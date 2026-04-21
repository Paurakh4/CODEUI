import { PublicProjectDetailClient } from "@/components/discover/public-project-detail-client"

interface DiscoverProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function DiscoverProjectPage({ params }: DiscoverProjectPageProps) {
  const { id } = await params

  return <PublicProjectDetailClient id={id} />
}
