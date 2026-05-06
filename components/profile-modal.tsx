"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Loader2,
  PencilLine,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <DialogContent
        showCloseButton
        className="sm:max-w-xl bg-background border-border p-0 rounded-2xl"
      >
        <DialogTitle className="sr-only">Profile Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your profile and subscription
        </DialogDescription>

        <ScrollArea className="max-h-[85vh]">
          {isLoading ? (
            <div className="flex h-[320px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : loadError || !profile ? (
            <div className="flex h-[320px] flex-col items-center justify-center px-6 text-center">
              <p className="text-sm text-muted-foreground">
                {loadError || "Profile data is currently unavailable."}
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-foreground">
                  Profile
                </h1>
                {isDirty && (
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="sm"
                  >
                    {isSaving && (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    )}
                    Save
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  {profile.image ? (
                    <AvatarImage src={profile.image} alt={profile.name} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {profile.email}
                  </p>
                </div>
              </div>

              <div className="relative">
                <PencilLine className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="pl-9 h-9 text-sm"
                  placeholder="Display name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Plan</p>
                  <p className="text-base font-semibold text-foreground">
                    {profile.subscription.tierName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                    {profile.subscription.monthlyAllowance}/mo
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Credits</p>
                  <p className="text-base font-semibold text-foreground tabular-nums">
                    {profile.credits.totalCredits}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {profile.credits.monthlyCredits}/mo
                    </p>
                    <button
                      onClick={showPricing}
                      className="text-xs font-medium text-foreground hover:underline"
                    >
                      Top-up
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Projects
                </p>
                <div className="space-y-1">
                  {profile.recentProjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No projects
                    </p>
                  ) : (
                    profile.recentProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0">
                            {project.emoji || "🎨"}
                          </span>
                          <span className="text-sm text-foreground truncate">
                            {project.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </span>
                          <span
                            className={`text-[10px] font-medium uppercase ${
                              project.isPrivate
                                ? "text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {project.isPrivate ? "Pvt" : "Pub"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
