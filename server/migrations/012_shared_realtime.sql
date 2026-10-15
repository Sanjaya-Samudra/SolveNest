create table if not exists public.realtime_events (
  id bigint generated always as identity primary key,
  audience text not null,
  event jsonb not null,
  origin uuid not null,
  created_at timestamptz not null default now(),
  constraint realtime_events_audience_length check (char_length(audience) between 1 and 128),
  constraint realtime_events_event_object check (jsonb_typeof(event) = 'object')
);

create index if not exists realtime_events_created_at_idx on public.realtime_events (created_at);
create index if not exists realtime_events_audience_id_idx on public.realtime_events (audience, id);

alter table public.realtime_events enable row level security;
revoke all on public.realtime_events from anon, authenticated;

comment on table public.realtime_events is
  'Short-lived server-side event relay used to fan SSE updates across multiple API instances.';
