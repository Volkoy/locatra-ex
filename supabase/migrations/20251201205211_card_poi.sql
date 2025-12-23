alter table cards add column card_category text not null default 'general' check (card_category in ('general', 'poi_specific'));
alter table cards add column keywords text;
alter table cards add column poi_id bigint references pois(id) on delete set null;

create index cards_poi_id_idx on cards(poi_id);