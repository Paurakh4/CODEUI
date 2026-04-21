import { DiscoverPageClient } from "@/components/discover/discover-page-client"
import { SITE_NAME } from "@/lib/site-config"

export const metadata = {
  title: `Discover | ${SITE_NAME}`,
  description: "Browse public CodeUI projects from the community.",
}

export default function DiscoverPage() {
  return <DiscoverPageClient />
}
