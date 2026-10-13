-- Store each domain entity as its own row while preserving the existing application model.
CREATE TABLE IF NOT EXISTS public.domain_state_meta (
  id text PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.domain_records (
  collection text NOT NULL,
  record_key text NOT NULL,
  payload jsonb NOT NULL,
  position bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, record_key),
  CHECK (collection IN (
    'tasks', 'files', 'deliveryFiles', 'analyses', 'reviews', 'drafts',
    'guestTransfers', 'conversations', 'messages', 'payments', 'plans',
    'scopeChanges', 'explainSessions', 'explainArtifacts', 'explainRequests',
    'supportTickets', 'idempotency', 'activity', 'notifications'
  ))
);
CREATE INDEX IF NOT EXISTS domain_records_collection_idx ON public.domain_records(collection);
ALTER TABLE public.domain_state_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_records ENABLE ROW LEVEL SECURITY;

INSERT INTO public.domain_state_meta (id, revision)
SELECT 'default', COALESCE(revision, 0) FROM public.app_state WHERE id = 'default'
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.domain_state_meta (id, revision) VALUES ('default', 0)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  source jsonb;
  collection_name text;
  item jsonb;
  item_index bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM public.domain_records LIMIT 1) THEN RETURN; END IF;
  SELECT state INTO source FROM public.app_state WHERE id = 'default';
  IF source IS NULL THEN RETURN; END IF;
  FOREACH collection_name IN ARRAY ARRAY[
    'tasks', 'files', 'deliveryFiles', 'analyses', 'reviews', 'drafts',
    'guestTransfers', 'conversations', 'messages', 'payments', 'plans',
    'scopeChanges', 'explainSessions', 'explainArtifacts', 'explainRequests',
    'supportTickets', 'activity', 'notifications'
  ] LOOP
    item_index := 0;
    FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(source->collection_name, '[]'::jsonb)) LOOP
      item_index := item_index + 1;
      INSERT INTO public.domain_records (collection, record_key, payload, position)
      VALUES (collection_name, COALESCE(NULLIF(item->>'id', ''), item_index::text), item, item_index)
      ON CONFLICT (collection, record_key) DO UPDATE SET payload = EXCLUDED.payload, position = EXCLUDED.position, updated_at = now();
    END LOOP;
  END LOOP;
  FOR collection_name, item IN SELECT key, value FROM jsonb_each(COALESCE(source->'idempotency', '{}'::jsonb)) LOOP
    INSERT INTO public.domain_records (collection, record_key, payload, position)
    VALUES ('idempotency', collection_name, item, 0)
    ON CONFLICT (collection, record_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();
  END LOOP;
END $$;

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
      'supportTickets', 'idempotency', 'activity', 'notifications'
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
