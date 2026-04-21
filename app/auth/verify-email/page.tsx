import { Suspense } from "react";
import { VerifyEmailCard } from "@/components/auth-recovery";

function VerifyEmailFallback() {
  return <div className="text-muted-foreground">Verifying your email...</div>;
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={<VerifyEmailFallback />}>
        <VerifyEmailCard />
      </Suspense>
    </div>
  );
}