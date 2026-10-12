-- App sessions are accessed only by the trusted API with the service role.
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON public.app_sessions(expires_at);
