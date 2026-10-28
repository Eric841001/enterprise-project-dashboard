import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Download,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  X,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PortfolioProvider, usePortfolio } from "./portfolio-context";
import {
  CustomerFormDialog,
  ProjectFormDialog,
  ReportDialog,
  ResourceFormDialog,
  categories,
  type ReportKind,
} from "./ManagementDialogs";
import {
  activeInMonth,
  resourceActiveInMonth,
  projectWarnings,
  toCsv,
} from "./lib/portfolio";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { Project, Resource, RiskLevel } from "./types";
import { StaffingWorkspace } from "./StaffingWorkspace";
import { resourceLoad, reviewProjects, seoulToday } from "./lib/staffing";
import { PortfolioTrends, ProjectEvidence, ProjectHistory } from './OperationsHistory';
import { dailyLoad } from './lib/timeline';
import { WorkspaceSearch } from './WorkspaceSearch';
import { OperationsInbox } from './OperationsInbox';
import { PeriodNavigator } from './PeriodNavigator';
import { monthlyPortfolio, operationalInbox, parseMonth, pipelineStatuses } from './lib/workspace';

let projects: Project[] = [];
let resources: Resource[] = [];

const statusKo: Record<string, string> = {
  Lead: "리드",
  Qualified: "검증",
  Proposal: "제안",
  Negotiation: "협상",
  Confirmed: "확정",
  Planning: "계획",
  "In Progress": "진행 중",
  "At Risk": "위험",
  Completed: "완료",
  Cancelled: "취소",
  Archived: "보관",
  "On Hold": "보류",
};
const projectStatuses = [
  "Lead", "Qualified", "Proposal", "Negotiation", "Confirmed", "Planning",
  "In Progress", "On Hold", "At Risk", "Completed", "Cancelled", "Archived",
] as const;

const colors = [
  "#0b69a3",
  "#16a085",
  "#7c5ce5",
  "#e69a2d",
  "#d9534f",
  "#5b6b7b",
];

function appRedirectUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}

function authErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Failed to fetch") {
    return "인증 서버에 연결하지 못했습니다. Supabase URL/anon key, 네트워크, 브라우저 차단 설정을 확인하세요.";
  }
  if (error instanceof Error) return error.message;
  return "인증 요청 중 알 수 없는 오류가 발생했습니다.";
}

function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [signedIn, setSignedIn] = useState(!isSupabaseConfigured);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const fallback = window.setTimeout(() => {
      if (!active) return;
      setSignedIn(false);
      setReady(true);
    }, 5000);
    void client.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSignedIn(Boolean(data.session));
      })
      .catch(() => {
        if (!active) return;
        setSignedIn(false);
      })
      .finally(() => {
        if (!active) return;
        window.clearTimeout(fallback);
        setReady(true);
      });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSignedIn(Boolean(session));
      setReady(true);
    });
    return () => {
      active = false;
      window.clearTimeout(fallback);
      data.subscription.unsubscribe();
    };
  }, []);
  if (!ready) return <div className="center-state">세션 확인 중…</div>;
  if (recovering) return <ResetPassword onDone={() => setRecovering(false)} />;
  if (!signedIn) return <Login />;
  return <>{children}</>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setError(authError ? authErrorMessage(authError) : "");
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword() {
    if (!supabase || !email) return;
    const requestedAt = new Date().toLocaleTimeString("ko-KR");
    setBusy(true);
    setError("");
    setNotice(`${requestedAt} 비밀번호 재설정 메일을 요청하는 중입니다.`);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: appRedirectUrl(),
      });
      if (resetError) {
        setNotice(`${requestedAt} 요청이 인증 서버에서 실패했습니다.`);
        setError(authErrorMessage(resetError));
      } else {
        setNotice(
          `${requestedAt} 요청을 보냈습니다. 메일이 오지 않으면 등록된 계정인지, 스팸함, Supabase Auth 이메일/Redirect URL 설정을 확인하세요.`,
        );
      }
    } catch (resetError) {
      setNotice(`${requestedAt} 요청이 브라우저에서 실패했습니다.`);
      setError(authErrorMessage(resetError));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="brand-mark">P</div>
        <p className="eyebrow">PROJECT OPERATIONS</p>
        <h1>
          프로젝트의 현재와
          <br />
          다음을 한눈에.
        </h1>
        <p>
          고객, 일정, 인력과 리스크를 하나의 안전한 포트폴리오에서 관리하세요.
        </p>
      </section>
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">SECURE WORKSPACE</p>
        <h2>로그인</h2>
        <p className="muted">승인된 계정으로 포트폴리오에 접속합니다.</p>
        <label>
          이메일
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <div aria-live="polite">
          {error && <p className="form-error">{error}</p>}
          {notice && <p className="form-success">{notice}</p>}
        </div>
        <button className="primary wide" disabled={busy}>
          {busy ? "확인 중…" : "로그인"}
        </button>
        <button
          type="button"
          className="secondary wide"
          onClick={() => void resetPassword()}
          disabled={!email || busy}
        >
          {busy ? "요청 중…" : "비밀번호 재설정 메일 보내기"}
        </button>
      </form>
    </main>
  );
}

function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setNotice("");
    if (password.length < 8) {
      setError("비밀번호는 8자 이상으로 설정하세요.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else {
      setNotice("비밀번호를 변경했습니다. 새 비밀번호로 로그인할 수 있습니다.");
      window.setTimeout(onDone, 1200);
    }
    setBusy(false);
  }
  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="brand-mark">P</div>
        <p className="eyebrow">PROJECT OPERATIONS</p>
        <h1>
          새 비밀번호를
          <br />
          설정하세요.
        </h1>
        <p>재설정 메일로 인증된 세션에서만 비밀번호를 변경할 수 있습니다.</p>
      </section>
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">PASSWORD RESET</p>
        <h2>비밀번호 재설정</h2>
        <p className="muted">8자 이상의 새 비밀번호를 입력합니다.</p>
        <label>
          새 비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label>
          새 비밀번호 확인
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </label>
        <div aria-live="polite">
          {error && <p className="form-error">{error}</p>}
          {notice && <p className="form-success">{notice}</p>}
        </div>
        <button className="primary wide" disabled={busy}>
          {busy ? "변경 중…" : "비밀번호 변경"}
        </button>
      </form>
    </main>
  );
}

const nav = [
  ["/", "대시보드", LayoutDashboard],
  ["/projects", "프로젝트", BriefcaseBusiness],
  ["/schedule", "일정", CalendarDays],
  ["/resources", "리소스", Users],
  ["/customers", "고객사", Building2],
  ["/reports", "리포트", FileBarChart],
  ["/settings", "설정", Settings],
] as const;

function Shell() {
  const portfolio = usePortfolio();
  projects = portfolio.projects;
  resources = portfolio.resources;
  const [open, setOpen] = useState(false);
  const [compact,setCompact]=useState(()=>window.matchMedia?.('(max-width:760px)').matches??false);
  const [dark, setDark] = useState(() => localStorage.getItem("portfolio-theme") === "dark");
  const [showAlerts, setShowAlerts] = useState(false);
  const location = useLocation();
  const alerts = operationalInbox(portfolio.projects);
  useEffect(()=>{const media=window.matchMedia?.('(max-width:760px)');if(!media)return;const update=()=>{setCompact(media.matches);if(!media.matches)setOpen(false)};media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
  useEffect(() => {setOpen(false);setShowAlerts(false)}, [location.pathname]);
  useEffect(() => localStorage.setItem("portfolio-theme", dark ? "dark" : "light"), [dark]);
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);setShowAlerts(false)}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);
  useEffect(()=>{if(!open)return;const sidebar=document.querySelector<HTMLElement>('.sidebar'),previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const items=()=>[...(sidebar?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')??[])].filter(e=>e.getClientRects().length>0);items()[0]?.focus();const trap=(e:KeyboardEvent)=>{if(e.key!=='Tab')return;const elements=items(),first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}};window.addEventListener('keydown',trap);return()=>{window.removeEventListener('keydown',trap);document.body.style.overflow=overflow;previous?.focus()}},[open]);
  useEffect(()=>{if(!showAlerts)return;const close=(e:PointerEvent)=>{if(!(e.target as Element).closest?.('.header-actions'))setShowAlerts(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[showAlerts]);
  return (
    <div className={dark ? "app dark" : "app"}>
      <aside id="workspace-navigation" className={open ? "sidebar open" : "sidebar"} inert={compact&&!open} aria-hidden={compact&&!open?true:undefined}>
        <div className="logo">
          <div className="brand-mark small">P</div>
          <div>
            <strong>Portfolio</strong>
            <span>Delivery Office</span>
          </div>
          <button
            className="icon mobile-only"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
          >
            <X />
          </button>
        </div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="avatar">AD</div>
          <div>
            <strong>{portfolio.role === "admin" ? "관리자" : portfolio.role === "manager" ? "매니저" : "조회 사용자"}</strong>
            <span>
              {isSupabaseConfigured ? "Secure workspace" : "읽기 전용 미리보기"}
            </span>
          </div>
        </div>
      </aside>
      {open&&<button type="button" className="sidebar-backdrop" aria-label="메뉴 바깥 닫기" onClick={()=>setOpen(false)}/>}
      <div className="main">
        <header>
          <button
            className="icon mobile-only"
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={open}
            aria-controls="workspace-navigation"
          >
            <Menu />
          </button>
          <WorkspaceSearch projects={portfolio.projects}/>
          <div className="header-actions">
            <span className={`sync ${portfolio.error?'sync-error':''}`} role="status">{portfolio.loading?'데이터 갱신 중':portfolio.error?'데이터 확인 필요':portfolio.refreshedAt?`최근 갱신 ${new Date(portfolio.refreshedAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false})}`:isSupabaseConfigured?'데이터 연결 중':'데이터 연결 없음'}</span>
            <button type="button" className="icon refresh-data" disabled={portfolio.loading||!isSupabaseConfigured} aria-label="데이터 새로고침" title="승인된 최신 데이터 다시 불러오기" onClick={()=>void portfolio.refresh()}><RefreshCw className={portfolio.loading?'refresh-spinning':''}/></button>
            <button
              className="icon"
              onClick={() => setDark(!dark)}
              aria-label="테마 변경"
            >
              {dark ? <Sun /> : <Moon />}
            </button>
            <button className="icon notification-button" onClick={() => setShowAlerts((value) => !value)} aria-label="주의 항목 알림">
              <Bell />
              {alerts.length > 0 && <i>{alerts.length}</i>}
            </button>
            {showAlerts && (
              <div className="notification-panel">
                <strong>주의 항목 {alerts.length}건</strong>
                {alerts.slice(0, 5).map(({project,kinds}) => <Link key={project.id} to={`/projects/${project.id}`} onClick={() => setShowAlerts(false)}><span>{project.customer} · {project.name}</span><small>{kinds.includes('overdue')?'조치 기한 초과':kinds.includes('risk')?'고위험':kinds.includes('ended')?'종료일 확인':'일정·배정 확인'}</small></Link>)}
                {!alerts.length && <p>현재 주의 항목이 없습니다.</p>}
                <Link to="/" onClick={()=>setShowAlerts(false)}>운영 조치함 전체 보기 <ChevronRight/></Link>
              </div>
            )}
            {supabase && (
              <button
                className="icon"
                onClick={() => void supabase?.auth.signOut()}
                aria-label="로그아웃"
              >
                <LogOut />
              </button>
            )}
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  desc,
  action,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {action}
    </div>
  );
}
function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function statusTone(status: string) {
  return status === "In Progress"
    ? "teal"
    : status === "Confirmed"
      ? "blue"
      : status === "Proposal" || status === "Qualified" || status === "Negotiation"
        ? "purple"
        : status === "At Risk"
          ? "red"
          : status === "Cancelled"
            ? "red"
            : "gray";
}
function riskTone(risk: RiskLevel) {
  return risk === "High" ? "red" : risk === "Medium" ? "amber" : "teal";
}

function Dashboard() {
  const { projects, loading, error } = usePortfolio();
  if (loading)
    return (
      <div className="center-state">
        승인된 포트폴리오 데이터를 불러오는 중…
      </div>
    );
  if (error)
    return (
      <div className="warning">
        <AlertTriangle />
        데이터를 불러오지 못했습니다. 계정 승인 상태와 Supabase 설정을
        확인하세요. ({error})
      </div>
    );
  const active = projects.filter((p) =>
    ["Confirmed", "Planning", "In Progress", "At Risk", "On Hold"].includes(p.status),
  );
  const high = projects.filter((p) => !['Completed','Cancelled','Archived'].includes(p.status)&&(p.risk === "High"||p.status==='At Risk'));
  const assigned = resources.filter(resource => active.some(p => p.resources.includes(resource.name) || p.manager === resource.name)).length;
  const now = new Date();
  const dashboardYear = now.getFullYear();
  const dashboardMonth = now.getMonth() + 1;
  const overallocated = resources.filter((resource) => dailyLoad(resource,projects,dashboardYear,dashboardMonth).peak>resource.capacity);
  const review = reviewProjects(projects);
  const weightedPipeline = projects.filter(p => ["Lead","Qualified","Proposal","Negotiation"].includes(p.status)).reduce((sum,p) => sum + p.probability / 100, 0);
  const statusData = Object.entries(
    projects.reduce<Record<string, number>>(
      (a, p) => ((a[p.status] = (a[p.status] || 0) + 1), a),
      {},
    ),
  ).map(([name, value]) => ({ name: statusKo[name], value }));
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: `${i + 1}월`,
    projects: projects.filter((p) => activeInMonth(p, i + 1, dashboardYear)).length,
  }));
  return (
    <>
      <PageTitle
        eyebrow="EXECUTIVE OVERVIEW"
        title="프로젝트 포트폴리오"
        desc="전체 딜리버리 현황과 지금 확인해야 할 항목입니다."
        action={
          <Link className="primary" to="/projects">
            <Plus /> 프로젝트 등록
          </Link>
        }
      />
      {!isSupabaseConfigured && (
        <div className="preview-note">
          <CircleHelp />
          <span>
            <strong>읽기 전용 미리보기</strong> — Supabase 환경값을 연결하면
            로그인과 실데이터 CRUD가 활성화됩니다.
          </span>
        </div>
      )}
      <section className="kpi-grid">
        <Kpi
          label="운영 프로젝트"
          value={active.length}
          note="확정·계획·진행·위험·보류"
        />
        <Kpi
          label="파이프라인"
          value={projects.filter((p) => pipelineStatuses.has(p.status)).length}
          note={`가중 프로젝트 ${weightedPipeline.toFixed(1)}건`}
        />
        <Kpi label="고위험" value={high.length} note="즉시 검토 필요" danger />
        <Kpi label="할당 리소스" value={assigned} note={`${overallocated.length}명 과부하 · ${resources.length - assigned}명 미배정`} />
      </section>
      <OperationsInbox projects={projects}/>
      <div className="staffing-overview-link"><div><strong>리소스 운영</strong><span>인력 미배정 {review.unassigned.length}건 · 7일 이상 미갱신 {review.stale.length}건</span></div><Link className="secondary" to="/resources"><Users />투입 현황 검토 <ChevronRight /></Link></div>
      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <PanelHead
            title="월별 운영 프로젝트"
            detail={`${dashboardYear}년 활성 프로젝트 수`}
          />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="projects" fill="var(--workspace-accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <article className="panel chart-panel">
          <PanelHead title="상태 분포" detail={`전체 ${projects.length}개 프로젝트`} />
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={94}
                paddingAngle={3}
              >
                {statusData.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend">
            {statusData.map((x, i) => (
              <span key={x.name}>
                <i style={{ background: colors[i % colors.length] }} />
                {x.name} {x.value}
              </span>
            ))}
          </div>
        </article>
        <article className="panel recent">
          <PanelHead title="최근 프로젝트" detail="최근 업데이트 순" />
          <ProjectRows
            rows={[...projects]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 5)}
          />
        </article>
      </section>
    </>
  );
}
function Kpi({
  label,
  value,
  note,
  trend,
  danger,
}: {
  label: string;
  value: number | string;
  note: string;
  trend?: string;
  danger?: boolean;
}) {
  return (
    <article className={`kpi ${danger ? "danger" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <div>
        <small>{note}</small>
        {trend && <Badge tone="teal">{trend}</Badge>}
      </div>
    </article>
  );
}
function PanelHead({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}
function useProjectFilter() {
  const { projects } = usePortfolio();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [risk, setRisk] = useState("all");
  const [workMode, setWorkMode] = useState("all");
  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          (status === "all" || p.status === status) &&
          (category === "all" || p.category === category) &&
          (risk === "all" || p.risk === risk) &&
          (workMode === "all" || (p.workMode ?? "non_resident") === workMode) &&
          `${p.customer} ${p.name} ${p.manager} ${p.resources.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [projects, query, status, category, risk, workMode],
  );
  return { query, setQuery, status, setStatus, category, setCategory, risk, setRisk, workMode, setWorkMode, filtered };
}
function Projects() {
  const { canEdit } = usePortfolio();
  const [creating, setCreating] = useState(false);
  const { query, setQuery, status, setStatus, category, setCategory, risk, setRisk, workMode, setWorkMode, filtered } = useProjectFilter();
  function download() {
    const blob = new Blob([toCsv(filtered)], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `projects-${new Date().getFullYear()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <>
      <PageTitle
        eyebrow="PORTFOLIO MANAGEMENT"
        title="프로젝트"
        desc={`${filtered.length}개의 프로젝트를 검색하고 관리합니다.`}
        action={
          <button
            className="primary"
            disabled={!isSupabaseConfigured || !canEdit}
            onClick={() => setCreating(true)}
            title={!canEdit ? "Admin 또는 Manager만 등록할 수 있습니다." : ""}
          >
            <Plus /> 프로젝트 등록
          </button>
        }
      />
      <ProjectFormDialog open={creating} onClose={() => setCreating(false)} />
      <div className="toolbar">
        <label className="search-box">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="프로젝트 또는 고객사 검색"
          />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">모든 상태</option>
          {projectStatuses.map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">모든 카테고리</option>{Array.from(new Set(projects.map((project) => project.category))).map((item) => <option key={item}>{item}</option>)}</select>
        <select value={risk} onChange={(event) => setRisk(event.target.value)}><option value="all">모든 위험</option><option>Low</option><option>Medium</option><option>High</option></select>
        <select value={workMode} onChange={(event) => setWorkMode(event.target.value)}><option value="all">모든 수행 형태</option><option value="resident">상주</option><option value="non_resident">비상주</option></select>
        {(query || status !== "all" || category !== "all" || risk !== "all" || workMode !== "all") && <button className="secondary" onClick={() => { setQuery(""); setStatus("all"); setCategory("all"); setRisk("all"); setWorkMode("all"); }}>필터 초기화</button>}
        <button className="secondary" onClick={download}>
          <Download /> CSV 내보내기
        </button>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>고객사 / 프로젝트</th>
              <th>상태</th>
              <th>확률</th>
              <th>기간</th>
              <th>수행 형태</th>
              <th>진행률</th>
              <th>담당 리소스</th>
              <th>위험</th>
              <th>후속조치</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link className="project-name" to={`/projects/${p.id}`}>
                    <strong>{p.customer}</strong>
                    <span>{p.name}</span>
                  </Link>
                </td>
                <td>
                  <Badge tone={statusTone(p.status)}>
                    {statusKo[p.status]}
                  </Badge>
                </td>
                <td>
                  <strong>{p.probability}%</strong>
                </td>
                <td className="nowrap">
                  {p.startDate?.slice(0, 7) ?? "미정"} —{" "}
                  {p.endDate?.slice(0, 7) ?? "미정"}
                </td>
                <td><Badge tone={p.workMode === "resident" ? "purple" : "gray"}>{p.workMode === "resident" ? "상주" : "비상주"}</Badge></td>
                <td>
                  <div className="progress">
                    <i style={{ width: `${p.progress}%` }} />
                  </div>
                  <small title={p.progressEstimated ? "시작일부터 오늘까지의 경과일 기준 자동 산정" : "입력된 진행률"}>{p.progress}%{p.progressEstimated ? " · 일정 산정" : ""}</small>
                </td>
                <td>
                  <AvatarStack names={p.resources} />
                </td>
                <td>
                  <Badge tone={riskTone(p.risk)}>{p.risk}</Badge>
                </td>
                <td>
                  <Badge tone={p.followUpStatus === "Pending" ? "amber" : p.followUpStatus === "Waiting" ? "blue" : "gray"}>
                    {p.followUpStatus === "Pending" ? "조치 필요" : p.followUpStatus === "Waiting" ? "회신 대기" : p.followUpStatus === "Done" ? "완료" : "해당 없음"}
                  </Badge>
                  {p.nextActionDueDate && <small className="follow-up-due">{p.nextActionDueDate}</small>}
                </td>
                <td>
                  <Link to={`/projects/${p.id}`} className="icon">
                    <ChevronRight />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty">조건에 맞는 프로젝트가 없습니다.</div>
        )}
      </div>
    </>
  );
}
function AvatarStack({ names }: { names: string[] }) {
  return names.length ? (
    <div className="avatars">
      {names.slice(0, 3).map((n) => (
        <span key={n} title={n}>
          {n.slice(0, 2).toUpperCase()}
        </span>
      ))}
      <small>{names.join(", ")}</small>
    </div>
  ) : (
    <Badge tone="amber">미지정</Badge>
  );
}
function ProjectRows({ rows }: { rows: Project[] }) {
  return (
    <div>
      {rows.map((p) => (
        <Link className="mini-project" to={`/projects/${p.id}`} key={p.id}>
          <div className="project-icon">{p.customer.slice(0, 1)}</div>
          <div>
            <strong>{p.customer}</strong>
            <span>{p.name}</span>
          </div>
          <Badge tone={statusTone(p.status)}>{statusKo[p.status]}</Badge>
          <span>{p.updatedAt.slice(5).replace("-", ".")}</span>
          <ChevronRight />
        </Link>
      ))}
    </div>
  );
}

function ProjectDetail() {
  const { canEdit } = usePortfolio();
  const [editing, setEditing] = useState(false);
  const { id } = useParams();
  const p = projects.find((x) => x.id === id);
  if (!p) return <Navigate to="/projects" />;
  const warnings = projectWarnings(p);
  return (
    <>
      <div className="breadcrumbs">
        <Link to="/projects">프로젝트</Link>
        <ChevronRight />
        {p.customer}
      </div>
      <PageTitle
        eyebrow={p.category.toUpperCase()}
        title={p.name}
        desc={`${p.customer} · 최근 업데이트 ${p.updatedAt}`}
        action={
          <button
            className="secondary"
            disabled={!isSupabaseConfigured || !canEdit}
            onClick={() => setEditing(true)}
            title={!canEdit ? "Admin 또는 Manager만 편집할 수 있습니다." : ""}
          >
            프로젝트 편집
          </button>
        }
      />
      <ProjectFormDialog
        project={p}
        open={editing}
        onClose={() => setEditing(false)}
      />
      {p.importNote && (
        <div className="preview-note">
          <CircleHelp />
          <span>{p.importNote}</span>
        </div>
      )}
      {warnings.map((w) => (
        <div className="warning" key={w}>
          <AlertTriangle />
          {w}
        </div>
      ))}
      <section className="detail-kpis">
        <Kpi label="상태" value={statusKo[p.status]} note={p.phase} />
        <Kpi
          label="수주 확률"
          value={`${p.probability}%`}
          note="수동 조정 가능"
        />
        <Kpi label="진행률" value={`${p.progress}%`} note={p.progressEstimated ? "시작일~오늘 자동 산정" : "현재 기준"} />
        <Kpi
          label="위험 수준"
          value={p.risk}
          note="프로젝트 리스크"
          danger={p.risk === "High"}
        />
      </section>
      <section className="detail-grid">
        <ProjectEvidence project={p} />
        {(p.followUpStatus || p.nextAction || p.evidenceSummary) && (
          <article className="panel prose span-2">
            <h2>메일 추적 및 후속조치</h2>
            <dl>
              <div><dt>상태</dt><dd>{p.followUpStatus === "Pending" ? "조치 필요" : p.followUpStatus === "Waiting" ? "회신 대기" : p.followUpStatus === "Done" ? "완료" : "해당 없음"}</dd></div>
              <div><dt>다음 액션</dt><dd>{p.nextAction ?? "등록된 후속조치 없음"}</dd></div>
              <div><dt>조치 기한</dt><dd>{p.nextActionDueDate ?? "미정"}</dd></div>
              <div><dt>최근 메일 근거</dt><dd>{p.evidenceLastAt ? new Date(p.evidenceLastAt).toLocaleString("ko-KR") : "미확인"}</dd></div>
              <div><dt>확인된 내용</dt><dd>{p.evidenceSummary ?? "메일 근거 없음"}</dd></div>
            </dl>
          </article>
        )}
        <article className="panel prose">
          <h2>프로젝트 개요</h2>
          <dl>
            <div>
              <dt>고객사</dt>
              <dd>{p.customer}</dd>
            </div>
            <div>
              <dt>프로젝트 매니저</dt>
              <dd>{p.manager}</dd>
            </div>
            <div>
              <dt>기간</dt>
              <dd>
                {p.startDate ?? "미정"} — {p.endDate ?? "미정"}
              </dd>
            </div>
            <div>
              <dt>수행 형태</dt>
              <dd>{p.workMode === "resident" ? "상주" : "비상주"}</dd>
            </div>
            <div>
              <dt>범위</dt>
              <dd>{p.scope}</dd>
            </div>
          </dl>
        </article>
        <article className="panel prose">
          <h2>담당 리소스</h2>
          {p.resources.length ? (
            p.resources.map((n) => (
              <div className="resource-line" key={n}>
                <div className="avatar">{n.slice(0, 2)}</div>
                <div>
                  <strong>{n}</strong>
                  <span>{p.resourceAssignments?.[n]?.map((assignment) => `할당 ${assignment.allocation}% · ${assignment.startDate}~${assignment.endDate}`).join(" / ") ?? (p.resourceAllocations?.[n] === undefined ? '투입률 확인 필요' : `할당 ${p.resourceAllocations[n]}% · 프로젝트 기간`)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty compact">할당된 리소스가 없습니다.</div>
          )}
        </article>
        <article className="panel prose span-2">
          <h2>딜리버리 현황</h2>
          <div className="large-progress">
            <i style={{ width: `${p.progress}%` }} />
            <span>{p.progress}%</span>
          </div>
          <div className="three-col">
            <div>
              <span>현재 단계</span>
              <strong>{p.phase}</strong>
            </div>
            <div>
              <span>다음 마일스톤</span>
              <strong>
                {p.startDate ? "상세 계획 확정" : "일정 확정 필요"}
              </strong>
            </div>
            <div>
              <span>마지막 변경</span>
              <strong>{p.updatedAt}</strong>
            </div>
          </div>
        </article>
        <ProjectHistory projectId={p.id} />
      </section>
    </>
  );
}

function Schedule() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const projectYears = projects.flatMap((project) => [project.startDate, project.endDate]).filter((date): date is string => Boolean(date)).map((date) => Number(date.slice(0, 4)));
  const availableYears = Array.from(new Set([currentYear, ...projectYears])).sort((a, b) => a - b);
  const [year, setYear] = useState(currentYear);
  const [prob, setProb] = useState("all");
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState("all");
  const [scheduleCategory, setScheduleCategory] = useState("all");
  const rows = projects.filter(
    (p) =>
      (prob === "all" || p.probability === Number(prob)) &&
      (scheduleStatus === "all" || p.status === scheduleStatus) &&
      (scheduleCategory === "all" || p.category === scheduleCategory) &&
      `${p.customer} ${p.name} ${p.manager} ${p.resources.join(" ")}`.toLowerCase().includes(scheduleQuery.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="ANNUAL DELIVERY PLAN"
        title="연간 프로젝트 일정"
        desc="고객·프로젝트별 작업 기간과 리소스 중복을 월 단위로 확인합니다."
        action={
          <button className="secondary" onClick={() => window.print()}>
            <Download /> 인쇄 / PDF
          </button>
        }
      />
      <div className="toolbar">
        <label className="search-box"><Search /><input value={scheduleQuery} onChange={(event) => setScheduleQuery(event.target.value)} placeholder="고객사·프로젝트·리소스 검색" /></label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {availableYears.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={prob} onChange={(e) => setProb(e.target.value)}>
          <option value="all">모든 확률</option>
          <option value="100">100% 확정</option>
          <option value="50">50% 파이프라인</option>
        </select>
        <select value={scheduleStatus} onChange={(event) => setScheduleStatus(event.target.value)}><option value="all">모든 상태</option>{projectStatuses.map((item) => <option key={item}>{statusKo[item]}</option>)}</select>
        <select value={scheduleCategory} onChange={(event) => setScheduleCategory(event.target.value)}><option value="all">모든 카테고리</option>{Array.from(new Set(projects.map((project) => project.category))).map((item) => <option key={item}>{item}</option>)}</select>
        <div className="timeline-legend">
          <span>
            <i className="bar confirmed" />
            확정/진행
          </span>
          <span>
            <i className="bar pipeline" />
            파이프라인
          </span>
          <span>
            <i className="current-dot" />
            현재 월
          </span>
        </div>
      </div>
      <div className="panel timeline-wrap">
        <div
          className="timeline"
          style={{ "--cols": 12 } as React.CSSProperties}
        >
          <div className="timeline-head sticky-label">고객사 / 프로젝트</div>
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className={`timeline-head ${year === currentYear && i === currentMonth ? "current" : ""}`}
            >
              {i + 1}월
            </div>
          ))}
          {rows.map((p) => (
            <div className="timeline-row" key={p.id}>
              <Link className="timeline-label" to={`/projects/${p.id}`}>
                <strong>{p.customer}</strong>
                <span>
                  {p.name} · {p.resources.join(", ") || "미지정"}
                </span>
              </Link>
              {Array.from({ length: 12 }, (_, i) => (
                <Link
                  aria-label={`${p.name} ${i + 1}월`}
                  to={`/projects/${p.id}`}
                  key={i}
                  className={`month-cell ${year === currentYear && i === currentMonth ? "current" : ""} ${activeInMonth(p, i + 1, year) ? (p.probability === 100 ? "active confirmed" : "active pipeline") : ""}`}
                >
                  {activeInMonth(p, i + 1, year) && <span />}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      {!isSupabaseConfigured && <p className="footnote">* 미리보기 데이터에는 비연속 일정 검증용 샘플이 포함됩니다.</p>}
    </>
  );
}

function Resources() {
  const { canEdit, error, resources:people } = usePortfolio();
  const [params,setParams]=useSearchParams();
  const {key:periodKey,year:resourceYear,month}=parseMonth(params.get('month'));
  const resourceQuery=params.get('q')??'';
  function updateResourceParam(key:string,value:string){setParams(previous=>{const next=new URLSearchParams(previous);if(value.trim())next.set(key,value);else next.delete(key);return next},{replace:true})}
  const [creating, setCreating] = useState(false);
  const visibleResources = useMemo(()=>people.filter((resource) => `${resource.name} ${resource.role} ${resource.skill}`.toLowerCase().includes(resourceQuery.trim().toLowerCase())),[people,resourceQuery]);
  return (
    <>
      <PageTitle
        eyebrow="CAPACITY MANAGEMENT"
        title="리소스"
        desc="월별 배정과 가용 용량을 기준으로 과부하를 조기에 확인합니다."
        action={<button className="primary" disabled={!canEdit} onClick={() => setCreating(true)} title={!canEdit ? "Admin 또는 Manager만 등록할 수 있습니다." : ""}><Plus /> 리소스 등록</button>}
      />
      <ResourceFormDialog open={creating} onClose={() => setCreating(false)} />
      {error && <div className="warning" role="alert"><AlertTriangle /><span>{error} <a href="https://eric841001.github.io/enterprise-project-dashboard/resources">운영 리소스 확인</a></span></div>}
      <div className="toolbar">
        <label className="search-box"><Search /><input aria-label="인력 검색" value={resourceQuery} onChange={(event) => updateResourceParam('q',event.target.value)} placeholder="이름·역할·기술 검색" /></label>
        <PeriodNavigator value={periodKey} onChange={value=>updateResourceParam('month',value)}/>
        <Link className="secondary period-report-link" to={`/reports?month=${periodKey}`}><FileBarChart/>이달 보고서</Link>
      </div>
      <StaffingWorkspace resources={visibleResources} projects={projects} year={resourceYear} month={month}>
      <section className="resource-grid">
        {visibleResources.map((r) => {
          const load = resourceLoad(r, resourceYear, month, projects);
          const alloc = dailyLoad(r,projects,resourceYear,month).peak;
          const teachingOnly = r.name === "진미나";
          const allocationUnknown = load.unknown;
          const monthKey = `${resourceYear}-${String(month).padStart(2, "0")}`;
          const today = seoulToday();
          const upcoming = projects
            .filter((project) => !["Completed", "Cancelled", "Archived"].includes(project.status))
            .flatMap((project) => (project.resourceAssignments?.[r.name] ?? [])
              .filter((assignment) => assignment.startDate >= today)
              .map((assignment) => ({ project, ...assignment })))
            .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.project.name.localeCompare(b.project.name));
          const assignedProjects = projects.filter((project) =>
            !["Completed", "Cancelled", "Archived"].includes(project.status) &&
            resourceActiveInMonth(r.name, project, month, resourceYear) &&
            (!teachingOnly || project.resourceAssignments?.[r.name]?.some((assignment) =>
              assignment.startDate === assignment.endDate && assignment.startDate.startsWith(monthKey),
            ) || (project.startDate !== null && project.startDate === project.endDate && project.startDate.startsWith(monthKey))),
          );
          return (
            <article className="panel resource-card" key={r.id}>
              <div className="resource-head">
                <div className="avatar large">{r.name.slice(0, 2)}</div>
                <div>
                  <h2>{r.name}</h2>
                  <p>{r.role}</p>
                </div>
                <Badge
                  tone={teachingOnly ? "blue" : alloc > r.capacity ? "red" : alloc >= r.capacity * .8 ? "amber" : "teal"}
                >
                  {teachingOnly ? "강의" : allocationUnknown ? "일부 투입률 미확정" : alloc > r.capacity ? "과부하" : load.tentative > 0 ? "예정 포함" : alloc >= r.capacity * .8 && alloc > 0 ? "용량 임박" : "가용"}
                </Badge>
              </div>
              {!teachingOnly && <><div className="capacity">
                <span>{allocationUnknown ? "날짜별 최대 · 확인 필요" : "이달 날짜별 최대 투입률"}</span>
                <strong>{alloc}%</strong>
              </div>
              <div className="progress">
                <i style={{ width: `${r.capacity > 0 ? Math.min(alloc / r.capacity * 100, 100) : alloc > 0 ? 100 : 0}%` }} />
              </div></>}
              <div className="resource-meta">
                <span>
                  주요 기술 <strong>{r.skill}</strong>
                </span>
                <span>
                  {teachingOnly ? "강의 프로젝트" : "프로젝트"}{" "}
                  <strong>
                    {
                      assignedProjects.length
                    }
                  </strong>
                </span>
              </div>
              <div className="resource-projects">
                <h3>{teachingOnly ? "강의 일정" : "현재 배정"}</h3>
                {assignedProjects.length === 0 && <p className="muted">{teachingOnly ? "등록된 강의 일정 없음" : "배정된 프로젝트 없음"}</p>}
                {assignedProjects.map((project) => {
                  const dates = (project.resourceAssignments?.[r.name] ?? [])
                    .filter((assignment) => teachingOnly
                      ? assignment.startDate === assignment.endDate && assignment.startDate.startsWith(monthKey)
                      : assignment.startDate.slice(0, 7) <= monthKey && assignment.endDate.slice(0, 7) >= monthKey);
                  return <Link key={project.id} to={`/projects/${project.id}`} className="resource-project">
                    <strong>{project.customer}</strong>
                    <span>{project.name}</span>
                    {dates.map((date, index) => <time key={index} dateTime={date.startDate}>{date.startDate}{date.endDate !== date.startDate ? ` ~ ${date.endDate}` : ""}</time>)}
                    {teachingOnly && !dates.length && <time>{project.startDate === project.endDate ? project.startDate : "강의일 확인 필요"}</time>}
                  </Link>;
                })}
              </div>
              {upcoming.length > 0 && <div className="resource-projects">
                <h3>예정 일정</h3>
                {upcoming.map((assignment) => <Link key={`${assignment.project.id}-${assignment.startDate}`} to={`/projects/${assignment.project.id}`} className="resource-project">
                  <strong>{assignment.project.customer}</strong>
                  <span>{assignment.project.name}</span>
                  <time dateTime={assignment.startDate}>{assignment.startDate}{assignment.endDate !== assignment.startDate ? ` ~ ${assignment.endDate}` : ""}</time>
                </Link>)}
              </div>}
            </article>
          );
        })}
      </section>
      </StaffingWorkspace>
    </>
  );
}

function Customers() {
  const { canEdit, customers } = usePortfolio();
  const [creating, setCreating] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const customerRows = customers.map(({ name }) => ({ name, items: projects.filter((p) => p.customer === name) }))
    .filter((customer) => `${customer.name} ${customer.items.map((item) => item.name).join(" ")}`.toLowerCase().includes(customerQuery.toLowerCase()));
  return (
    <>
      <PageTitle
        eyebrow="CUSTOMER PORTFOLIO"
        title="고객사"
        desc="고객별 프로젝트 현황과 파이프라인을 한곳에서 관리합니다."
        action={
          <button className="primary" disabled={!isSupabaseConfigured || !canEdit} onClick={() => setCreating(true)} title={!canEdit ? "Admin 또는 Manager만 등록할 수 있습니다." : ""}>
            <Plus /> 고객사 등록
          </button>
        }
      />
      <CustomerFormDialog open={creating} onClose={() => setCreating(false)} />
      <div className="toolbar"><label className="search-box"><Search /><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="고객사 또는 프로젝트 검색" /></label></div>
      <section className="customer-grid">
        {customerRows.map((c) => (
          <article className="panel customer-card" key={c.name}>
            <div className="customer-logo">{c.name.slice(0, 2)}</div>
            <div>
              <h2>{c.name}</h2>
              <p>{c.items.map((x) => x.category).join(" · ")}</p>
            </div>
            <div className="customer-stats">
              <span>
                전체 <strong>{c.items.length}</strong>
              </span>
              <span>
                확정{" "}
                <strong>
                  {c.items.filter((x) => x.probability === 100).length}
                </strong>
              </span>
              <span>
                파이프라인{" "}
                <strong>
                  {c.items.filter((x) => x.probability < 100).length}
                </strong>
              </span>
            </div>
            {c.items[0] ? <Link to={`/projects/${c.items[0].id}`}>프로젝트 보기 <ChevronRight /></Link> : <span className="muted">등록된 프로젝트 없음</span>}
          </article>
        ))}
      </section>
    </>
  );
}

function Reports() {
  const [params,setParams]=useSearchParams();
  const {key:reportKey,year:reportYear,month:reportMonth}=parseMonth(params.get('month'));
  const reportMonthLabel=`${reportYear}년 ${reportMonth}월`;
  const [openReport, setOpenReport] = useState<ReportKind | null>(null);
  const summary=monthlyPortfolio(projects,reportYear,reportMonth);
  return (
    <>
      <PageTitle
        eyebrow="MANAGEMENT REPORTING"
        title="리포트"
        desc="현재 포트폴리오 데이터를 바탕으로 한 결정론적 경영 요약입니다."
      />
      <div className="report-period-bar"><PeriodNavigator label="보고서 기준 월" value={reportKey} onChange={value=>{setOpenReport(null);setParams({month:value},{replace:true})}}/><Link className="secondary" to={`/resources?month=${reportKey}`}>같은 월 투입 현황 <ChevronRight/></Link></div>
      <p className="report-scope">시작·종료일 또는 작업 구간이 등록된 프로젝트를 선택 월로 조회합니다. 기간 미정은 별도로 표시하며, 과거 시점의 상태는 변화 추적 기록에서 확인할 수 있습니다.</p>
      <ReportDialog kind={openReport} period={{year:reportYear,month:reportMonth}} onClose={() => setOpenReport(null)} />
      <article className="panel report-hero">
        <div>
          <p className="eyebrow">{reportMonthLabel.toUpperCase()} · EXECUTIVE SUMMARY</p>
          <h2>월간 프로젝트 포트폴리오 요약</h2>
          <p>
            {reportMonthLabel} 일정이 있는 프로젝트는 <strong>{summary.dated.length}개</strong>입니다. 이 중 확정·운영 단계 <strong>{summary.confirmed.length}개</strong>, 파이프라인 <strong>{summary.pipeline.length}개</strong>, 완료·취소·보관 <strong>{summary.closed.length}개</strong>입니다. 선택 월의 고위험 운영 프로젝트는 <strong>{summary.high.length}개</strong>입니다.
          </p>
        </div>
        <button className="secondary" onClick={() => window.print()}>
          <Download /> PDF로 인쇄
        </button>
      </article>
      <div className="report-metrics"><div><span>선택 월 운영</span><strong>{summary.open.length}<small>건</small></strong></div><div><span>확정·운영 단계</span><strong>{summary.confirmed.length}<small>건</small></strong></div><div><span>선택 월 파이프라인</span><strong>{summary.pipeline.length}<small>건</small></strong></div><div><span>전체 기간 확인 필요</span><strong>{summary.unscheduled.length}<small>건</small></strong></div></div>
      <section className="report-grid">
        {([
          "월간 포트폴리오",
          "확정 vs 파이프라인",
          "리소스 활용률",
          "위험 및 이슈",
          "고객사 요약",
          "업데이트 준수",
        ] as ReportKind[]).map((x) => (
          <article className="panel report-card" key={x}>
            <div className="report-icon">
              <BarChart3 />
            </div>
            <h2>{x}</h2>
            <p>
              {x==='리소스 활용률'?'날짜별 최대·등록 합계·확인 상태를 함께 비교합니다.':x==='업데이트 준수'?'선택 월과 기간 미정 운영 프로젝트의 최근 갱신을 점검합니다.':x==='위험 및 이슈'?'선택 월의 위험과 기간 미정 운영 프로젝트를 확인합니다.':`${reportMonthLabel}에 일정이 있는 프로젝트를 기준으로 내보냅니다.`}
            </p>
            <button className="text-button" onClick={() => setOpenReport(x)}>
              리포트 열기 <ChevronRight />
            </button>
          </article>
        ))}
      </section>
      <PortfolioTrends />
    </>
  );
}

function SettingsPage() {
  const { role, canEdit, projects, resources, customers } = usePortfolio();
  return (
    <>
      <PageTitle
        eyebrow="WORKSPACE CONTROL"
        title="설정"
        desc="인증, 데이터 연결과 포트폴리오 기준을 관리합니다."
      />
      <section className="settings-grid">
        <article className="panel setting">
          <h2>현재 권한</h2>
          <Badge tone={canEdit ? "blue" : "gray"}>{role.toUpperCase()}</Badge>
          <p>{canEdit ? "프로젝트·고객사·리소스를 등록하고 편집할 수 있습니다." : "승인된 포트폴리오를 조회할 수 있으며 변경 작업은 제한됩니다."}</p>
        </article>
        <article className="panel setting">
          <h2>Supabase 연결</h2>
          <Badge tone={isSupabaseConfigured ? "teal" : "amber"}>
            {isSupabaseConfigured ? "연결됨" : "설정 필요"}
          </Badge>
          <p>Authentication, PostgreSQL 및 Row Level Security를 사용합니다.</p>
          <code>VITE_SUPABASE_URL</code>
          <code>VITE_SUPABASE_ANON_KEY</code>
        </article>
        <article className="panel setting">
          <h2>운영 데이터 상태</h2>
          <div className="setting-metrics"><span>프로젝트 <strong>{projects.length}</strong></span><span>고객사 <strong>{customers.length}</strong></span><span>리소스 <strong>{resources.length}</strong></span></div>
          <p>모든 메뉴는 동일한 승인된 Supabase 포트폴리오 데이터를 사용합니다.</p>
        </article>
        <article className="panel setting">
          <h2>접근 제어</h2>
          <Badge tone="blue">Private</Badge>
          <p>모든 프로젝트 페이지는 기본적으로 인증된 사용자만 접근합니다.</p>
          <ul>
            <li>Admin — 전체 관리</li>
            <li>Manager — 운영 데이터 관리</li>
            <li>Viewer — 읽기 전용</li>
          </ul>
        </article>
        <article className="panel setting">
          <h2>카테고리</h2>
          <p>
            M365, Azure, Security, Copilot, Migration 등 표준 운영 분류를
            프로젝트 등록과 편집 화면에서 선택합니다.
          </p>
          <div className="category-chips">{categories.map((category) => <Badge key={category} tone="gray">{category}</Badge>)}</div>
        </article>
      </section>
    </>
  );
}

export default function App() {
  return (
    <AuthGate>
      <PortfolioProvider>
        <Shell />
      </PortfolioProvider>
    </AuthGate>
  );
}
