"use client";

import { useEffect, useState } from "react";
import { Loader2, Mailbox, Palette, Shield, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    secondaryColor: state.secondaryColor as UserPreferences["secondaryColor"],
    defaultModel: state.selectedModel,
    enhancedPrompts: state.enhancedPrompts,
  };
}

function getColorValue(name: UserPreferences["primaryColor"]) {
  return USER_PREFERENCE_COLORS.find((color) => color.name === name);
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { state, setModel, setPrimaryColor, setSecondaryColor, setTheme, setEnhancedPrompts } = useEditor();
  const { toast } = useToast();
  const [draft, setDraft] = useState<UserPreferences>(getDraftFromEditor(state));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const {
    theme,
    primaryColor,
    secondaryColor,
    selectedModel,
    enhancedPrompts,
  } = state;

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      setDraft({
        ...createDefaultUserPreferences(),
        theme,
        primaryColor: primaryColor as UserPreferences["primaryColor"],
        secondaryColor: secondaryColor as UserPreferences["secondaryColor"],
        defaultModel: selectedModel,
        enhancedPrompts,
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
  }, [
    enhancedPrompts,
    open,
    primaryColor,
    secondaryColor,
    selectedModel,
    theme,
    toast,
  ]);

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
      setEnhancedPrompts(savedSettings.enhancedPrompts);
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

  const selectedPrimaryColor = getColorValue(draft.primaryColor);
  const selectedSecondaryColor = getColorValue(
    draft.secondaryColor as UserPreferences["primaryColor"]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-white/10 bg-zinc-950 p-0 text-zinc-100 sm:max-w-4xl">
        <DialogHeader className="border-b border-white/10 px-6 py-5 text-left">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Settings
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Sync your appearance, AI defaults, and account preferences across sessions.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <Tabs defaultValue="appearance" className="min-h-[520px]">
            <div className="border-b border-white/10 px-6 py-4">
              <TabsList className="bg-zinc-900 text-zinc-400">
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
                <TabsTrigger value="ai">AI Defaults</TabsTrigger>
                <TabsTrigger value="preferences">Preferences</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="max-h-[60vh] px-6 py-6">
              <TabsContent value="appearance" className="mt-0 space-y-6">
                <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
                  <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Theme
                  </Label>
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/80 p-1">
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
                          "flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors",
                          draft.theme === themeOption
                            ? "bg-zinc-800 text-zinc-100"
                            : "text-zinc-500 hover:text-zinc-200"
                        )}
                      >
                        {themeOption}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Primary Color
                      </Label>
                      <div
                        className="h-6 w-6 rounded-md border border-white/10"
                        style={{ backgroundColor: selectedPrimaryColor?.value }}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-11">
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
                            "h-7 w-7 rounded-md transition-transform hover:scale-110",
                            draft.primaryColor === color.name &&
                              "ring-2 ring-white ring-offset-2 ring-offset-zinc-950"
                          )}
                          style={{ backgroundColor: color.value }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Secondary Color
                      </Label>
                      <div
                        className="h-6 w-6 rounded-md border border-white/10"
                        style={{ backgroundColor: selectedSecondaryColor?.value }}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-11">
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
                            "h-7 w-7 rounded-md transition-transform hover:scale-110",
                            draft.secondaryColor === color.name &&
                              "ring-2 ring-white ring-offset-2 ring-offset-zinc-950"
                          )}
                          style={{ backgroundColor: color.value }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    <Palette className="h-4 w-4" />
                    Preview
                  </div>
                  <div
                    className="mt-4 rounded-2xl border border-white/10 p-5 text-white"
                    style={{
                      background: `linear-gradient(135deg, ${selectedPrimaryColor?.value} 0%, ${selectedSecondaryColor?.dark} 100%)`,
                    }}
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                      Workspace Accent Preview
                    </p>
                    <p className="mt-2 text-2xl font-semibold">CodeUI Preferences</p>
                    <p className="mt-1 max-w-md text-sm text-white/80">
                      Keep the same visual system available everywhere you sign in.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="mt-0 space-y-6">
                <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    <Sparkles className="h-4 w-4" />
                    Default Model
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    This becomes your default starting model each time you open the editor.
                  </p>
                  <div className="mt-4">
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
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
                    <div>
                      <Label className="text-sm font-medium text-zinc-100">
                        Enhanced Prompts
                      </Label>
                      <p className="mt-1 text-sm text-zinc-400">
                        Start generations with richer prompting guidance turned on.
                      </p>
                    </div>
                    <Switch
                      checked={draft.enhancedPrompts}
                      onCheckedChange={(checked) =>
                        setDraft((current) => ({
                          ...current,
                          enhancedPrompts: checked,
                        }))
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preferences" className="mt-0 space-y-6">
                <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    <Mailbox className="h-4 w-4" />
                    Contact Preferences
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
                      <div>
                        <Label className="text-sm font-medium text-zinc-100">
                          Product Updates
                        </Label>
                        <p className="mt-1 text-sm text-zinc-400">
                          Receive release notes and important product changes.
                        </p>
                      </div>
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
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
                      <div>
                        <Label className="text-sm font-medium text-zinc-100">
                          Marketing Emails
                        </Label>
                        <p className="mt-1 text-sm text-zinc-400">
                          Hear about launches, experiments, and special offers.
                        </p>
                      </div>
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
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    <Shield className="h-4 w-4" />
                    Privacy
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
                    <div>
                      <Label className="text-sm font-medium text-zinc-100">
                        Private Projects by Default
                      </Label>
                      <p className="mt-1 text-sm text-zinc-400">
                        New projects inherit this privacy setting unless you override it manually.
                      </p>
                    </div>
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
            </ScrollArea>
          </Tabs>
        )}

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
            disabled={isSaving || isLoading}
            className="bg-white text-black hover:bg-zinc-200"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}