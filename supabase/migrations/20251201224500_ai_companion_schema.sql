-- Create enums for AI companion
DO $$ BEGIN
    CREATE TYPE ai_tone AS ENUM ('enthusiastic', 'calm', 'mysterious', 'professional', 'playful', 'serious');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_personality AS ENUM ('mentor', 'friend', 'sage', 'explorer', 'historian', 'storyteller');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_relationship AS ENUM ('guide', 'companion', 'rival', 'mysterious-ally');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Drop and recreate ai_companion_configs table with proper schema
DROP TABLE IF EXISTS public.ai_companion_configs CASCADE;

CREATE TABLE public.ai_companion_configs (
    id bigserial PRIMARY KEY,
    game_id bigint NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    name text NOT NULL,
    avatar_url text,
    tone ai_tone NOT NULL DEFAULT 'calm',
    personality ai_personality NOT NULL DEFAULT 'mentor',
    relationship ai_relationship NOT NULL DEFAULT 'guide',
    humor_level smallint NOT NULL DEFAULT 0 CHECK (humor_level >= 0 AND humor_level <= 2),
    formality smallint NOT NULL DEFAULT 1 CHECK (formality >= 0 AND formality <= 2),
    additional_context text,
    system_prompt text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(game_id)
);

-- Create indexes
CREATE INDEX ai_companion_configs_game_id_idx ON public.ai_companion_configs(game_id);

-- Enable RLS
ALTER TABLE public.ai_companion_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view AI configs for their games" ON public.ai_companion_configs;
DROP POLICY IF EXISTS "Users can insert AI configs for their games" ON public.ai_companion_configs;
DROP POLICY IF EXISTS "Users can update AI configs for their games" ON public.ai_companion_configs;
DROP POLICY IF EXISTS "Users can delete AI configs for their games" ON public.ai_companion_configs;

-- Create RLS policies
CREATE POLICY "Users can view AI configs for their games"
    ON public.ai_companion_configs FOR SELECT
    USING (
        game_id IN (
            SELECT id FROM public.games WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert AI configs for their games"
    ON public.ai_companion_configs FOR INSERT
    WITH CHECK (
        game_id IN (
            SELECT id FROM public.games WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update AI configs for their games"
    ON public.ai_companion_configs FOR UPDATE
    USING (
        game_id IN (
            SELECT id FROM public.games WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete AI configs for their games"
    ON public.ai_companion_configs FOR DELETE
    USING (
        game_id IN (
            SELECT id FROM public.games WHERE owner_id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON public.ai_companion_configs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ai_companion_configs_id_seq TO authenticated;

-- Create trigger for updated_at
CREATE TRIGGER ai_companion_configs_updated_at
    BEFORE UPDATE ON public.ai_companion_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
