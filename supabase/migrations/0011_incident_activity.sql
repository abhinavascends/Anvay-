-- Permanent incident activity history for operator timelines.
create table public.incident_activity (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  action_type text not null,
  message text not null,
  actor_type text not null check (actor_type in ('citizen', 'operator', 'rescue_team', 'system')),
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_incident_activity_incident_created
  on public.incident_activity (incident_id, created_at desc);

alter table public.incident_activity enable row level security;

create policy "incident_activity_select_authenticated"
  on public.incident_activity
  for select to authenticated using (true);

alter publication supabase_realtime add table public.incident_activity;

create or replace function public.incident_actor_type(actor_id uuid, fallback text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case (select role::text from public.profiles where id = actor_id)
      when 'FIELD_TEAM' then 'rescue_team'
      when 'OPERATOR' then 'operator'
      when 'ADMIN' then 'operator'
      when 'CITIZEN' then 'citizen'
      else null
    end,
    fallback
  );
$$;

create or replace function public.record_incident_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  actor_kind text;
  team_code text;
begin
  if tg_op = 'INSERT' then
    actor := new.reporter_id;
    actor_kind := public.incident_actor_type(
      actor,
      case when new.source = 'SMS' then 'citizen' else 'citizen' end
    );

    insert into public.incident_activity
      (incident_id, action_type, message, actor_type, actor_id)
    values
      (new.id, 'INCIDENT_SUBMITTED', 'Citizen submitted incident', actor_kind, actor),
      (new.id, 'INCIDENT_AVAILABLE', 'Incident available to operators', 'system', null);

    return new;
  end if;

  if old.verification_status is distinct from new.verification_status then
    actor := auth.uid();
    actor_kind := public.incident_actor_type(actor, 'operator');
    insert into public.incident_activity
      (incident_id, action_type, message, actor_type, actor_id)
    values (
      new.id,
      case when new.verification_status = 'REJECTED'
        then 'INCIDENT_REJECTED' else 'INCIDENT_VERIFIED' end,
      case when new.verification_status = 'REJECTED'
        then 'Incident rejected'
        else 'Incident verified as ' || replace(new.verification_status::text, '_', ' ') end,
      actor_kind,
      actor
    );
  end if;

  if old.status is distinct from new.status then
    actor := auth.uid();
    actor_kind := public.incident_actor_type(actor, 'operator');
    insert into public.incident_activity
      (incident_id, action_type, message, actor_type, actor_id)
    values (
      new.id,
      case when new.status in ('RESOLVED', 'CANCELLED')
        then 'INCIDENT_CLOSED' else 'INCIDENT_STATUS_CHANGED' end,
      case when new.status = 'RESOLVED' then 'Incident resolved'
        when new.status = 'CANCELLED' then 'Incident cancelled'
        else 'Incident status changed to ' || replace(new.status::text, '_', ' ') end,
      actor_kind,
      actor
    );
  end if;

  return new;
end;
$$;

create trigger trg_record_incident_activity
  after insert or update of status, verification_status
  on public.incidents
  for each row execute function public.record_incident_activity();

create or replace function public.record_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  actor_kind text;
  resolved_team_code text;
begin
  select t.team_code into resolved_team_code
  from public.resource_teams
  as t
  where t.id = new.resource_id;

  if tg_op = 'INSERT' then
    actor := new.assigned_by_id;
    actor_kind := public.incident_actor_type(actor, 'operator');
    insert into public.incident_activity
      (incident_id, action_type, message, actor_type, actor_id)
    values (
      new.incident_id,
      'TEAM_ASSIGNED',
      'Operator assigned ' || coalesce(resolved_team_code, 'rescue team'),
      actor_kind,
      actor
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    actor := auth.uid();
    actor_kind := public.incident_actor_type(actor, 'rescue_team');
    insert into public.incident_activity
      (incident_id, action_type, message, actor_type, actor_id)
    values (
      new.incident_id,
      case when new.status = 'INTERRUPTED' then 'TEAM_REASSIGNED'
        else 'TEAM_STATUS_CHANGED' end,
      case when new.status = 'INTERRUPTED'
        then coalesce(resolved_team_code, 'Rescue team') || ' response interrupted; reassignment needed'
        else coalesce(resolved_team_code, 'Rescue team') || ' status changed to ' || replace(new.status::text, '_', ' ') end,
      actor_kind,
      actor
    );
  end if;

  return new;
end;
$$;

create trigger trg_record_assignment_activity
  after insert or update of status
  on public.assignments
  for each row execute function public.record_assignment_activity();
