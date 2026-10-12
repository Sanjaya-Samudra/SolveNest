-- Move real Expert workspaces out of the shared application document.
CREATE TABLE IF NOT EXISTS public.expert_workspaces (
  expert_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expert_workspaces ENABLE ROW LEVEL SECURITY;

INSERT INTO public.expert_workspaces (expert_id, workspace)
SELECT profile.id, item.value
FROM public.app_state AS source
CROSS JOIN LATERAL jsonb_each(COALESCE(source.state->'expertWorkspaces', '{}'::jsonb)) AS item(key, value)
JOIN public.profiles AS profile ON profile.id::text = item.key
WHERE source.id = 'default'
ON CONFLICT (expert_id) DO NOTHING;

INSERT INTO public.expert_workspaces (expert_id, workspace)
SELECT profile.id, source.state->'expert'
FROM public.app_state AS source
JOIN public.profiles AS profile ON profile.id::text = source.state->'expert'->'expert'->>'id'
WHERE source.id = 'default' AND source.state ? 'expert'
ON CONFLICT (expert_id) DO NOTHING;
