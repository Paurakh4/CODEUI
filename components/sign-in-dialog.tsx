"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AuthMethods } from "@/components/auth-methods";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SITE_LINKS } from "@/lib/site-config";
import {
  modalContainerVariants,
  modalItemVariants,
  modalHeaderVariants,
} from "@/lib/modal-animations";

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-[#0a0a0a] border border-[#414141]/80 rounded-[8px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-[#ffffff] font-sans">
        <motion.div
          variants={modalContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <DialogHeader className="space-y-1">
            <motion.div variants={modalHeaderVariants}>
              <DialogTitle className="text-[20px] font-black text-center tracking-tight text-white">
                Sign in
              </DialogTitle>
              <DialogDescription className="text-center text-[#a0a0a0] text-[13px] font-medium">
                to continue to CodeUI
              </DialogDescription>
            </motion.div>
          </DialogHeader>

          <motion.div variants={modalItemVariants} className="flex flex-col gap-4 pt-2">
            <AuthMethods
              appearance="dialog"
              onSuccess={() => onOpenChange(false)}
            />

            <p className="text-[11px] text-center text-[#585858] font-medium">
              By continuing, you agree to the{" "}
              <Link href={SITE_LINKS.termsOfService} className="text-[#a0a0a0] hover:text-[#faff69] transition-colors">Terms of Service</Link>{" "}and{" "}
              <Link href={SITE_LINKS.privacyPolicy} className="text-[#a0a0a0] hover:text-[#faff69] transition-colors">Privacy Policy</Link>.
            </p>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
