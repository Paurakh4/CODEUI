"use client";

import { usePathname } from "next/navigation";
import { PageTransition } from "./page-transition";

export function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <PageTransition pageKey={pathname} variant="slideUp" className="min-h-screen w-full flex-col flex">
      {children}
    </PageTransition>
  );
}