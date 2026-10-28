import type { Resource } from './types'
import type { AssignmentRow } from './lib/project-save'
import { EvidenceEditor } from './EvidenceEditor'
import { verificationLabels } from './lib/evidence'

export function AssignmentRowsEditor({ rows, resources, onChange, disabled }: { rows: AssignmentRow[]; resources: Resource[]; onChange: (rows: AssignmentRow[]) => void; disabled?: boolean }) {
  function change(index: number, patch: Partial<AssignmentRow>, evidence = false) {
    onChange(rows.map((row, i) => i === index ? { ...row, ...patch, ...(evidence ? {} : { evidence_basis: null }) } : row))
  }
  return <fieldset className="resource-picker assignment-rows" disabled={disabled}><legend>기간별 담당 배정 · 기존 기록 유지</legend>
    {rows.map((row, index) => {
      const resource = resources.find(r => r.id === row.resource_id)
      return <div className="resource-assignment-card selected" key={row.id ?? `new-${index}`}>
        <strong>{resource?.name ?? '비활성 담당자 · 기존 기록 유지'} · 배정 {index + 1}</strong>
        {!resource ? <p>{row.start_date} ~ {row.end_date} · {row.allocation_percentage}%</p> : <>
          <div className="assignment-fields">
            <label>인력<select aria-label={`배정 ${index + 1} 인력`} value={row.resource_id} onChange={e => change(index, { resource_id: e.target.value, parent_assignment_id: null })}>{resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <label>투입률 (%)<input aria-label={`배정 ${index + 1} 투입률`} type="number" min="0" max="100" value={row.allocation_percentage} onChange={e => change(index, { allocation_percentage: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
            <label>확인 상태<select value={row.verification_state} onChange={e => change(index, { verification_state: e.target.value as AssignmentRow['verification_state'] })}>{Object.entries(verificationLabels).filter(([v])=>v!=='legacy'||row.verification_state==='legacy').map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>배정 시작일<input aria-label={`배정 ${index + 1} 시작일`} type="date" value={row.start_date} onChange={e => change(index, { start_date: e.target.value })} /></label>
            <label>배정 종료일<input aria-label={`배정 ${index + 1} 종료일`} type="date" value={row.end_date} onChange={e => change(index, { end_date: e.target.value })} /></label>
            <label>기록 유형<select value={row.record_kind} onChange={e => change(index, { record_kind: e.target.value as AssignmentRow['record_kind'], parent_assignment_id: null })}><option value="allocation">별도 투입 배정</option><option value="included">기본 배정에 포함된 활동</option></select></label>
            {row.record_kind === 'included' && <label>연결할 기본 배정<select value={row.parent_assignment_id ?? ''} onChange={e => change(index, { parent_assignment_id: e.target.value || null, allocation_percentage: 0 })}><option value="">선택</option>{rows.filter(p => p.id && p.id !== row.id && p.resource_id === row.resource_id && p.record_kind === 'allocation' && p.verification_state === 'confirmed').map(p => <option key={p.id} value={p.id}>{p.start_date} ~ {p.end_date} · {p.allocation_percentage}%</option>)}</select></label>}
          </div>
          <EvidenceEditor label={`배정 ${index + 1} 확인 근거`} value={row.evidence_basis} onChange={evidence_basis => change(index, { evidence_basis }, true)} />
          <button type="button" className="secondary" onClick={() => onChange(rows.filter((_,i) => i !== index))}>배정 제외{row.id ? ' · 이력 보존' : ''}</button>
        </>}
      </div>
    })}
    <button type="button" className="secondary" disabled={!resources.length} onClick={() => { const r = resources[0]; if (r) onChange([...rows, {resource_id:r.id,role:r.role,allocation_percentage:0,start_date:'',end_date:'',verification_state:'unverified',record_kind:'allocation',parent_assignment_id:null,evidence_basis:null}]) }}>기간별 배정 추가</button>
    <p className="dialog-note">0%는 미입력 기본값입니다. 확정 투입률을 추정하지 않습니다. 새 기본 배정을 저장한 뒤 포함 활동을 연결할 수 있습니다.</p>
  </fieldset>
}
