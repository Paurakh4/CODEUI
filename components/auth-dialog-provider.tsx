"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { SignInDialog } from "@/components/sign-in-dialog";

interface AuthDialogContextType {
  showSignIn: () => void;
  hideSignIn: () => void;
}

const AuthDialogContext = createContext<AuthDialogContextType | undefined>(undefined);

export function useAuthDialog() {
  const context = useContext(AuthDialogContext);
  if (!context) {
    throw new Error("useAuthDialog must be used within AuthDialogProvider");
  }
  return context;
}

interface AuthDialogProviderProps {
  children: ReactNode;
}

export function AuthDialogProvider({ children }: AuthDialogProviderProps) {
  const [open, setOpen] = useState(false);

  const showSignIn = () => setOpen(true);
  const hideSignIn = () => setOpen(false);

  return (
    <AuthDialogContext.Provider value={{ showSignIn, hideSignIn }}>
      {children}
      <SignInDialog open={open} onOpenChange={setOpen} />
    </AuthDialogContext.Provider>
  );
}
