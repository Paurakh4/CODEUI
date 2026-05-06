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
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
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
          toast({
            title: "Settings unavailable",
            description: "Using your current editor defaults for now.",
            variant: "destructive",
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

      toast({
        title: "Settings updated",
        description: "Your preferences are now synced to your account.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "Save failed",
        description:
          error instanceof Error
            ? error.message
            : "We couldn't save your settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-xl bg-background border-border p-0 rounded-2xl"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Sync your appearance, AI defaults, and account preferences.
        </DialogDescription>

        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[85vh]">
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-foreground">
                  Settings
                </h1>
                <Button onClick={handleSave} disabled={isSaving} size="sm">
                  {isSaving && (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  )}
                  Save
                </Button>
              </div>

              <Tabs defaultValue="appearance">
                <TabsList className="w-full">
                  <TabsTrigger value="appearance" className="flex-1 gap-1.5">
                    <Palette className="h-3.5 w-3.5" />
                    Appearance
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="flex-1 gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Defaults
                  </TabsTrigger>
                  <TabsTrigger value="preferences" className="flex-1 gap-1.5">
                    <Settings className="h-3.5 w-3.5" />
                    Preferences
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="appearance" className="space-y-4 mt-4">
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <Label className="text-xs text-muted-foreground font-medium">
                      Theme
                    </Label>
                    <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1">
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
                            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all",
                            draft.theme === themeOption
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {themeOption}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <Label className="text-xs text-muted-foreground font-medium">
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
                              "ring-2 ring-ring ring-offset-1 ring-offset-background"
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

                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <Label className="text-xs text-muted-foreground font-medium">
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
                              "ring-2 ring-ring ring-offset-1 ring-offset-background"
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
                </TabsContent>

                <TabsContent value="ai" className="space-y-4 mt-4">
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <Label className="text-xs text-muted-foreground font-medium">
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

                <TabsContent value="preferences" className="space-y-4 mt-4">
                  <div className="rounded-lg border border-border divide-y divide-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <Label className="text-sm text-foreground cursor-pointer">
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
                      <Label className="text-sm text-foreground cursor-pointer">
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
                      <Label className="text-sm text-foreground cursor-pointer">
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
              </Tabs>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
