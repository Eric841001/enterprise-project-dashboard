import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Download, X } from "lucide-react";
import { csvCell, seoulToday } from './lib/staffing';
import {buildReport,type ReportKind} from './lib/reporting';
import { supabase } from "./lib/supabase";
import { usePortfolio } from "./portfolio-context";
import type { EvidenceBasis, FollowUpStatus, Project, ProjectStatus, RiskLevel, VerificationState, WorkMode } from "./types";
import { AssignmentRowsEditor } from './AssignmentRowsEditor';
import { EvidenceEditor } from './EvidenceEditor';
import { assignmentErrors, saveError, type AssignmentRow } from './lib/project-save';
import { validBasis } from './lib/evidence';

const categories = [
  "M365 Consulting", "M365 Deployment", "M365 Education", "Azure Consulting",
  "Azure Deployment", "Azure OpenAI", "Copilot", "Security", "Entra ID",
  "Intune", "Defender", "Purview", "Exchange Online", "SharePoint Online",
  "Teams", "Migration", "Change Management", "Managed Service", "Presales", "Other",
];

const statuses: ProjectStatus[] = [
  "Lead", "Qualified", "Proposal", "Negotiation", "Confirmed", "Planning",
  "In Progress", "On Hold", "At Risk", "Completed", "Cancelled", "Archived",
];

interface CustomerOption { id: string; name: string }

function Dialog({ title, eyebrow, open, onClose, children, wide = false, locked = false }: {
  title: string; eyebrow: string; open: boolean; onClose: () => void; children: ReactNode; wide?: boolean; locked?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose,locked]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={() => {if(!locked)onClose()}}>
      <section className={`assignment-dialog management-dialog ${wide ? "wide-dialog" : ""}`} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
          <button className="icon" type="button" disabled={locked} onClick={onClose} aria-label="닫기"><X /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ProjectFormDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project }) {
  const { resources, refresh } = usePortfolio();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [workMode, setWorkMode] = useState<WorkMode>("non_resident");
  const [status, setStatus] = useState<ProjectStatus>("Lead");
  const [probability, setProbability] = useState(10);
  const [progress, setProgress] = useState(0);
  const [risk, setRisk] = useState<RiskLevel>("Low");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scope, setScope] = useState("");
  const [phase, setPhase] = useState("Planning");
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>("Not Required");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDueDate, setNextActionDueDate] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [managerId, setManagerId] = useState("");
  const [assignmentRows, setAssignmentRows] = useState<AssignmentRow[]>([]);
  const [baselineRows, setBaselineRows] = useState<AssignmentRow[]>([]);
  const [expectedVersion, setExpectedVersion] = useState<string | null>(null);
  const [initialManagerId,setInitialManagerId]=useState('');
  const [loaded, setLoaded] = useState(false);
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [contractState, setContractState] = useState<VerificationState>('unverified');
  const [contractBasis, setContractBasis] = useState<EvidenceBasis | null>(null);
  const [scheduleBasis, setScheduleBasis] = useState<EvidenceBasis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !supabase) return;
    let cancelled = false;
    setLoaded(false);
    const client = supabase;
    void (async () => {
      try {
        if (!project) { setAssignmentRows([]); setBaselineRows([]); setExpectedVersion(null); setLoaded(true); return; }
        const p = await client.from('projects').select('updated_at,project_manager_id,project_type,progress,phase,scope_summary').eq('id',project.id).single();
        if (cancelled) return;
        if (p.error) throw p.error;
        if (p.data.updated_at !== project.version) throw new Error('프로젝트 정보가 변경되었습니다. 목록을 새로고침한 뒤 다시 열어 주세요.');
        if ('project_manager_id' in p.data) {setManagerId(p.data.project_manager_id ?? '');setInitialManagerId(p.data.project_manager_id ?? '')}
        if ('project_type' in p.data) setWorkMode(p.data.project_type ?? 'non_resident');
        if ('progress' in p.data) setProgress(p.data.progress);
        if ('phase' in p.data) setPhase(p.data.phase ?? '');
        if ('scope_summary' in p.data) setScope(p.data.scope_summary ?? '');
        const result = await client.from('project_assignments').select('*').eq('project_id',project.id).is('removed_at',null).order('id');
        if (cancelled) return;
        if (result.error) throw result.error;
        setAssignmentRows(result.data as AssignmentRow[]); setBaselineRows(result.data as AssignmentRow[]);
        setExpectedVersion(p.data.updated_at); setLoaded(true);
      } catch (e) { if (!cancelled) setError(saveError(e instanceof Error ? e.message : String((e as {message?:string}).message ?? e))); }
    })();
    void supabase.from("customers").select("id,name").order("name").then(({ data, error: loadError }) => {
      if (loadError) { setError(loadError.message); return; }
      const rows = (data ?? []) as CustomerOption[];
      setCustomers(rows);
      setCustomerId(project ? (rows.find((row) => row.name === project.customer)?.id ?? "") : (rows[0]?.id ?? ""));
    });
    setName(project?.name ?? "");
    setCategory(project?.category ?? categories[0]);
    setWorkMode(project?.workMode ?? "non_resident");
    setStatus(project?.status ?? "Lead");
    setProbability(project?.probability ?? 10);
    setProgress(project?.progressEstimated ? 0 : (project?.progress ?? 0));
    setRisk(project?.risk ?? "Low");
    setStartDate(project?.startDate ?? "");
    setEndDate(project?.endDate ?? "");
    setScope(project?.scope === "범위 미정" ? "" : (project?.scope ?? ""));
    setPhase(project?.phase === '미정' ? '' : (project?.phase ?? "Planning"));
    setFollowUpStatus(project?.followUpStatus ?? "Not Required");
    setNextAction(project?.nextAction ?? "");
    setNextActionDueDate(project?.nextActionDueDate ?? "");
    setEvidenceSummary(project?.evidenceSummary ?? "");
    setManagerId(resources.find((resource) => resource.name === project?.manager)?.id ?? "");
    setInitialManagerId(resources.find((resource) => resource.name === project?.manager)?.id ?? '');
    setContractStart(project?.contractStartDate ?? ''); setContractEnd(project?.contractEndDate ?? '');
    setContractState(project?.contractState ?? 'unverified'); setContractBasis(project?.contractBasis ?? null);
    setScheduleBasis(project?.scheduleBasis ?? null);
    setError("");
    return () => { cancelled = true; };
  }, [open, project, resources]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    if (!customerId || !name.trim()) { setError("고객사와 프로젝트명은 필수입니다."); return; }
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) { setError("수주 확률은 0~100 사이여야 합니다."); return; }
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) { setError("진행률은 0~100 사이여야 합니다."); return; }
    if (!loaded || busy) return;
    const rowErrors = assignmentErrors(assignmentRows, baselineRows);
    if (rowErrors.length) { setError(rowErrors.join(' ')); return; }
    const scheduleChanged = !project || startDate !== (project.startDate ?? '') || endDate !== (project.endDate ?? '') || status !== project.status || probability !== project.probability || managerId !== initialManagerId;
    const removed = baselineRows.some(row => !assignmentRows.some(a => a.id === row.id));
    if ((scheduleChanged || removed) && !validBasis(scheduleBasis)) { setError('일정·확정 상태 변경 또는 배정 제외의 Gmail·Teams 근거를 확인해 주세요.'); return; }
    if (contractStart && contractEnd && contractStart > contractEnd) { setError('계약 시작일과 종료일을 확인해 주세요.'); return; }
    const contractChanged = contractStart !== (project?.contractStartDate ?? '') || contractEnd !== (project?.contractEndDate ?? '') || contractState !== (project?.contractState ?? 'unverified');
    if (contractChanged && !validBasis(contractBasis)) { setError('계약 기간·상태의 Gmail·Teams 근거를 확인해 주세요.'); return; }
    if (contractState === 'confirmed' && (!contractStart || !contractEnd || !validBasis(contractBasis))) { setError('확정 계약은 시작일·종료일과 근거가 필요합니다.'); return; }
    if (startDate && endDate && startDate > endDate) { setError("시작일은 종료일보다 늦을 수 없습니다."); return; }
    if (["Confirmed", "Planning", "In Progress"].includes(status) && (!startDate || !endDate)) {
      setError("확정·계획·진행 프로젝트는 시작일과 종료일이 필요합니다."); return;
    }
    setBusy(true); setError("");
    const payload = {
      customer_id: customerId, name: name.trim(), category, project_type: workMode, status, probability,
      progress, risk_level: risk, start_date: startDate || null, end_date: endDate || null,
      scope_summary: scope.trim() || null, phase: phase.trim() || null,
      follow_up_status: followUpStatus, next_action: nextAction.trim() || null,
      next_action_due_date: nextActionDueDate || null,
      evidence_summary: evidenceSummary.trim() || null,
      project_manager_id: managerId || null,
      contract_start_date: contractStart || null, contract_end_date: contractEnd || null,
      contract_state: contractState, contract_basis: contractBasis, schedule_basis: scheduleBasis,
    };
    try {
      const result = await client.rpc('save_project_operations', {
        p_project_id: project?.id ?? null, p_expected_version: expectedVersion,
        p_expected_assignments: baselineRows, p_project: payload, p_assignments: assignmentRows,
      });
      if (result.error) throw result.error;
      await refresh(); onClose();
    } catch (e) { setError(saveError(e instanceof Error ? e.message : String((e as {message?:string}).message ?? e))); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title={project ? "프로젝트 편집" : "프로젝트 등록"} eyebrow="PROJECT MANAGEMENT" wide locked={busy}>
      <form onSubmit={submit}>
        <fieldset className="project-fields" disabled={busy || !loaded}>
        <div className="form-grid">
          <label>고객사<select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required><option value="">선택</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label>프로젝트명<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>카테고리<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>수행 형태<select value={workMode} onChange={(e) => setWorkMode(e.target.value as WorkMode)}><option value="non_resident">비상주</option><option value="resident">상주</option></select></label>
          <label>상태<select value={status} onChange={(e) => {setStatus(e.target.value as ProjectStatus);setScheduleBasis(null)}}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>수주 확률<input type="number" min="0" max="100" value={probability} onChange={(e) => {setProbability(Number(e.target.value));setScheduleBasis(null)}} /></label>
          <label>진행률<input type="number" min="0" max="100" value={progress} onChange={(e) => setProgress(Number(e.target.value))} /></label>
          <label>위험 수준<select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)}><option>Low</option><option>Medium</option><option>High</option></select></label>
          <label>현재 단계<input value={phase} onChange={(e) => setPhase(e.target.value)} /></label>
          <label>프로젝트 시작일<input type="date" value={startDate} onChange={(e) => {setStartDate(e.target.value);setScheduleBasis(null)}} /></label>
          <label>프로젝트 종료일<input type="date" value={endDate} onChange={(e) => {setEndDate(e.target.value);setScheduleBasis(null)}} /></label>
          <label>계약 시작일<input type="date" value={contractStart} onChange={e => {setContractStart(e.target.value);setContractBasis(null)}} /></label>
          <label>계약 종료일<input type="date" value={contractEnd} onChange={e => {setContractEnd(e.target.value);setContractBasis(null)}} /></label>
          <label>계약 확인 상태<select value={contractState} onChange={e => {setContractState(e.target.value as VerificationState);setContractBasis(null)}}><option value="unverified">미확인</option><option value="tentative">협의 중</option><option value="confirmed">확정</option></select></label>
          <label>프로젝트 매니저<select value={managerId} onChange={(e) => {setManagerId(e.target.value);setScheduleBasis(null)}}><option value="">미지정</option>{managerId&&!resources.some(r=>r.id===managerId)&&<option value={managerId}>기존 담당자 · 기록 유지</option>}{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label>
          <label className="span-2">프로젝트 범위<textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3} /></label>
          <label>후속조치 상태<select value={followUpStatus} onChange={(e) => setFollowUpStatus(e.target.value as FollowUpStatus)}><option value="Not Required">해당 없음</option><option value="Pending">조치 필요</option><option value="Waiting">회신 대기</option><option value="Done">완료</option></select></label>
          <label>후속조치 기한<input type="date" value={nextActionDueDate} onChange={(e) => setNextActionDueDate(e.target.value)} /></label>
          <label className="span-2">다음 액션<textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} rows={2} /></label>
          <label className="span-2">메일·일정 확인 근거<textarea value={evidenceSummary} onChange={(e) => setEvidenceSummary(e.target.value)} rows={3} /></label>
        </div>
        <EvidenceEditor label="프로젝트 일정·확정 상태 / 배정 제외 근거" value={scheduleBasis} onChange={setScheduleBasis} />
        <EvidenceEditor label="계약 기간 확인 근거" value={contractBasis} onChange={setContractBasis} />
        <AssignmentRowsEditor rows={assignmentRows} resources={resources} onChange={setAssignmentRows} disabled={busy || !loaded} />
        </fieldset>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>취소</button><button className="primary" disabled={busy || !loaded}>{busy ? "저장 중…" : project ? "변경 저장" : "프로젝트 등록"}</button></div>
      </form>
    </Dialog>
  );
}

export function CustomerFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh } = usePortfolio();
  const [name, setName] = useState(""); const [englishName, setEnglishName] = useState("");
  const [industry, setIndustry] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (!supabase) return; setBusy(true); const result = await supabase.from("customers").insert({ name: name.trim(), english_name: englishName.trim() || null, industry: industry.trim() || null }); if (result.error) setError(result.error.message); else { await refresh(); onClose(); setName(""); } setBusy(false); }
  return <Dialog open={open} onClose={onClose} title="고객사 등록" eyebrow="CUSTOMER MANAGEMENT"><form onSubmit={submit}><div className="form-grid one-col"><label>고객사명<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>영문명<input value={englishName} onChange={(e) => setEnglishName(e.target.value)} /></label><label>산업군<input value={industry} onChange={(e) => setIndustry(e.target.value)} /></label></div>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>취소</button><button className="primary" disabled={busy}>등록</button></div></form></Dialog>;
}

export function ResourceFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh } = usePortfolio(); const [name, setName] = useState(""); const [role, setRole] = useState("M365 Engineer"); const [skill, setSkill] = useState(""); const [capacity, setCapacity] = useState(100); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (!supabase) return; setBusy(true); const result = await supabase.from("resources").insert({ name: name.trim(), role, primary_skill: skill.trim() || null, available_capacity: capacity }); if (result.error) setError(result.error.message); else { await refresh(); onClose(); setName(""); } setBusy(false); }
  return <Dialog open={open} onClose={onClose} title="리소스 등록" eyebrow="RESOURCE MANAGEMENT"><form onSubmit={submit}><div className="form-grid one-col"><label>이름<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>역할<select value={role} onChange={(e) => setRole(e.target.value)}><option>Project Manager</option><option>Presales Consultant</option><option>Technical Consultant</option><option>M365 Engineer</option><option>Power Platform Engineer</option><option>Azure Engineer</option><option>Security Engineer</option><option>Migration Engineer</option><option>Trainer</option><option>Developer</option></select></label><label>주요 기술<input value={skill} onChange={(e) => setSkill(e.target.value)} /></label><label>가용 용량<input type="number" min="0" max="100" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></label></div>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>취소</button><button className="primary" disabled={busy}>등록</button></div></form></Dialog>;
}

export type {ReportKind} from './lib/reporting';

export function ReportDialog({ kind, onClose,period }: { kind: ReportKind | null; onClose: () => void;period?:{year:number;month:number} }) {
  const { projects, resources } = usePortfolio();
  const reportDate = new Date(`${seoulToday()}T12:00:00+09:00`);
  const reportYear=period?.year??reportDate.getFullYear(),reportMonth=period?.month??reportDate.getMonth()+1;
  const {headers,rows,scope}=useMemo(()=>kind?buildReport(kind,projects,resources,reportYear,reportMonth):{headers:[],rows:[],scope:''},[kind,projects,resources,reportYear,reportMonth]);
  function download() { if (!kind) return; const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${kind}-${reportYear}-${String(reportMonth).padStart(2,'0')}.csv`; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  return <Dialog open={Boolean(kind)} onClose={onClose} title={kind ?? "리포트"} eyebrow="MANAGEMENT REPORT" wide><p className="report-export-scope">{scope}</p><div className="report-actions"><button className="secondary" disabled={!rows.length} onClick={download}><Download /> CSV 내보내기</button><button className="secondary" onClick={() => window.print()}>인쇄 / PDF</button></div>{rows.length?<div className="table-wrap report-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>:<div className="inbox-empty"><strong>선택한 기준에 해당하는 항목이 없습니다.</strong><span>다른 월을 선택하거나 운영 데이터의 기간을 확인해 주세요.</span></div>}<p className="dialog-note">승인된 포트폴리오 기준 · 총 {rows.length}개 항목</p></Dialog>;
}

// Shared with the read-only settings summary.
// eslint-disable-next-line react-refresh/only-export-components
export { categories };
