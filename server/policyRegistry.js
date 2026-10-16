import crypto from 'node:crypto'

const version = process.env.ACTIVE_POLICY_VERSION || '2026-10-17'
const policies = [
  { id: 'terms', title: 'Terms of Use', version },
  { id: 'privacy', title: 'Privacy Notice', version },
  { id: 'integrity', title: 'Academic Integrity', version },
]

export function activePolicies() {
  return policies.map((policy) => ({ ...policy, contentHash: crypto.createHash('sha256').update(`${policy.id}:${policy.title}:${policy.version}`).digest('hex') }))
}

export function validatePolicyConsents(consents) {
  if (!Array.isArray(consents)) return false
  const submitted = new Map(consents.map((item) => [String(item?.id || ''), item]))
  return activePolicies().every((policy) => {
    const consent = submitted.get(policy.id)
    return consent && consent.version === policy.version && consent.contentHash === policy.contentHash && !Number.isNaN(Date.parse(consent.acceptedAt))
  })
}
