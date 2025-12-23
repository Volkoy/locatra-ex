create type "public"."hero_steps" as enum ('call_to_adventure', 'crossing_the_threshold', 'meeting_the_mentor', 'trials_and_growth', 'death_and_transformation', 'change_and_return');

alter table "public"."cards" add column "type" public.types not null;

ALTER TABLE "public"."cards" DROP COLUMN IF EXISTS "hero_steps";

ALTER TABLE "public"."cards" ADD COLUMN "hero_steps" public.hero_steps[] NOT NULL DEFAULT '{}';



