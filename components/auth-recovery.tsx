"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthResponse {
  success?: boolean;
  error?: string;
  debugUrl?: string;
}

async function readAuthResponse(response: Response): Promise<AuthResponse> {
  try {
    return (await response.json()) as AuthResponse;
  } catch {
    return {
      error: "Request failed",
    };
  }
}

function AuthStatusMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const className =
    tone === "error"
      ? "flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      : "flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300";

  return (
    <div className={className} role={tone === "error" ? "alert" : "status"}>
      {tone === "error" ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function ForgotPasswordCard() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    setDebugUrl(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const body = await readAuthResponse(response);

      if (!response.ok) {
        setError(body.error || "Failed to request a password reset.");
        return;
      }

      setSuccess(
        "If an account exists for this email, a password reset link has been sent."
      );
      setDebugUrl(body.debugUrl || null);
    } catch (submitError) {
      console.error("Forgot password request failed:", submitError);
      setError("Failed to request a password reset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="forgot-password-email">Email</Label>
            <Input
              id="forgot-password-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {error ? (
            <AuthStatusMessage tone="error">
              <span>{error}</span>
            </AuthStatusMessage>
          ) : null}

          {success ? (
            <AuthStatusMessage tone="success">
              <span>{success}</span>
              {debugUrl ? (
                <Link className="underline" href={debugUrl}>
                  Open the local development reset link
                </Link>
              ) : null}
            </AuthStatusMessage>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send reset link
          </Button>
        </form>

        <Button asChild variant="outline" className="w-full">
          <Link href="/auth/signin">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordCard() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("This password reset link is missing a token.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const body = await readAuthResponse(response);

      if (!response.ok) {
        setError(body.error || "Failed to reset your password.");
        return;
      }

      setSuccess("Your password has been reset. You can sign in now.");
      setPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      console.error("Reset password request failed:", submitError);
      setError("Failed to reset your password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Choose a new password</CardTitle>
        <CardDescription>
          Enter a new password for your CodeUI account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token ? (
          <AuthStatusMessage tone="error">
            <span>This password reset link is missing a token.</span>
          </AuthStatusMessage>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                placeholder="Create a new password"
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-password-confirm">Confirm password</Label>
              <Input
                id="reset-password-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                minLength={8}
                maxLength={72}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {error ? (
              <AuthStatusMessage tone="error">
                <span>{error}</span>
              </AuthStatusMessage>
            ) : null}

            {success ? (
              <AuthStatusMessage tone="success">
                <span>{success}</span>
              </AuthStatusMessage>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reset password
            </Button>
          </form>
        )}

        <Button asChild variant="outline" className="w-full">
          <Link href="/auth/signin">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function VerifyEmailCard() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    let isCancelled = false;

    async function verifyEmail() {
      if (!token) {
        setStatus("error");
        setMessage("This email verification link is missing a token.");
        return;
      }

      try {
        const response = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
          {
            cache: "no-store",
          }
        );
        const body = await readAuthResponse(response);

        if (isCancelled) {
          return;
        }

        if (!response.ok) {
          setStatus("error");
          setMessage(body.error || "Failed to verify your email.");
          return;
        }

        setStatus("success");
        setMessage("Your email has been verified.");
      } catch (verifyError) {
        console.error("Email verification failed:", verifyError);
        if (!isCancelled) {
          setStatus("error");
          setMessage("Failed to verify your email.");
        }
      }
    }

    verifyEmail();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {status === "loading" ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : status === "success" ? (
            <MailCheck className="h-6 w-6 text-emerald-500" />
          ) : (
            <AlertCircle className="h-6 w-6 text-destructive" />
          )}
        </div>
        <CardTitle className="text-2xl font-bold">Email verification</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button asChild className="w-full">
          <Link href="/auth/signin">Go to sign in</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}