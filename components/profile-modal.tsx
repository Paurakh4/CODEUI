"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BadgeCheck,
  CreditCard,
  FolderKanban,
  Loader2,
  Mail,
  PencilLine,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountModals } from "@/components/account-modal-provider";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileResponse["profile"] | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

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

        if (cancelled) {
          return;
        }

        setProfile(data.profile);
        setDisplayName(data.profile.name);
      } catch (error) {
        console.error("Failed to load profile:", error);
        if (!cancelled) {
          setLoadError("We couldn't load your profile details right now.");
          toast({
            title: "Profile unavailable",
            description: "We couldn't load your profile details right now.",
            variant: "destructive",
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

    if (!profile || !trimmedName || trimmedName === profile.name) {
      return;
    }

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
      toast({
        title: "Profile updated",
        description: "Your display name has been saved.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast({
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "We couldn't save your profile changes.",
        variant: "destructive",
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
      <DialogContent className="max-w-3xl border-white/10 bg-zinc-950 p-0 text-zinc-100 sm:max-w-3xl">
        <DialogHeader className="border-b border-white/10 px-6 py-5 text-left">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Profile
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Review your account details, subscription status, and recent work.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : loadError || !profile ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="max-w-md text-sm text-zinc-400">
                {loadError || "Profile data is currently unavailable."}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16 border border-white/10">
                      {profile.image ? (
                        <AvatarImage src={profile.image} alt={profile.name} />
                      ) : null}
                      <AvatarFallback className="bg-zinc-800 text-lg font-semibold text-zinc-100">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <BadgeCheck className="h-4 w-4 text-emerald-400" />
                        Google account connected
                      </div>
                      <h3 className="truncate text-xl font-semibold text-zinc-50">
                        {profile.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{profile.email}</span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Avatar is managed by Google for this account.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <Label htmlFor="profile-name" className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Display Name
                    </Label>
                    <div className="relative">
                      <PencilLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="profile-name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        className="border-white/10 bg-zinc-900 pl-10 text-zinc-100 placeholder:text-zinc-500"
                        placeholder="Your display name"
                      />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-zinc-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Member Since
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-100">
                        {new Date(profile.memberSince).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-zinc-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Last Synced
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-100">
                        {new Date(profile.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                      <Sparkles className="h-4 w-4" />
                      Subscription
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {profile.subscription.tierName}
                    </p>
                    <p className="mt-1 text-sm text-emerald-100/80">
                      {profile.subscription.monthlyAllowance} monthly credits included
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                        <CreditCard className="h-4 w-4" />
                        Available Credits
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-zinc-50">
                        {profile.credits.totalCredits}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {profile.credits.monthlyCredits} monthly credits and {profile.credits.topupCredits} top-up credits
                      </p>
                      <Button
                        type="button"
                        variant="link"
                        onClick={showPricing}
                        className="mt-2 h-auto p-0 text-xs text-emerald-300 hover:text-emerald-200"
                      >
                        Buy top-up credits
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                        <FolderKanban className="h-4 w-4" />
                        Projects
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-zinc-50">
                        {profile.projectCount}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {profile.credits.totalCreditsUsed} credits used lifetime
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Recent Projects
                    </h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      Your latest active workspaces.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {profile.recentProjects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950/80 px-4 py-6 text-sm text-zinc-500">
                      No projects yet. Your next generated build will appear here.
                    </div>
                  ) : (
                    profile.recentProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg leading-none">
                              {project.emoji || "🎨"}
                            </span>
                            <p className="truncate text-sm font-medium text-zinc-100">
                              {project.name}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            Updated {new Date(project.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                          {project.isPrivate ? "Private" : "Public"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t border-white/10 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving || isLoading}
            className="bg-white text-black hover:bg-zinc-200"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}