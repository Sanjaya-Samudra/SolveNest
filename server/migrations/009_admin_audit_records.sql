-- Persist operational audit events alongside other transactional records.
ALTER TABLE public.domain_records DROP CONSTRAINT IF EXISTS domain_records_collection_check;
ALTER TABLE public.domain_records ADD CONSTRAINT domain_records_collection_check CHECK (collection IN (
    'tasks', 'files', 'deliveryFiles', 'analyses', 'reviews', 'drafts',
    'guestTransfers', 'conversations', 'messages', 'payments', 'plans',
    'scopeChanges', 'explainSessions', 'explainArtifacts', 'explainRequests',
    'supportTickets', 'idempotency', 'activity', 'notifications', 'adminAudit'));

INSERT INTO public.domain_records(collection, record_key, payload, position)
SELECT 'adminAudit', COALESCE(item->>'id', ordinality::text), item, ordinality - 1
FROM public.app_state, LATERAL jsonb_array_elements(COALESCE(state->'adminAudit', '[]'::jsonb)) WITH ORDINALITY AS audit(item, ordinality)
WHERE id = 'default'
ON CONFLICT(collection, record_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_domain_changes(
  p_expected_revision bigint,
  p_changes jsonb
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_revision bigint;
  change jsonb;
  next_revision bigint;
BEGIN
  SELECT revision INTO current_revision
  FROM public.domain_state_meta
  WHERE id = 'default'
  FOR UPDATE;

  IF current_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'APP_STATE_CONFLICT' USING ERRCODE = '40001';
  END IF;
  IF jsonb_typeof(COALESCE(p_changes, '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(p_changes, '[]'::jsonb)) > 10000 THEN
    RAISE EXCEPTION 'DOMAIN_CHANGES_INVALID' USING ERRCODE = '22023';
  END IF;

  FOR change IN SELECT value FROM jsonb_array_elements(COALESCE(p_changes, '[]'::jsonb)) LOOP
    IF change->>'collection' NOT IN (
      'tasks', 'files', 'deliveryFiles', 'analyses', 'reviews', 'drafts',
      'guestTransfers', 'conversations', 'messages', 'payments', 'plans',
      'scopeChanges', 'explainSessions', 'explainArtifacts', 'explainRequests',
      'supportTickets', 'idempotency', 'activity', 'notifications', 'adminAudit'
    ) OR COALESCE(change->>'key', '') = '' THEN
      RAISE EXCEPTION 'DOMAIN_CHANGE_INVALID' USING ERRCODE = '22023';
    END IF;
    IF change->'payload' IS NULL OR change->'payload' = 'null'::jsonb THEN
      DELETE FROM public.domain_records WHERE collection = change->>'collection' AND record_key = change->>'key';
    ELSE
      INSERT INTO public.domain_records (collection, record_key, payload, position, updated_at)
      VALUES (change->>'collection', change->>'key', change->'payload', COALESCE((change->>'position')::bigint, 0), now())
      ON CONFLICT (collection, record_key) DO UPDATE SET payload = EXCLUDED.payload, position = EXCLUDED.position, updated_at = now();
    END IF;
  END LOOP;

  next_revision := current_revision + 1;
  UPDATE public.domain_state_meta SET revision = next_revision, updated_at = now() WHERE id = 'default';
  RETURN next_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_domain_changes(bigint, jsonb) FROM PUBLIC;
REVOKE ALL ON public.domain_state_meta FROM anon, authenticated;
REVOKE ALL ON public.domain_records FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_domain_changes(bigint, jsonb) TO service_role;
