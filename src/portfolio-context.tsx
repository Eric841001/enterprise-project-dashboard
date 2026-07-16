import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  projects as sampleProjects,
  resources as sampleResources,
} from "./data";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { Project, ProjectStatus, Resource, RiskLevel } from "./types";

interface PortfolioContextValue {
  projects: Project[];
  resources: Resource[];
  customers: CustomerRow[];
  role: "admin" | "manager" | "viewer";
  canEdit: boolean;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}
interface ProjectRow {
  id: string;
  customer_id: string;
  name: string;
  category: string;
  probability: number;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  progress: number;
  risk_level: RiskLevel;
  scope_summary: string | null;
  phase: string | null;
  updated_at: string;
  import_note: string | null;
  project_manager_id: string | null;
}
interface CustomerRow {
  id: string;
  name: string;
}
interface ResourceRow {
  id: string;
  name: string;
  role: string;
  primary_skill: string | null;
  available_capacity: number;
}
interface AssignmentRow {
  project_id: string;
  resource_id: string;
  allocation_percentage: number;
}
interface WorkPeriodRow {
  project_id: string;
  start_date: string;
  end_date: string;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

function monthsForPeriods(periods: WorkPeriodRow[]) {
  const months = new Set<number>();
  for (const period of periods) {
    const cursor = new Date(`${period.start_date}T00:00:00`);
    const last = new Date(`${period.end_date}T00:00:00`);
    cursor.setDate(1);
    last.setDate(1);
    while (cursor <= last) {
      if (cursor.getFullYear() === 2026) months.add(cursor.getMonth() + 1);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return [...months].sort((a, b) => a - b);
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(
    isSupabaseConfigured ? [] : sampleProjects,
  );
  const [resources, setResources] = useState<Resource[]>(
    isSupabaseConfigured ? [] : sampleResources,
  );
  const [customers, setCustomers] = useState<CustomerRow[]>(
    isSupabaseConfigured
      ? []
      : Array.from(new Set(sampleProjects.map((project) => project.customer))).map((name) => ({ id: name, name })),
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [role, setRole] = useState<"admin" | "manager" | "viewer">("viewer");

  const refresh = useCallback(async () => {
    const client = supabase;
    if (!client) {
      setProjects(sampleProjects);
      setResources(sampleResources);
      setCustomers(Array.from(new Set(sampleProjects.map((project) => project.customer))).map((name) => ({ id: name, name })));
      setCanEdit(false);
      setRole("viewer");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) {
      setError("로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.");
      setProjects([]);
      setResources([]);
      setCustomers([]);
      setCanEdit(false);
      setRole("viewer");
      setLoading(false);
      return;
    }
    const profileResult = await client
      .from("profiles")
      .select("is_approved,role")
      .eq("id", authData.user.id)
      .single();
    if (profileResult.error) {
      setError(`계정 권한을 확인하지 못했습니다: ${profileResult.error.message}`);
      setProjects([]);
      setResources([]);
      setCustomers([]);
      setCanEdit(false);
      setRole("viewer");
      setLoading(false);
      return;
    }
    if (!profileResult.data?.is_approved) {
      setError("이 계정은 아직 포트폴리오 열람 승인을 받지 않았습니다.");
      setProjects([]);
      setResources([]);
      setCustomers([]);
      setCanEdit(false);
      setRole("viewer");
      setLoading(false);
      return;
    }
    setCanEdit(
      profileResult.data.role === "admin" ||
        profileResult.data.role === "manager",
    );
    setRole(profileResult.data.role);
    const [
      projectResult,
      customerResult,
      resourceResult,
      assignmentResult,
      periodResult,
    ] = await Promise.all([
      client
        .from("projects")
        .select(
          "id,customer_id,name,category,probability,status,start_date,end_date,progress,risk_level,scope_summary,phase,updated_at,import_note,project_manager_id",
        )
        .eq("is_archived", false)
        .order("updated_at", { ascending: false }),
      client.from("customers").select("id,name"),
      client
        .from("resources")
        .select("id,name,role,primary_skill,available_capacity")
        .eq("employment_status", "active")
        .order("name"),
      client.from("project_assignments").select("project_id,resource_id,allocation_percentage"),
      client
        .from("project_work_periods")
        .select("project_id,start_date,end_date"),
    ]);
    const firstError = [
      projectResult.error,
      customerResult.error,
      resourceResult.error,
      assignmentResult.error,
      periodResult.error,
    ].find(Boolean);
    if (firstError) {
      setError(firstError.message);
      setProjects([]);
      setResources([]);
      setCustomers([]);
      setLoading(false);
      return;
    }

    const projectRows = (projectResult.data ?? []) as ProjectRow[];
    const customerRows = (customerResult.data ?? []) as CustomerRow[];
    const resourceRows = (resourceResult.data ?? []) as ResourceRow[];
    const assignmentRows = (assignmentResult.data ?? []) as AssignmentRow[];
    const periodRows = (periodResult.data ?? []) as WorkPeriodRow[];
    const customerById = new Map(customerRows.map((row) => [row.id, row.name]));
    setCustomers(customerRows);
    const resourceById = new Map(resourceRows.map((row) => [row.id, row.name]));

    setResources(
      resourceRows.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        skill: row.primary_skill ?? "미지정",
        capacity: row.available_capacity,
      })),
    );
    setProjects(
      projectRows.map((row) => {
        const assigned = assignmentRows
          .filter((assignment) => assignment.project_id === row.id)
          .map((assignment) => resourceById.get(assignment.resource_id))
          .filter((name): name is string => Boolean(name));
        const resourceAllocations = Object.fromEntries(
          assignmentRows
            .filter((assignment) => assignment.project_id === row.id)
            .map((assignment) => [resourceById.get(assignment.resource_id), assignment.allocation_percentage])
            .filter((entry): entry is [string, number] => Boolean(entry[0])),
        );
        const periods = periodRows.filter(
          (period) => period.project_id === row.id,
        );
        return {
          id: row.id,
          customer: customerById.get(row.customer_id) ?? "미지정 고객사",
          name: row.name,
          category: row.category,
          probability: row.probability,
          status: row.status,
          startDate: row.start_date,
          endDate: row.end_date,
          progress: row.progress,
          manager: row.project_manager_id
            ? (resourceById.get(row.project_manager_id) ?? "미지정")
            : "미지정",
          resources: assigned,
          resourceAllocations,
          risk: row.risk_level,
          scope: row.scope_summary ?? "범위 미정",
          phase: row.phase ?? "미정",
          updatedAt: row.updated_at.slice(0, 10),
          workMonths: periods.length ? monthsForPeriods(periods) : undefined,
          workPeriods: periods.map((period) => ({ startDate: period.start_date, endDate: period.end_date })),
          importNote: row.import_note ?? undefined,
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const value = useMemo(
    () => ({ projects, resources, customers, role, canEdit, loading, error, refresh }),
    [projects, resources, customers, role, canEdit, loading, error, refresh],
  );
  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

// Provider and its hook intentionally share this small module.
// eslint-disable-next-line react-refresh/only-export-components
export function usePortfolio() {
  const value = useContext(PortfolioContext);
  if (!value)
    throw new Error("usePortfolio must be used inside PortfolioProvider");
  return value;
}
