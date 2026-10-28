import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { projects, resources } from "./data";

vi.mock("./lib/supabase", () => ({ isSupabaseConfigured: false, supabase: null }));

afterEach(()=>{cleanup();vi.unstubAllGlobals()});

describe("all primary menu routes", () => {
  it("keeps fictitious records out of application data", () => {
    expect(projects.some((project) => project.id.startsWith("sample-"))).toBe(false);
    expect(resources.some((resource) => /Consultant|Engineer|Specialist/.test(resource.name))).toBe(false);
  });
  it.each([
    ["/", "프로젝트 포트폴리오"],
    ["/projects", "프로젝트"],
    ["/schedule", "연간 프로젝트 일정"],
    ["/resources", "리소스"],
    ["/customers", "고객사"],
    ["/reports", "리포트"],
    ["/settings", "설정"],
  ])("renders %s without a routing failure", (route, heading) => {
    render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
  });

  it("opens a project detail route", () => {
    render(<MemoryRouter initialEntries={[`/projects/${projects[0].id}`]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: projects[0].name, level: 1 })).toBeInTheDocument();
  });

  it("exposes every primary navigation link", () => {
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    for (const name of ["대시보드", "프로젝트", "일정", "리소스", "고객사", "리포트", "설정"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("opens a report detail dialog", () => {
    render(<MemoryRouter initialEntries={["/reports"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole("button", { name: /리포트 열기/ })[0]);
    expect(screen.getByRole("dialog", { name: "월간 포트폴리오" })).toBeInTheDocument();
  });

  it("closes report dialogs with Escape", () => {
    render(<MemoryRouter initialEntries={["/reports"]}><App /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole("button", { name: /리포트 열기/ })[0]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "월간 포트폴리오" })).not.toBeInTheDocument();
  });

  it("shows an explicit empty state for global search", () => {
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    fireEvent.change(screen.getByRole("combobox", { name: "전체 검색" }), { target: { value: "존재하지않는프로젝트" } });
    expect(screen.getByText("일치하는 프로젝트가 없습니다.")).toHaveAttribute('role','status');
  });

  it("exposes every database-backed project status in filters", () => {
    render(<MemoryRouter initialEntries={["/projects"]}><App /></MemoryRouter>);
    for (const status of ["Lead", "Qualified", "Proposal", "Negotiation", "Confirmed", "Planning", "In Progress", "On Hold", "At Risk", "Completed", "Cancelled", "Archived"]) {
      expect(screen.getByRole("option", { name: status })).toBeInTheDocument();
    }
  });
  it('carries the selected resource month across December into the next year and into reports',()=>{
    render(<MemoryRouter initialEntries={['/resources?month=2026-12&q=김']}><App/></MemoryRouter>)
    expect(screen.getByLabelText('기준 월')).toHaveValue('2026-12')
    fireEvent.click(screen.getByRole('button',{name:'다음 월'}))
    expect(screen.getByLabelText('기준 월')).toHaveValue('2027-01')
    expect(screen.getByLabelText('인력 검색')).toHaveValue('김')
    expect(screen.getByRole('link',{name:'이달 보고서'})).toHaveAttribute('href','/reports?month=2027-01')
  })
  it('uses the selected report month in its dialog and shows an explicit empty state',()=>{
    render(<MemoryRouter initialEntries={['/reports?month=2070-01']}><App/></MemoryRouter>)
    fireEvent.click(screen.getAllByRole('button',{name:/리포트 열기/})[0])
    const dialog=screen.getByRole('dialog',{name:'월간 포트폴리오'})
    expect(dialog).toHaveTextContent('2070년 1월 일정 기준')
    expect(dialog).toHaveTextContent('선택한 기준에 해당하는 항목이 없습니다.')
    expect(screen.getByRole('button',{name:'CSV 내보내기'})).toBeDisabled()
  })
  it('keeps a closed mobile navigation out of focus and restores scrolling on Escape',()=>{
    vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}))
    render(<MemoryRouter><App/></MemoryRouter>)
    const sidebar=document.getElementById('workspace-navigation')!
    expect(sidebar).toHaveAttribute('inert');expect(sidebar).toHaveAttribute('aria-hidden','true')
    fireEvent.click(screen.getByRole('button',{name:'메뉴 열기'}))
    expect(sidebar).not.toHaveAttribute('inert');expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(window,{key:'Escape'})
    expect(sidebar).toHaveAttribute('inert');expect(document.body.style.overflow).not.toBe('hidden')
  })
});
