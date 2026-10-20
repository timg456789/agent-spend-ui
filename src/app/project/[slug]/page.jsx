import ProjectPage from '@/views/ProjectPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { slug } = await params
  return { title: slug }
}

export default async function Page({ params }) {
  const { slug } = await params
  return <ProjectPage key={slug} slug={slug} />
}
