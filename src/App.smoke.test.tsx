import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

vi.mock("./lib/supabase", () => ({ isSupabaseConfigured: false, supabase: null }));

afterEach(cleanup);

describe("all primary menu routes", () => {
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
    render(<MemoryRouter initialEntries={["/projects/sample-hanseong-governance"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Microsoft 365 Governance Rollout", level: 1 })).toBeInTheDocument();
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
    fireEvent.change(screen.getByRole("textbox", { name: "전체 검색" }), { target: { value: "존재하지않는프로젝트" } });
    expect(screen.getByRole("status")).toHaveTextContent("일치하는 프로젝트가 없습니다.");
  });

  it("exposes every database-backed project status in filters", () => {
    render(<MemoryRouter initialEntries={["/projects"]}><App /></MemoryRouter>);
    for (const status of ["Lead", "Qualified", "Proposal", "Negotiation", "Confirmed", "Planning", "In Progress", "On Hold", "At Risk", "Completed", "Cancelled", "Archived"]) {
      expect(screen.getByRole("option", { name: status })).toBeInTheDocument();
    }
  });
});
