-- Atomic, shared one-minute limits for every API instance.
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL,
  PRIMARY KEY (key_hash, window_start)
);
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key_hash text, p_max integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  IF p_key_hash !~ '^[0-9a-f]{64}$' OR p_max < 1 OR p_max > 1000 THEN
    RAISE EXCEPTION 'Invalid rate limit input';
  END IF;
  INSERT INTO public.rate_limit_counters (key_hash, window_start, request_count)
  VALUES (p_key_hash, date_trunc('minute', clock_timestamp()), 1)
  ON CONFLICT (key_hash, window_start)
  DO UPDATE SET request_count = rate_limit_counters.request_count + 1
  RETURNING request_count INTO current_count;
  IF random() < 0.001 THEN
    DELETE FROM public.rate_limit_counters WHERE window_start < clock_timestamp() - interval '1 day';
  END IF;
  RETURN current_count <= p_max;
END;
$$;

REVOKE ALL ON public.rate_limit_counters FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer) TO service_role;
