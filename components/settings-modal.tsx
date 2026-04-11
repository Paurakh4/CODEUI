"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Loader2, Mailbox, Palette, Shield, Sparkles, User, Settings, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

  const [activeTab, setActiveTab] = useState("appearance");

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

  const selectedPrimaryColor = getColorValue(draft.primaryColor);
  const selectedSecondaryColor = getColorValue(
    draft.secondaryColor as UserPreferences["primaryColor"]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] sm:max-w-[900px] border-border/40 bg-[#060608] p-0 text-[#E6E7E8] shadow-2xl overflow-hidden rounded-[24px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Sync your appearance, AI defaults, and account preferences.</DialogDescription>

        <div className="flex flex-col md:flex-row min-h-[600px] max-h-[85vh]">
          {/* Left Navigation / Control Console */}
          <div className="w-full md:w-[280px] bg-[#08090A] border-r border-white/[0.04] flex flex-col relative z-10">
            <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-white/[0.05] via-transparent to-transparent pointer-events-none" />
            
            <div className="p-6 pb-4">
              <h2 className="text-lg font-medium tracking-tight text-[#E6E7E8]">Settings</h2>
            </div>

            <div className="px-4 space-y-1 flex-1">
              {[
                { id: "appearance", label: "Appearance", icon: Palette },
                { id: "ai", label: "AI Defaults", icon: Sparkles },
                { id: "preferences", label: "Preferences", icon: Settings }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all relative group overflow-hidden ${
                    activeTab === tab.id 
                      ? "bg-white/[0.03] text-[#0AA6FF]" 
                      : "text-[#A6A6A6] hover:text-[#E6E7E8] hover:bg-white/[0.02]"
                  }`}
                >
                  {activeTab === tab.id && (
                    <div className="absolute inset-y-0 left-0 w-1 bg-[#0AA6FF] rounded-r-full shadow-[0_0_8px_#0AA6FF]" />
                  )}
                  <div className="flex items-center gap-3">
                    <tab.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-white/[0.04]">
               <button 
                onClick={() => onOpenChange(false)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[#A6A6A6] hover:text-[#E6E7E8] hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-sm font-medium">Close</span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-[#060608] relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02] pointer-events-none" />
            
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#0AA6FF]" />
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-8 md:p-10">
                  <motion.div 
                    custom={0}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                    className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8"
                  >
                    <div>
                      <h1 className="text-3xl font-semibold tracking-tight text-[#E6E7E8] capitalize">
                        {activeTab === "ai" ? "AI Defaults" : activeTab}
                      </h1>
                      <p className="text-sm text-[#A6A6A6] mt-1">
                        Manage your {activeTab} preferences.
                      </p>
                    </div>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-[#0AA6FF] hover:bg-[#0AA6FF]/90 text-white shadow-[0_0_15px_rgba(10,166,255,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] rounded-xl font-medium"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Save Settings
                    </Button>
                  </motion.div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      {activeTab === "appearance" && (
                        <div className="space-y-6">
                          <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants} className="rounded-2xl bg-[#0F1113] border border-white/[0.04] p-6 shadow-xl">
                            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[#A6A6A6]">
                              Theme Mode
                            </Label>
                            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#0B0C0D] border border-white/[0.04] p-1.5">
                              {(["dark", "light"] as const).map((themeOption) => (
                                <button
                                  key={themeOption}
                                  type="button"
                                  onClick={() => setDraft((current) => ({ ...current, theme: themeOption }))}
                                  className={cn(
                                    "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium capitalize transition-all",
                                    draft.theme === themeOption
                                      ? "bg-white/[0.06] text-[#E6E7E8] shadow-sm"
                                      : "text-[#A6A6A6] hover:text-[#E6E7E8] hover:bg-white/[0.02]"
                                  )}
                                >
                                  {themeOption}
                                </button>
                              ))}
                            </div>
                          </motion.div>

                          <div className="grid gap-6 lg:grid-cols-2">
                            <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants} className="rounded-2xl bg-[#0F1113] border border-white/[0.04] p-6 shadow-xl">
                              <div className="flex items-center justify-between mb-4">
                                <Label className="text-[11px] font-semibold uppercase tracking-wider text-[#A6A6A6]">
                                  Primary Color
                                </Label>
                                <div className="h-6 w-6 rounded-md shadow-inner" style={{ backgroundColor: selectedPrimaryColor?.value }} />
                              </div>
                              <div className="grid grid-cols-5 sm:grid-cols-7 gap-3">
                                {USER_PREFERENCE_COLORS.map((color) => (
                                  <button
                                    key={`primary-${color.name}`}
                                    type="button"
                                    title={color.name}
                                    onClick={() => setDraft((current) => ({ ...current, primaryColor: color.name }))}
                                    className={cn(
                                      "h-8 w-8 rounded-full transition-all hover:scale-110 flex items-center justify-center",
                                      draft.primaryColor === color.name && "ring-2 ring-white/20 ring-offset-2 ring-offset-[#0F1113]"
                                    )}
                                    style={{ backgroundColor: color.value }}
                                  >
                                    {draft.primaryColor === color.name && <CheckCircle2 className="w-4 h-4 text-white drop-shadow-md" />}
                                  </button>
                                ))}
                              </div>
                            </motion.div>

                            <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants} className="rounded-2xl bg-[#0F1113] border border-white/[0.04] p-6 shadow-xl">
                              <div className="flex items-center justify-between mb-4">
                                <Label className="text-[11px] font-semibold uppercase tracking-wider text-[#A6A6A6]">
                                  Secondary Color
                                </Label>
                                <div className="h-6 w-6 rounded-md shadow-inner" style={{ backgroundColor: selectedSecondaryColor?.value }} />
                              </div>
                              <div className="grid grid-cols-5 sm:grid-cols-7 gap-3">
                                {USER_PREFERENCE_COLORS.map((color) => (
                                  <button
                                    key={`secondary-${color.name}`}
                                    type="button"
                                    title={color.name}
                                    onClick={() => setDraft((current) => ({ ...current, secondaryColor: color.name }))}
                                    className={cn(
                                      "h-8 w-8 rounded-full transition-all hover:scale-110 flex items-center justify-center",
                                      draft.secondaryColor === color.name && "ring-2 ring-white/20 ring-offset-2 ring-offset-[#0F1113]"
                                    )}
                                    style={{ backgroundColor: color.value }}
                                  >
                                    {draft.secondaryColor === color.name && <CheckCircle2 className="w-4 h-4 text-white drop-shadow-md" />}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          </div>

                          <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants} className="rounded-2xl bg-[#0F1113] border border-white/[0.04] p-6 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                            <div className="flex items-center gap-2 mb-4">
                              <Palette className="h-4 w-4 text-[#A6A6A6]" />
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A6A6A6]">Live Preview</span>
                            </div>
                            <div
                              className="rounded-xl p-6 text-white shadow-inner"
                              style={{ background: `linear-gradient(135deg, ${selectedPrimaryColor?.value} 0%, ${selectedSecondaryColor?.dark} 100%)` }}
                            >
                              <p className="text-[11px] uppercase tracking-wider text-white/70">Workspace Accent</p>
                              <p className="mt-2 text-2xl font-semibold tracking-tight">CodeUI Custom</p>
                              <p className="mt-1 text-sm text-white/80 max-w-md">Your selected colors will be applied across the interface.</p>
                            </div>
                          </motion.div>
                        </div>
                      )}

                      {activeTab === "ai" && (
                        <div className="space-y-6">
                          <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants} className="rounded-2xl bg-[#0F1113] border border-white/[0.04] p-6 shadow-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-[#0AA6FF]" />
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0AA6FF]">Default Model</span>
                            </div>
                            <p className="text-sm text-[#A6A6A6] mb-6">Select the AI model that powers your generations by default.</p>
                            <div className="bg-[#0B0C0D] p-1 rounded-xl border border-white/[0.04]">
                              <ModelSelector
                                selectedModel={draft.defaultModel}
                                onModelChange={(modelId) => setDraft((current) => ({ ...current, defaultModel: modelId }))}
                              />
                            </div>
                          </motion.div>

                          <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants} className="rounded-2xl bg-[#0F1113] border border-white/[0.04] p-6 shadow-xl">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <Label className="text-sm font-medium text-[#E6E7E8]">Enhanced Prompts</Label>
                                <p className="mt-1 text-sm text-[#A6A6A6]">Automatically enrich your prompts for better results.</p>
                              </div>
                              <Switch
                                checked={draft.enhancedPrompts}
                                onCheckedChange={(checked) => setDraft((current) => ({ ...current, enhancedPrompts: checked }))}
                                className="data-[state=checked]:bg-[#0AA6FF]"
                              />
                            </div>
                          </motion.div>
                        </div>
                      )}

                      {activeTab === "preferences" && (
                        <div className="space-y-6">
                          <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants} className="rounded-2xl bg-[#0F1113] border border-white/[0.04] p-6 shadow-xl">
                            <div className="flex items-center gap-2 mb-6">
                              <Mailbox className="h-4 w-4 text-[#A6A6A6]" />
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A6A6A6]">Communications</span>
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#0B0C0D] border border-white/[0.04]">
                                <div>
                                  <Label className="text-sm font-medium text-[#E6E7E8]">Product Updates</Label>
                                  <p className="mt-1 text-sm text-[#A6A6A6]">Receive release notes and feature announcements.</p>
                                </div>
                                <Switch
                                  checked={draft.contactPreferences.productUpdates}
                                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, contactPreferences: { ...current.contactPreferences, productUpdates: checked } }))}
                                  className="data-[state=checked]:bg-[#0AA6FF]"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#0B0C0D] border border-white/[0.04]">
                                <div>
                                  <Label className="text-sm font-medium text-[#E6E7E8]">Marketing Emails</Label>
                                  <p className="mt-1 text-sm text-[#A6A6A6]">Hear about experiments and special offers.</p>
                                </div>
                                <Switch
                                  checked={draft.contactPreferences.marketingEmails}
                                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, contactPreferences: { ...current.contactPreferences, marketingEmails: checked } }))}
                                  className="data-[state=checked]:bg-[#0AA6FF]"
                                />
                              </div>
                            </div>
                          </motion.div>

                          <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants} className="rounded-2xl bg-[#0F1113] border border-white/[0.04] p-6 shadow-xl">
                            <div className="flex items-center gap-2 mb-6">
                              <Shield className="h-4 w-4 text-[#A6A6A6]" />
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A6A6A6]">Privacy</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#0B0C0D] border border-white/[0.04]">
                              <div>
                                <Label className="text-sm font-medium text-[#E6E7E8]">Private Projects by Default</Label>
                                <p className="mt-1 text-sm text-[#A6A6A6]">New projects will be created as private automatically.</p>
                              </div>
                              <Switch
                                checked={draft.privacyPreferences.privateProjectsByDefault}
                                onCheckedChange={(checked) => setDraft((current) => ({ ...current, privacyPreferences: { ...current.privacyPreferences, privateProjectsByDefault: checked } }))}
                                className="data-[state=checked]:bg-[#0AA6FF]"
                              />
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}