alter table "public"."characters" alter column "category" drop default;

alter type "public"."character_category" rename to "character_category__old_version_to_be_dropped";

create type "public"."character_category" as enum ('human', 'non-human', 'both');

alter table "public"."characters" alter column category type "public"."character_category" using category::text::"public"."character_category";

alter table "public"."characters" alter column "category" set default 'non-human'::public.character_category;

drop type "public"."character_category__old_version_to_be_dropped";

alter table "public"."cards" drop column "applies_to";

alter table "public"."cards" add column "character_category" public.character_category not null default 'both'::public.character_category;

alter table "public"."characters" alter column "category" set default 'non-human'::public.character_category;


