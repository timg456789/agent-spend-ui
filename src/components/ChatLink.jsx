'use client'

import { chatPageUrl, openChatPage } from '@/lib/routes'

export function ChatTitle({ name }) {
  const n = (name || '').trim()
  return n ? n : <span className="muted">Untitled chat</span>
}

/** Table cell: chat title (opens in a new window) + explicit new-window icon. */
export function ChatNameCell({ slug, chatId, name }) {
  return (
    <td className="chat-link-cell">
      <span className="chat-link-inner">
        <button
          type="button"
          className="linkish"
          onClick={(e) => {
            e.stopPropagation()
            openChatPage(slug, chatId)
          }}
        >
          <ChatTitle name={name} />
        </button>
        <a
          className="open-chat-icon"
          href={chatPageUrl(slug, chatId)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open chat in new window"
          title="Open in new window"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </span>
    </td>
  )
}
