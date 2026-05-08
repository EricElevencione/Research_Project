create table public.land_parcels (
  id serial not null,
  parcel_number character varying(50) not null,
  farm_location_barangay character varying(100) null,
  farm_location_municipality character varying(100) null default 'Dumangas'::character varying,
  farm_location_province character varying(100) null default 'Iloilo'::character varying,
  total_farm_area_ha numeric(10, 4) null,
  within_ancestral_domain boolean null default false,
  agrarian_reform_beneficiary boolean null default false,
  ownership_document_no character varying(100) null,
  ownership_document_type character varying(50) null,
  latitude numeric(10, 8) null,
  longitude numeric(11, 8) null,
  polygon_coordinates jsonb null,
  land_type character varying(50) null,
  primary_crop character varying(100) null,
  is_active boolean null default true,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  created_by character varying(100) null,
  constraint land_parcels_pkey primary key (id),
  constraint land_parcels_parcel_number_key unique (parcel_number)
) TABLESPACE pg_default;

create index IF not exists idx_land_parcels_parcel_number on public.land_parcels using btree (parcel_number) TABLESPACE pg_default;

create index IF not exists idx_land_parcels_barangay on public.land_parcels using btree (farm_location_barangay) TABLESPACE pg_default;

create index IF not exists idx_land_parcels_active on public.land_parcels using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create trigger trigger_update_land_parcels_timestamp BEFORE
update on land_parcels for EACH row
execute FUNCTION update_land_parcels_timestamp ();