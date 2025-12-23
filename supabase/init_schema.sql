-- Create profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'staff' CHECK (role IN ('staff', 'admin')),
  organization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create custom types
CREATE TYPE game_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE game_difficulty AS ENUM ('easy', 'medium', 'hard');

-- Create games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  location_name TEXT,
  location_coordinates GEOGRAPHY(POINT),
  location_radius INTEGER, -- in meters
  url_slug TEXT UNIQUE,
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  status game_status DEFAULT 'draft',
  difficulty game_difficulty DEFAULT 'medium',
  estimated_duration INTEGER, -- in minutes
  minimum_players INTEGER DEFAULT 1,
  maximum_players INTEGER,
  is_public BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'en',
  published_at TIMESTAMPTZ,
  play_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.00,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_games_creator ON public.games(creator_id);
CREATE INDEX idx_games_status ON public.games(status);
CREATE INDEX idx_games_location ON public.games USING GIST(location_coordinates);
CREATE INDEX idx_games_categories ON public.games USING GIN(categories);
CREATE INDEX idx_games_tags ON public.games USING GIN(tags);
CREATE INDEX idx_games_slug ON public.games(url_slug);

-- Enable Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Policies for games
CREATE POLICY "Anyone can view published games"
  ON public.games FOR SELECT
  USING (status = 'published' AND is_public = true);

CREATE POLICY "Creators can view their own games"
  ON public.games FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Authenticated users can create games"
  ON public.games FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their own games"
  ON public.games FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their own games"
  ON public.games FOR DELETE
  USING (auth.uid() = creator_id);

-- Trigger for updated_at
CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create custom types for POI
CREATE TYPE poi_type AS ENUM ('monument', 'museum', 'landmark', 'building', 'natural', 'event', 'custom');
CREATE TYPE poi_status AS ENUM ('active', 'inactive', 'maintenance');

-- Create points of interest table
CREATE TABLE IF NOT EXISTS public.points_of_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  audio_url TEXT,
  video_url TEXT,
  location_coordinates GEOGRAPHY(POINT) NOT NULL,
  location_address TEXT,
  radius INTEGER DEFAULT 50, -- detection radius in meters
  type poi_type DEFAULT 'custom',
  order_index INTEGER NOT NULL, -- sequence in the game
  is_required BOOLEAN DEFAULT true,
  status poi_status DEFAULT 'active',
  tags TEXT[] DEFAULT '{}',
  contextual_data JSONB DEFAULT '{}', -- historical facts, year, architect, etc.
  accessibility_info TEXT,
  visit_duration INTEGER, -- estimated time in minutes
  hints TEXT[],
  unlock_condition JSONB, -- conditions to unlock this POI
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_poi_game ON public.points_of_interest(game_id);
CREATE INDEX idx_poi_location ON public.points_of_interest USING GIST(location_coordinates);
CREATE INDEX idx_poi_type ON public.points_of_interest(type);
CREATE INDEX idx_poi_order ON public.points_of_interest(game_id, order_index);
CREATE INDEX idx_poi_tags ON public.points_of_interest USING GIN(tags);

-- Enable Row Level Security
ALTER TABLE public.points_of_interest ENABLE ROW LEVEL SECURITY;

-- Policies for POI
CREATE POLICY "Anyone can view POIs of published games"
  ON public.points_of_interest FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = points_of_interest.game_id
      AND games.status = 'published'
      AND games.is_public = true
    )
  );

CREATE POLICY "Game creators can view their POIs"
  ON public.points_of_interest FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = points_of_interest.game_id
      AND games.creator_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can insert POIs"
  ON public.points_of_interest FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = points_of_interest.game_id
      AND games.creator_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can update their POIs"
  ON public.points_of_interest FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = points_of_interest.game_id
      AND games.creator_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can delete their POIs"
  ON public.points_of_interest FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = points_of_interest.game_id
      AND games.creator_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER poi_updated_at
  BEFORE UPDATE ON public.points_of_interest
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create custom types for card prompts
CREATE TYPE prompt_type AS ENUM ('narrative', 'question', 'challenge', 'reflection', 'choice');
CREATE TYPE hero_journey_step AS ENUM (
  'ordinary_world',
  'call_to_adventure',
  'refusal_of_call',
  'meeting_mentor',
  'crossing_threshold',
  'tests_allies_enemies',
  'approach_inmost_cave',
  'ordeal',
  'reward',
  'road_back',
  'resurrection',
  'return_with_elixir'
);

-- Create card prompts table
CREATE TABLE IF NOT EXISTS public.card_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  poi_id UUID REFERENCES public.points_of_interest(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type prompt_type DEFAULT 'narrative',
  hero_journey_step hero_journey_step,
  order_index INTEGER NOT NULL,
  required_previous_prompts UUID[],
  image_url TEXT,
  audio_url TEXT,
  time_limit INTEGER, -- in seconds, null for no limit
  points_value INTEGER DEFAULT 0,
  choices JSONB, -- for choice-type prompts: [{"text": "...", "consequence": "..."}]
  validation_rules JSONB, -- rules for validating responses
  hints TEXT[],
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_prompts_game ON public.card_prompts(game_id);
CREATE INDEX idx_prompts_poi ON public.card_prompts(poi_id);
CREATE INDEX idx_prompts_type ON public.card_prompts(type);
CREATE INDEX idx_prompts_journey_step ON public.card_prompts(hero_journey_step);
CREATE INDEX idx_prompts_order ON public.card_prompts(game_id, order_index);

-- Enable Row Level Security
ALTER TABLE public.card_prompts ENABLE ROW LEVEL SECURITY;

-- Policies for card prompts
CREATE POLICY "Anyone can view prompts of published games"
  ON public.card_prompts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = card_prompts.game_id
      AND games.status = 'published'
      AND games.is_public = true
    )
  );

CREATE POLICY "Game creators can view their prompts"
  ON public.card_prompts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = card_prompts.game_id
      AND games.creator_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can insert prompts"
  ON public.card_prompts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = card_prompts.game_id
      AND games.creator_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can update their prompts"
  ON public.card_prompts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = card_prompts.game_id
      AND games.creator_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can delete their prompts"
  ON public.card_prompts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = card_prompts.game_id
      AND games.creator_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER prompts_updated_at
  BEFORE UPDATE ON public.card_prompts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create AI configuration table
CREATE TABLE IF NOT EXISTS public.ai_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID UNIQUE NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  character_name TEXT DEFAULT 'Guide',
  character_description TEXT,
  character_avatar_url TEXT,
  character_voice TEXT, -- voice ID for TTS
  personality_traits TEXT[],
  tone TEXT DEFAULT 'friendly', -- friendly, formal, mysterious, humorous, etc.
  temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 1),
  max_tokens INTEGER DEFAULT 500,
  top_p DECIMAL(3,2) DEFAULT 0.9 CHECK (top_p >= 0 AND top_p <= 1),
  frequency_penalty DECIMAL(3,2) DEFAULT 0.0 CHECK (frequency_penalty >= -2 AND frequency_penalty <= 2),
  presence_penalty DECIMAL(3,2) DEFAULT 0.0 CHECK (presence_penalty >= -2 AND presence_penalty <= 2),
  system_prompt TEXT NOT NULL,
  context_prompt_template TEXT,
  greeting_message TEXT,
  farewell_message TEXT,
  error_message TEXT,
  enable_context_awareness BOOLEAN DEFAULT true,
  enable_memory BOOLEAN DEFAULT true,
  memory_window INTEGER DEFAULT 10, -- number of previous interactions to remember
  enable_location_awareness BOOLEAN DEFAULT true,
  custom_instructions JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ai_config_game ON public.ai_configuration(game_id);

-- Enable Row Level Security
ALTER TABLE public.ai_configuration ENABLE ROW LEVEL SECURITY;

-- Policies for AI configuration
CREATE POLICY "Game creators can view their AI config"
  ON public.ai_configuration FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = ai_configuration.game_id
      AND games.creator_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can insert AI config"
  ON public.ai_configuration FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = ai_configuration.game_id
      AND games.creator_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can update their AI config"
  ON public.ai_configuration FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = ai_configuration.game_id
      AND games.creator_id = auth.uid()
    )
  );

CREATE POLICY "Game creators can delete their AI config"
  ON public.ai_configuration FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = ai_configuration.game_id
      AND games.creator_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER ai_config_updated_at
  BEFORE UPDATE ON public.ai_configuration
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create game sessions table (track player progress)
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_token TEXT UNIQUE,
  current_poi_id UUID REFERENCES public.points_of_interest(id) ON DELETE SET NULL,
  completed_pois UUID[] DEFAULT '{}',
  completed_prompts UUID[] DEFAULT '{}',
  current_step hero_journey_step,
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration INTEGER, -- in seconds
  player_data JSONB DEFAULT '{}', -- story choices, collected items, etc.
  ai_conversation_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create player responses table
CREATE TABLE IF NOT EXISTS public.player_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.card_prompts(id) ON DELETE CASCADE,
  response_text TEXT,
  response_data JSONB,
  ai_feedback TEXT,
  points_earned INTEGER DEFAULT 0,
  time_taken INTEGER, -- in seconds
  location_coordinates GEOGRAPHY(POINT),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_sessions_game ON public.game_sessions(game_id);
CREATE INDEX idx_sessions_player ON public.game_sessions(player_id);
CREATE INDEX idx_sessions_status ON public.game_sessions(status);
CREATE INDEX idx_responses_session ON public.player_responses(session_id);
CREATE INDEX idx_responses_prompt ON public.player_responses(prompt_id);

-- Enable Row Level Security
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_responses ENABLE ROW LEVEL SECURITY;

-- Policies for game sessions
CREATE POLICY "Players can view their own sessions"
  ON public.game_sessions FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players can create sessions"
  ON public.game_sessions FOR INSERT
  WITH CHECK (auth.uid() = player_id OR player_id IS NULL);

CREATE POLICY "Players can update their own sessions"
  ON public.game_sessions FOR UPDATE
  USING (auth.uid() = player_id OR player_id IS NULL);

-- Policies for player responses
CREATE POLICY "Players can view their own responses"
  ON public.player_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_sessions
      WHERE game_sessions.id = player_responses.session_id
      AND (game_sessions.player_id = auth.uid() OR game_sessions.player_id IS NULL)
    )
  );

CREATE POLICY "Players can create responses"
  ON public.player_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.game_sessions
      WHERE game_sessions.id = player_responses.session_id
      AND (game_sessions.player_id = auth.uid() OR game_sessions.player_id IS NULL)
    )
  );

-- Triggers
CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


