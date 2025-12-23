alter table "public"."games" drop constraint "games_location_check";

alter table "public"."pois" drop constraint "pois_location_check";

drop function if exists "public"."get_slug"();

alter table "public"."characters" drop constraint "characters_pkey";

drop index if exists "public"."games_location_idx";

drop index if exists "public"."pois_location_idx";

drop index if exists "public"."characters_pkey";

alter table "public"."characters" add column "character_id" uuid not null default gen_random_uuid();

alter table "public"."games" alter column "description" drop default;

alter table "public"."games" alter column "game_id" set not null;

alter table "public"."games" alter column "location" drop not null;

alter table "public"."games" alter column "location" set data type geometry(Point, 4326) using "location"::geometry;

alter table "public"."games" alter column "owner_id" set not null;

alter table "public"."games" alter column "title" drop default;

alter table "public"."pois" add column "contextual_data" text;

alter table "public"."pois" alter column "location" set data type geography(Point, 4326) using "location"::geography;

alter table "public"."pois" alter column "slug" drop not null;

CREATE UNIQUE INDEX characters_character_id_key ON public.characters USING btree (character_id);

CREATE UNIQUE INDEX characters_pkey ON public.characters USING btree (id, character_id);

alter table "public"."characters" add constraint "characters_pkey" PRIMARY KEY using index "characters_pkey";

alter table "public"."characters" add constraint "characters_character_id_key" UNIQUE using index "characters_character_id_key";

alter table "public"."games" add constraint "games_location_check" CHECK ((st_srid(location) = 4326)) not valid;

alter table "public"."games" validate constraint "games_location_check";

alter table "public"."pois" add constraint "pois_location_check" CHECK ((st_srid(location) = 4326)) not valid;

alter table "public"."pois" validate constraint "pois_location_check";

CREATE INDEX games_location_idx ON public.games USING GIST (location);
CREATE INDEX pois_location_idx ON public.pois USING GIST (location);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.gen_slug()
 RETURNS text
 LANGUAGE sql
AS $function$select 'game-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 8)$function$
;


CREATE OR REPLACE FUNCTION public.get_pois_with_geojson(p_game_id bigint)
RETURNS TABLE (
    id bigint,
    game_id bigint,
    name text,
    slug text,
    description text,
    image_url text,
    contextual_data text,
    type types,
    tags text[],
    created_at timestamptz,
    updated_at timestamptz,
    location json
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        p.id,
        p.game_id,
        p.name,
        p.slug,
        p.description,
        p.image_url,
        p.contextual_data,
        p.type,
        p.tags,
        p.created_at,
        p.updated_at,
        ST_AsGeoJSON(p.location)::json as location
    FROM pois p
    WHERE p.game_id = p_game_id
    ORDER BY p.created_at;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_pois_with_geojson(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pois_with_geojson(bigint) TO anon;