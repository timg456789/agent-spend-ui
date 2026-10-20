import './globals.css'
import { AppShell } from '@/components/AppShell'

export const metadata = {
  title: { default: 'Agent Spend', template: '%s · Agent Spend' },
  description: 'See what your Cursor agent chats cost — locally, by project, model, month, day, and chat.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
