create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  body_text text not null,
  reply_to text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'retry', 'delivered', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists notification_outbox_pending_idx on public.notification_outbox (next_attempt_at, created_at) where status in ('queued', 'retry', 'processing');
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;

create or replace function public.claim_notification_outbox(p_limit integer default 10)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 50 then raise exception 'OUTBOX_LIMIT_INVALID'; end if;
  return query
  with candidates as (
    select id from public.notification_outbox
    where (status in ('queued', 'retry') and next_attempt_at <= now())
       or (status = 'processing' and claimed_at < now() - interval '10 minutes')
    order by created_at
    for update skip locked
    limit p_limit
  )
  update public.notification_outbox o
  set status = 'processing', claimed_at = now(), attempts = attempts + 1
  from candidates c where o.id = c.id
  returning o.*;
end;
$$;

create or replace function public.complete_notification_outbox(p_id uuid, p_delivered boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.notification_outbox
  set status = case when p_delivered then 'delivered' when attempts >= 5 then 'failed' else 'retry' end,
      delivered_at = case when p_delivered then now() else null end,
      next_attempt_at = case when p_delivered then next_attempt_at else now() + make_interval(secs => least(3600, 30 * power(2, greatest(0, attempts - 1))::integer)) end,
      last_error = case when p_delivered then null else left(coalesce(p_error, 'EMAIL_NOT_DELIVERED'), 1000) end
  where id = p_id and status = 'processing';
end;
$$;

revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
revoke all on function public.complete_notification_outbox(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;
grant execute on function public.complete_notification_outbox(uuid, boolean, text) to service_role;
