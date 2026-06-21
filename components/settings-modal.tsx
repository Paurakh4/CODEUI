"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Palette,
  Sparkles,
  Settings,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ModelSelector } from "@/components/model-selector";
import { useEditor } from "@/stores/editor-store";
import {
  USER_PREFERENCE_COLORS,
  createDefaultUserPreferences,
  type UserPreferences,
} from "@/lib/user-preferences";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SettingsResponse {
  settings: UserPreferences;
}

function getDraftFromEditor(state: ReturnType<typeof useEditor>["state"]): UserPreferences {
  return {
    ...createDefaultUserPreferences(),
    theme: state.theme,
    primaryColor: state.primaryColor as UserPreferences["primaryColor"],
    secondaryColor: state.secondaryColor as UserPreferences["primaryColor"],
    defaultModel: state.selectedModel,
  };
}

function getColorValue(name: UserPreferences["primaryColor"]) {
  return USER_PREFERENCE_COLORS.find((color) => color.name === name);
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { state, setModel, setPrimaryColor, setSecondaryColor, setTheme } = useEditor();
  const [draft, setDraft] = useState<UserPreferences>(getDraftFromEditor(state));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { theme, primaryColor, secondaryColor, selectedModel } = state;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadSettings = async () => {
      setDraft({
        ...createDefaultUserPreferences(),
        theme,
        primaryColor: primaryColor as UserPreferences["primaryColor"],
        secondaryColor: secondaryColor as UserPreferences["primaryColor"],
        defaultModel: selectedModel,
      });
      setIsLoading(true);

      try {
        const response = await fetch("/api/user/settings", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load settings");
        }

        const data = (await response.json()) as SettingsResponse;

        if (!cancelled) {
          setDraft(data.settings);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        if (!cancelled) {
          toast.error("Settings unavailable", {
            description: "Using your current editor defaults for now.",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [open, primaryColor, secondaryColor, selectedModel, theme, toast]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      const savedSettings = data.settings as UserPreferences;

      setTheme(savedSettings.theme);
      setPrimaryColor(savedSettings.primaryColor);
      setSecondaryColor(savedSettings.secondaryColor);
      setModel(savedSettings.defaultModel);
      setDraft(savedSettings);

      toast.success("Settings updated", {
        description: "Your preferences are now synced to your account.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Save failed", {
        description:
          error instanceof Error
            ? error.message
            : "We couldn't save your settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-xl bg-[#0E0E10] border-white/[0.06] p-0 rounded-xl overflow-hidden"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Sync your appearance, AI defaults, and account preferences.
        </DialogDescription>

        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[#6B6B70]" />
          </div>
        ) : (
          <ScrollArea className="max-h-[85vh]">
            <div className="p-5 space-y-5">
              {/* Header */}
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[#E7E7E9]">
                  Settings
                </h1>
                <p className="text-[11px] text-[#9B9B9F] mt-0.5">
                  Sync your appearance, AI defaults, and preferences.
                </p>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="appearance">
                <TabsList className="w-full bg-[#0E0E10] border border-white/[0.04] rounded-lg p-0.5 h-auto">
                  <TabsTrigger
                    value="appearance"
                    className="flex-1 gap-1.5 h-7 text-[11px] data-[state=active]:bg-[#1B1B1F] data-[state=active]:text-[#E7E7E9] text-[#9B9B9F] rounded-md border-0"
                  >
                    <Palette className="h-3 w-3" />
                    Appearance
                  </TabsTrigger>
                  <TabsTrigger
                    value="ai"
                    className="flex-1 gap-1.5 h-7 text-[11px] data-[state=active]:bg-[#1B1B1F] data-[state=active]:text-[#E7E7E9] text-[#9B9B9F] rounded-md border-0"
                  >
                    <Sparkles className="h-3 w-3" />
                    AI Defaults
                  </TabsTrigger>
                  <TabsTrigger
                    value="preferences"
                    className="flex-1 gap-1.5 h-7 text-[11px] data-[state=active]:bg-[#1B1B1F] data-[state=active]:text-[#E7E7E9] text-[#9B9B9F] rounded-md border-0"
                  >
                    <Settings className="h-3 w-3" />
                    Preferences
                  </TabsTrigger>
                </TabsList>

                <div className="relative mt-4">
                  <TabsContent forceMount value="appearance"
                    className="transition-all duration-200 ease-out data-[state=active]:opacity-100 data-[state=active]:translate-y-0 data-[state=inactive]:opacity-0 data-[state=inactive]:translate-y-1 data-[state=inactive]:pointer-events-none data-[state=inactive]:absolute data-[state=inactive]:inset-x-0"
                  >
                    <div className="space-y-3">
                      {/* Theme */}
                      <div className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-4 space-y-3">
                        <Label className="text-[11px] text-[#9B9B9F] font-medium uppercase tracking-[0.05em]">
                          Theme
                        </Label>
                        <div className="flex items-center gap-1.5 rounded-lg bg-[#0E0E10] border border-white/[0.04] p-0.5">
                          {(["dark", "light"] as const).map((themeOption) => (
                            <button
                              key={themeOption}
                              type="button"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  theme: themeOption,
                                }))
                              }
                              className={cn(
                                "flex-1 rounded-md px-3 py-1.5 text-[11px] font-medium capitalize transition-all",
                                draft.theme === themeOption
                                  ? "bg-[#1B1B1F] text-[#E7E7E9]"
                                  : "text-[#6B6B70] hover:text-[#9B9B9F]"
                              )}
                            >
                              {themeOption}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Primary Color */}
                      <div className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-4 space-y-3">
                        <Label className="text-[11px] text-[#9B9B9F] font-medium uppercase tracking-[0.05em]">
                          Primary
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {USER_PREFERENCE_COLORS.map((color) => (
                            <button
                              key={`primary-${color.name}`}
                              type="button"
                              title={color.name}
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  primaryColor: color.name,
                                }))
                              }
                              className={cn(
                                "h-6 w-6 rounded-full transition-all hover:scale-110 flex items-center justify-center",
                                draft.primaryColor === color.name &&
                                  "ring-2 ring-white ring-offset-2 ring-offset-[#0E0E10]"
                              )}
                              style={{ backgroundColor: color.value }}
                            >
                              {draft.primaryColor === color.name && (
                                <CheckCircle2 className="h-3 w-3 text-white drop-shadow-sm" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Secondary Color */}
                      <div className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-4 space-y-3">
                        <Label className="text-[11px] text-[#9B9B9F] font-medium uppercase tracking-[0.05em]">
                          Secondary
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {USER_PREFERENCE_COLORS.map((color) => (
                            <button
                              key={`secondary-${color.name}`}
                              type="button"
                              title={color.name}
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  secondaryColor: color.name,
                                }))
                              }
                              className={cn(
                                "h-6 w-6 rounded-full transition-all hover:scale-110 flex items-center justify-center",
                                draft.secondaryColor === color.name &&
                                  "ring-2 ring-white ring-offset-2 ring-offset-[#0E0E10]"
                              )}
                              style={{ backgroundColor: color.value }}
                            >
                              {draft.secondaryColor === color.name && (
                                <CheckCircle2 className="h-3 w-3 text-white drop-shadow-sm" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent forceMount value="ai"
                    className="transition-all duration-200 ease-out data-[state=active]:opacity-100 data-[state=active]:translate-y-0 data-[state=inactive]:opacity-0 data-[state=inactive]:translate-y-1 data-[state=inactive]:pointer-events-none data-[state=inactive]:absolute data-[state=inactive]:inset-x-0"
                  >
                    <div className="rounded-lg border border-white/[0.04] bg-[#0E0E10] p-4 space-y-3">
                      <Label className="text-[11px] text-[#9B9B9F] font-medium uppercase tracking-[0.05em]">
                        Default Model
                      </Label>
                      <ModelSelector
                        selectedModel={draft.defaultModel}
                        onModelChange={(modelId) =>
                          setDraft((current) => ({
                            ...current,
                            defaultModel: modelId,
                          }))
                        }
                      />
                    </div>
                  </TabsContent>

                  <TabsContent forceMount value="preferences"
                    className="transition-all duration-200 ease-out data-[state=active]:opacity-100 data-[state=active]:translate-y-0 data-[state=inactive]:opacity-0 data-[state=inactive]:translate-y-1 data-[state=inactive]:pointer-events-none data-[state=inactive]:absolute data-[state=inactive]:inset-x-0"
                  >
                    <div className="rounded-lg border border-white/[0.04] bg-[#0E0E10] divide-y divide-white/[0.04]">
                      <div className="flex items-center justify-between px-4 py-3">
                        <Label className="text-[13px] text-[#E7E7E9] cursor-pointer font-normal">
                          Product Updates
                        </Label>
                        <Switch
                          checked={draft.contactPreferences.productUpdates}
                          onCheckedChange={(checked) =>
                            setDraft((current) => ({
                              ...current,
                              contactPreferences: {
                                ...current.contactPreferences,
                                productUpdates: checked,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between px-4 py-3">
                        <Label className="text-[13px] text-[#E7E7E9] cursor-pointer font-normal">
                          Marketing Emails
                        </Label>
                        <Switch
                          checked={draft.contactPreferences.marketingEmails}
                          onCheckedChange={(checked) =>
                            setDraft((current) => ({
                              ...current,
                              contactPreferences: {
                                ...current.contactPreferences,
                                marketingEmails: checked,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between px-4 py-3">
                        <Label className="text-[13px] text-[#E7E7E9] cursor-pointer font-normal">
                          Private Projects
                        </Label>
                        <Switch
                          checked={draft.privacyPreferences.privateProjectsByDefault}
                          onCheckedChange={(checked) =>
                            setDraft((current) => ({
                              ...current,
                              privacyPreferences: {
                                ...current.privacyPreferences,
                                privateProjectsByDefault: checked,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>

              {/* Save button at the end */}
              <div className="pt-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  size="sm"
                  className="h-7 text-[11px] rounded-lg bg-white text-black hover:bg-[#E7E7E9] font-medium"
                >
                  {isSaving && (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
