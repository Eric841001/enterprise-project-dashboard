import type { Project } from '../types'

export function validateProject(project: Pick<Project,'customer'|'name'|'probability'|'progress'|'startDate'|'endDate'>) {
  const errors: string[] = []
  if (!project.customer.trim()) errors.push('고객사는 필수입니다.')
  if (!project.name.trim()) errors.push('프로젝트명은 필수입니다.')
  if (project.probability < 0 || project.probability > 100) errors.push('수주 확률은 0~100이어야 합니다.')
  if (project.progress < 0 || project.progress > 100) errors.push('진행률은 0~100이어야 합니다.')
  if (project.startDate && project.endDate && project.startDate > project.endDate) errors.push('시작일은 종료일보다 늦을 수 없습니다.')
  return errors
}

export function activeInMonth(project: Project, month: number, year = 2026) {
  if (project.workMonths) return year === 2026 && project.workMonths.includes(month)
  if (!project.startDate || !project.endDate) return false
  const point = year * 12 + month
  const start = Number(project.startDate.slice(0,4)) * 12 + Number(project.startDate.slice(5,7))
  const end = Number(project.endDate.slice(0,4)) * 12 + Number(project.endDate.slice(5,7))
  return point >= start && point <= end
}

export function projectWarnings(project: Project) {
  const warnings: string[] = []
  if (project.status === 'Confirmed' && project.probability < 100) warnings.push('확정 상태지만 확률이 100% 미만입니다.')
  if ((project.status === 'Lead' || project.status === 'Proposal') && project.probability === 100) warnings.push('초기 영업 상태지만 확률이 100%입니다.')
  if (project.status === 'In Progress' && project.resources.length === 0) warnings.push('진행 중이지만 리소스가 없습니다.')
  if (project.status === 'Completed' && project.progress < 100) warnings.push('완료 상태지만 진행률이 100% 미만입니다.')
  return warnings
}

export function allocationFor(resource: string, month: number, rows: Project[]) {
  return rows.filter(p => p.resources.includes(resource) && activeInMonth(p, month)).length * 50
}

export function toCsv(rows: Project[]) {
  const quote = (v: unknown) => `"${String(v ?? '').replace(/"/g,'""')}"`
  const header = ['Customer','Project Name','Category','Probability','Status','Start Date','End Date','Project Manager','Assigned Resources','Scope','Progress','Risk','Notes']
  const body = rows.map(p => [p.customer,p.name,p.category,p.probability,p.status,p.startDate,p.endDate,p.manager,p.resources.join('; '),p.scope,p.progress,p.risk,p.importNote].map(quote).join(','))
  return '\uFEFF' + [header.map(quote).join(','),...body].join('\r\n')
}
