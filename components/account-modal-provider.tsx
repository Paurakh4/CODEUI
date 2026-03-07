"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ProfileModal } from "@/components/profile-modal";
import { SettingsModal } from "@/components/settings-modal";

interface AccountModalContextValue {
  showProfile: () => void;
  hideProfile: () => void;
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const value = useMemo<AccountModalContextValue>(
    () => ({
      showProfile: () => {
        setSettingsOpen(false);
        setProfileOpen(true);
      },
      hideProfile: () => setProfileOpen(false),
      showSettings: () => {
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
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </AccountModalContext.Provider>
  );
}