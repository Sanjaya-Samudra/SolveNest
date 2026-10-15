create or replace function public.apply_domain_changes_v2(
  p_changes jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  change jsonb;
  current_payload jsonb;
  current_exists boolean;
  next_revision bigint;
begin
  if jsonb_typeof(coalesce(p_changes, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_changes, '[]'::jsonb)) > 10000 then
    raise exception 'DOMAIN_CHANGES_INVALID' using errcode = '22023';
  end if;

  for change in select value from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) loop
    if change->>'collection' not in (
      'tasks', 'files', 'deliveryFiles', 'analyses', 'reviews', 'drafts',
      'guestTransfers', 'conversations', 'messages', 'payments', 'plans',
      'scopeChanges', 'explainSessions', 'explainArtifacts', 'explainRequests',
      'supportTickets', 'idempotency', 'activity', 'notifications', 'adminAudit'
    ) or coalesce(change->>'key', '') = '' then
      raise exception 'DOMAIN_CHANGE_INVALID' using errcode = '22023';
    end if;

    select payload into current_payload
    from public.domain_records
    where collection = change->>'collection' and record_key = change->>'key'
    for update;
    current_exists := found;

    if current_exists is distinct from coalesce((change->>'expectedExists')::boolean, false)
       or (current_exists and current_payload is distinct from change->'expectedPayload') then
      raise exception 'APP_STATE_CONFLICT' using errcode = '40001';
    end if;

    if change->'payload' is null or change->'payload' = 'null'::jsonb then
      delete from public.domain_records
      where collection = change->>'collection' and record_key = change->>'key';
    else
      insert into public.domain_records (collection, record_key, payload, position, updated_at)
      values (change->>'collection', change->>'key', change->'payload', coalesce((change->>'position')::bigint, 0), now())
      on conflict (collection, record_key) do update
      set payload = excluded.payload, position = excluded.position, updated_at = now();
    end if;
  end loop;

  update public.domain_state_meta
  set revision = revision + 1, updated_at = now()
  where id = 'default'
  returning revision into next_revision;
  return next_revision;
exception
  when unique_violation then
    raise exception 'APP_STATE_CONFLICT' using errcode = '40001';
end;
$$;

revoke all on function public.apply_domain_changes_v2(jsonb) from public;
grant execute on function public.apply_domain_changes_v2(jsonb) to service_role;

create index if not exists domain_records_student_idx
  on public.domain_records (collection, ((payload->>'studentId')));
create index if not exists domain_records_task_idx
  on public.domain_records (collection, ((payload->>'taskId')));
