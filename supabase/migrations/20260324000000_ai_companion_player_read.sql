-- Allow players to read AI companion configs for published games
CREATE POLICY "Players can view AI configs for published games"
    ON public.ai_companion_configs FOR SELECT
    USING (
        game_id IN (
            SELECT id FROM public.games WHERE status = 'published'
        )
    );
