create table if not exists public.scheduled_job_leases (
  job_key text primary key,
  lease_until timestamptz not null,
  claimed_at timestamptz not null default now()
);

alter table public.scheduled_job_leases enable row level security;
revoke all on public.scheduled_job_leases from anon, authenticated;

create or replace function public.claim_scheduled_job(p_job_key text, p_lease_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed integer;
begin
  if length(trim(coalesce(p_job_key, ''))) < 3 or p_lease_seconds < 10 or p_lease_seconds > 86400 then
    raise exception 'INVALID_JOB_LEASE';
  end if;
  insert into public.scheduled_job_leases(job_key, lease_until, claimed_at)
  values (p_job_key, now() + make_interval(secs => p_lease_seconds), now())
  on conflict (job_key) do update
    set lease_until = excluded.lease_until, claimed_at = excluded.claimed_at
    where public.scheduled_job_leases.lease_until <= now();
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.claim_scheduled_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_scheduled_job(text, integer) to service_role;
