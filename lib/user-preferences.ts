import { getDefaultModelId, isModelEnabled } from "@/lib/ai-models";

export const USER_THEME_OPTIONS = ["light", "dark"] as const;
export type UserTheme = (typeof USER_THEME_OPTIONS)[number];

export const USER_PREFERENCE_COLORS = [
  { name: "slate", value: "#64748b", dark: "#1e293b" },
  { name: "gray", value: "#6b7280", dark: "#1f2937" },
  { name: "zinc", value: "#71717a", dark: "#27272a" },
  { name: "neutral", value: "#737373", dark: "#262626" },
  { name: "stone", value: "#78716c", dark: "#292524" },
  { name: "red", value: "#ef4444", dark: "#991b1b" },
  { name: "orange", value: "#f97316", dark: "#9a3412" },
  { name: "amber", value: "#f59e0b", dark: "#92400e" },
  { name: "yellow", value: "#eab308", dark: "#854d0e" },
  { name: "lime", value: "#84cc16", dark: "#3f6212" },
  { name: "green", value: "#22c55e", dark: "#166534" },
  { name: "emerald", value: "#10b981", dark: "#065f46" },
  { name: "teal", value: "#14b8a6", dark: "#115e59" },
  { name: "cyan", value: "#06b6d4", dark: "#155e75" },
  { name: "sky", value: "#0ea5e9", dark: "#075985" },
  { name: "blue", value: "#3b82f6", dark: "#1e40af" },
  { name: "indigo", value: "#6366f1", dark: "#3730a3" },
  { name: "violet", value: "#8b5cf6", dark: "#5b21b6" },
  { name: "purple", value: "#a855f7", dark: "#7e22ce" },
  { name: "fuchsia", value: "#d946ef", dark: "#a21caf" },
  { name: "pink", value: "#ec4899", dark: "#9d174d" },
  { name: "rose", value: "#f43f5e", dark: "#9f1239" },
] as const;

export const USER_PREFERENCE_COLOR_NAMES = USER_PREFERENCE_COLORS.map(
  (color) => color.name
) as [
  (typeof USER_PREFERENCE_COLORS)[number]["name"],
  ...(typeof USER_PREFERENCE_COLORS)[number]["name"][]
];

export interface ContactPreferences {
  productUpdates: boolean;
  marketingEmails: boolean;
}

export interface PrivacyPreferences {
  privateProjectsByDefault: boolean;
}

export interface UserPreferences {
  theme: UserTheme;
  primaryColor: (typeof USER_PREFERENCE_COLOR_NAMES)[number];
  secondaryColor: (typeof USER_PREFERENCE_COLOR_NAMES)[number];
  defaultModel: string;
  enhancedPrompts: boolean;
  contactPreferences: ContactPreferences;
  privacyPreferences: PrivacyPreferences;
}

export function createDefaultUserPreferences(): UserPreferences {
  return {
    theme: "dark",
    primaryColor: "blue",
    secondaryColor: "slate",
    defaultModel: getDefaultModelId(),
    enhancedPrompts: false,
    contactPreferences: {
      productUpdates: true,
      marketingEmails: false,
    },
    privacyPreferences: {
      privateProjectsByDefault: true,
    },
  };
}

export function normalizeUserPreferences(
  preferences?: Partial<UserPreferences> | null
): UserPreferences {
  const defaults = createDefaultUserPreferences();
  const primaryColor = USER_PREFERENCE_COLOR_NAMES.includes(
    preferences?.primaryColor as (typeof USER_PREFERENCE_COLOR_NAMES)[number]
  )
    ? (preferences?.primaryColor as UserPreferences["primaryColor"])
    : defaults.primaryColor;
  const secondaryColor = USER_PREFERENCE_COLOR_NAMES.includes(
    preferences?.secondaryColor as (typeof USER_PREFERENCE_COLOR_NAMES)[number]
  )
    ? (preferences?.secondaryColor as UserPreferences["secondaryColor"])
    : defaults.secondaryColor;

  return {
    ...defaults,
    ...preferences,
    theme:
      preferences?.theme && USER_THEME_OPTIONS.includes(preferences.theme)
        ? preferences.theme
        : defaults.theme,
    primaryColor,
    secondaryColor,
    defaultModel:
      preferences?.defaultModel && isModelEnabled(preferences.defaultModel)
        ? preferences.defaultModel
        : defaults.defaultModel,
    enhancedPrompts:
      typeof preferences?.enhancedPrompts === "boolean"
        ? preferences.enhancedPrompts
        : defaults.enhancedPrompts,
    contactPreferences: {
      ...defaults.contactPreferences,
      ...preferences?.contactPreferences,
    },
    privacyPreferences: {
      ...defaults.privacyPreferences,
      ...preferences?.privacyPreferences,
    },
  };
}