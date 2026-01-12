"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, User } from "lucide-react";
import { SignInDialog } from "@/components/sign-in-dialog";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [showSignInDialog, setShowSignInDialog] = useState(false);

  if (status === "loading") {
    return (
      <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
    );
  }

  if (!session) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSignInDialog(true)}
          className="gap-2 h-6"
        >
          <User className="h-3.5 w-3.5" />
          Sign In
        </Button>
        <SignInDialog 
          open={showSignInDialog} 
          onOpenChange={setShowSignInDialog}
        />
      </>
    );
  }

  const initials = session.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-6 w-6 rounded-full">
          <Avatar className="h-6 w-6">
            {session.user?.image && (
              <AvatarImage
                src={session.user.image}
                alt={session.user?.name || "User"}
              />
            )}
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {session.user?.name}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {session.user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
