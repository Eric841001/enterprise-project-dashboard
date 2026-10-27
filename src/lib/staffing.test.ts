import { describe, expect, it } from 'vitest'
import type { Project, Resource } from '../types'
import { compareDraft, planningMonths, resourceLoad, reviewProjects, simulationMonths, staffingCsv } from './staffing'

const person: Resource = { id:'r1',name:'담당자',role:'Consultant',skill:'M365',capacity:100 }
const project: Project = { id:'p1',customer:'고객사',name:'구축',category:'M365',status:'In Progress',probability:100,startDate:'2026-10-01',endDate:'2026-12-31',progress:40,manager:'담당자',resources:['담당자'],risk:'Low',scope:'구축',phase:'구축',updatedAt:'2026-10-20',resourceAssignments:{담당자:[{allocation:100,startDate:'2026-10-01',endDate:'2026-12-31'}]} }

describe('staffing capacity', () => {
  it('crosses years without carrying December into the wrong year', () => {
    expect(planningMonths(2026,11).map(p=>p.key)).toEqual(['2026-11','2026-12','2027-01','2027-02','2027-03','2027-04'])
    expect(resourceLoad(person,2027,1,[project]).total).toBe(0)
  })
  it('retains confirmed100 through December and includes zero activities without double counting', () => {
    const p={...project,resourceAssignments:{담당자:[...project.resourceAssignments!.담당자,{allocation:0,startDate:'2026-11-02',endDate:'2026-11-13'}]}}
    for (const month of [10,11,12]) {
      expect(resourceLoad(person,2026,month,[p])).toMatchObject({confirmed:100,unknown:false,total:100,free:0})
    }
  })
  it('never assumes50 for missing allocations or interprets zero as free', () => {
    expect(resourceLoad(person,2026,10,[{...project,resourceAssignments:undefined}])).toMatchObject({total:0,unknown:true,free:null})
    expect(resourceLoad(person,2026,10,[{...project,resourceAssignments:{담당자:[{allocation:0,startDate:'2026-10-01',endDate:'2026-12-31'}]}}])).toMatchObject({unknown:true,free:null})
  })
  it('does not hide zero outside confirmed coverage or in another project', () => {
    const p={...project,resourceAssignments:{담당자:[{allocation:100,startDate:'2026-10-01',endDate:'2026-10-15'},{allocation:0,startDate:'2026-10-16',endDate:'2026-10-31'}]}}
    expect(resourceLoad(person,2026,10,[p]).unknown).toBe(true)
    const other={...project,id:'other',resourceAssignments:{담당자:[{allocation:0,startDate:'2026-10-01',endDate:'2026-10-31'}]}}
    expect(resourceLoad(person,2026,10,[project,other]).unknown).toBe(true)
  })
  it('separates pipeline from confirmed reservations and flags combined over-capacity', () => {
    const pending={...project,id:'proposed',status:'Proposal' as const,resourceAssignments:{담당자:[{allocation:25,startDate:'2026-11-01',endDate:'2026-11-30'}]}}
    expect(resourceLoad(person,2026,11,[project,pending])).toMatchObject({confirmed:100,tentative:25,total:125,tone:'over'})
  })
  it('excludes terminal projects from every capacity and review calculation', () => {
    for(const status of ['Completed','Cancelled','Archived'] as const) {
      expect(resourceLoad(person,2026,10,[{...project,status}]).total).toBe(0)
      expect(reviewProjects([{...project,status,resources:[]}],'2026-10-27').unassigned).toHaveLength(0)
    }
  })
  it('does not infer a manager-only reservation', () => {
    expect(resourceLoad(person,2026,10,[{...project,resources:[],resourceAssignments:undefined}])).toMatchObject({total:0,unknown:true,free:null})
  })
  it('does not advertise unscheduled staffing as free capacity', () => {
    expect(resourceLoad(person,2026,10,[{...project,startDate:null,endDate:null,resourceAssignments:undefined}])).toMatchObject({unknown:true,free:null})
  })
  it('compares actual resource capacity rather than a hard-coded100', () => {
    expect(resourceLoad({...person,capacity:80},2026,10,[project]).tone).toBe('over')
  })
})

describe('planning and review', () => {
  it('previews additions without mutating existing records', () => {
    const before=JSON.stringify(project)
    const result=compareDraft(person,[project],'2026-11-01','2026-12-31',25)
    expect(result.map(r=>[r.after,r.over])).toEqual([[125,true],[125,true]])
    expect(JSON.stringify(project)).toBe(before)
  })
  it('rejects invalid, reversed and oversized simulation ranges', () => {
    for(const [start,end] of [['2026-02-30','2026-03-01'],['2026-12-31','2026-11-01'],['2026-01-01','2030-12-31'],['','']]) expect(simulationMonths(start,end)).toEqual([])
    expect(compareDraft(person,[project],'2026-10-01','2026-10-31',NaN)).toEqual([])
  })
  it('keeps unknown effort explicit in the simulation', () => {
    const p={...project,resourceAssignments:undefined}
    expect(compareDraft(person,[p],'2026-10-01','2026-10-31',25)[0].before.free).toBeNull()
  })
  it('uses a seven-day inclusive stale threshold and does not count future updates', () => {
    const items=[project,{...project,id:'recent',updatedAt:'2026-10-21'},{...project,id:'future',updatedAt:'2026-10-28'}]
    expect(reviewProjects(items,'2026-10-27').stale.map(p=>p.id)).toEqual(['p1'])
  })
  it('distinguishes manager designation from an actual staffed project', () => {
    expect(reviewProjects([{...project,resources:[]}],'2026-10-27').unassigned).toHaveLength(1)
  })
  it('exports confirmed, tentative and missing separately with formula-safe cells', () => {
    const csv=staffingCsv([{...person,name:'=DANGEROUS()'}],[],2026,11)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('2027.01 확정')
    expect(csv).toContain(`"'=DANGEROUS()"`)
    expect(csv).toContain('미입력')
  })
})
