import type {Project,Resource} from '../types'
import {monthlyPortfolio,pipelineStatuses} from './workspace'
import {isOpenProject,resourceLoad,seoulToday} from './staffing'
import {dailyLoad} from './timeline'

export type ReportKind='월간 포트폴리오'|'확정 vs 파이프라인'|'리소스 활용률'|'위험 및 이슈'|'고객사 요약'|'업데이트 준수'
export function buildReport(kind:ReportKind,projects:Project[],resources:Resource[],year:number,month:number,today=seoulToday()){
  const summary=monthlyPortfolio(projects,year,month),key=`${year}-${String(month).padStart(2,'0')}`
  const scope=`${year}년 ${month}월 일정 기준 · 현재 등록된 상태`
  if(kind==='리소스 활용률')return {scope:`${scope} · 날짜별 최대와 기간별 등록 합계를 구분합니다.`,headers:['리소스','역할',`${key} 날짜별 최대(%)`,'달력일 평균(%)','등록 합계(%)','확인 구분','주요 기술'],rows:resources.map(r=>{const l=resourceLoad(r,year,month,projects),d=dailyLoad(r,projects,year,month);return[r.name,r.role,String(d.peak),String(d.average),String(l.total),`새 근거 확인 ${l.confirmed}% / 예정 ${l.tentative}% / 기존 등록 ${l.legacy}%${l.unknown?' · 미입력/미확인 있음':''}`,r.skill]})}
  if(kind==='고객사 요약')return {scope,headers:['고객사','선택 월 전체','확정·운영','파이프라인','완료·취소·보관'],rows:[...new Set(summary.dated.map(p=>p.customer))].sort((a,b)=>a.localeCompare(b,'ko')).map(customer=>{const items=summary.dated.filter(p=>p.customer===customer);return[customer,String(items.length),String(items.filter(p=>isOpenProject(p)&&!pipelineStatuses.has(p.status)).length),String(items.filter(p=>pipelineStatuses.has(p.status)).length),String(items.filter(p=>!isOpenProject(p)).length)]})}
  const review=[...new Map([...summary.open,...summary.unscheduled].map(p=>[p.id,p])).values()]
  if(kind==='위험 및 이슈')return {scope:`${scope} · 전체 기간 미정 운영 프로젝트 포함`,headers:['고객사','프로젝트','위험','검토 항목'],rows:review.filter(p=>p.risk!=='Low'||p.status==='At Risk'||!p.startDate||!p.endDate||!p.resources.length).map(p=>[p.customer,p.name,p.risk,[...(!p.startDate||!p.endDate?['기간 확인']:[]),...(!p.resources.length?['인력 미배정']:[]),...(p.risk!=='Low'||p.status==='At Risk'?['위험 검토']:[])].join(' · ')])}
  if(kind==='업데이트 준수')return {scope:`${scope} · 전체 기간 미정 운영 프로젝트 포함 · 오늘 기준 7일 경과 점검`,headers:['고객사','프로젝트','최근 업데이트','상태'],rows:review.sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)).map(p=>[p.customer,p.name,p.updatedAt,Date.parse(`${today}T00:00:00Z`)-Date.parse(`${p.updatedAt.slice(0,10)}T00:00:00Z`)>=7*86400000?'업데이트 필요':'정상'])}
  return {scope,headers:['고객사','프로젝트','확률','현재 상태','시작일','종료일'],rows:(kind==='확정 vs 파이프라인'?summary.open:summary.dated).map(p=>[p.customer,p.name,`${p.probability}%`,p.status,p.startDate??'미정',p.endDate??'미정'])}
}
