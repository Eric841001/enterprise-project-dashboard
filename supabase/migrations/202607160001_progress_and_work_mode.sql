-- Classify the current portfolio and fill only zero progress values from the
-- inclusive scheduled-month ratio. Existing manually entered progress is kept.
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

with period_months as (
  select wp.project_id,
         date_trunc('month', month_value)::date as month_start
  from public.project_work_periods as wp
  cross join lateral generate_series(
    date_trunc('month', wp.start_date::timestamp),
    date_trunc('month', wp.end_date::timestamp),
    interval '1 month'
  ) as month_value
),
fallback_months as (
  select p.id as project_id,
         date_trunc('month', month_value)::date as month_start
  from public.projects as p
  cross join lateral generate_series(
    date_trunc('month', p.start_date::timestamp),
    date_trunc('month', p.end_date::timestamp),
    interval '1 month'
  ) as month_value
  where p.start_date is not null
    and p.end_date is not null
    and not exists (
      select 1 from public.project_work_periods as wp where wp.project_id = p.id
    )
),
scheduled_months as (
  select distinct project_id, month_start from period_months
  union
  select distinct project_id, month_start from fallback_months
),
calculated as (
  select project_id,
         count(*) filter (where month_start <= date_trunc('month', current_date)::date) as elapsed_months,
         count(*) as total_months
  from scheduled_months
  group by project_id
)
update public.projects as p
set progress = least(
      100,
      round(100.0 * calculated.elapsed_months / nullif(calculated.total_months, 0))::smallint
    ),
    updated_at = now()
from calculated
where p.id = calculated.project_id
  and p.progress = 0
  and calculated.elapsed_months > 0
  and p.status not in ('Completed', 'Cancelled', 'Archived');
