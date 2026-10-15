CREATE OR REPLACE FUNCTION public.change_staff_role(
  p_actor uuid,
  p_target uuid,
  p_expected_role text,
  p_new_role text,
  p_note text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_profile public.profiles%ROWTYPE;
  target_profile public.profiles%ROWTYPE;
  superadmin_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('solvenest:staff-role-governance'));
  SELECT * INTO actor_profile FROM public.profiles WHERE id = p_actor FOR UPDATE;
  IF actor_profile.role IS DISTINCT FROM 'Superadmin' THEN RAISE EXCEPTION 'SUPERADMIN_REQUIRED'; END IF;
  IF p_actor = p_target THEN RAISE EXCEPTION 'SELF_ROLE_CHANGE_BLOCKED'; END IF;
  IF p_new_role NOT IN ('Student', 'Expert', 'Admin', 'Superadmin') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 10 THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;

  SELECT * INTO target_profile FROM public.profiles WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF target_profile.role IS DISTINCT FROM p_expected_role THEN RAISE EXCEPTION 'ROLE_CHANGED'; END IF;
  IF target_profile.role = p_new_role THEN RAISE EXCEPTION 'ROLE_UNCHANGED'; END IF;
  IF target_profile.role = 'Superadmin' AND p_new_role <> 'Superadmin' THEN
    SELECT count(*) INTO superadmin_count FROM public.profiles WHERE role = 'Superadmin';
    IF superadmin_count <= 1 THEN RAISE EXCEPTION 'LAST_SUPERADMIN'; END IF;
  END IF;

  UPDATE public.profiles SET role = p_new_role, updated_at = now() WHERE id = p_target;
  DELETE FROM public.app_sessions WHERE user_id = p_target;
  INSERT INTO public.staff_role_events (actor_id, target_id, actor_email, target_email, previous_role, new_role, note)
  VALUES (p_actor, p_target, actor_profile.email, target_profile.email, target_profile.role, p_new_role, btrim(p_note));
  RETURN jsonb_build_object('id', p_target, 'role', p_new_role);
END;
$$;

REVOKE ALL ON FUNCTION public.change_staff_role(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_staff_role(uuid, uuid, text, text, text) TO service_role;
