import {describe,it,expect} from 'vitest'
import {validBasis,evidenceUrl} from './evidence'
import {assignmentErrors,type AssignmentRow} from './project-save'
import {dailyLoad} from './timeline'
import {compareDraft,resourceLoad,reviewProjects} from './staffing'
import type {Project,Resource} from '../types'
const basis={source:'gmail' as const,reference:'abcdef1234567890',checkedAt:'2026-01-01T00:00:00Z'}
const row:AssignmentRow={id:'a',resource_id:'r',role:'Consultant',allocation_percentage:50,start_date:'2026-10-01',end_date:'2026-10-15',verification_state:'confirmed',record_kind:'allocation',parent_assignment_id:null,evidence_basis:basis}
const person:Resource={id:'r',name:'테스트 인력',role:'Consultant',skill:'M365',capacity:100}
const project:Project={id:'p',customer:'테스트 고객',name:'검증',category:'M365',status:'In Progress',probability:100,progress:0,manager:'미지정',resources:[person.name],startDate:'2026-10-01',endDate:'2026-10-31',updatedAt:'2026-10-01',risk:'Low',scope:'테스트',phase:'검증'}
function dated(start:string,end:string,allocation=100):Project{return {...project,resourceAssignments:{[person.name]:[{allocation,startDate:start,endDate:end,verification:'confirmed'}]}}}
describe('evidence and assignment editing',()=>{
  it('accepts message IDs and canonical Teams links but rejects bodies, addresses, hostile URLs and future checks',()=>{
    expect(validBasis(basis)).toBe(true)
    expect(validBasis({...basis,source:'teams',reference:'https://teams.microsoft.com/l/message/19%3Afixture/1234567890'})).toBe(true)
    for(const reference of ['someone@example.com','javascript:alert(1)','https://evil.example/l/message/id/1','https://teams.microsoft.com/l/message/id/1?token=secret'])expect(validBasis({...basis,source:'teams',reference})).toBe(false)
    expect(validBasis({...basis,checkedAt:'2099-01-01T00:00:00Z'})).toBe(false)
    expect(evidenceUrl({...basis,reference:'email body'})).toBeUndefined()
  })
  it('preserves multiple periods and rejects invalid dates and duplicate identity keys',()=>{
    const second={...row,id:'b',start_date:'2026-10-16',end_date:'2026-10-31'}
    expect(assignmentErrors([row,second],[row,second])).toEqual([])
    expect(assignmentErrors([row,{...row,id:'b'}],[row])).toContain('같은 인력의 같은 시작일 배정이 중복되었습니다.')
    expect(assignmentErrors([{...row,start_date:'2026-02-30'}],[row])).toContain('배정 시작일과 종료일을 확인해 주세요.')
  })
  it('requires reviewed evidence only for changed rows',()=>{
    const old={...row,evidence_basis:null}
    expect(assignmentErrors([old],[old])).toEqual([])
    expect(assignmentErrors([{...old,allocation_percentage:75}],[old])).toContain('변경한 배정의 Gmail·Teams 근거를 확인해 주세요.')
    expect(assignmentErrors([{...old,allocation_percentage:75,evidence_basis:basis}],[old])).toEqual([])
  })
  it('requires included activities to belong to a confirmed parent on the same resource and within its dates',()=>{
    const activity:AssignmentRow={...row,id:'b',record_kind:'included',allocation_percentage:0,parent_assignment_id:'a',start_date:'2026-10-03',end_date:'2026-10-04'}
    expect(assignmentErrors([row,activity],[row])).toEqual([])
    expect(assignmentErrors([row,{...activity,end_date:'2026-11-01'}],[row])).toContain('포함 활동은 같은 인력의 확정 기본 배정 기간 안에 있어야 합니다.')
  })
})
describe('date-based load and verification',()=>{
  it('does not claim non-overlapping full-time periods are simultaneous over-allocation',()=>{
    const projects=[dated('2026-10-01','2026-10-15'),{...dated('2026-10-16','2026-10-31'),id:'p2'}]
    expect(resourceLoad(person,2026,10,projects).total).toBe(200)
    expect(dailyLoad(person,projects,2026,10)).toMatchObject({peak:100,average:100,conflicts:[]})
  })
  it('counts inclusive overlap days and excludes terminal projects',()=>{
    const projects=[dated('2026-10-01','2026-10-15'),{...dated('2026-10-15','2026-10-31'),id:'p2'}]
    expect(dailyLoad(person,projects,2026,10).conflicts.map(d=>d.date)).toEqual(['2026-10-15'])
    expect(dailyLoad(person,[...projects,{...project,status:'Completed'}],2026,10).peak).toBe(200)
  })
  it('adds a simulation only on its actual dates rather than adding monthly reservations',()=>{
    const projects=[dated('2026-10-01','2026-10-15')]
    const result=compareDraft(person,projects,'2026-10-16','2026-10-31',100)[0]
    expect(result).toMatchObject({after:100,over:false})
    expect(result.before.total).toBe(100)
  })
  it('does not treat explicit unverified percentages as confirmed capacity',()=>{
    const p=dated('2026-10-01','2026-10-31',50);p.resourceAssignments![person.name][0].verification='unverified'
    expect(resourceLoad(person,2026,10,[p])).toMatchObject({confirmed:0,unverified:50,total:50,free:null})
    p.resourceAssignments![person.name][0].verification='tentative'
    expect(resourceLoad(person,2026,10,[p])).toMatchObject({confirmed:0,tentative:50,unverified:0})
  })
  it('distinguishes a confirmed zero from missing effort',()=>{
    expect(resourceLoad(person,2026,10,[dated('2026-10-01','2026-10-31',0)])).toMatchObject({total:0,unknown:false})
  })
  it('preserves existing manual rates and fully included legacy zero activities without inventing new confirmations',()=>{
    const p=dated('2026-10-01','2026-12-31');p.resourceAssignments![person.name][0].verification='legacy'
    p.resourceAssignments![person.name].push({allocation:0,startDate:'2026-10-15',endDate:'2026-10-16',verification:'legacy'})
    expect(resourceLoad(person,2026,10,[p])).toMatchObject({total:100,legacy:100,confirmed:0,unknown:false})
    expect(dailyLoad(person,[p],2026,10)).toMatchObject({peak:100,unknown:false})
  })
  it('supports leap-year February and unknown undated work',()=>{
    expect(dailyLoad(person,[],2028,2).rows).toHaveLength(29)
    expect(dailyLoad(person,[{...project,startDate:null,endDate:null}],2026,10).unknown).toBe(true)
  })
  it('queues overdue follow-ups and ended open projects without reviving completed work',()=>{
    const p={...project,endDate:'2026-10-20',followUpStatus:'Pending' as const,nextActionDueDate:'2026-10-25'}
    const q=reviewProjects([p,{...p,id:'closed',status:'Completed'}],'2026-10-28')
    expect(q.overdue.map(p=>p.id)).toEqual(['p']);expect(q.ended.map(p=>p.id)).toEqual(['p'])
  })
})
