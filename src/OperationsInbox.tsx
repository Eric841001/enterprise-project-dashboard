import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, ClipboardList, Search } from 'lucide-react'
import type { Project } from './types'
import { issueLabels, operationalInbox, type IssueKind } from './lib/workspace'
import { seoulToday } from './lib/staffing'

export function OperationsInbox({projects}:{projects:Project[]}){
  const [filter,setFilter]=useState<IssueKind|'all'>('all'),[query,setQuery]=useState(''),[limit,setLimit]=useState(5)
  const rows=operationalInbox(projects)
  const filtered=rows.filter(r=>(filter==='all'||r.kinds.includes(filter))&&`${r.project.customer} ${r.project.name} ${r.project.manager} ${r.project.resources.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <section className="operations-inbox" aria-label="운영 조치함">
    <div className="inbox-heading"><div><span className="workspace-eyebrow"><ClipboardList/> ACTION CENTER</span><h2>오늘 확인할 일 <span>{rows.length}</span></h2><p>{seoulToday()} 기준 · 기한 초과와 위험 항목부터 정렬했습니다.</p></div><label className="inbox-search"><Search/><input aria-label="운영 조치함 검색" placeholder="고객사·프로젝트·담당자" value={query} onChange={e=>{setQuery(e.target.value);setLimit(5)}}/></label></div>
    <div className="inbox-filters" role="group" aria-label="운영 조치함 분류">
      {(['all',...Object.keys(issueLabels)] as const).map(key=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>{setFilter(key as IssueKind|'all');setLimit(5)}}>{key==='all'?'전체':issueLabels[key as IssueKind]}<b>{key==='all'?rows.length:rows.filter(r=>r.kinds.includes(key as IssueKind)).length}</b></button>)}
    </div>
    <div className="inbox-list">{filtered.slice(0,limit).map(({project,kinds})=><Link className="inbox-item" key={project.id} to={`/projects/${project.id}`}>
      <span className={`inbox-priority ${kinds[0]}`} aria-hidden="true"/>
      <span className="inbox-project"><strong>{project.customer}<span>{project.name}</span></strong><span>{project.nextAction||'프로젝트 상세에서 일정과 담당 배정을 확인해 주세요.'}</span><span className="inbox-reasons">{kinds.map(k=><small key={k} data-kind={k}>{issueLabels[k]}</small>)}</span></span>
      <span className="inbox-owner"><strong>{project.manager==='미지정'?'담당 확인 필요':project.manager}</strong><small>{project.nextActionDueDate?`조치 기한 ${project.nextActionDueDate}`:project.endDate?`프로젝트 종료 ${project.endDate}`:'기간 미정'}</small></span><ArrowUpRight/>
    </Link>)}</div>
    {!filtered.length&&<div className="inbox-empty"><CheckCircle2/><strong>{rows.length?'조건에 맞는 항목이 없습니다.':'현재 확인할 운영 항목이 없습니다.'}</strong>{(query||filter!=='all')&&<button type="button" className="text-button" onClick={()=>{setQuery('');setFilter('all')}}>조건 초기화</button>}</div>}
    <footer><span>총 {filtered.length}건 · 한 프로젝트의 여러 사유를 함께 표시합니다.</span>{filtered.length>limit&&<button type="button" className="text-button" onClick={()=>setLimit(v=>v+10)}>10건 더 보기</button>}</footer>
  </section>
}
