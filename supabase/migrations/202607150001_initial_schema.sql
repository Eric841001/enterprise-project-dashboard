create extension if not exists pgcrypto;
create type public.app_role as enum ('admin','manager','viewer');
create type public.project_status as enum ('Lead','Qualified','Proposal','Negotiation','Confirmed','Planning','In Progress','On Hold','At Risk','Completed','Cancelled','Archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '', role public.app_role not null default 'viewer', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), name text not null unique, english_name text, industry text, tier text, account_owner uuid references public.profiles(id), contact_name text, contact_email text, contact_phone text, website text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.resources (
  id uuid primary key default gen_random_uuid(), name text not null unique, english_name text, role text not null, job_title text, team text, primary_skill text, secondary_skills text[] not null default '{}', email text, employment_status text not null default 'active', available_capacity smallint not null default 100 check (available_capacity between 0 and 100), notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id), project_code text unique, name text not null, category text not null, project_type text, description text, business_background text, objective text, scope_summary text, in_scope text, out_of_scope text, assumptions text, dependencies text, constraints text, success_criteria text, probability smallint not null default 0 check (probability between 0 and 100), status public.project_status not null default 'Lead', priority text not null default 'Medium', risk_level text not null default 'Low' check (risk_level in ('Low','Medium','High')), phase text, progress smallint not null default 0 check (progress between 0 and 100), start_date date, end_date date, project_manager_id uuid references public.resources(id), presales_owner_id uuid references public.resources(id), delivery_owner_id uuid references public.resources(id), is_archived boolean not null default false, import_note text, created_at timestamptz not null default now(), created_by uuid references public.profiles(id), updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id), constraint valid_project_dates check (start_date is null or end_date is null or start_date <= end_date)
);
create table public.project_assignments (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, resource_id uuid not null references public.resources(id), role text not null, allocation_percentage smallint not null check (allocation_percentage between 0 and 100), start_date date not null, end_date date not null, unique(project_id,resource_id,start_date), check(start_date <= end_date)
);
create table public.project_milestones (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, title text not null, due_date date, status text not null default 'planned', notes text);
create table public.project_deliverables (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, title text not null, due_date date, status text not null default 'planned', owner_id uuid references public.resources(id));
create table public.project_risks (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, title text not null, description text, impact text, probability text, mitigation text, owner_id uuid references public.resources(id), due_date date, status text not null default 'open');
create table public.project_notes (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, body text not null, note_type text not null default 'note', created_by uuid references public.profiles(id), created_at timestamptz not null default now());
create table public.project_activity_logs (id bigint generated always as identity primary key, project_id uuid references public.projects(id) on delete set null, actor_id uuid references public.profiles(id), action text not null, changed_fields jsonb not null default '{}', created_at timestamptz not null default now());
create table public.app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create index projects_customer_idx on public.projects(customer_id);
create index projects_status_idx on public.projects(status) where not is_archived;
create index projects_dates_idx on public.projects(start_date,end_date);
create index assignments_resource_dates_idx on public.project_assignments(resource_id,start_date,end_date);

create function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$ select coalesce((select role from public.profiles where id=auth.uid()),'viewer'::public.app_role) $$;
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
create trigger resources_touch before update on public.resources for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security; alter table public.customers enable row level security; alter table public.resources enable row level security; alter table public.projects enable row level security; alter table public.project_assignments enable row level security; alter table public.project_milestones enable row level security; alter table public.project_deliverables enable row level security; alter table public.project_risks enable row level security; alter table public.project_notes enable row level security; alter table public.project_activity_logs enable row level security; alter table public.app_settings enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_self_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and role=(select role from public.profiles where id=auth.uid()));
create policy profiles_admin on public.profiles for all to authenticated using (public.current_role()='admin') with check (public.current_role()='admin');

do $$ declare t text; begin foreach t in array array['customers','resources','projects','project_assignments','project_milestones','project_deliverables','project_risks','project_notes','project_activity_logs','app_settings'] loop execute format('create policy %I_read on public.%I for select to authenticated using (true)',t,t); execute format('create policy %I_write on public.%I for all to authenticated using (public.current_role() in (''admin'',''manager'')) with check (public.current_role() in (''admin'',''manager''))',t,t); end loop; end $$;

revoke all on all tables in schema public from anon;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
