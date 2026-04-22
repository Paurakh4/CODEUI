import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthMethods } from "@/components/auth-methods";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function resolveSafeCallbackPath(callbackUrl?: string) {
  if (!callbackUrl) {
    return "/dashboard";
  }

  if (callbackUrl.startsWith("/")) {
    return callbackUrl.startsWith("/auth/signin") ? "/dashboard" : callbackUrl;
  }

  try {
    const url = new URL(callbackUrl);
    const nextPath = `${url.pathname}${url.search}${url.hash}` || "/dashboard";

    return nextPath.startsWith("/auth/signin") ? "/dashboard" : nextPath;
  } catch {
    return "/dashboard";
  }
}

interface SignInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = Array.isArray(params.callbackUrl)
    ? params.callbackUrl[0]
    : params.callbackUrl;

  if (session) {
    redirect(resolveSafeCallbackPath(callbackUrl));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Welcome to CodeUI
          </CardTitle>
          <CardDescription>
            Sign in with Google or a simple email and password account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthMethods appearance="page" />
        </CardContent>
      </Card>
    </div>
  );
}
