import type { EvidenceBasis, VerificationState } from '../types'
import { validBasis, validDate } from './evidence'

export interface AssignmentRow {
  id?: string; project_id?: string; resource_id: string; role: string;
  allocation_percentage: number; start_date: string; end_date: string;
  verification_state: VerificationState | 'legacy'; record_kind: 'allocation' | 'included';
  parent_assignment_id: string | null; evidence_basis: EvidenceBasis | null;
  removed_at?: string | null
}
export function assignmentErrors(rows: AssignmentRow[], baseline: AssignmentRow[]): string[] {
  const errors: string[] = [], keys = new Set<string>(), ids = new Set<string>()
  for (const row of rows) {
    const key = `${row.resource_id}/${row.start_date}`
    if (keys.has(key)) errors.push('같은 인력의 같은 시작일 배정이 중복되었습니다.')
    keys.add(key)
    if (row.id && ids.has(row.id)) errors.push('배정 ID가 중복되었습니다.')
    if (row.id) ids.add(row.id)
    if (!validDate(row.start_date) || !validDate(row.end_date) || row.start_date > row.end_date) errors.push('배정 시작일과 종료일을 확인해 주세요.')
    if (!Number.isInteger(row.allocation_percentage) || row.allocation_percentage < 0 || row.allocation_percentage > 100) errors.push('배정률은 0~100 사이의 정수로 입력해 주세요.')
    const old = baseline.find(a => a.id === row.id)
    const fields = ['resource_id','allocation_percentage','start_date','end_date','verification_state','record_kind','parent_assignment_id','evidence_basis'] as const
    const changed = !old || fields.some(k => JSON.stringify(old[k]) !== JSON.stringify(row[k]))
    if (changed && !validBasis(row.evidence_basis)) errors.push('변경한 배정의 Gmail·Teams 근거를 확인해 주세요.')
    if (changed && row.verification_state === 'legacy') errors.push('변경한 배정은 미확인·예정·확정 중 확인 상태를 선택해 주세요.')
    if (row.record_kind === 'included') {
      const parent = rows.find(a => a.id && a.id === row.parent_assignment_id)
      if (row.allocation_percentage !== 0 || !parent || parent.resource_id !== row.resource_id || parent.record_kind !== 'allocation' || parent.verification_state !== 'confirmed' || parent.start_date > row.start_date || parent.end_date < row.end_date) errors.push('포함 활동은 같은 인력의 확정 기본 배정 기간 안에 있어야 합니다.')
    }
  }
  return [...new Set(errors)]
}
export function saveError(message: string) {
  if (/STALE_PROJECT|STALE_ASSIGNMENTS/.test(message)) return '다른 사용자가 프로젝트 또는 배정을 변경했습니다. 입력을 보존했습니다. 취소 후 최신 정보를 다시 열어 비교해 주세요.'
  if (/function.*not.*found|schema cache|PGRST202/i.test(message)) return '배정 저장 기능의 DB 업데이트가 아직 적용되지 않았습니다. 입력을 보존했습니다.'
  return message
}
