-- Fix infinite RLS recursion between game_sessions and stories.
--
-- The cycle:
--   game_sessions_select_public_story  → queries stories (triggers stories RLS)
--   stories_select_own                 → queries game_sessions (triggers game_sessions RLS)
--
-- Solution: a SECURITY DEFINER helper that queries stories without RLS.

CREATE OR REPLACE FUNCTION public.session_has_public_story(session_id_param bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.session_id = session_id_param AND s.is_public = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.session_has_public_story(bigint) TO anon, authenticated;

-- Replace the recursive policy with one that uses the SECURITY DEFINER helper.
DROP POLICY IF EXISTS "game_sessions_select_public_story" ON public.game_sessions;

CREATE POLICY "game_sessions_select_public_story"
  ON public.game_sessions AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (public.session_has_public_story(game_sessions.id));
