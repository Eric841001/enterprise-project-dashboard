import type { Project, Resource } from '../types'

export function dailyLoad(resource: Resource, projects: Project[], year: number, month: number) {
  const first=new Date(Date.UTC(year,month-1,1))
  const key=`${first.getUTCFullYear()}-${String(first.getUTCMonth()+1).padStart(2,'0')}`
  const count = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate()
  const rows = Array.from({length:count},(_,i) => {
    const date = `${key}-${String(i+1).padStart(2,'0')}`
    const lines = projects.filter(p=>!['Completed','Cancelled','Archived'].includes(p.status)).flatMap(project => {
      const assignments = project.resourceAssignments?.[resource.name] ?? []
      if (assignments.length) {
        return assignments.filter(a => a.startDate <= date && a.endDate >= date && a.kind !== 'included').map(a => ({
          project, allocation:a.allocation,
          unknown:a.verification === 'unverified' || (a.allocation===0 && (!a.verification || a.verification==='legacy') && !assignments.some(p => p.allocation===100 && p.startDate<=a.startDate && p.endDate>=a.endDate)),
          tentative:a.verification === 'tentative' || ['Lead','Qualified','Proposal','Negotiation'].includes(project.status),
        }))
      }
      if (!project.resources.includes(resource.name) && project.manager !== resource.name) return []
      if (project.startDate && project.startDate>date || project.endDate && project.endDate<date) return []
      const allocation=project.resourceAllocations?.[resource.name] ?? 0
      return [{project,allocation,unknown:!project.startDate || !project.endDate || !allocation || !project.resources.includes(resource.name),tentative:['Lead','Qualified','Proposal','Negotiation'].includes(project.status)}]
    })
    const total = lines.reduce((s,a) => s+a.allocation,0)
    return {date,lines,total,unknown:lines.some(a=>a.unknown),over:total>resource.capacity}
  })
  return {rows,peak:Math.max(0,...rows.map(r=>r.total)),average:Math.round(rows.reduce((s,r)=>s+r.total,0)/count*10)/10,conflicts:rows.filter(r=>r.over),unknown:rows.some(r=>r.unknown)}
}
