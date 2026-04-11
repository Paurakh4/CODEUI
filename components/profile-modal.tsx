"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  BadgeCheck,
  CreditCard,
  FolderKanban,
  Loader2,
  Mail,
  PencilLine,
  Sparkles,
  User,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.08,
        duration: 0.54,
        ease: [0.34, 1.56, 0.64, 1],
      },
    }),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] sm:max-w-[900px] border-border/40 bg-[#060608] p-0 text-[#E6E7E8] shadow-2xl overflow-hidden rounded-[24px]">
        <DialogTitle className="sr-only">Profile Settings</DialogTitle>
        <DialogDescription className="sr-only">Manage your profile and subscription</DialogDescription>
        
        <div className="flex flex-col md:flex-row min-h-[600px] max-h-[85vh]">
          {/* Left Navigation / Control Console */}
          <div className="w-full md:w-[280px] bg-[#08090A] border-r border-white/[0.04] flex flex-col relative z-10">
            {/* Soft edge highlight */}
            <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-white/[0.05] via-transparent to-transparent pointer-events-none" />
            
            <div className="p-6 pb-4">
              <h2 className="text-lg font-medium tracking-tight text-[#E6E7E8]">Control Panel</h2>
            </div>

            <div className="px-4 space-y-1 flex-1">
              <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] text-[#0AA6FF] relative group overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1 bg-[#0AA6FF] rounded-r-full shadow-[0_0_8px_#0AA6FF]" />
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Profile</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
              
              <button 
                onClick={() => onOpenChange(false)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#A6A6A6] hover:text-[#E6E7E8] hover:bg-white/[0.02] transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Close</span>
              </button>
            </div>

            {/* Profile Info Summary */}
            {profile && (
              <div className="p-6 border-t border-white/[0.04] mt-auto">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-1 ring-white/10 shadow-[0_0_15px_rgba(10,166,255,0.15)]">
                    {profile.image ? (
                      <AvatarImage src={profile.image} alt={profile.name} />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-br from-[#0AA6FF]/20 to-transparent text-[#0AA6FF] text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#E6E7E8]">
                      {profile.name}
                    </p>
                    <p className="truncate text-xs text-[#A6A6A6]">
                      {profile.email}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-[#060608] relative overflow-hidden">
            {/* Subtle background mesh/grid */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02] pointer-events-none" />
            
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="flex h-[600px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#0AA6FF]" />
                </div>
              ) : loadError || !profile ? (
                <div className="flex h-[600px] flex-col items-center justify-center gap-4 px-6 text-center">
                  <p className="max-w-md text-sm text-[#A6A6A6]">
                    {loadError || "Profile data is currently unavailable."}
                  </p>
                </div>
              ) : (
                <div className="p-8 md:p-10 space-y-8">
                  {/* Header */}
                  <motion.div 
                    custom={0}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                    className="flex flex-col md:flex-row md:items-end justify-between gap-4"
                  >
                    <div>
                      <h1 className="text-3xl font-semibold tracking-tight text-[#E6E7E8]">
                        Overview
                      </h1>
                      <p className="text-sm text-[#A6A6A6] mt-1">
                        Manage your account settings and preferences.
                      </p>
                    </div>
                    {isDirty && (
                      <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-[#0AA6FF] hover:bg-[#0AA6FF]/90 text-white shadow-[0_0_15px_rgba(10,166,255,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] rounded-xl font-medium"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Save Changes
                      </Button>
                    )}
                  </motion.div>

                  {/* Primary Profile Card */}
                  <motion.div 
                    custom={1}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                    className="relative group rounded-2xl bg-[#0F1113] border border-white/[0.04] p-6 shadow-xl backdrop-blur-xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                      <div className="relative">
                        <Avatar className="h-20 w-20 ring-2 ring-white/10 shadow-[0_0_20px_rgba(10,166,255,0.1)]">
                          {profile.image ? (
                            <AvatarImage src={profile.image} alt={profile.name} />
                          ) : null}
                          <AvatarFallback className="bg-gradient-to-br from-[#0AA6FF]/20 to-transparent text-[#0AA6FF] text-xl font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 bg-[#0F1113] rounded-full p-1 border border-white/[0.04]">
                          <BadgeCheck className="h-4 w-4 text-[#33D07A]" />
                        </div>
                      </div>

                      <div className="flex-1 space-y-4 w-full">
                        <div className="space-y-1">
                          <Label htmlFor="profile-name" className="text-[11px] font-semibold uppercase tracking-wider text-[#A6A6A6]">
                            Display Name
                          </Label>
                          <div className="relative max-w-sm">
                            <PencilLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A6A6A6]" />
                            <Input
                              id="profile-name"
                              value={displayName}
                              onChange={(event) => setDisplayName(event.target.value)}
                              className="border-white/[0.08] bg-[#0B0C0D] pl-10 text-[#E6E7E8] placeholder:text-[#A6A6A6] focus-visible:ring-[#0AA6FF] rounded-xl h-10 transition-all focus:bg-white/[0.02]"
                              placeholder="Your display name"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="hidden sm:flex flex-col gap-2 border-l border-white/[0.04] pl-6">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-[#A6A6A6]">Member Since</p>
                          <p className="text-sm font-medium tabular-nums text-[#E6E7E8] mt-0.5">
                            {new Date(profile.memberSince).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-[#A6A6A6]">Last Synced</p>
                          <p className="text-sm font-medium tabular-nums text-[#E6E7E8] mt-0.5">
                            {new Date(profile.lastUpdated).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* KPIs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Subscription Card */}
                    <motion.div 
                      custom={2}
                      initial="hidden"
                      animate="visible"
                      variants={cardVariants}
                      className="relative group rounded-2xl bg-[#0F1113] border border-white/[0.04] p-5 shadow-xl transition-all hover:-translate-y-1 hover:border-[#0AA6FF]/30"
                    >
                      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#0AA6FF]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#0AA6FF]/10 to-transparent border border-[#0AA6FF]/20">
                          <Sparkles className="h-3.5 w-3.5 text-[#0AA6FF]" />
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0AA6FF]">Plan</span>
                        </div>
                      </div>
                      <p className="text-2xl font-semibold tracking-tight text-[#E6E7E8]">{profile.subscription.tierName}</p>
                      <p className="text-sm text-[#A6A6A6] mt-1 tabular-nums">{profile.subscription.monthlyAllowance} monthly credits included</p>
                    </motion.div>

                    {/* Credits Card */}
                    <motion.div 
                      custom={3}
                      initial="hidden"
                      animate="visible"
                      variants={cardVariants}
                      className="relative group rounded-2xl bg-[#0F1113] border border-white/[0.04] p-5 shadow-xl transition-all hover:-translate-y-1 hover:border-white/10"
                    >
                      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.04]">
                          <CreditCard className="h-3.5 w-3.5 text-[#E6E7E8]" />
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A6A6A6]">Credits</span>
                        </div>
                      </div>
                      <p className="text-2xl font-semibold tracking-tight text-[#E6E7E8] tabular-nums">{profile.credits.totalCredits}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-[#A6A6A6] tabular-nums">{profile.credits.monthlyCredits} / mo</p>
                        <button onClick={showPricing} className="text-[11px] font-medium text-[#0AA6FF] hover:text-[#0AA6FF]/80 transition-colors uppercase tracking-wider">Top-up</button>
                      </div>
                    </motion.div>
                  </div>

                  {/* Recent Projects */}
                  <motion.div 
                    custom={4}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                    className="relative rounded-2xl bg-[#0F1113] border border-white/[0.04] p-6 shadow-xl"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.04]">
                        <FolderKanban className="h-3.5 w-3.5 text-[#E6E7E8]" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A6A6A6]">Projects</span>
                      </div>
                      <span className="text-sm font-medium text-[#A6A6A6] tabular-nums">{profile.projectCount} Total</span>
                    </div>

                    <div className="space-y-2">
                      {profile.recentProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-white/[0.08] bg-[#0B0C0D]">
                          <p className="text-sm text-[#A6A6A6]">No projects yet. Your next generated build will appear here.</p>
                        </div>
                      ) : (
                        profile.recentProjects.map((project, idx) => (
                          <motion.div
                            key={project.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + idx * 0.1 }}
                            className="flex items-center justify-between gap-4 rounded-xl bg-[#0B0C0D] border border-white/[0.04] p-4 hover:bg-white/[0.02] transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center justify-center text-lg">
                                {project.emoji || "🎨"}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#E6E7E8] group-hover:text-[#0AA6FF] transition-colors">
                                  {project.name}
                                </p>
                                <p className="text-xs text-[#A6A6A6] tabular-nums mt-0.5">
                                  Updated {new Date(project.updatedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <span className="rounded-full bg-white/[0.03] border border-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[#A6A6A6]">
                              {project.isPrivate ? "Private" : "Public"}
                            </span>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}