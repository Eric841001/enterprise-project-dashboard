import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { usePortfolio } from './portfolio-context'
import { evidenceUrl, verificationLabels } from './lib/evidence'
import type { EvidenceBasis, Project } from './types'

type Change = {before:unknown;after:unknown}
interface Log {id:number;actor_id:string;created_at:string;changed_fields:Record<string,Change>}
interface Snapshot {snapshot_date:string;project_count:number;open_count:number;confirmed_count:number;pipeline_count:number;resource_count:number}
const labels:Record<string,string> = {status:'상태',probability:'수주 확률',start_date:'프로젝트 시작일',end_date:'프로젝트 종료일',contract_start_date:'계약 시작일',contract_end_date:'계약 종료일',contract_state:'계약 확인 상태',project_manager_id:'PM'}
function scalar(value:unknown) { return value === null || value === undefined ? '미정' : typeof value === 'string' || typeof value === 'number' ? String(value) : '변경됨' }

export function ProjectEvidence({project}:{project:Project}) {
  return <article className="panel prose"><h2>계약 기간과 확인 근거</h2><dl>
    <div><dt>계약 기간</dt><dd>{project.contractStartDate ?? '미확인'} — {project.contractEndDate ?? '미확인'}</dd></div>
    <div><dt>계약 확인 상태</dt><dd>{verificationLabels[project.contractState ?? 'unverified']}</dd></div>
    {[['계약 근거',project.contractBasis],['프로젝트 일정·확정 근거',project.scheduleBasis]].map(([label,basis]) => {
      const value=basis as EvidenceBasis|undefined, url=evidenceUrl(value)
      return <div key={label as string}><dt>{label as string}</dt><dd>{url ? <><a href={url} target="_blank" rel="noreferrer">{value!.source === 'gmail'?'Gmail':'Teams'} 원문 확인</a><small> · 확인 {new Date(value!.checkedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</small></> : '근거 확인 필요'}</dd></div>
    })}
  </dl><p>계약 기간·프로젝트 기간·개인 투입 기간은 별도로 관리합니다.</p></article>
}

export function ProjectHistory({projectId}:{projectId:string}) {
  const {resources}=usePortfolio()
  const [logs,setLogs]=useState<Log[]>([]),[actors,setActors]=useState<Record<string,string>>({}),[message,setMessage]=useState('변경 이력을 불러오는 중입니다.')
  useEffect(()=>{
    let active=true
    if(!supabase) return
    const client=supabase
    void (async()=>{
      const r=await client.from('project_activity_logs').select('id,actor_id,created_at,changed_fields').eq('project_id',projectId).eq('action','operations_saved').order('created_at',{ascending:false}).limit(50)
      if(!active)return
      if(r.error){setLogs([]);setMessage('변경 이력을 불러오지 못했습니다. 다시 열어 주세요.');return}
      setLogs(r.data as Log[]);setMessage('새 저장 방식으로 기록된 변경 이력이 아직 없습니다.')
      const ids=[...new Set(r.data.map(a=>a.actor_id).filter(Boolean))]
      if(ids.length){const p=await client.from('profiles').select('id,display_name').in('id',ids);if(active)setActors(Object.fromEntries((p.data??[]).map(a=>[a.id,a.display_name&&!a.display_name.includes('@')?a.display_name:'운영자'])))}
    })()
    return()=>{active=false}
  },[projectId])
  function value(field:string,v:unknown){return field==='project_manager_id'? resources.find(r=>r.id===v)?.name ?? (v?'기존 담당자':'미지정'):scalar(v)}
  return <article className="panel prose span-2"><h2>변경 이력</h2>{!logs.length?<p className="muted">{message}</p>:<ol className="operations-history">{logs.map(log=><li key={log.id}>
    <strong>{new Date(log.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · {actors[log.actor_id]??'운영자'}</strong>
    {Object.entries(log.changed_fields).filter(([k])=>labels[k]).map(([key,c])=><p key={key}>{labels[key]}: {value(key,c.before)} → {value(key,c.after)}</p>)}
    {log.changed_fields.assignments && <AssignmentDiff change={log.changed_fields.assignments} names={Object.fromEntries(resources.map(r=>[r.id,r.name]))} />}
  </li>)}</ol>}<small>최신 50건 · 메일 제목·본문과 계약금액은 이력에 보관하지 않습니다.</small></article>
}

function AssignmentDiff({change,names}:{change:Change;names:Record<string,string>}){
  type Row={id:string;resource_id:string;allocation_percentage:number;start_date:string;end_date:string;verification_state?:string;record_kind?:string}
  const before=(Array.isArray(change.before)?change.before:[]) as Row[],after=(Array.isArray(change.after)?change.after:[]) as Row[]
  const ids=[...new Set([...before,...after].map(r=>r.id))]
  const describe=(r:Row|undefined)=>r?`${r.start_date}~${r.end_date} · ${r.allocation_percentage}% · ${r.verification_state??'미분류'} · ${r.record_kind==='included'?'포함 활동':'별도 투입'}`:'배정 없음'
  return <>{ids.flatMap(id=>{const b=before.find(r=>r.id===id),a=after.find(r=>r.id===id);if(JSON.stringify(b)===JSON.stringify(a))return[];return <p key={id}>{names[(a??b)!.resource_id]??'기존 담당자'}: {describe(b)} → {describe(a)}</p>})}</>
}

export function PortfolioTrends(){
  const {canEdit}=usePortfolio()
  const [rows,setRows]=useState<Snapshot[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  async function load(){if(!supabase)return;const r=await supabase.from('portfolio_snapshots').select('snapshot_date,project_count,open_count,confirmed_count,pipeline_count,resource_count').order('snapshot_date',{ascending:false}).limit(90);if(r.error){setMessage('추세 기준점이 아직 준비되지 않았습니다.');return}setRows((r.data??[]) as Snapshot[]);setMessage('')}
  useEffect(()=>{let active=true;if(supabase)void supabase.from('portfolio_snapshots').select('snapshot_date,project_count,open_count,confirmed_count,pipeline_count,resource_count').order('snapshot_date',{ascending:false}).limit(90).then(r=>{if(active){if(r.error)setMessage('추세 기준점이 아직 준비되지 않았습니다.');else setRows((r.data??[]) as Snapshot[])}});return()=>{active=false}},[])
  async function capture(){if(!supabase||busy)return;setBusy(true);try{const r=await supabase.rpc('capture_portfolio_snapshot');if(r.error)throw r.error;await load()}catch{setMessage('기준점을 저장하지 못했습니다. 연결과 운영 DB 업데이트 상태를 확인해 주세요.')}finally{setBusy(false)}}
  return <section className="panel prose"><div className="staffing-section-head"><h2>포트폴리오 변화 추적</h2>{canEdit&&<button className="secondary" disabled={busy} onClick={capture}>{busy?'저장 중…':'현재 기준점 저장'}</button>}</div>
    <p>저장한 날짜 사이의 실제 변화입니다. 과거 데이터는 추정하지 않습니다. 프로젝트 저장 시 오늘 기준점도 갱신됩니다.</p>
    {message&&<p role="status">{message}</p>}
    {!rows.length?<p>첫 기준점을 저장하면 다음 기록부터 증감을 비교합니다.</p>:<div className="table-wrap"><table><thead><tr><th>기준일</th><th>전체</th><th>운영 중</th><th>확정 단계</th><th>파이프라인</th><th>등록 인력</th><th>이전 기록 대비</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.snapshot_date}><th>{r.snapshot_date}</th><td>{r.project_count}</td><td>{r.open_count}</td><td>{r.confirmed_count}</td><td>{r.pipeline_count}</td><td>{r.resource_count}</td><td>{rows[i+1]?`운영 ${r.open_count-rows[i+1].open_count>=0?'+':''}${r.open_count-rows[i+1].open_count} · 확정 ${r.confirmed_count-rows[i+1].confirmed_count>=0?'+':''}${r.confirmed_count-rows[i+1].confirmed_count}`:'첫 기준점'}</td></tr>)}</tbody></table></div>}
  </section>
}
