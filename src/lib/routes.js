/**
 * App routes:
 *   /                           home
 *   /docs[#section]             docs
 *   /pricing                    pricing table
 *   /project/:slug              project usage
 *   /project/:slug/chat/:id     one agent chat
 */
export const hrefHome = '/'
export const hrefDocs = (section) => '/docs' + (section ? '#' + section : '')
export const hrefPricing = '/pricing'
export const hrefProject = (slug) => '/project/' + encodeURIComponent(slug)
export const hrefChat = (slug, chatId) => hrefProject(slug) + '/chat/' + encodeURIComponent(chatId)

/** URL for opening a chat in a new window (same as hrefChat; kept for call sites). */
export const chatPageUrl = hrefChat

export function openChatPage(slug, chatId) {
  window.open(chatPageUrl(slug, chatId), '_blank', 'noopener,noreferrer')
}
