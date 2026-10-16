CREATE TABLE IF NOT EXISTS public.privileged_role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  expected_role text NOT NULL CHECK (expected_role IN ('Student', 'Expert', 'Admin')),
  requested_role text NOT NULL CHECK (requested_role = 'Superadmin'),
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE UNIQUE INDEX IF NOT EXISTS privileged_role_requests_one_pending_target
  ON public.privileged_role_requests(target_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS privileged_role_requests_pending_created
  ON public.privileged_role_requests(status, created_at DESC);

ALTER TABLE public.privileged_role_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.privileged_role_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_superadmin_role(
  p_actor uuid,
  p_target uuid,
  p_expected_role text,
  p_note text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_profile public.profiles%ROWTYPE;
DECLARE target_profile public.profiles%ROWTYPE;
DECLARE request_id uuid;
BEGIN
  SELECT * INTO actor_profile FROM public.profiles WHERE id = p_actor;
  IF actor_profile.role IS DISTINCT FROM 'Superadmin' THEN RAISE EXCEPTION 'SUPERADMIN_REQUIRED'; END IF;
  IF p_actor = p_target THEN RAISE EXCEPTION 'SELF_ROLE_CHANGE_BLOCKED'; END IF;
  IF p_expected_role NOT IN ('Student', 'Expert', 'Admin') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 10 THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;
  SELECT * INTO target_profile FROM public.profiles WHERE id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF target_profile.role IS DISTINCT FROM p_expected_role THEN RAISE EXCEPTION 'ROLE_CHANGED'; END IF;
  UPDATE public.privileged_role_requests SET status = 'expired', decided_at = now()
    WHERE target_id = p_target AND status = 'pending' AND expires_at <= now();
  INSERT INTO public.privileged_role_requests(target_id, requested_by, expected_role, requested_role, note)
  VALUES (p_target, p_actor, p_expected_role, 'Superadmin', btrim(p_note))
  RETURNING id INTO request_id;
  RETURN jsonb_build_object('id', request_id, 'status', 'pending', 'expiresAt', now() + interval '24 hours');
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'APPROVAL_ALREADY_PENDING';
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_superadmin_role_request(
  p_actor uuid,
  p_request uuid,
  p_decision text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_profile public.profiles%ROWTYPE;
DECLARE target_profile public.profiles%ROWTYPE;
DECLARE role_request public.privileged_role_requests%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('solvenest:staff-role-governance'));
  SELECT * INTO actor_profile FROM public.profiles WHERE id = p_actor FOR UPDATE;
  IF actor_profile.role IS DISTINCT FROM 'Superadmin' THEN RAISE EXCEPTION 'SUPERADMIN_REQUIRED'; END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  SELECT * INTO role_request FROM public.privileged_role_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVAL_NOT_FOUND'; END IF;
  IF role_request.status <> 'pending' THEN RAISE EXCEPTION 'APPROVAL_DECIDED'; END IF;
  IF role_request.expires_at <= now() THEN
    UPDATE public.privileged_role_requests SET status = 'expired', decided_at = now() WHERE id = p_request;
    RAISE EXCEPTION 'APPROVAL_EXPIRED';
  END IF;
  IF role_request.requested_by = p_actor THEN RAISE EXCEPTION 'SECOND_APPROVER_REQUIRED'; END IF;
  SELECT * INTO target_profile FROM public.profiles WHERE id = role_request.target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF target_profile.role IS DISTINCT FROM role_request.expected_role THEN RAISE EXCEPTION 'ROLE_CHANGED'; END IF;
  UPDATE public.privileged_role_requests SET status = p_decision, approved_by = p_actor, decided_at = now() WHERE id = p_request;
  IF p_decision = 'approved' THEN
    UPDATE public.profiles SET role = 'Superadmin', updated_at = now() WHERE id = target_profile.id;
    DELETE FROM public.app_sessions WHERE user_id = target_profile.id;
    INSERT INTO public.staff_role_events(actor_id, target_id, actor_email, target_email, previous_role, new_role, note)
    VALUES (p_actor, target_profile.id, actor_profile.email, target_profile.email, target_profile.role, 'Superadmin', role_request.note);
  END IF;
  RETURN jsonb_build_object('id', p_request, 'status', p_decision, 'targetId', target_profile.id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_superadmin_role(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_superadmin_role_request(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_superadmin_role(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_superadmin_role_request(uuid, uuid, text) TO service_role;
