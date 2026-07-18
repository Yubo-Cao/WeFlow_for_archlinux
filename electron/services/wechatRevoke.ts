import type { Message } from './chatService'

export function normalizeMessageIdToken(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const numeric = /^-?\d+$/.test(raw) ? raw.replace(/^-/, '').replace(/^0+(?=\d)/, '') : raw
  return numeric === '0' ? '' : numeric
}

export function isRevokeSystemMessage(message: Message): boolean {
  const localType = Number(message.localType || 0)
  const content = `${message.rawContent || ''}\n${message.parsedContent || ''}`
  if (content.includes('revokemsg') || content.includes('<replacemsg')) return true
  if (content.includes('撤回了一条消息') || content.includes('尝试撤回此消息')) return true
  return (localType === 10000 || localType === 10002) && content.includes('撤回')
}

/** Only structured revoke XML is authoritative; the system row's own ids are never candidates. */
export function extractRevokedPlatformMessageId(message: Message): string | undefined {
  const content = `${message.rawContent || ''}\n${message.parsedContent || ''}`
  for (const tag of ['newmsgid', 'msgid', 'oldmsgid', 'svrid']) {
    const normalized = normalizeMessageIdToken(extractXmlValue(content, tag))
    if (normalized) return normalized
  }
  return undefined
}

export function extractRevokerUsername(message: Message): string | undefined {
  const content = String(message.rawContent || '')
  for (const candidate of [extractXmlValue(content, 'fromusername'), extractXmlValue(content, 'session'), message.senderUsername]) {
    const normalized = String(candidate || '').trim()
    if (normalized) return normalized
  }
  return undefined
}

export function messageIdTokens(message: Message): Set<string> {
  const tokens = new Set<string>()
  for (const candidate of [message.serverIdRaw, message.serverId, message.localId]) {
    const normalized = normalizeMessageIdToken(candidate)
    if (normalized) tokens.add(normalized)
  }
  return tokens
}

export function findExactRevokedOriginal(
  messages: Message[],
  revokeMessage: Message,
  revokedMessageId = extractRevokedPlatformMessageId(revokeMessage)
): Message | undefined {
  const target = normalizeMessageIdToken(revokedMessageId)
  if (!target) return undefined
  return messages.find((message) =>
    message.messageKey !== revokeMessage.messageKey
    && !isRevokeSystemMessage(message)
    && normalizeMessageIdToken(message.serverIdRaw) === target
  )
}

function extractXmlValue(xml: string, tagName: string): string {
  const decoded = String(xml || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i')
  const match = regex.exec(decoded)
  return match ? match[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim() : ''
}
