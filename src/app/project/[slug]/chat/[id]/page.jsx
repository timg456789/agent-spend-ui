import ChatPage from '@/views/ChatPage'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Agent chat' }

export default async function Page({ params }) {
  const { slug, id } = await params
  return <ChatPage key={slug + '/' + id} slug={slug} chatId={id} />
}
