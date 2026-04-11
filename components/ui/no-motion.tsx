"use client";

import * as React from "react";

type MotionDivProps = React.ComponentPropsWithoutRef<"div"> & {
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  variants?: unknown;
  transition?: unknown;
  custom?: unknown;
  whileInView?: unknown;
  viewport?: unknown;
};

const MotionDiv = React.forwardRef<HTMLDivElement, MotionDivProps>(
  (
    {
      initial: _initial,
      animate: _animate,
      exit: _exit,
      variants: _variants,
      transition: _transition,
      custom: _custom,
      whileInView: _whileInView,
      viewport: _viewport,
      ...props
    },
    ref,
  ) => <div ref={ref} {...props} />,
);

MotionDiv.displayName = "MotionDiv";

export const motion = {
  div: MotionDiv,
};

export function AnimatePresence({ children }: { children: React.ReactNode; mode?: unknown }) {
  return <>{children}</>;
}

export type Variants = Record<string, unknown>;