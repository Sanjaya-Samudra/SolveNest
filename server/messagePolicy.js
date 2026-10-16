const blockedPatterns = [
  { code: 'DIRECT_CONTACT', pattern: /(?:\b(?:email|e-mail|mail)\b.{0,24}\b(?:me|us)\b|\b(?:whats?app|telegram|discord|signal|wechat)\b|(?:https?:\/\/|www\.)\S+)/i },
  { code: 'OFF_PLATFORM_PAYMENT', pattern: /\b(?:pay|payment|bank transfer|wire|crypto|bitcoin|paypal|wise|revolut)\b.{0,36}\b(?:direct|outside|off[- ]?platform|privately|personal)\b/i },
  { code: 'CONTACT_DETAILS', pattern: /(?:\+?\d[\d\s().-]{8,}\d|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i },
]

export function moderateTaskMessage(value) {
  const body = String(value || '').trim()
  if (!body) return { allowed: true, body }
  const match = blockedPatterns.find((rule) => rule.pattern.test(body))
  return match ? { allowed: false, code: match.code, body } : { allowed: true, body }
}
