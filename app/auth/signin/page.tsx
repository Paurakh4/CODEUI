import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthMethods } from "@/components/auth-methods";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SignInPage() {
  const session = await auth();

  if (session) {
    redirect("/");
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
