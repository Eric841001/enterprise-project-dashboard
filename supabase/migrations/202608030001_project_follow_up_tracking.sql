alter table public.projects
  add column if not exists follow_up_status text
    check (follow_up_status in ('Not Required', 'Pending', 'Waiting', 'Done')),
  add column if not exists next_action text,
  add column if not exists next_action_due_date date,
  add column if not exists evidence_last_at timestamptz,
  add column if not exists evidence_summary text;

comment on column public.projects.follow_up_status is 'Operational follow-up state derived from verified communication evidence.';
comment on column public.projects.evidence_last_at is 'Timestamp of the latest verified email or calendar evidence.';

insert into public.customers(name)
values ('HMM')
on conflict(name) do nothing;

insert into public.resources(name, role, primary_skill)
values
  ('권지민', 'Technical Consultant', 'M365 Education'),
  ('이강표', 'Technical Consultant', 'Power Platform')
on conflict(name) do nothing;

insert into public.projects(
  customer_id, project_code, name, category, project_type, probability, status,
  risk_level, phase, progress, scope_summary, import_note, follow_up_status,
  next_action, next_action_due_date, evidence_last_at, evidence_summary,
  project_manager_id
)
select
  c.id,
  'MZC-HMM-OA-2026',
  '2026년 OA·M365 Copilot 활용 교육',
  'M365 Education',
  'non_resident',
  100,
  'Confirmed'::public.project_status,
  'Medium',
  '교육 준비',
  35,
  '동일 사용자 대상 M365 사용자 교육 및 Copilot Chat 활용 교육, 과정별 주강사·보조강사 운영',
  '메일 확인 결과 교육 자료와 PDF 강사 프로필은 전달 완료되었습니다. 정확한 교육 일시는 메일 및 캘린더에서 확인되지 않아 일정 확정 증빙이 필요합니다. 교육용 계정의 비밀번호는 보안상 저장하지 않습니다.',
  'Pending',
  'HMM 정은혜 매니저에게 확정 교육 일시·참석 인원·장소를 재확인하고 캘린더 초대를 등록',
  '2026-08-04',
  '2026-08-03T09:43:51+09:00',
  '7월 27일 MCI 설문 완료. 7월 31일 교육자료 및 강사 프로필 전달. 8월 3일 PDF 프로필과 주강사·보조강사 운영 방식 회신 완료.',
  r.id
from public.customers c
join public.resources r on r.name = '권지민'
where c.name = 'HMM'
on conflict(project_code) do update set
  name = excluded.name,
  category = excluded.category,
  probability = excluded.probability,
  status = excluded.status,
  risk_level = excluded.risk_level,
  phase = excluded.phase,
  progress = excluded.progress,
  scope_summary = excluded.scope_summary,
  import_note = excluded.import_note,
  follow_up_status = excluded.follow_up_status,
  next_action = excluded.next_action,
  next_action_due_date = excluded.next_action_due_date,
  evidence_last_at = excluded.evidence_last_at,
  evidence_summary = excluded.evidence_summary,
  project_manager_id = excluded.project_manager_id,
  updated_at = now();

insert into public.project_assignments(project_id, resource_id, role, allocation_percentage, start_date, end_date)
select p.id, r.id, case when r.name = '권지민' then 'Lead Instructor' else 'Assistant Instructor' end, 25, '2026-08-03', '2026-08-31'
from public.projects p
join public.resources r on r.name in ('권지민', '이강표')
where p.project_code = 'MZC-HMM-OA-2026'
on conflict(project_id, resource_id, start_date) do update
set allocation_percentage = excluded.allocation_percentage;
