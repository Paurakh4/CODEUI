import type { Variants } from "framer-motion"

const easeSmooth = [0.23, 1, 0.32, 1] as const

export const modalContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: easeSmooth,
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
}

export const modalItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: easeSmooth,
    },
  },
}

export const modalHeaderVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: easeSmooth,
    },
  },
}
