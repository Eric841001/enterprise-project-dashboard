-- Classify the current portfolio and fill only zero progress values from the
-- inclusive scheduled-day ratio through current_date. Existing manually entered progress is kept.
update public.projects as p
set project_type = case
  when exists (
    select 1 from public.customers as c
    where c.id = p.customer_id and c.name = '삼성증권'
  ) then 'resident'
  else 'non_resident'
end
where p.project_type is distinct from case
  when exists (
    select 1 from public.customers as c
    where c.id = p.customer_id and c.name = '삼성증권'
  ) then 'resident'
  else 'non_resident'
end;

with period_days as (
  select wp.project_id,
         day_value::date as scheduled_day
  from public.project_work_periods as wp
  cross join lateral generate_series(
    wp.start_date::timestamp,
    wp.end_date::timestamp,
    interval '1 day'
  ) as day_value
),
fallback_days as (
  select p.id as project_id,
         day_value::date as scheduled_day
  from public.projects as p
  cross join lateral generate_series(
    p.start_date::timestamp,
    p.end_date::timestamp,
    interval '1 day'
  ) as day_value
  where p.start_date is not null
    and p.end_date is not null
    and not exists (
      select 1 from public.project_work_periods as wp where wp.project_id = p.id
    )
),
scheduled_days as (
  select distinct project_id, scheduled_day from period_days
  union
  select distinct project_id, scheduled_day from fallback_days
),
calculated as (
  select project_id,
         count(*) filter (where scheduled_day <= current_date) as elapsed_days,
         count(*) as total_days
  from scheduled_days
  group by project_id
)
update public.projects as p
set progress = least(
      100,
      round(100.0 * calculated.elapsed_days / nullif(calculated.total_days, 0))::smallint
    ),
    updated_at = now()
from calculated
where p.id = calculated.project_id
  and p.progress = 0
  and calculated.elapsed_days > 0
  and p.status not in ('Completed', 'Cancelled', 'Archived');
