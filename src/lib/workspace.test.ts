import {describe,it,expect} from 'vitest'
import {operationalInbox,parseMonth,shiftMonth,monthlyPortfolio} from './workspace'
import {buildReport} from './reporting'
import type {Project,Resource} from '../types'
const p:Project={id:'p',customer:'검증 고객',name:'검증 프로젝트',category:'M365',probability:100,status:'In Progress',progress:20,startDate:'2026-10-01',endDate:'2026-12-31',manager:'검증 담당',resources:['검증 담당'],risk:'Low',scope:'검증',phase:'실행',updatedAt:'2026-10-28'}
const person:Resource={id:'r',name:'검증 담당',role:'Consultant',skill:'M365',capacity:100}
describe('operational inbox',()=>{
  it('groups multiple reasons per project and puts an overdue action ahead of stale work',()=>{
    const rows=operationalInbox([{...p,id:'stale',updatedAt:'2026-01-01'},{...p,id:'urgent',resources:[],risk:'High',followUpStatus:'Pending',nextActionDueDate:'2026-10-27'}],'2026-10-28')
    expect(rows).toHaveLength(2);expect(rows[0].project.id).toBe('urgent');expect(rows[0].kinds).toEqual(['overdue','risk','unassigned'])
  })
  it('excludes completed work, done follow-ups, future updates and deadlines today',()=>{
    expect(operationalInbox([{...p,status:'Completed',risk:'High'},{...p,id:'done',followUpStatus:'Done',nextActionDueDate:'2026-10-01'},{...p,id:'today',followUpStatus:'Pending',nextActionDueDate:'2026-10-28',updatedAt:'2026-10-29'}],'2026-10-28')).toEqual([])
  })
  it('uses the inclusive seven-day threshold',()=>{
    expect(operationalInbox([{...p,updatedAt:'2026-10-21'}],'2026-10-28')[0].kinds).toEqual(['stale'])
  })
})
describe('periods and reporting',()=>{
  it('validates incoming month URLs and crosses the year boundary without losing the month',()=>{
    expect(parseMonth('2026-13','2026-10').key).toBe('2026-10');expect(parseMonth('bad','2026-10').key).toBe('2026-10')
    expect(shiftMonth('2026-12',1)).toBe('2027-01');expect(shiftMonth('2027-01',-1)).toBe('2026-12')
    expect(shiftMonth('2000-01',-1)).toBe('2000-01');expect(shiftMonth('2100-12',1)).toBe('2100-12')
  })
  it('does not describe closed work as pipeline and keeps undated work separate',()=>{
    const list=[p,{...p,id:'closed',status:'Completed' as const},{...p,id:'pipeline',status:'Proposal' as const,probability:100},{...p,id:'undated',startDate:null,endDate:null}]
    const s=monthlyPortfolio(list,2026,10)
    expect([s.confirmed.length,s.pipeline.length,s.closed.length,s.unscheduled.length]).toEqual([1,1,1,1])
    expect(s.dated).toHaveLength(3)
  })
  it('filters exports to the selected year and month, including discontinuous work periods',()=>{
    const list=[p,{...p,id:'future',name:'미래 업무',startDate:'2027-01-01',endDate:'2027-01-31'},{...p,id:'gap',name:'중간 공백',startDate:null,endDate:null,workPeriods:[{startDate:'2026-09-01',endDate:'2026-09-30'},{startDate:'2026-11-01',endDate:'2026-11-30'}]}]
    expect(buildReport('월간 포트폴리오',list,[],2027,1).rows.map(r=>r[1])).toEqual(['미래 업무'])
    expect(buildReport('월간 포트폴리오',list,[],2026,10).rows.map(r=>r[1])).toEqual(['검증 프로젝트'])
  })
  it('does not present an unknown end date as scheduled work indefinitely into the future',()=>{
    const s=monthlyPortfolio([{...p,endDate:null}],2070,1)
    expect(s.dated).toHaveLength(0);expect(s.unscheduled).toHaveLength(1)
  })
  it('uses the complete project period ahead of older task windows in project reports',()=>{
    const item={...p,workMonths:[10],workPeriods:[{startDate:'2026-10-01',endDate:'2026-10-31'}]}
    expect(monthlyPortfolio([item],2026,11).dated).toHaveLength(1)
    expect(buildReport('월간 포트폴리오',[item],[],2026,12).rows).toHaveLength(1)
    expect(monthlyPortfolio([item],2027,1).dated).toHaveLength(0)
  })
  it('separates actual daily peaks from monthly registration totals in resource exports',()=>{
    const item={...p,resourceAssignments:{'검증 담당':[{allocation:100,startDate:'2026-10-01',endDate:'2026-10-15'},{allocation:100,startDate:'2026-10-16',endDate:'2026-10-31'}]}}
    const report=buildReport('리소스 활용률',[item],[person],2026,10)
    expect(report.rows[0].slice(2,5)).toEqual(['100','100','200']);expect(report.headers[2]).toContain('2026-10')
  })
  it('includes undated operating work in quality checks without duplicating partial periods or reviving closed work',()=>{
    const list=[{...p,endDate:null},{...p,id:'undated',name:'기간 미정',startDate:null,endDate:null},{...p,id:'closed',name:'종료',status:'Completed' as const,resources:[],risk:'High' as const}]
    const report=buildReport('위험 및 이슈',list,[],2026,10)
    expect(report.rows.map(r=>r[1])).toEqual(['검증 프로젝트','기간 미정']);expect(report.scope).toContain('기간 미정')
  })
})
