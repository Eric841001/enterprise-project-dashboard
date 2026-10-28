-- Additive migration. Existing dates/allocations and manual confirmations remain untouched.
alter table public.projects
  add column contract_start_date date,
  add column contract_end_date date,
  add column contract_state text not null default 'unverified' check(contract_state in ('unverified','tentative','confirmed')),
  add column contract_basis jsonb,
  add column schedule_basis jsonb,
  add constraint valid_contract_dates check(contract_start_date is null or contract_end_date is null or contract_start_date <= contract_end_date);
alter table public.project_assignments
  add column verification_state text not null default 'legacy' check(verification_state in ('legacy','unverified','tentative','confirmed')),
  add column record_kind text not null default 'allocation' check(record_kind in ('allocation','included')),
  add column parent_assignment_id uuid references public.project_assignments(id),
  add column evidence_basis jsonb,
  add column removed_at timestamptz;
alter table public.project_assignments drop constraint project_assignments_project_id_resource_id_start_date_key;
create unique index assignments_active_start on public.project_assignments(project_id,resource_id,start_date) where removed_at is null;

create table public.portfolio_snapshots (
  snapshot_date date primary key default (now() at time zone 'Asia/Seoul')::date,
  project_count integer not null, open_count integer not null, confirmed_count integer not null,
  pipeline_count integer not null, resource_count integer not null,
  captured_at timestamptz not null default now()
);
alter table public.portfolio_snapshots enable row level security;
create policy snapshots_read on public.portfolio_snapshots for select to authenticated using(public.is_approved_user());
create policy snapshots_write on public.portfolio_snapshots for all to authenticated using(public.current_role() in ('admin','manager')) with check(public.current_role() in ('admin','manager'));
grant select,insert,update on public.portfolio_snapshots to authenticated;
revoke all on public.portfolio_snapshots from anon;

create function public.valid_evidence_basis(b jsonb) returns boolean language sql stable as $$
  select coalesce(jsonb_typeof(b)='object'
    and b ?& array['source','reference','checkedAt']
    and (select count(*)=3 from jsonb_object_keys(b))
    and case when b->>'source'='gmail' then (b->>'reference') ~ '^[a-fA-F0-9]{12,32}$' or (b->>'reference') ~ '^https://mail\.google\.com/mail/u/[0-9]+/#(all|inbox|sent)/[A-Za-z0-9]{12,256}$'
             when b->>'source'='teams' then (b->>'reference') ~ '^https://teams\.microsoft\.com/l/message/[^/?#[:space:]]+/[0-9]+$'
             else false end
    and (b->>'checkedAt')::timestamptz <= now()+interval '1 minute',false)
$$;

create function public.capture_portfolio_snapshot() returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.is_approved_user() or public.current_role() not in ('admin','manager') then raise exception 'FORBIDDEN'; end if;
  insert into public.portfolio_snapshots(project_count,open_count,confirmed_count,pipeline_count,resource_count)
  select count(*),count(*) filter(where status not in ('Completed','Cancelled','Archived')),
    count(*) filter(where status in ('Confirmed','Planning','In Progress','At Risk','On Hold')),
    count(*) filter(where status in ('Lead','Qualified','Proposal','Negotiation')),
    (select count(*) from public.resources where employment_status='active')
  from public.projects where not is_archived
  on conflict(snapshot_date) do update set project_count=excluded.project_count,open_count=excluded.open_count,
    confirmed_count=excluded.confirmed_count,pipeline_count=excluded.pipeline_count,
    resource_count=excluded.resource_count,captured_at=now();
end $$;

-- Child writes lock their parent so old clients cannot bypass the concurrency token.
create function public.assignment_touch_parent() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  update public.projects set updated_at=clock_timestamp() where id=case when TG_OP='DELETE' then old.project_id else new.project_id end;
  return case when TG_OP='DELETE' then old else new end;
end $$;
create trigger assignment_parent_version before insert or update or delete on public.project_assignments for each row execute function public.assignment_touch_parent();

-- A single request is one PostgreSQL transaction. No destructive replacement.
-- Caller supplies the exact project timestamp and all active assignment rows it read.
create function public.save_project_operations(
  p_project_id uuid, p_expected_version timestamptz, p_expected_assignments jsonb,
  p_project jsonb, p_assignments jsonb
) returns uuid language plpgsql security invoker set search_path=public as $$
declare
  pid uuid := p_project_id;
  old_project public.projects;
  next_project public.projects;
  old_rows jsonb;
  item jsonb;
  existing public.project_assignments;
  rid uuid;
  seen uuid[] := '{}';
  field text;
  changes jsonb := '{}';
begin
  if not public.is_approved_user() or public.current_role() not in ('admin','manager') then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_project)<>'object' or jsonb_typeof(p_assignments)<>'array' then raise exception 'INVALID_PAYLOAD'; end if;
  if pid is not null then
    select * into old_project from public.projects where id=pid for update;
    if not found or old_project.updated_at is distinct from p_expected_version then raise exception 'STALE_PROJECT: 다른 사용자의 변경이 있습니다. 다시 불러와 주세요.'; end if;
    select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') into old_rows from public.project_assignments a where project_id=pid and removed_at is null;
    if old_rows is distinct from p_expected_assignments then raise exception 'STALE_ASSIGNMENTS: 배정이 변경되었습니다. 다시 불러와 주세요.'; end if;
  end if;
  next_project := jsonb_populate_record(old_project,p_project);
  if pid is null or (next_project.start_date,next_project.end_date,next_project.status,next_project.probability,next_project.project_manager_id) is distinct from (old_project.start_date,old_project.end_date,old_project.status,old_project.probability,old_project.project_manager_id) then
    if not public.valid_evidence_basis(next_project.schedule_basis) then raise exception '프로젝트 일정·확정 상태 변경에는 Gmail 또는 Teams 확인 근거가 필요합니다.'; end if;
  end if;
  if (next_project.contract_start_date,next_project.contract_end_date,next_project.contract_state) is distinct from (old_project.contract_start_date,old_project.contract_end_date,coalesce(old_project.contract_state,'unverified')) then
    if not public.valid_evidence_basis(next_project.contract_basis) then raise exception '계약 기간·상태 변경에는 Gmail 또는 Teams 확인 근거가 필요합니다.'; end if;
  end if;
  if next_project.contract_state='confirmed' and (next_project.contract_start_date is null or next_project.contract_end_date is null or not public.valid_evidence_basis(next_project.contract_basis)) then raise exception '확정 계약은 기간과 근거가 필요합니다.'; end if;
  if pid is null then
    insert into public.projects(customer_id,name,category,project_type,status,probability,progress,risk_level,start_date,end_date,scope_summary,phase,follow_up_status,next_action,next_action_due_date,evidence_summary,project_manager_id,contract_start_date,contract_end_date,contract_state,contract_basis,schedule_basis,created_by,updated_by)
    values(next_project.customer_id,next_project.name,next_project.category,next_project.project_type,next_project.status,next_project.probability,next_project.progress,next_project.risk_level,next_project.start_date,next_project.end_date,next_project.scope_summary,next_project.phase,next_project.follow_up_status,next_project.next_action,next_project.next_action_due_date,next_project.evidence_summary,next_project.project_manager_id,next_project.contract_start_date,next_project.contract_end_date,coalesce(next_project.contract_state,'unverified'),next_project.contract_basis,next_project.schedule_basis,auth.uid(),auth.uid()) returning id into pid;
  else
    update public.projects set customer_id=next_project.customer_id,name=next_project.name,category=next_project.category,project_type=next_project.project_type,status=next_project.status,probability=next_project.probability,progress=next_project.progress,risk_level=next_project.risk_level,start_date=next_project.start_date,end_date=next_project.end_date,scope_summary=next_project.scope_summary,phase=next_project.phase,follow_up_status=next_project.follow_up_status,next_action=next_project.next_action,next_action_due_date=next_project.next_action_due_date,evidence_summary=next_project.evidence_summary,project_manager_id=next_project.project_manager_id,contract_start_date=next_project.contract_start_date,contract_end_date=next_project.contract_end_date,contract_state=next_project.contract_state,contract_basis=next_project.contract_basis,schedule_basis=next_project.schedule_basis,updated_by=auth.uid() where id=pid;
  end if;
  -- Validate identities and release changed date keys inside the transaction.
  -- Deferring the unique check is unnecessary: unchanged IDs stay in place.
  for item in select value from jsonb_array_elements(p_assignments) loop
    if item->>'id' is not null then
      rid := (item->>'id')::uuid;
      if rid=any(seen) then raise exception 'DUPLICATE_ASSIGNMENT_ID'; end if;
      seen := array_append(seen,rid);
      if not exists(select 1 from public.project_assignments where id=rid and project_id=pid and removed_at is null) then raise exception 'INVALID_ASSIGNMENT_ID'; end if;
    end if;
  end loop;
  if exists(select 1 from public.project_assignments where project_id=pid and removed_at is null and not(id=any(seen))) and not public.valid_evidence_basis(next_project.schedule_basis) then raise exception '배정 제외에는 Gmail 또는 Teams 확인 근거가 필요합니다.'; end if;
  update public.project_assignments set removed_at=now() where project_id=pid and removed_at is null and not(id=any(seen));
  for item in select value from jsonb_array_elements(p_assignments) loop
    rid := nullif(item->>'id','')::uuid;
    existing := null;
    if rid is not null then select * into existing from public.project_assignments where id=rid and project_id=pid; end if;
    if rid is null or (existing.resource_id,existing.allocation_percentage,existing.start_date,existing.end_date,existing.verification_state,existing.record_kind,existing.parent_assignment_id,existing.evidence_basis) is distinct from
      ((item->>'resource_id')::uuid,(item->>'allocation_percentage')::smallint,(item->>'start_date')::date,(item->>'end_date')::date,item->>'verification_state',item->>'record_kind',nullif(item->>'parent_assignment_id','')::uuid,nullif(item->'evidence_basis','null'::jsonb)) then
      if not public.valid_evidence_basis(item->'evidence_basis') then raise exception '배정 변경에는 Gmail 또는 Teams 확인 근거가 필요합니다.'; end if;
      if item->>'verification_state'='legacy' then raise exception '변경한 배정의 확인 상태를 선택해 주세요.'; end if;
      if item->>'record_kind'='included' and (item->>'parent_assignment_id' is null or (item->>'allocation_percentage')::int<>0) then raise exception '포함 활동은 기본 배정과 연결하고 추가 투입률을 0으로 입력해 주세요.'; end if;
      if rid is null then
        insert into public.project_assignments(project_id,resource_id,role,allocation_percentage,start_date,end_date,verification_state,record_kind,parent_assignment_id,evidence_basis)
        values(pid,(item->>'resource_id')::uuid,item->>'role',(item->>'allocation_percentage')::smallint,(item->>'start_date')::date,(item->>'end_date')::date,item->>'verification_state',item->>'record_kind',nullif(item->>'parent_assignment_id','')::uuid,item->'evidence_basis');
      else
        update public.project_assignments set resource_id=(item->>'resource_id')::uuid,allocation_percentage=(item->>'allocation_percentage')::smallint,start_date=(item->>'start_date')::date,end_date=(item->>'end_date')::date,verification_state=item->>'verification_state',record_kind=item->>'record_kind',parent_assignment_id=nullif(item->>'parent_assignment_id','')::uuid,evidence_basis=item->'evidence_basis' where id=rid;
      end if;
    end if;
  end loop;
  if exists(select 1 from public.project_assignments a left join public.project_assignments parent on parent.id=a.parent_assignment_id
    where a.project_id=pid and a.removed_at is null and a.record_kind='included' and
    (parent.id is null or parent.removed_at is not null or parent.project_id<>pid or parent.resource_id<>a.resource_id or parent.record_kind<>'allocation' or parent.verification_state<>'confirmed' or parent.start_date>a.start_date or parent.end_date<a.end_date)) then raise exception '포함 활동은 동일 인력의 확정 기본 배정 기간 안에 있어야 합니다.'; end if;
  foreach field in array array['status','probability','start_date','end_date','contract_start_date','contract_end_date','contract_state','project_manager_id'] loop
    if to_jsonb(old_project)->field is distinct from to_jsonb(next_project)->field then changes := changes || jsonb_build_object(field,jsonb_build_object('before',to_jsonb(old_project)->field,'after',to_jsonb(next_project)->field)); end if;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') into old_rows from public.project_assignments a where project_id=pid and removed_at is null;
  -- Audit contains operational values and source IDs only, never mail bodies/titles/contact details.
  changes := changes || jsonb_build_object('assignments',jsonb_build_object(
    'before',(select coalesce(jsonb_agg(value-'role'-'project_id'-'removed_at'),'[]') from jsonb_array_elements(coalesce(p_expected_assignments,'[]'))),
    'after',(select coalesce(jsonb_agg(value-'role'-'project_id'-'removed_at'),'[]') from jsonb_array_elements(old_rows))));
  insert into public.project_activity_logs(project_id,actor_id,action,changed_fields) values(pid,auth.uid(),'operations_saved',changes);
  perform public.capture_portfolio_snapshot();
  return pid;
end $$;
revoke all on function public.save_project_operations(uuid,timestamptz,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_project_operations(uuid,timestamptz,jsonb,jsonb,jsonb) to authenticated;
revoke all on function public.capture_portfolio_snapshot() from public,anon;
grant execute on function public.capture_portfolio_snapshot() to authenticated;
