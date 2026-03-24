-- Automatically unpublish a game when its content is modified.
-- This prevents published games from having stale/inconsistent content.

-- Trigger function for content tables (characters, pois, cards, ai_companion_configs)
CREATE OR REPLACE FUNCTION unpublish_game_on_content_change()
RETURNS TRIGGER AS $$
DECLARE
  v_game_id integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_game_id := OLD.game_id;
  ELSE
    v_game_id := NEW.game_id;
  END IF;

  IF v_game_id IS NOT NULL THEN
    UPDATE games
    SET status = 'draft', visibility = 'private'
    WHERE id = v_game_id
      AND status = 'published';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for the games table itself (title, description, location, etc.)
CREATE OR REPLACE FUNCTION unpublish_game_on_game_content_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'published' AND (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.location IS DISTINCT FROM NEW.location OR
    OLD.image_url IS DISTINCT FROM NEW.image_url OR
    OLD.categories IS DISTINCT FROM NEW.categories
  ) THEN
    NEW.status := 'draft';
    NEW.visibility := 'private';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to content tables
CREATE TRIGGER unpublish_on_character_change
  AFTER INSERT OR UPDATE OR DELETE ON characters
  FOR EACH ROW EXECUTE FUNCTION unpublish_game_on_content_change();

CREATE TRIGGER unpublish_on_poi_change
  AFTER INSERT OR UPDATE OR DELETE ON pois
  FOR EACH ROW EXECUTE FUNCTION unpublish_game_on_content_change();

CREATE TRIGGER unpublish_on_card_change
  AFTER INSERT OR UPDATE OR DELETE ON cards
  FOR EACH ROW EXECUTE FUNCTION unpublish_game_on_content_change();

CREATE TRIGGER unpublish_on_ai_config_change
  AFTER INSERT OR UPDATE OR DELETE ON ai_companion_configs
  FOR EACH ROW EXECUTE FUNCTION unpublish_game_on_content_change();

-- Attach to games table (BEFORE so we can modify NEW directly)
CREATE TRIGGER unpublish_on_game_content_change
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION unpublish_game_on_game_content_change();
