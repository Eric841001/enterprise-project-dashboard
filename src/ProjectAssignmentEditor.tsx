import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { supabase } from "./lib/supabase";
import { usePortfolio } from "./portfolio-context";
import type { Project } from "./types";

interface Props {
  project: Project;
  open: boolean;
  onClose: () => void;
}

export function ProjectAssignmentEditor({ project, open, onClose }: Props) {
  const { resources, refresh } = usePortfolio();
  const [selected, setSelected] = useState<string[]>(project.resources);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(project.resources);
      setError("");
    }
  }, [open, project.resources]);

  if (!open) return null;

  function toggle(name: string) {
    setSelected((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    if (!project.startDate || !project.endDate) {
      setError(
        "담당 리소스를 배정하려면 프로젝트 시작일과 종료일이 필요합니다.",
      );
      return;
    }

    setBusy(true);
    setError("");
    const selectedResources = resources.filter((resource) =>
      selected.includes(resource.name),
    );
    const existingResult = await client
      .from("project_assignments")
      .select("id,resource_id")
      .eq("project_id", project.id);
    if (existingResult.error) {
      setError(existingResult.error.message);
      setBusy(false);
      return;
    }

    const existing = existingResult.data ?? [];
    const selectedIds = new Set(
      selectedResources.map((resource) => resource.id),
    );
    const deleteIds = existing
      .filter((assignment) => !selectedIds.has(assignment.resource_id))
      .map((assignment) => assignment.id);
    const existingIds = new Set(
      existing.map((assignment) => assignment.resource_id),
    );
    const inserts = selectedResources
      .filter((resource) => !existingIds.has(resource.id))
      .map((resource) => ({
        project_id: project.id,
        resource_id: resource.id,
        role: resource.role,
        allocation_percentage: 50,
        start_date: project.startDate,
        end_date: project.endDate,
      }));

    if (deleteIds.length) {
      const deleteResult = await client
        .from("project_assignments")
        .delete()
        .in("id", deleteIds);
      if (deleteResult.error) {
        setError(deleteResult.error.message);
        setBusy(false);
        return;
      }
    }
    if (inserts.length) {
      const insertResult = await client
        .from("project_assignments")
        .insert(inserts);
      if (insertResult.error) {
        setError(insertResult.error.message);
        setBusy(false);
        return;
      }
    }

    await client
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", project.id);
    await refresh();
    setBusy(false);
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="assignment-dialog"
        onSubmit={save}
        onMouseDown={(event) => event.stopPropagation()}
        aria-label="프로젝트 담당 리소스 편집"
      >
        <div className="dialog-head">
          <div>
            <p className="eyebrow">RESOURCE ASSIGNMENT</p>
            <h2>담당 리소스 편집</h2>
            <p>
              {project.customer} · {project.name}
            </p>
          </div>
          <button
            className="icon"
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            <X />
          </button>
        </div>
        <div className="assignment-options">
          {resources.map((resource) => (
            <label key={resource.id}>
              <input
                type="checkbox"
                checked={selected.includes(resource.name)}
                onChange={() => toggle(resource.name)}
              />
              <span className="avatar">{resource.name.slice(0, 2)}</span>
              <span>
                <strong>{resource.name}</strong>
                <small>
                  {resource.role} · {resource.skill}
                </small>
              </span>
            </label>
          ))}
        </div>
        <p className="dialog-note">
          신규 배정은 프로젝트 기간 동안 기본 50%로 등록됩니다.
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary" type="button" onClick={onClose}>
            취소
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
