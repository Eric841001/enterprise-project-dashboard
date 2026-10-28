import type { Project } from '../types'
import { activeInMonth } from './portfolio'
import { isOpenProject, planningMonths, seoulToday } from './staffing'

export const issueLabels = {overdue:'후속조치 기한 초과',risk:'고위험',ended:'종료일 경과',unassigned:'인력 미배정',unscheduled:'기간 확인',stale:'7일 이상 미갱신'}
export type IssueKind = keyof typeof issueLabels
export function operationalInbox(projects: Project[], today=seoulToday()) {
  const current=Date.parse(`${today}T00:00:00Z`)
  return projects.filter(isOpenProject).flatMap(project=>{
    const kinds:IssueKind[]=[]
    if(project.nextActionDueDate && project.nextActionDueDate<today && ['Pending','Waiting'].includes(project.followUpStatus??''))kinds.push('overdue')
    if(project.risk==='High'||project.status==='At Risk')kinds.push('risk')
    if(project.endDate && project.endDate<today)kinds.push('ended')
    if(!project.resources.length)kinds.push('unassigned')
    if(!project.startDate||!project.endDate)kinds.push('unscheduled')
    if(current-Date.parse(`${project.updatedAt.slice(0,10)}T00:00:00Z`)>=7*86400000)kinds.push('stale')
    if(!kinds.length)return[]
    const weights={overdue:100,risk:90,ended:70,unassigned:40,unscheduled:30,stale:10}
    return [{project,kinds,priority:Math.max(...kinds.map(k=>weights[k])),due:project.nextActionDueDate??project.endDate??'9999-12-31'}]
  }).sort((a,b)=>b.priority-a.priority||a.due.localeCompare(b.due)||a.project.updatedAt.localeCompare(b.project.updatedAt)||a.project.id.localeCompare(b.project.id))
}
export function parseMonth(value: string | null, fallback=seoulToday().slice(0,7)) {
  const key=value&&/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value)?value:fallback
  return {key,year:Number(key.slice(0,4)),month:Number(key.slice(5,7))}
}
export function shiftMonth(key:string,amount:number) {
  const p=parseMonth(key), next=planningMonths(p.year,p.month+amount,1)[0].key
  return /^(20\d{2}|2100)-/.test(next)?next:p.key
}
export const pipelineStatuses=new Set(['Lead','Qualified','Proposal','Negotiation'])
export function monthlyPortfolio(projects:Project[],year:number,month:number){
  const dated=projects.filter(p=>p.startDate&&p.endDate
    ?activeInMonth({...p,workPeriods:undefined,workMonths:undefined},month,year)
    :Boolean(p.workPeriods?.length||p.workMonths?.length)&&activeInMonth(p,month,year))
  const open=dated.filter(isOpenProject)
  return {dated,open,confirmed:open.filter(p=>!pipelineStatuses.has(p.status)),pipeline:open.filter(p=>pipelineStatuses.has(p.status)),closed:dated.filter(p=>!isOpenProject(p)),unscheduled:projects.filter(p=>isOpenProject(p)&&(!p.startDate||!p.endDate)),high:open.filter(p=>p.risk==='High'||p.status==='At Risk')}
}
