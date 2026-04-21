export const SITE_NAME = "CodeUI"

export const SITE_LINKS = {
  documentation: "/docs",
  privacyPolicy: "/legal/privacy",
  termsOfService: "/legal/terms",
  github: process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/",
  discover: "/discover",
} as const

export const FOOTER_LINKS = [
  { label: "Documentation", href: SITE_LINKS.documentation },
  { label: "Privacy Policy", href: SITE_LINKS.privacyPolicy },
  { label: "Terms of Service", href: SITE_LINKS.termsOfService },
  { label: "GitHub", href: SITE_LINKS.github, external: true },
] as const
