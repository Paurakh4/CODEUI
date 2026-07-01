"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Camera,
  Loader2,
  PencilLine,
} from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAccountModals } from "@/components/account-modal-provider";
import { toast } from "sonner";
import {
  modalContainerVariants,
  modalItemVariants,
  modalHeaderVariants,
} from "@/lib/modal-animations";

function formatRelativeDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const inputDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffDays = Math.floor((today.getTime() - inputDate.getTime()) / 86400000);

  if (inputDate.getTime() === today.getTime()) return "today";
  if (inputDate.getTime() === yesterday.getTime()) return "yesterday";
  if (diffDays <= 7) return `${diffDays} days ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntilNextMonth(): number {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((nextMonth.getTime() - now.getTime()) / 86400000);
}

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileResponse {
  profile: {
    name: string;
    email: string;
    image: string | null;
    memberSince: string;
    lastUpdated: string;
    projectCount: number;
    subscription: {
      tier: string;
      tierName: string;
      monthlyAllowance: number;
    };
    credits: {
      monthlyCredits: number;
      topupCredits: number;
      totalCredits: number;
      totalCreditsUsed: number;
    };
    recentProjects: Array<{
      id: string;
      name: string;
      emoji?: string;
      updatedAt: string;
      isPrivate: boolean;
    }>;
  };
}

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { update: updateSession } = useSession();
  const { showPricing } = useAccountModals();
  const [profile, setProfile] = useState<ProfileResponse["profile"] | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadProfile = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch("/api/user/profile", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load profile");
        }

        const data = (await response.json()) as ProfileResponse;

        if (cancelled) return;

        setProfile(data.profile);
        setDisplayName(data.profile.name);
      } catch (error) {
        console.error("Failed to load profile:", error);
        if (!cancelled) {
          setLoadError("We couldn't load your profile details right now.");
          toast.error("Profile unavailable", {
            description: "We couldn't load your profile details right now.",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  const handleSave = async () => {
    const trimmedName = displayName.trim();

    if (!profile || !trimmedName || trimmedName === profile.name) return;

    setIsSaving(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setProfile((current) =>
        current
          ? {
            ...current,
            name: data.profile.name,
            email: data.profile.email,
            image: data.profile.image,
          }
          : current
      );
      setDisplayName(data.profile.name);
      await updateSession();
      toast.success("Profile updated", {
        description: "Your display name has been saved.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Update failed", {
        description:
          error instanceof Error
            ? error.message
            : "We couldn't save your profile changes.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const initials =
    profile?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";
  const isDirty = profile ? displayName.trim() !== profile.name : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-xl bg-[#0E0E10] border-white/[0.06] p-0 rounded-xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <DialogTitle className="sr-only">Profile Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your profile and subscription
        </DialogDescription>

        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[#6B6B70]" />
          </div>
        ) : loadError || !profile ? (
          <div className="flex h-[320px] flex-col items-center justify-center px-6 text-center">
            <p className="text-[13px] text-[#9B9B9F]">
              {loadError || "Profile data is currently unavailable."}
            </p>
          </div>
        ) : (
          <motion.div
            variants={modalContainerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-white/[0.04]">
              <div className="p-5 space-y-5">
                {/* Header */}
                <motion.div variants={modalHeaderVariants}>
                  <h1 className="text-lg font-bold tracking-tight text-[#E7E7E9]">
                    Profile
                  </h1>
                  <p className="text-[11px] text-[#9B9B9F] mt-0.5">
                    Manage your display name and account details.
                  </p>
                </motion.div>

                {/* Avatar + Name */}
                <motion.div variants={modalItemVariants} className="flex items-center gap-3">
                  <button type="button" className="group relative shrink-0 rounded-full">
                    <Avatar className="h-10 w-10 ring-2 ring-white/[0.06]">
                      {profile.image ? (
                        <AvatarImage src={profile.image} alt={profile.name} />
                      ) : null}
                      <AvatarFallback className="bg-[#1B1B1F] text-[#9B9B9F] text-xs font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="h-3.5 w-3.5 text-white/80" />
                    </div>
                  </button>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#E7E7E9] truncate">
                      {profile.name}
                    </p>
                    <p className="text-[11px] text-[#6B6B70] truncate">
                      {profile.email}
                    </p>
                  </div>
                </motion.div>

                {/* Display Name Input */}
                <motion.div variants={modalItemVariants} className="relative">
                  <PencilLine className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B6B70]" />
                  <Input
                    id="profile-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="pl-9 h-10 text-[13px] bg-[#0E0E10] border-white/[0.06] text-[#E7E7E9] placeholder:text-[#6B6B70] rounded-lg focus-visible:ring-white/20"
                    placeholder="Display name"
                  />
                </motion.div>

                {/* Merged Plan + Credits card */}
                <motion.div variants={modalItemVariants} className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-4">
                  <p className="text-[10px] text-[#6B6B70] uppercase tracking-[0.05em] font-medium mb-1">
                    Current plan
                  </p>
                  <p className="text-base font-semibold text-[#E7E7E9]">
                    {profile.subscription.tierName}
                  </p>
                  <p className="text-[13px] text-[#9B9B9F] mt-1 tabular-nums">
                    {profile.credits.totalCredits} available
                  </p>
                  <p className="text-[11px] text-[#6B6B70] mt-0.5">
                    Resets in {daysUntilNextMonth()} days
                  </p>
                  <button
                    onClick={showPricing}
                    className="mt-2 text-[11px] font-medium text-[#E7E7E9] hover:text-white transition-colors"
                  >
                    {profile.subscription.tier === "free" ? "Upgrade plan →" : "Manage subscription →"}
                  </button>
                </motion.div>

                {/* Recent Projects */}
                <motion.div variants={modalItemVariants}>
                  <p className="text-[10px] text-[#6B6B70] uppercase tracking-[0.05em] font-medium mb-2">
                    Recent Projects
                  </p>
                  <div className="space-y-1">
                    {profile.recentProjects.length === 0 ? (
                      <p className="text-[11px] text-[#6B6B70] py-4 text-center">
                        No projects yet
                      </p>
                    ) : (
                      profile.recentProjects.map((project) => (
                        <div
                          key={project.id}
                          className="rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 py-2.5 hover:border-white/[0.08] transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm shrink-0">
                              {project.emoji || "🎨"}
                            </span>
                            <span className="text-[13px] text-[#E7E7E9] truncate">
                              {project.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 pl-7">
                            <span className="text-[11px] text-[#6B6B70]">
                              Edited {formatRelativeDate(project.updatedAt)}
                            </span>
                            <span className="text-[10px] text-[#6B6B70]">·</span>
                            <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#6B6B70]">
                              {project.isPrivate ? "Private" : "Public"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Sticky footer (only when dirty) */}
            {isDirty && (
              <motion.div
                variants={modalItemVariants}
                className="border-t border-white/[0.04] px-5 py-3 flex justify-end"
              >
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  size="sm"
                  className="h-8 text-[12px] rounded-lg bg-white text-black hover:bg-[#E7E7E9] font-medium"
                >
                  {isSaving && (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  )}
                  Save
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
