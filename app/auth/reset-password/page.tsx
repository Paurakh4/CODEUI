import { Suspense } from "react";
import { ResetPasswordCard } from "@/components/auth-recovery";

function ResetPasswordFallback() {
  return (
    <div className="text-muted-foreground">Loading password reset form...</div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={<ResetPasswordFallback />}>
        <ResetPasswordCard />
      </Suspense>
    </div>
  );
}