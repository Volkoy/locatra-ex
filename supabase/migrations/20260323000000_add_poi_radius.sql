-- Add radius column to pois table (in meters, how close player must be to unlock)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS radius integer NOT NULL DEFAULT 50;

-- Update the get_game_pois_with_location RPC to include radius
DROP FUNCTION IF EXISTS get_game_pois_with_location(bigint);
CREATE OR REPLACE FUNCTION get_game_pois_with_location(game_id_param bigint)
RETURNS TABLE (
  id bigint,
  name text,
  description text,
  contextual_data text,
  image_url text,
  type types,
  tags text[],
  slug text,
  radius integer,
  longitude double precision,
  latitude double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.contextual_data,
    p.image_url,
    p.type,
    p.tags,
    p.slug,
    p.radius,
    ST_X(p.location::geometry) as longitude,
    ST_Y(p.location::geometry) as latitude
  FROM pois p
  WHERE p.game_id = game_id_param
  ORDER BY p.created_at;
END;
$$;
