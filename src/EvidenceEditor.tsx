import type { EvidenceBasis } from './types'
import { evidenceUrl, validBasis } from './lib/evidence'

export function EvidenceEditor({ label, value, onChange }: { label: string; value?: EvidenceBasis | null; onChange: (basis: EvidenceBasis | null) => void }) {
  const basis = value ?? { source: 'gmail' as const, reference: '', checkedAt: '' }
  const url = evidenceUrl(basis)
  return <fieldset className="evidence-editor"><legend>{label}</legend>
    <div className="assignment-fields"><label>근거 출처<select value={basis.source} onChange={e => onChange({ ...basis, source: e.target.value as EvidenceBasis['source'], reference: '', checkedAt: '' })}><option value="gmail">Gmail</option><option value="teams">Teams</option></select></label>
      <label>확인 근거 링크<input value={basis.reference} placeholder={basis.source === 'gmail' ? 'Gmail 메시지 링크 또는 ID' : 'Teams 메시지 링크 (쿼리 제외)'} onChange={e => onChange({ ...basis, reference: e.target.value.trim(), checkedAt: '' })} /></label></div>
    <label><input type="checkbox" checked={validBasis(basis)} onChange={e => onChange({ ...basis, checkedAt: e.target.checked ? new Date().toISOString() : '' })} /> 이 근거에서 기간·투입률·확정 여부를 직접 확인함</label>
    {basis.checkedAt && !validBasis(basis) && <p className="form-error">출처와 메시지 ID 또는 Teams 메시지 링크를 확인해 주세요.</p>}
    <small>메일 제목·본문·이메일 주소·계약금액은 입력하지 않습니다. {url && <a href={url} target="_blank" rel="noreferrer">확인한 원문 열기</a>}</small>
  </fieldset>
}
