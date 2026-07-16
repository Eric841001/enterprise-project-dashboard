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
  if (project.workPeriods?.length) {
    const point = year * 12 + month
    return project.workPeriods.some(period => {
      const start = Number(period.startDate.slice(0,4)) * 12 + Number(period.startDate.slice(5,7))
      const end = Number(period.endDate.slice(0,4)) * 12 + Number(period.endDate.slice(5,7))
      return point >= start && point <= end
    })
  }
  if (project.workMonths) return year === 2026 && project.workMonths.includes(month)
  if (!project.startDate || !project.endDate) return false
  const point = year * 12 + month
  const start = Number(project.startDate.slice(0,4)) * 12 + Number(project.startDate.slice(5,7))
  const end = Number(project.endDate.slice(0,4)) * 12 + Number(project.endDate.slice(5,7))
  return point >= start && point <= end
}

function dayIndex(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function addDayRange(days: Set<number>, startDate: string, endDate: string) {
  const start = dayIndex(startDate)
  const end = dayIndex(endDate)
  for (let day = start; day <= end; day += 1) days.add(day)
}

export function calculateScheduleProgress(
  project: Pick<Project, 'startDate' | 'endDate' | 'workMonths' | 'workPeriods'>,
  asOf = new Date(),
) {
  const scheduled = new Set<number>()
  if (project.workPeriods?.length) {
    project.workPeriods.forEach((period) => addDayRange(scheduled, period.startDate, period.endDate))
  } else if (project.workMonths?.length) {
    project.workMonths.forEach((month) => {
      const lastDay = new Date(Date.UTC(2026, month, 0)).getUTCDate()
      addDayRange(scheduled, `2026-${String(month).padStart(2, '0')}-01`, `2026-${String(month).padStart(2, '0')}-${lastDay}`)
    })
  } else if (project.startDate && project.endDate) {
    addDayRange(scheduled, project.startDate, project.endDate)
  }
  if (!scheduled.size) return 0
  const current = Math.floor(Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()) / 86_400_000)
  const elapsed = [...scheduled].filter((day) => day <= current).length
  return Math.min(100, Math.round((elapsed / scheduled.size) * 100))
}

export function projectWarnings(project: Project) {
  const warnings: string[] = []
  if (project.status === 'Confirmed' && project.probability < 100) warnings.push('확정 상태지만 확률이 100% 미만입니다.')
  if ((project.status === 'Lead' || project.status === 'Proposal') && project.probability === 100) warnings.push('초기 영업 상태지만 확률이 100%입니다.')
  if (project.status === 'In Progress' && project.resources.length === 0) warnings.push('진행 중이지만 리소스가 없습니다.')
  if (project.status === 'Completed' && project.progress < 100) warnings.push('완료 상태지만 진행률이 100% 미만입니다.')
  return warnings
}

export function allocationFor(resource: string, month: number, rows: Project[], year = 2026) {
  return rows
    .filter(p => p.resources.includes(resource))
    .reduce((total, project) => {
      const assignments = project.resourceAssignments?.[resource]
      if (assignments?.length) {
        const point = year * 12 + month
        return total + assignments
          .filter(assignment => {
            const start = Number(assignment.startDate.slice(0,4)) * 12 + Number(assignment.startDate.slice(5,7))
            const end = Number(assignment.endDate.slice(0,4)) * 12 + Number(assignment.endDate.slice(5,7))
            return point >= start && point <= end
          })
          .reduce((sum, assignment) => sum + assignment.allocation, 0)
      }
      return activeInMonth(project, month, year)
        ? total + (project.resourceAllocations?.[resource] ?? 50)
        : total
    }, 0)
}

export function toCsv(rows: Project[]) {
  const quote = (v: unknown) => `"${String(v ?? '').replace(/"/g,'""')}"`
  const header = ['Customer','Project Name','Category','Work Mode','Probability','Status','Start Date','End Date','Project Manager','Assigned Resources','Scope','Progress','Risk','Notes']
  const body = rows.map(p => [p.customer,p.name,p.category,p.workMode === 'resident' ? '상주' : '비상주',p.probability,p.status,p.startDate,p.endDate,p.manager,p.resources.join('; '),p.scope,p.progress,p.risk,p.importNote].map(quote).join(','))
  return '\uFEFF' + [header.map(quote).join(','),...body].join('\r\n')
}
