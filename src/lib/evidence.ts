import type { EvidenceBasis } from '../types'

export const verificationLabels = { unverified: '미확인', tentative: '예정', confirmed: '확정', legacy: '기존 등록 · 근거 재확인' }
export function validBasis(basis?: EvidenceBasis | null): boolean {
  if (!basis || !Number.isFinite(Date.parse(basis.checkedAt)) || Date.parse(basis.checkedAt) > Date.now() + 60000) return false
  if (basis.source === 'gmail') return /^[a-f0-9]{12,32}$/i.test(basis.reference) || /^https:\/\/mail\.google\.com\/mail\/u\/\d+\/#(?:all|inbox|sent)\/[A-Za-z0-9]{12,256}$/.test(basis.reference)
  return basis.source === 'teams' && /^https:\/\/teams\.microsoft\.com\/l\/message\/[^/?#\s]+\/\d+$/.test(basis.reference)
}
export function evidenceUrl(basis?: EvidenceBasis | null) {
  if (!validBasis(basis)) return undefined
  return basis!.source === 'gmail' && !basis!.reference.startsWith('https://') ? `https://mail.google.com/mail/u/0/#all/${basis!.reference}` : basis!.reference
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value
}
