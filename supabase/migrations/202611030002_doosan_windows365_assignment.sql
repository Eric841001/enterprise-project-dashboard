insert into public.customers(name)
values ('두산에너빌리티')
on conflict(name) do nothing;

insert into public.projects(
  customer_id, project_code, name, category, project_type,
  probability, status, risk_level, phase, progress,
  start_date, end_date, scope_summary, import_note, project_manager_id
)
select
  customer_row.id, 'MZC-DOOSAN-W365', 'Windows 365 Deployment', 'Windows 365', 'non_resident',
  100, 'In Progress', 'Medium', 'Delivery', 0,
  date '2026-11-09', date '2027-02-08',
  'Windows 365 delivery project',
  'User-confirmed: Yun Kangyeol is assigned at 100 percent from 2026-11-09 through 2027-02-08. Commercial, contact, and security details are intentionally omitted.',
  resource_row.id
from public.customers customer_row
join public.resources resource_row on resource_row.name = '윤강열'
where customer_row.name = '두산에너빌리티'
on conflict(project_code) do update
set status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    phase = excluded.phase,
    project_manager_id = excluded.project_manager_id,
    import_note = excluded.import_note;

insert into public.project_assignments(
  project_id, resource_id, role, allocation_percentage, start_date, end_date, verification_state, record_kind
)
select project_row.id, resource_row.id, 'Windows 365 Delivery', 100, date '2026-11-09', date '2027-02-08', 'confirmed', 'allocation'
from public.projects project_row
join public.resources resource_row on resource_row.name = '윤강열'
where project_row.project_code = 'MZC-DOOSAN-W365'
on conflict(project_id, resource_id, start_date) where removed_at is null do update
set allocation_percentage = excluded.allocation_percentage,
    end_date = excluded.end_date,
    verification_state = excluded.verification_state;
