import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, CalendarRange, Check, ChevronLeft, ChevronRight, ClipboardList, Download, Grid2X2, SlidersHorizontal, Table2, Users, X } from 'lucide-react'
import type { Project, Resource } from './types'
import { compareDraft, planningMonths, resourceLoad, reviewProjects, seoulToday, staffingCsv } from './lib/staffing'
import { dailyLoad } from './lib/timeline'
import { evidenceUrl, verificationLabels } from './lib/evidence'
import './staffing.css'

type Period = ReturnType<typeof planningMonths>[number]
const stateLabels: Record<string, string> = { over: '과할당', unknown: '투입률 확인 필요', tentative: '예정 포함', near: '용량 임박', available: '가용' }
const statusLabels: Record<string, string> = { Lead: '리드', Qualified: '검증', Proposal: '제안', Negotiation: '협상', Confirmed: '확정', Planning: '계획', 'In Progress': '진행 중', 'At Risk': '위험', 'On Hold': '보류' }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId(), ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    root?.querySelector<HTMLButtonElement>('button')?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Tab') {
        const elements = [...(root?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]') ?? [])]
        const first = elements[0], last = elements[elements.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', keydown); previous?.focus() }
  }, [onClose])
  return <div className="staffing-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section ref={ref} className="staffing-modal" role="dialog" aria-modal="true" aria-labelledby={id}>
      <header><div><span className="staffing-eyebrow">RESOURCE OPERATIONS</span><h2 id={id}>{title}</h2></div><button type="button" className="icon" onClick={onClose} title="닫기" aria-label="닫기"><X /></button></header>
      {children}
    </section>
  </div>
}

export function StaffingWorkspace({ resources, projects, year, month, children }: {
  resources: Resource[]; projects: Project[]; year: number; month: number; children: ReactNode
}) {
  const [view, setView] = useState('matrix')
  const [filter, setFilter] = useState('all')
  const [detail, setDetail] = useState<{ resource: Resource; period: Period } | null>(null)
  const [simulator, setSimulator] = useState<{ resource: Resource; period: Period } | null>(null)
  const [queue, setQueue] = useState<'unassigned' | 'stale' | 'unscheduled' | 'overdue' | 'ended'>('unassigned')
  const periods = planningMonths(year, month)
  const loads = resources.map(resource => {const load=resourceLoad(resource,year,month,projects),daily=dailyLoad(resource,projects,year,month);return {resource,load,daily,free:load.unknown||daily.unknown?null:Math.max(0,load.capacity-daily.peak)}})
  const shown = loads.filter(({ load,daily,free }) => filter === 'all' || (filter === 'free' ? free !== null && free > 0 : filter === 'over' ? daily.peak>load.capacity : load.unknown||daily.unknown))
  const review = reviewProjects(projects)
  const closeDetail = useCallback(() => setDetail(null), [])
  const closeSimulator = useCallback(() => setSimulator(null), [])
  function download() {
    const url = URL.createObjectURL(new Blob([staffingCsv(shown.map(r => r.resource), projects, year, month)], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `staffing-${periods[0].key}.csv`; a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="staffing-workspace">
    <div className="staffing-summary" aria-label="선택 월 투입 현황">
      <div><span>관리 인력</span><strong>{resources.length}<small>명</small></strong><span>{year}년 {month}월</span></div>
      <div data-tone="over"><span>과할당</span><strong>{loads.filter(r => r.daily.peak>r.load.capacity).length}<small>명</small></strong><span>날짜가 겹치는 용량 초과</span></div>
      <div data-tone="available"><span>여유 인력</span><strong>{loads.filter(r => r.free !== null && r.free > 0).length}<small>명</small></strong><span>날짜별 최대 투입 기준</span></div>
      <div data-tone="unknown"><span>투입률 확인 필요</span><strong>{loads.filter(r => r.load.unknown).length}<small>명</small></strong><span>미입력 · 담당만 지정</span></div>
    </div>
    <div className="staffing-viewbar">
      <div role="tablist" aria-label="리소스 보기">
        {[['matrix', '월별 투입률', Table2], ['people', '인력별 보기', Users], ['review', '운영 점검', ClipboardList]].map(([key, label, Icon]) => {
          const I = Icon as typeof Table2
          return <button key={key as string} id={`staffing-tab-${key}`} role="tab" tabIndex={view === key ? 0 : -1} aria-selected={view === key} aria-controls="staffing-view" onClick={() => setView(key as string)} onKeyDown={e => {
            if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return
            e.preventDefault()
            const tabs = [...(e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])]
            const index = tabs.indexOf(e.currentTarget)
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
            tabs[next]?.click(); tabs[next]?.focus()
          }}><I />{label as string}</button>
        })}
      </div>
      {view !== 'people' && <div className="staffing-actions">
        <button type="button" className="secondary" disabled={!resources.length} onClick={() => setSimulator({ resource: resources[0], period: periods[0] })}><SlidersHorizontal /> 배정 검토</button>
        {view === 'matrix' && <button type="button" className="icon" disabled={!shown.length} onClick={download} aria-label="월별 투입률 CSV 다운로드" title="CSV 다운로드"><Download /></button>}
      </div>}
    </div>
    <div id="staffing-view" role="tabpanel" aria-labelledby={`staffing-tab-${view}`}>
      {view === 'people' ? children : view === 'matrix' ? <>
        <div className="staffing-section-head"><div><h2>6개월 배정 현황</h2><span>{periods[0].label} - {periods[5].label}</span></div>
          <label className="staffing-filter">배정 상태 <select aria-label="배정 상태 필터" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">전체 인력</option><option value="over">과할당</option><option value="free">여유 있음</option><option value="unknown">투입률 확인 필요</option></select></label>
        </div>
        <div className="staffing-legend"><span><i className="firm" />확정 배정</span><span><i className="tentative" />제안·협상 포함</span><span><i className="over" />용량 초과</span><span><i className="unknown" />투입률 미입력</span></div>
        <div className="staffing-table-scroll">
          <table className="staffing-matrix"><caption className="sr-only">인력별 6개월 투입률. 월별 상세에서 프로젝트별 배정 근거 확인.</caption>
            <thead><tr><th scope="col">인력 / 주요 기술</th>{periods.map(p => <th key={p.key} scope="col" aria-current={p.key === seoulToday().slice(0, 7) ? 'date' : undefined}>{p.label}</th>)}<th scope="col">다음 여유</th></tr></thead>
            <tbody>{shown.map(({ resource }) => {
              const forecast = periods.map(p => {const load=resourceLoad(resource,p.year,p.month,projects),daily=dailyLoad(resource,projects,p.year,p.month);return {period:p,load,daily}})
              const free = forecast.find(p => !p.load.unknown && !p.daily.unknown && p.daily.peak<p.load.capacity)?.period
              return <tr key={resource.id}>
                <th scope="row"><button className="staffing-person" onClick={() => setDetail({ resource, period: periods[0] })}><span className="avatar">{resource.name.slice(0, 2)}</span><span><strong>{resource.name}</strong><small>{resource.skill}</small></span></button></th>
                {periods.map(period => {
                  const l = resourceLoad(resource, period.year, period.month, projects)
                  const d=dailyLoad(resource,projects,period.year,period.month)
                  const tone=d.peak>l.capacity?'over':l.unknown||d.unknown?'unknown':l.tentative>0?'tentative':d.peak>=l.capacity*.8&&d.peak>0?'near':'available'
                  return <td key={period.key}><button className={`staffing-cell ${tone}`} onClick={() => setDetail({ resource, period })} title={`날짜별 최대 ${d.peak}% · 등록 합계 ${l.total}% · 새 근거 확인 ${l.confirmed}% · 예정 ${l.tentative}% · 기존 등록 ${l.legacy}%${l.unknown ? ' · 미확인 있음' : ''}`} aria-label={`${resource.name} ${period.year}년 ${period.month}월 투입 상세`}>
                    <strong>{l.unknown && d.peak === 0 ? '미입력' : `${d.peak}%`}{l.unknown && <AlertCircle aria-label="미입력 포함" />}</strong><small>{l.lines.length ? `${l.lines.length}개 프로젝트${l.total!==d.peak?` · 합계 ${l.total}%`:''}` : '배정 없음'}</small>
                  </button></td>
                })}
                <td><span className="staffing-next">{free ? free.label : forecast.some(p => p.load.unknown) ? '확인 필요' : '기간 내 없음'}</span></td>
              </tr>
            })}</tbody>
          </table>
          {!shown.length && <div className="staffing-empty"><Grid2X2 /><p>조건에 맞는 인력이 없습니다.</p>{filter !== 'all' && <button className="secondary" onClick={() => setFilter('all')}>필터 초기화</button>}</div>}
        </div>
        <p className="muted">셀 숫자는 해당 월의 날짜별 최대 투입률입니다. 상세에서 등록 합계·달력일 평균과 구분해 확인할 수 있습니다.</p>
      </> : <>
        <div className="staffing-section-head"><div><h2>운영 점검</h2><span>{seoulToday()} 기준</span></div></div>
        <div className="staffing-queue-tabs">{([['unassigned','인력 미배정'],['stale','7일 이상 미갱신'],['unscheduled','기간 확인 필요'],['overdue','후속조치 기한 초과'],['ended','종료일 경과']] as const).map(([key,label]) => <button aria-pressed={queue === key} key={key} onClick={() => setQueue(key)}>{label}<b>{review[key].length}</b></button>)}</div>
        <div className="staffing-queue">{review[queue].map(p => <Link key={p.id} to={`/projects/${p.id}`}><span><strong>{p.customer}</strong><span>{p.name}</span><small>{statusLabels[p.status] ?? p.status} · {p.manager} · 최근 변경 {p.updatedAt}</small></span><ArrowRight /></Link>)}{!review[queue].length && <div className="staffing-empty"><Check /><p>해당하는 프로젝트가 없습니다.</p></div>}</div>
      </>}
    </div>
    {detail && <ResourceDetail resource={detail.resource} initialPeriod={detail.period} projects={projects} onClose={closeDetail} onSimulate={period => { setSimulator({ resource: detail.resource, period }); setDetail(null) }} />}
    {simulator && <AllocationSimulation resources={resources} initial={simulator.resource} year={simulator.period.year} month={simulator.period.month} projects={projects} onClose={closeSimulator} />}
  </div>
}

function ResourceDetail({ resource, initialPeriod, projects, onClose, onSimulate }: {
  resource: Resource; initialPeriod: Period; projects: Project[]; onClose: () => void; onSimulate: (period: Period) => void
}) {
  const [period, setPeriod] = useState(initialPeriod)
  const load = resourceLoad(resource, period.year, period.month, projects)
  const timeline = dailyLoad(resource, projects, period.year, period.month)
  const detailTone = timeline.peak>load.capacity?'over':load.unknown||timeline.unknown?'unknown':load.tentative>0?'tentative':timeline.peak>=load.capacity*.8&&timeline.peak>0?'near':'available'
  const history = projects.filter(p => p.resources.includes(resource.name) || p.manager === resource.name)
  function move(amount: number) { setPeriod(planningMonths(period.year, period.month + amount, 1)[0]) }
  return <Modal title={`${resource.name} · 배정 상세`} onClose={onClose}>
    <div className="staffing-modal-body">
      <div className="staffing-detail-top"><p>{resource.role}<br /><strong>{resource.skill}</strong></p><div className="staffing-month-switch"><button className="icon" title="이전 달" aria-label="이전 달" onClick={() => move(-1)}><ChevronLeft /></button><strong>{period.label}</strong><button className="icon" title="다음 달" aria-label="다음 달" onClick={() => move(1)}><ChevronRight /></button></div></div>
      <div className={`staffing-load ${detailTone}`}><div><span>등록 투입률 합계</span><strong>{load.total}%</strong></div><span>{load.total>timeline.peak&&detailTone!=='over'?'기간 분산 배정':stateLabels[detailTone]}</span><small>새 근거 확인 {load.confirmed}% · 예정 {load.tentative}% · 기존 등록 유지 {load.legacy}% · 미확인 {load.unverified}% · 기준 용량 {load.capacity}%</small></div>
      {load.unknown && <p className="staffing-caution"><AlertCircle />미입력 배정이 있어 실제 투입률은 등록 합계와 다를 수 있습니다.</p>}
      <section className="staffing-daily" aria-label="날짜별 겹침 확인"><h3>날짜별 투입 확인</h3>
        <p>월중 최대 <strong>{timeline.peak}%</strong> · 달력일 평균 <strong>{timeline.average}%</strong> · 용량 초과 <strong>{timeline.conflicts.length}일</strong></p>
        <small>등록된 기간의 날짜별 합산입니다. 실근무시간·휴가·공휴일을 반영한 가동률은 아닙니다.{timeline.unknown && ' 미확인 배정이 있어 가용량은 추가 확인이 필요합니다.'}</small>
        <div className="staffing-days">{timeline.rows.map(d => <span key={d.date} className={d.over?'over':d.unknown?'unknown':''} title={`${d.date} · ${d.total}% · ${[...new Set(d.lines.map(l=>l.project.customer))].join(', ')}`}><small>{d.date.slice(8)}</small><strong>{d.total}%</strong></span>)}</div>
        {timeline.conflicts.length > 0 && <details><summary>겹치는 날짜와 프로젝트 보기</summary>{timeline.conflicts.map(d => <p key={d.date}>{d.date} · {d.total}% · {[...new Set(d.lines.map(l=>`${l.project.customer} ${l.project.name}`))].join(' / ')}</p>)}</details>}
      </section>
      <h3>이달 배정 근거</h3>
      <div className="staffing-detail-lines">{load.lines.map(line => <div key={line.project.id}>
        <div><Link to={`/projects/${line.project.id}`} onClick={onClose}><strong>{line.project.customer} · {line.project.name}</strong><ArrowRight /></Link><small>{statusLabels[line.project.status] ?? line.project.status} · {line.managerOnly ? 'PM 지정만 있음' : '배정 기록'}</small>
          {line.dates.map((d, i) => <time key={i}>{d.startDate} - {d.endDate}</time>)}
          {line.project.resourceAssignments?.[resource.name]?.filter(a => a.startDate.slice(0,7)<=period.key && a.endDate.slice(0,7)>=period.key).map((a,i) => <small key={`basis-${a.id ?? i}`}>
            {a.verification ? verificationLabels[a.verification] : '기존 등록값 · 근거 상태 미분류'} · {a.kind === 'included' ? '기본 배정 포함 활동' : '별도 투입'}
            {evidenceUrl(a.basis) && <a href={evidenceUrl(a.basis)} target="_blank" rel="noreferrer"> 확인 근거</a>}
          </small>)}
          {!line.dates.length && <time>{line.project.startDate ?? '시작일 미정'} - {line.project.endDate ?? '종료일 미정'}</time>}
        </div><strong className={line.unknown ? 'staffing-unknown-text' : ''}>{line.allocation}%{line.unknown && <small>미입력 포함</small>}</strong>
      </div>)}{!load.lines.length && <p className="muted">이달 배정된 프로젝트가 없습니다.</p>}</div>
      <details className="staffing-history"><summary>프로젝트 이력 <b>{history.length}</b></summary>{history.map(p => <Link key={p.id} to={`/projects/${p.id}`} onClick={onClose}><span>{p.customer} · {p.name}</span><small>{statusLabels[p.status] ?? p.status}</small></Link>)}</details>
    </div>
    <footer><span>배정 기록 기준 · 휴가 미반영</span><button className="primary" onClick={() => onSimulate(period)}><SlidersHorizontal />추가 배정 검토</button></footer>
  </Modal>
}

function AllocationSimulation({ resources, initial, year, month, projects, onClose }: {
  resources: Resource[]; initial: Resource; year: number; month: number; projects: Project[]; onClose: () => void
}) {
  const first = planningMonths(year, month, 1)[0]
  const [resourceId, setResourceId] = useState(initial.id)
  const [allocation, setAllocation] = useState(25)
  const [start, setStart] = useState(`${first.key}-01`)
  const [end, setEnd] = useState(`${first.key}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`)
  const resource = resources.find(r => r.id === resourceId) ?? initial
  const rows = compareDraft(resource, projects, start, end, allocation)
  const overloaded = rows.filter(r => r.over)
  return <Modal title="추가 배정 검토" onClose={onClose}>
    <div className="staffing-modal-body">
      <div className="staffing-simulation-fields">
        <label>인력<select value={resourceId} onChange={e => setResourceId(e.target.value)}>{resources.map(r => <option key={r.id} value={r.id}>{r.name} · {r.skill}</option>)}</select></label>
        <label>시작일<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>종료일<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
      </div>
      <div className="staffing-slider"><label htmlFor="draft-allocation">추가 투입률</label><strong>{allocation}%</strong><input id="draft-allocation" aria-label="추가 투입률" type="range" min="0" max="100" step="5" value={allocation} onChange={e => setAllocation(Number(e.target.value))} /></div>
      {!rows.length ? <p role="alert" className="form-error">시작일·종료일을 확인해 주세요. 검토 기간은 최대 24개월입니다.</p> : <>
        <div className={`staffing-simulation-result ${overloaded.length ? 'over' : 'available'}`} role="status">{overloaded.length ? <AlertCircle /> : <Check />}<span>{overloaded.length ? `${overloaded.length}개월 용량 초과` : '등록 용량 이내'}<small>{rows.some(r => r.before.unknown) ? '미입력 배정 포함: 실제 가용량 확인 필요' : '기존 배정 + 추가 투입률'}</small></span></div>
        <div className="staffing-simulation-table"><table><caption className="sr-only">추가 배정 전후 비교</caption><thead><tr><th>기간</th><th>기존 최대</th><th>추가 후 최대</th><th>최소 잔여 용량</th></tr></thead><tbody>{rows.map(r => <tr key={r.key}><th>{r.label}</th><td>{r.before.total}%{r.before.unknown && ' + 미입력'}</td><td className={r.over ? 'staffing-over-text' : ''}>{r.after}%</td><td>{r.before.unknown ? '확인 필요' : `${r.before.capacity - r.after}%`}</td></tr>)}</tbody></table></div>
      </>}
    </div>
    <footer><span><CalendarRange />검토 전용 · 기존 배정 변경 없음</span><button className="secondary" onClick={onClose}>검토 닫기</button></footer>
  </Modal>
}
