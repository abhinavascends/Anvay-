
create or replace function public.sync_team_current_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('PENDING', 'ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE') then
    update public.resource_teams
    set current_assignment_id = new.id,
        status = case
          when new.status = 'PENDING' then 'ASSIGNED'::public.resource_status
          when new.status = 'ACKNOWLEDGED' then 'ASSIGNED'::public.resource_status
          when new.status = 'EN_ROUTE' then 'EN_ROUTE'::public.resource_status
          else 'ON_SCENE'::public.resource_status
        end,
        last_status_update = now()
    where id = new.resource_id;
  elsif new.status in ('COMPLETED', 'CANCELLED', 'INTERRUPTED') then
    update public.resource_teams
    set current_assignment_id = null,
        status = case
          when new.status = 'COMPLETED' then 'RETURNING'::public.resource_status
          else 'AVAILABLE'::public.resource_status
        end,
        last_status_update = now()
    where id = new.resource_id and current_assignment_id = new.id;
  end if;

  if new.status in ('ACKNOWLEDGED', 'EN_ROUTE', 'ON_SCENE') then
    update public.incidents
    set status = case
        when new.status = 'ACKNOWLEDGED' then 'ASSIGNED'::public.incident_status
        when new.status = 'EN_ROUTE' then 'EN_ROUTE'::public.incident_status
        else 'ON_SCENE'::public.incident_status
      end,
      updated_at = now()
    where id = new.incident_id;
  elsif new.status = 'COMPLETED' then
    update public.incidents
    set status = 'RESOLVED'::public.incident_status,
        resolved_at = now(),
        updated_at = now()
    where id = new.incident_id;
  end if;

  return new;
end;
$$;

drop policy if exists "logs_insert_field_team" on public.assignment_logs;
create policy "logs_insert_field_team"
on public.assignment_logs for insert to authenticated
with check (
  public.has_role(array['FIELD_TEAM']::public.user_role[])
);
