alter table public.project_assignments add column if not exists weekdays smallint[] null;
alter table public.project_assignments drop constraint if exists project_assignments_weekdays_valid;
alter table public.project_assignments add constraint project_assignments_weekdays_valid check (weekdays is null or (cardinality(weekdays) > 0 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]));

update public.project_assignments assignment_row
set allocation_percentage = 100, weekdays = array[1,2,5]::smallint[]
from public.projects project_row
join public.customers customer_row on customer_row.id = project_row.customer_id
join public.resources resource_row on resource_row.name = '설용환'
where assignment_row.project_id = project_row.id
  and assignment_row.resource_id = resource_row.id
  and customer_row.name = '알테오젠'
  and assignment_row.start_date = date '2026-11-03'
  and assignment_row.end_date = date '2027-03-31';
