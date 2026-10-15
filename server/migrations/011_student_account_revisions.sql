alter table public.student_accounts
  add column if not exists revision bigint not null default 0;

create index if not exists student_accounts_updated_at_idx
  on public.student_accounts (updated_at desc);

comment on column public.student_accounts.revision is
  'Optimistic concurrency token used to prevent account preference and profile updates from overwriting one another.';
