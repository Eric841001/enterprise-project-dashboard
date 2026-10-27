import type { Project, Resource } from '../types'
import { resourceActiveInMonth } from './portfolio'

const closed = new Set(['Completed', 'Cancelled', 'Archived'])
const pipeline = new Set(['Lead', 'Qualified', 'Proposal', 'Negotiation'])
export function isOpenProject(project: Project) { return !closed.has(project.status) }
export function seoulToday() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) }
export function planningMonths(year: number, month: number, count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 + i, 1))
    const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1
    return { year: y, month: m, key: `${y}-${String(m).padStart(2, '0')}`, label: `${y}.${String(m).padStart(2, '0')}` }
  })
}

export interface StaffingLine {
  project: Project; allocation: number; unknown: boolean; tentative: boolean;
  dates: Array<{ startDate: string; endDate: string }>; managerOnly: boolean
}
export function staffingLines(resource: string, year: number, month: number, projects: Project[]): StaffingLine[] {
  const key = `${year}-${String(month).padStart(2, '0')}`
  return projects.filter(p => isOpenProject(p) && (
    resourceActiveInMonth(resource, p, month, year) ||
    (!p.startDate && !p.endDate && !p.resourceAssignments?.[resource]?.length && (p.resources.includes(resource) || p.manager === resource))
  )).map(project => {
    const all = project.resourceAssignments?.[resource] ?? []
    const dates = all.filter(a => a.startDate.slice(0, 7) <= key && a.endDate.slice(0, 7) >= key)
    const managerOnly = !project.resources.includes(resource)
    const registered = project.resourceAllocations?.[resource]
    const allocation = managerOnly ? 0 : dates.length ? dates.reduce((sum, a) => sum + a.allocation, 0) : (registered ?? 0)
    const unknown = managerOnly || (!dates.length && !project.startDate && !project.endDate) || (dates.length ? dates.some(a => a.allocation === 0 && !all.some(known =>
      known.allocation === 100 && known.startDate <= a.startDate && known.endDate >= a.endDate,
    )) : registered === undefined || registered === 0)
    return { project, allocation, unknown, tentative: pipeline.has(project.status), dates, managerOnly }
  })
}
export function resourceLoad(resource: Resource, year: number, month: number, projects: Project[]) {
  const lines = staffingLines(resource.name, year, month, projects)
  const confirmed = lines.filter(l => !l.tentative).reduce((sum, l) => sum + l.allocation, 0)
  const tentative = lines.filter(l => l.tentative).reduce((sum, l) => sum + l.allocation, 0)
  const unknown = lines.some(l => l.unknown)
  const capacity = Math.max(0, resource.capacity)
  const total = confirmed + tentative
  const free = unknown ? null : Math.max(0, capacity - total)
  const tone = total > capacity ? 'over' : unknown ? 'unknown' : tentative > 0 ? 'tentative' : total >= capacity * .8 && total > 0 ? 'near' : 'available'
  return { lines, confirmed, tentative, unknown, total, capacity, free, tone }
}
export function reviewProjects(projects: Project[], today = seoulToday()) {
  const current = Date.parse(`${today}T00:00:00Z`)
  const open = projects.filter(isOpenProject)
  return {
    unassigned: open.filter(p => !p.resources.length),
    unscheduled: open.filter(p => !p.startDate || !p.endDate),
    stale: open.filter(p => {
      const updated = Date.parse(`${p.updatedAt.slice(0, 10)}T00:00:00Z`)
      return Number.isFinite(updated) && current - updated >= 7 * 86400000
    }),
  }
}
export function simulationMonths(start: string, end: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return []
  const dateIsValid = (s: string) => { const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s }
  if (!dateIsValid(start) || !dateIsValid(end)) return []
  const year = Number(start.slice(0, 4)), month = Number(start.slice(5, 7))
  const count = (Number(end.slice(0, 4)) - year) * 12 + Number(end.slice(5, 7)) - month + 1
  return count > 24 ? [] : planningMonths(year, month, count)
}
export function compareDraft(resource: Resource, projects: Project[], start: string, end: string, allocation: number) {
  if (!Number.isFinite(allocation) || allocation < 0 || allocation > 100) return []
  return simulationMonths(start, end).map(period => {
    const before = resourceLoad(resource, period.year, period.month, projects)
    return { ...period, before, after: before.total + allocation, over: before.total + allocation > before.capacity }
  })
}
export function csvCell(value: unknown) {
  let text = String(value ?? '')
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function staffingCsv(resources: Resource[], projects: Project[], year: number, month: number) {
  const periods = planningMonths(year, month)
  const rows: unknown[][] = [['인력', '역할', '기술', ...periods.flatMap(p => [`${p.label} 확정(%)`, `${p.label} 예정(%)`, `${p.label} 미입력`])]]
  for (const r of resources) rows.push([r.name, r.role, r.skill, ...periods.flatMap(p => {
    const l = resourceLoad(r, p.year, p.month, projects)
    return [l.confirmed, l.tentative, l.unknown ? '있음' : '없음']
  })])
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}
