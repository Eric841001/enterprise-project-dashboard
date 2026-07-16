import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Download, X } from "lucide-react";
import { allocationFor } from "./lib/portfolio";
import { supabase } from "./lib/supabase";
import { usePortfolio } from "./portfolio-context";
import type { Project, ProjectStatus, RiskLevel, WorkMode } from "./types";

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

function Dialog({ title, eyebrow, open, onClose, children, wide = false }: {
  title: string; eyebrow: string; open: boolean; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`assignment-dialog management-dialog ${wide ? "wide-dialog" : ""}`} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
          <button className="icon" type="button" onClick={onClose} aria-label="닫기"><X /></button>
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
  const [managerId, setManagerId] = useState("");
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [assignmentDates, setAssignmentDates] = useState<Record<string, { startDate: string; endDate: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !supabase) return;
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
    setProgress(project?.progress ?? 0);
    setRisk(project?.risk ?? "Low");
    setStartDate(project?.startDate ?? "");
    setEndDate(project?.endDate ?? "");
    setScope(project?.scope === "범위 미정" ? "" : (project?.scope ?? ""));
    setPhase(project?.phase ?? "Planning");
    setManagerId(resources.find((resource) => resource.name === project?.manager)?.id ?? "");
    setSelectedResourceIds(resources.filter((resource) => project?.resources.includes(resource.name)).map((resource) => resource.id));
    setAllocations(Object.fromEntries(resources.map((resource) => [resource.id, project?.resourceAllocations?.[resource.name] ?? 50])));
    setAssignmentDates(Object.fromEntries(resources.map((resource) => {
      const assignment = project?.resourceAssignments?.[resource.name]?.[0];
      return [resource.id, {
        startDate: assignment?.startDate ?? project?.startDate ?? "",
        endDate: assignment?.endDate ?? project?.endDate ?? "",
      }];
    })));
    setError("");
  }, [open, project, resources]);

  function toggleResource(id: string) {
    setSelectedResourceIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      setAssignmentDates((dates) => ({
        ...dates,
        [id]: dates[id]?.startDate && dates[id]?.endDate ? dates[id] : { startDate, endDate },
      }));
      return [...current, id];
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    if (!customerId || !name.trim()) { setError("고객사와 프로젝트명은 필수입니다."); return; }
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) { setError("수주 확률은 0~100 사이여야 합니다."); return; }
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) { setError("진행률은 0~100 사이여야 합니다."); return; }
    if (selectedResourceIds.some((id) => !Number.isFinite(allocations[id]) || allocations[id] < 1 || allocations[id] > 100)) {
      setError("담당 리소스 배정률은 1~100 사이여야 합니다."); return;
    }
    if (selectedResourceIds.some((id) => !assignmentDates[id]?.startDate || !assignmentDates[id]?.endDate || assignmentDates[id].startDate > assignmentDates[id].endDate)) {
      setError("담당 리소스별 올바른 배정 시작일과 종료일을 입력해 주세요."); return;
    }
    if (startDate && endDate && startDate > endDate) { setError("시작일은 종료일보다 늦을 수 없습니다."); return; }
    if (["Confirmed", "Planning", "In Progress"].includes(status) && (!startDate || !endDate)) {
      setError("확정·계획·진행 프로젝트는 시작일과 종료일이 필요합니다."); return;
    }
    setBusy(true); setError("");
    const payload = {
      customer_id: customerId, name: name.trim(), category, project_type: workMode, status, probability,
      progress, risk_level: risk, start_date: startDate || null, end_date: endDate || null,
      scope_summary: scope.trim() || null, phase: phase.trim() || null,
      project_manager_id: managerId || null, updated_at: new Date().toISOString(),
    };
    let projectId = project?.id ?? "";
    if (project) {
      const result = await client.from("projects").update(payload).eq("id", project.id);
      if (result.error) { setError(result.error.message); setBusy(false); return; }
    } else {
      const result = await client.from("projects").insert(payload).select("id").single();
      if (result.error) { setError(result.error.message); setBusy(false); return; }
      projectId = result.data.id;
    }
    const existingResult = await client.from("project_assignments").delete().eq("project_id", projectId);
    if (existingResult.error) { setError(existingResult.error.message); setBusy(false); return; }
    const selected = new Set(selectedResourceIds);
    if (selectedResourceIds.length) {
      const inserts = resources.filter((resource) => selected.has(resource.id)).map((resource) => ({
        project_id: projectId, resource_id: resource.id, role: resource.role,
        allocation_percentage: allocations[resource.id] ?? 50,
        start_date: assignmentDates[resource.id].startDate,
        end_date: assignmentDates[resource.id].endDate,
      }));
      if (inserts.length) {
        const result = await client.from("project_assignments").insert(inserts);
        if (result.error) { setError(result.error.message); setBusy(false); return; }
      }
    }
    await refresh(); setBusy(false); onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={project ? "프로젝트 편집" : "프로젝트 등록"} eyebrow="PROJECT MANAGEMENT" wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>고객사<select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required><option value="">선택</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label>프로젝트명<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>카테고리<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>수행 형태<select value={workMode} onChange={(e) => setWorkMode(e.target.value as WorkMode)}><option value="non_resident">비상주</option><option value="resident">상주</option></select></label>
          <label>상태<select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>수주 확률<input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(Number(e.target.value))} /></label>
          <label>진행률<input type="number" min="0" max="100" value={progress} onChange={(e) => setProgress(Number(e.target.value))} /></label>
          <label>위험 수준<select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)}><option>Low</option><option>Medium</option><option>High</option></select></label>
          <label>현재 단계<input value={phase} onChange={(e) => setPhase(e.target.value)} /></label>
          <label>시작일<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label>종료일<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
          <label>프로젝트 매니저<select value={managerId} onChange={(e) => setManagerId(e.target.value)}><option value="">미지정</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label>
          <label className="span-2">프로젝트 범위<textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3} /></label>
        </div>
        <fieldset className="resource-picker"><legend>담당 리소스·배정률·배정기간</legend>{resources.map((resource) => {
          const selected = selectedResourceIds.includes(resource.id);
          return <div className={`resource-assignment-card ${selected ? "selected" : ""}`} key={resource.id}>
            <label className="resource-toggle"><input type="checkbox" checked={selected} onChange={() => toggleResource(resource.id)} /><span>{resource.name}</span><small>{resource.skill}</small></label>
            {selected && <div className="assignment-fields">
              <label>배정률<input className="allocation-input" aria-label={`${resource.name} 배정률`} type="number" min="1" max="100" value={allocations[resource.id] ?? 50} onChange={(event) => setAllocations((current) => ({ ...current, [resource.id]: Number(event.target.value) }))} /></label>
              <label>배정 시작일<input aria-label={`${resource.name} 배정 시작일`} type="date" value={assignmentDates[resource.id]?.startDate ?? ""} onChange={(event) => setAssignmentDates((current) => ({ ...current, [resource.id]: { ...current[resource.id], startDate: event.target.value } }))} /></label>
              <label>배정 종료일<input aria-label={`${resource.name} 배정 종료일`} type="date" value={assignmentDates[resource.id]?.endDate ?? ""} onChange={(event) => setAssignmentDates((current) => ({ ...current, [resource.id]: { ...current[resource.id], endDate: event.target.value } }))} /></label>
            </div>}
          </div>;
        })}</fieldset>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>취소</button><button className="primary" disabled={busy}>{busy ? "저장 중…" : project ? "변경 저장" : "프로젝트 등록"}</button></div>
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
  return <Dialog open={open} onClose={onClose} title="리소스 등록" eyebrow="RESOURCE MANAGEMENT"><form onSubmit={submit}><div className="form-grid one-col"><label>이름<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>역할<select value={role} onChange={(e) => setRole(e.target.value)}><option>Project Manager</option><option>Presales Consultant</option><option>Technical Consultant</option><option>M365 Engineer</option><option>Azure Engineer</option><option>Security Engineer</option><option>Migration Engineer</option><option>Trainer</option><option>Developer</option></select></label><label>주요 기술<input value={skill} onChange={(e) => setSkill(e.target.value)} /></label><label>가용 용량<input type="number" min="0" max="100" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></label></div>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>취소</button><button className="primary" disabled={busy}>등록</button></div></form></Dialog>;
}

export type ReportKind = "월간 포트폴리오" | "확정 vs 파이프라인" | "리소스 활용률" | "위험 및 이슈" | "고객사 요약" | "업데이트 준수";

export function ReportDialog({ kind, onClose }: { kind: ReportKind | null; onClose: () => void }) {
  const { projects, resources } = usePortfolio();
  const reportDate = new Date();
  const reportYear = reportDate.getFullYear();
  const reportMonth = reportDate.getMonth() + 1;
  const staleThreshold = new Date(reportDate); staleThreshold.setDate(staleThreshold.getDate() - 14);
  const staleDate = staleThreshold.toISOString().slice(0, 10);
  const rows = useMemo(() => {
    if (!kind) return [] as string[][];
    if (kind === "리소스 활용률") return resources.map((resource) => [resource.name, resource.role, `${allocationFor(resource.name, reportMonth, projects, reportYear)}%`, resource.skill]);
    if (kind === "고객사 요약") return Array.from(new Set(projects.map((project) => project.customer))).map((customer) => { const items = projects.filter((project) => project.customer === customer); return [customer, String(items.length), String(items.filter((item) => item.probability === 100).length), String(items.filter((item) => item.probability < 100).length)]; });
    if (kind === "위험 및 이슈") return projects.filter((project) => project.risk !== "Low" || !project.startDate || !project.resources.length).map((project) => [project.customer, project.name, project.risk, !project.startDate ? "일정 미정" : !project.resources.length ? "리소스 미지정" : "위험 검토"]);
    if (kind === "업데이트 준수") return [...projects].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).map((project) => [project.customer, project.name, project.updatedAt, project.updatedAt < staleDate ? "업데이트 필요" : "정상"]);
    return projects.filter((project) => kind !== "확정 vs 파이프라인" || project.probability > 0).map((project) => [project.customer, project.name, `${project.probability}%`, project.status, project.startDate ?? "미정", project.endDate ?? "미정"]);
  }, [kind, projects, resources, reportMonth, reportYear, staleDate]);
  const headers = kind === "리소스 활용률" ? ["리소스", "역할", `${reportMonth}월 활용률`, "주요 기술"] : kind === "고객사 요약" ? ["고객사", "전체", "확정", "파이프라인"] : kind === "위험 및 이슈" ? ["고객사", "프로젝트", "위험", "검토 항목"] : kind === "업데이트 준수" ? ["고객사", "프로젝트", "최근 업데이트", "상태"] : ["고객사", "프로젝트", "확률", "상태", "시작일", "종료일"];
  function download() { if (!kind) return; const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map((cell) => '"' + String(cell).replaceAll('"', '""') + '"').join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${kind}.csv`; anchor.click(); URL.revokeObjectURL(url); }
  return <Dialog open={Boolean(kind)} onClose={onClose} title={kind ?? "리포트"} eyebrow="MANAGEMENT REPORT" wide><div className="report-actions"><button className="secondary" onClick={download}><Download /> CSV 내보내기</button><button className="secondary" onClick={() => window.print()}>인쇄 / PDF</button></div><div className="table-wrap report-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div><p className="dialog-note">현재 승인된 포트폴리오 데이터를 기준으로 생성되었습니다. 총 {rows.length}개 항목입니다.</p></Dialog>;
}

// Shared with the read-only settings summary.
// eslint-disable-next-line react-refresh/only-export-components
export { categories };
