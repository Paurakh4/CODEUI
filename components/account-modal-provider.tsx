"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { ProfileModal } from "@/components/profile-modal";
import { PricingModal } from "@/components/pricing-modal";
import { SettingsModal } from "@/components/settings-modal";
import type { SubscriptionTier } from "@/lib/pricing";

interface AccountModalContextValue {
  showProfile: () => void;
  hideProfile: () => void;
  showPricing: () => void;
  hidePricing: () => void;
  showSettings: () => void;
  hideSettings: () => void;
}

const AccountModalContext = createContext<AccountModalContextValue | undefined>(undefined);

export function useAccountModals() {
  const context = useContext(AccountModalContext);

  if (!context) {
    throw new Error("useAccountModals must be used within AccountModalProvider");
  }

  return context;
}

interface AccountModalProviderProps {
  children: ReactNode;
}

export function AccountModalProvider({ children }: AccountModalProviderProps) {
  const { data: session } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const currentTier = ((session?.user as { subscription?: SubscriptionTier } | undefined)?.subscription ?? "free") as SubscriptionTier;

  const value = useMemo<AccountModalContextValue>(
    () => ({
      showProfile: () => {
        setPricingOpen(false);
        setSettingsOpen(false);
        setProfileOpen(true);
      },
      hideProfile: () => setProfileOpen(false),
      showPricing: () => {
        setProfileOpen(false);
        setSettingsOpen(false);
        setPricingOpen(true);
      },
      hidePricing: () => setPricingOpen(false),
      showSettings: () => {
        setPricingOpen(false);
        setProfileOpen(false);
        setSettingsOpen(true);
      },
      hideSettings: () => setSettingsOpen(false),
    }),
    []
  );

  return (
    <AccountModalContext.Provider value={value}>
      {children}
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} currentTier={currentTier} />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </AccountModalContext.Provider>
  );
}