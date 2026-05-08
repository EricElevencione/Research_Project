create table public.land_plots (
  id character varying(100) not null,
  name character varying(255) null,
  ffrs_id character varying(100) null,
  area numeric(10, 2) null,
  coordinate_accuracy character varying(50) null,
  barangay character varying(100) null,
  first_name character varying(100) null,
  middle_name character varying(100) null,
  surname character varying(100) null,
  ext_name character varying(50) null,
  gender character varying(20) null,
  municipality character varying(100) null,
  province character varying(100) null,
  parcel_address text null,
  status character varying(50) null,
  street character varying(255) null,
  farm_type character varying(50) null,
  plot_source character varying(50) null,
  parcel_number character varying(50) null,
  geometry jsonb null,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  geometry_postgis geometry null,
  farmer_id integer null,
  constraint land_plots_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_land_plots_ffrs_barangay on public.land_plots using btree (ffrs_id, barangay) TABLESPACE pg_default;

create index IF not exists idx_land_plots_barangay on public.land_plots using btree (barangay) TABLESPACE pg_default;

create index IF not exists idx_land_plots_geometry on public.land_plots using gin (geometry) TABLESPACE pg_default;

create index IF not exists idx_land_plots_geometry_postgis on public.land_plots using gist (geometry_postgis) TABLESPACE pg_default;

create index IF not exists idx_land_plots_municipality on public.land_plots using btree (municipality) TABLESPACE pg_default;

create index IF not exists idx_land_plots_status on public.land_plots using btree (status) TABLESPACE pg_default;

create index IF not exists idx_land_plots_surname on public.land_plots using btree (surname) TABLESPACE pg_default;