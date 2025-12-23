-- RPC function to get latitude and longitude from PostGIS geometry/geography columns
-- This function extracts coordinates from the location column for any table

-- Function to get coordinates from games table
CREATE OR REPLACE FUNCTION get_game_location(game_id_param bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'longitude', ST_X(location::geometry),
    'latitude', ST_Y(location::geometry)
  ) INTO result
  FROM games
  WHERE id = game_id_param;
  
  RETURN result;
END;
$$;

-- Function to get coordinates from POIs table
CREATE OR REPLACE FUNCTION get_poi_location(poi_id_param bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'longitude', ST_X(location::geometry),
    'latitude', ST_Y(location::geometry)
  ) INTO result
  FROM pois
  WHERE id = poi_id_param;
  
  RETURN result;
END;
$$;

-- Function to get all POIs with coordinates for a specific game
CREATE OR REPLACE FUNCTION get_game_pois_with_location(game_id_param bigint)
RETURNS TABLE (
  id bigint,
  name text,
  description text,
  image_url text,
  type types,
  tags text[],
  slug text,
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
    p.image_url,
    p.type,
    p.tags,
    p.slug,
    ST_X(p.location::geometry) as longitude,
    ST_Y(p.location::geometry) as latitude
  FROM pois p
  WHERE p.game_id = game_id_param
  ORDER BY p.created_at;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_game_location(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_poi_location(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_game_pois_with_location(bigint) TO authenticated;
