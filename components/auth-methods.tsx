"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthAppearance = "page" | "dialog";
type AuthMode = "signin" | "register";

interface AuthMethodsProps {
  appearance?: AuthAppearance;
  onSuccess?: () => void;
}

const appearanceCopy: Record<
  AuthAppearance,
  {
    divider: string;
    googleLabel: string;
    submitLabel: Record<AuthMode, string>;
    toggleLabel: Record<AuthMode, string>;
  }
> = {
  page: {
    divider: "Or continue with email",
    googleLabel: "Continue with Google",
    submitLabel: {
      signin: "Sign In",
      register: "Create Account",
    },
    toggleLabel: {
      signin: "Need an account? Create one",
      register: "Already have an account? Sign in",
    },
  },
  dialog: {
    divider: "Secure Sector",
    googleLabel: "AUTHENTICATE",
    submitLabel: {
      signin: "EMAIL ACCESS",
      register: "CREATE ACCOUNT",
    },
    toggleLabel: {
      signin: "Create a local account",
      register: "Use an existing account",
    },
  },
};

const appearanceStyles: Record<
  AuthAppearance,
  {
    googleButton: string;
    dividerText: string;
    label: string;
    input: string;
    submitButton: string;
    toggleButton: string;
    feedback: string;
    hint: string;
  }
> = {
  page: {
    googleButton: "w-full gap-2",
    dividerText:
      "bg-background px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground",
    label: "text-sm text-foreground",
    input: "h-10",
    submitButton: "w-full",
    toggleButton:
      "h-auto w-full px-0 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground",
    feedback:
      "flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive",
    hint: "text-xs text-muted-foreground",
  },
  dialog: {
    googleButton:
      "group relative h-12 w-full justify-center gap-3 overflow-hidden rounded-[4px] border border-[#414141]/80 bg-[#141414] px-6 text-[16px] font-bold text-[#ffffff] hover:bg-[#3a3a3a] hover:border-[#faff69]/50 active:text-[#f4f692]",
    dividerText:
      "bg-[#0a0a0a] px-4 text-[12px] font-bold uppercase tracking-[1.4px] text-[#a0a0a0]",
    label:
      "text-[12px] font-bold uppercase tracking-[1.4px] text-[#a0a0a0]",
    input:
      "h-11 rounded-[4px] border-[#414141]/80 bg-[#141414] px-4 text-[#ffffff] placeholder:text-[#666666] focus-visible:border-[#faff69]/60 focus-visible:ring-[#faff69]/15 hover:border-[#666666]",
    submitButton:
      "h-11 w-full rounded-[4px] bg-[#faff69] text-[15px] font-black text-[#151515] hover:bg-[#f2ff31] active:bg-[#dce800]",
    toggleButton:
      "h-auto w-full px-0 text-[13px] font-bold uppercase tracking-[0.08em] text-[#a0a0a0] hover:bg-transparent hover:text-[#faff69]",
    feedback:
      "flex items-start gap-2 rounded-[4px] border border-[#7c3030] bg-[#2b1111] px-3 py-2 text-[13px] text-[#ffb4b4]",
    hint: "text-[11px] uppercase tracking-[0.08em] text-[#666666]",
  },
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "Request failed";
  } catch {
    return "Request failed";
  }
}

export function AuthMethods({
  appearance = "page",
  onSuccess,
}: AuthMethodsProps) {
  const copy = appearanceCopy[appearance];
  const styles = appearanceStyles[appearance];
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegisterMode = mode === "register";

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (signInError) {
      console.error("Failed to start Google sign-in:", signInError);
      setError("Google sign-in could not be started.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCredentialsSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isRegisterMode) {
        const registerResponse = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        if (!registerResponse.ok) {
          setError(await readErrorMessage(registerResponse));
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (!result || result.error) {
        setError(
          isRegisterMode
            ? "Account created, but automatic sign-in failed. Try signing in again."
            : "Invalid email or password."
        );
        return;
      }

      onSuccess?.();
      router.push(result.url ?? "/dashboard");
      router.refresh();
    } catch (submitError) {
      console.error("Credentials auth failed:", submitError);
      setError(
        isRegisterMode
          ? "Failed to create your account."
          : "Failed to sign in."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Button
        type="button"
        variant={appearance === "dialog" ? "outline" : "default"}
        className={styles.googleButton}
        onClick={handleGoogleSignIn}
        disabled={isSubmitting}
      >
        {appearance === "dialog" ? (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
        ) : null}
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span className="relative">{copy.googleLabel}</span>
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60 dark:border-white/10" />
        </div>
        <div className="relative flex justify-center">
          <span className={styles.dividerText}>{copy.divider}</span>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleCredentialsSubmit}>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={`${appearance}-email`} className={styles.label}>
              Email
            </Label>
            <span className={styles.hint}>8+ character password</span>
          </div>
          <Input
            id={`${appearance}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className={styles.input}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${appearance}-password`} className={styles.label}>
            Password
          </Label>
          <Input
            id={`${appearance}-password`}
            type="password"
            autoComplete={isRegisterMode ? "new-password" : "current-password"}
            placeholder={
              isRegisterMode ? "Create a password" : "Enter your password"
            }
            minLength={8}
            maxLength={72}
            className={styles.input}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        {!isRegisterMode ? (
          <div className="flex justify-end">
            <Link
              href="/auth/forgot-password"
              className={
                appearance === "dialog"
                  ? "text-[12px] font-bold uppercase tracking-[0.08em] text-[#a0a0a0] transition-colors hover:text-[#faff69]"
                  : "text-sm text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              Forgot password?
            </Link>
          </div>
        ) : null}

        {error ? (
          <div className={styles.feedback} role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <Button
          type="submit"
          className={styles.submitButton}
          disabled={isSubmitting}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {copy.submitLabel[mode]}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className={styles.toggleButton}
          onClick={() => {
            setMode(isRegisterMode ? "signin" : "register");
            setError(null);
          }}
          disabled={isSubmitting}
        >
          {copy.toggleLabel[mode]}
        </Button>
      </form>
    </div>
  );
}