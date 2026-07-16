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
  useNavigate,
  useParams,
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
  allocationFor,
  projectWarnings,
  toCsv,
} from "./lib/portfolio";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { Project, Resource, RiskLevel } from "./types";

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

function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [signedIn, setSignedIn] = useState(!isSupabaseConfigured);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    void client.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  if (!ready) return <div className="center-state">세션 확인 중…</div>;
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
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setError(authError?.message ?? "");
    setBusy(false);
  }
  async function resetPassword() {
    if (!supabase || !email) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) setError(resetError.message);
    else setNotice("비밀번호 재설정 안내 메일을 보냈습니다.");
    setBusy(false);
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
          className="text-button"
          onClick={() => void resetPassword()}
          disabled={!email || busy}
        >
          비밀번호 재설정
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
  const [dark, setDark] = useState(() => localStorage.getItem("portfolio-theme") === "dark");
  const [globalQuery, setGlobalQuery] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const globalMatches = globalQuery.trim()
    ? portfolio.projects.filter((project) => `${project.customer} ${project.name} ${project.resources.join(" ")}`.toLowerCase().includes(globalQuery.toLowerCase())).slice(0, 6)
    : [];
  const alerts = portfolio.projects.filter((project) => project.risk === "High" || !project.startDate || !project.resources.length);
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => localStorage.setItem("portfolio-theme", dark ? "dark" : "light"), [dark]);
  return (
    <div className={dark ? "app dark" : "app"}>
      <aside className={open ? "sidebar open" : "sidebar"}>
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
      <div className="main">
        <header>
          <button
            className="icon mobile-only"
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
          >
            <Menu />
          </button>
          <div className="global-search">
            <Search />
            <input
              placeholder="프로젝트, 고객사, 담당자 검색"
              aria-label="전체 검색"
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && globalMatches[0]) {
                  navigate(`/projects/${globalMatches[0].id}`);
                  setGlobalQuery("");
                }
              }}
            />
            {globalMatches.length > 0 && (
              <div className="search-results">
                {globalMatches.map((project) => (
                  <Link key={project.id} to={`/projects/${project.id}`} onClick={() => setGlobalQuery("")}>
                    <strong>{project.customer}</strong><span>{project.name} · {project.resources.join(", ") || "담당자 미지정"}</span>
                  </Link>
                ))}
              </div>
            )}
            {globalQuery.trim() && globalMatches.length === 0 && (
              <div className="search-results search-empty" role="status">일치하는 프로젝트가 없습니다.</div>
            )}
          </div>
          <div className="header-actions">
            <span className="sync">{isSupabaseConfigured ? "실시간 데이터" : "샘플 데이터"}</span>
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
                {alerts.slice(0, 5).map((project) => <Link key={project.id} to={`/projects/${project.id}`} onClick={() => setShowAlerts(false)}><span>{project.customer} · {project.name}</span><small>{project.risk === "High" ? "고위험" : !project.startDate ? "일정 미정" : "리소스 미지정"}</small></Link>)}
                {!alerts.length && <p>현재 주의 항목이 없습니다.</p>}
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
      {open && (
        <button
          className="backdrop"
          onClick={() => setOpen(false)}
          aria-label="메뉴 닫기"
        />
      )}
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
    ["Confirmed", "Planning", "In Progress"].includes(p.status),
  );
  const high = projects.filter((p) => p.risk === "High");
  const assigned = new Set(projects.flatMap((p) => p.resources)).size;
  const now = new Date();
  const dashboardYear = now.getFullYear();
  const dashboardMonth = now.getMonth() + 1;
  const overallocated = resources.filter((resource) => allocationFor(resource.name, dashboardMonth, projects, dashboardYear) > 100);
  const unassigned = projects.filter((project) => !project.resources.length);
  const unscheduled = projects.filter((project) => !project.startDate || !project.endDate);
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
          note="확정·계획·진행"
          trend="+2 이번 달"
        />
        <Kpi
          label="파이프라인"
          value={projects.filter((p) => p.probability < 100).length}
          note="가중 프로젝트 2.5건"
        />
        <Kpi label="고위험" value={high.length} note="즉시 검토 필요" danger />
        <Kpi label="할당 리소스" value={assigned} note={`${overallocated.length}명 과부하 · ${resources.length - assigned}명 미배정`} />
      </section>
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
              <Bar dataKey="projects" fill="#0b69a3" radius={[6, 6, 0, 0]} />
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
        <article className="panel attention">
          <PanelHead
            title="주의가 필요한 항목"
            detail="우선순위 기준 자동 분류"
          />
          <Attention
            icon={<AlertTriangle />}
            tone="red"
            title={`고위험 프로젝트 ${high.length}건`}
            text={high.map((project) => project.customer).join(", ") || "해당 없음"}
          />
          <Attention
            icon={<Users />}
            tone="amber"
            title={`리소스 미지정 ${unassigned.length}건`}
            text={unassigned.map((project) => project.customer).join(", ") || "해당 없음"}
          />
          <Attention
            icon={<CalendarDays />}
            tone="blue"
            title={`일정 미확정 ${unscheduled.length}건`}
            text={unscheduled.map((project) => project.customer).join(", ") || "해당 없음"}
          />
          <Link to="/projects" className="panel-link">
            전체 프로젝트 검토 <ChevronRight />
          </Link>
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
function Attention({
  icon,
  tone,
  title,
  text,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  text: string;
}) {
  return (
    <div className="attention-row">
      <div className={`signal ${tone}`}>{icon}</div>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <ChevronRight />
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
          `${p.customer} ${p.name} ${p.resources.join(" ")}`
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
                  <span>{p.resourceAssignments?.[n]?.map((assignment) => `할당 ${assignment.allocation}% · ${assignment.startDate}~${assignment.endDate}`).join(" / ") ?? `할당 ${p.resourceAllocations?.[n] ?? 50}% · 프로젝트 기간`}</span>
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
      `${p.customer} ${p.name} ${p.resources.join(" ")}`.toLowerCase().includes(scheduleQuery.toLowerCase()),
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
  const { canEdit } = usePortfolio();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [resourceYear, setResourceYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);
  const [resourceQuery, setResourceQuery] = useState("");
  const visibleResources = resources.filter((resource) => `${resource.name} ${resource.role} ${resource.skill}`.toLowerCase().includes(resourceQuery.toLowerCase()));
  const resourceYears = Array.from(new Set([
    new Date().getFullYear(),
    ...projects.flatMap((project) => [project.startDate, project.endDate])
      .filter((date): date is string => Boolean(date))
      .map((date) => Number(date.slice(0, 4))),
  ])).sort((a, b) => a - b);
  return (
    <>
      <PageTitle
        eyebrow="CAPACITY MANAGEMENT"
        title="리소스"
        desc="월별 배정과 가용 용량을 기준으로 과부하를 조기에 확인합니다."
        action={<button className="primary" disabled={!canEdit} onClick={() => setCreating(true)} title={!canEdit ? "Admin 또는 Manager만 등록할 수 있습니다." : ""}><Plus /> 리소스 등록</button>}
      />
      <ResourceFormDialog open={creating} onClose={() => setCreating(false)} />
      <div className="toolbar">
        <label className="search-box"><Search /><input value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} placeholder="이름·역할·기술 검색" /></label>
        <select value={resourceYear} onChange={(event) => setResourceYear(Number(event.target.value))}>{resourceYears.map((item) => <option key={item}>{item}</option>)}</select>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option value={i + 1} key={i}>
              {i + 1}월
            </option>
          ))}
        </select>
      </div>
      <section className="resource-grid">
        {visibleResources.map((r) => {
          const alloc = allocationFor(r.name, month, projects, resourceYear);
          return (
            <article className="panel resource-card" key={r.id}>
              <div className="resource-head">
                <div className="avatar large">{r.name.slice(0, 2)}</div>
                <div>
                  <h2>{r.name}</h2>
                  <p>{r.role}</p>
                </div>
                <Badge
                  tone={alloc > 100 ? "red" : alloc >= 80 ? "amber" : "teal"}
                >
                  {alloc > 100 ? "과부하" : alloc >= 80 ? "용량 임박" : "가용"}
                </Badge>
              </div>
              <div className="capacity">
                <span>월간 할당</span>
                <strong>{alloc}%</strong>
              </div>
              <div className="progress">
                <i style={{ width: `${Math.min(alloc, 100)}%` }} />
              </div>
              <div className="resource-meta">
                <span>
                  주요 기술 <strong>{r.skill}</strong>
                </span>
                <span>
                  프로젝트{" "}
                  <strong>
                    {
                      projects.filter(
                        (p) =>
                          p.resources.includes(r.name) &&
                          activeInMonth(p, month, resourceYear),
                      ).length
                    }
                  </strong>
                </span>
              </div>
            </article>
          );
        })}
      </section>
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
  const reportDate = new Date();
  const reportYear = reportDate.getFullYear();
  const reportMonth = reportDate.getMonth() + 1;
  const reportMonthLabel = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(reportDate);
  const [openReport, setOpenReport] = useState<ReportKind | null>(null);
  const confirmed = projects.filter((p) => p.probability === 100).length;
  const high = projects.filter((p) => p.risk === "High").length;
  return (
    <>
      <PageTitle
        eyebrow="MANAGEMENT REPORTING"
        title="리포트"
        desc="현재 포트폴리오 데이터를 바탕으로 한 결정론적 경영 요약입니다."
      />
      <ReportDialog kind={openReport} onClose={() => setOpenReport(null)} />
      <article className="panel report-hero">
        <div>
          <p className="eyebrow">{reportMonthLabel.toUpperCase()} · EXECUTIVE SUMMARY</p>
          <h2>월간 프로젝트 포트폴리오 요약</h2>
          <p>
            전체 <strong>{projects.length}개</strong> 프로젝트 중{" "}
            <strong>{confirmed}개</strong>가 확정되었으며, 나머지는 파이프라인
            단계입니다. 고위험 프로젝트는 <strong>{high}개</strong>, 일정 미확정
            프로젝트는{" "}
            <strong>{projects.filter((p) => !p.startDate).length}개</strong>
            입니다. {reportMonth}월에는 {projects.filter((p) => activeInMonth(p, reportMonth, reportYear)).length}
            개 프로젝트가 동시에 운영되어 리소스 배정 검토가 필요합니다.
          </p>
        </div>
        <button className="secondary" onClick={() => window.print()}>
          <Download /> PDF로 인쇄
        </button>
      </article>
      <section className="report-grid">
        {([
          "월간 포트폴리오",
          "확정 vs 파이프라인",
          "리소스 활용률",
          "위험 및 이슈",
          "고객사 요약",
          "업데이트 준수",
        ] as ReportKind[]).map((x, i) => (
          <article className="panel report-card" key={x}>
            <div className="report-icon">
              <BarChart3 />
            </div>
            <h2>{x}</h2>
            <p>
              {i % 2 === 0
                ? "월별 추세와 주요 변화를 경영진 관점에서 확인합니다."
                : "필터링된 데이터를 표와 요약으로 내보냅니다."}
            </p>
            <button className="text-button" onClick={() => setOpenReport(x)}>
              리포트 열기 <ChevronRight />
            </button>
          </article>
        ))}
      </section>
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
