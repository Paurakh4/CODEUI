"use client";

import Link from "next/link";
import { AuthMethods } from "@/components/auth-methods";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SITE_LINKS } from "@/lib/site-config";

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0a0a0a] border border-[#414141]/80 rounded-[8px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-[#ffffff] font-sans">
        <DialogHeader className="space-y-4">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-[#faff69] text-[#151515] rounded-[4px] flex items-center justify-center text-[20px] font-black">
              C
            </div>
          </div>
          <DialogTitle className="text-[32px] font-black text-center tracking-tight leading-none text-white">
            ENTER THE <span className="text-[#faff69]">COCKPIT.</span>
          </DialogTitle>
          <DialogDescription className="text-center text-[#a0a0a0] text-[16px] font-medium leading-[1.5]">
            Sign in to unleash the database-grade AI UI engine.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-6">
          <AuthMethods
            appearance="dialog"
            onSuccess={() => onOpenChange(false)}
          />
          
          <p className="text-[12px] text-center text-[#585858] font-medium leading-[1.6]">
            By continuing, you initialize the engine according to the <br/>
            <Link href={SITE_LINKS.termsOfService} className="text-[#a0a0a0] hover:text-[#faff69] transition-colors">Terms of Service</Link> and <Link href={SITE_LINKS.privacyPolicy} className="text-[#a0a0a0] hover:text-[#faff69] transition-colors">Privacy Policy</Link>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
