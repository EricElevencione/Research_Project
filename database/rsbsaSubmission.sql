create table public.rsbsa_submission (
  id bigserial not null,
  "LAST NAME" character varying(255) null,
  "FIRST NAME" character varying(255) null,
  "MIDDLE NAME" character varying(255) null,
  "EXT NAME" character varying(255) null,
  "GENDER" character varying(10) null,
  "BIRTHDATE" date null,
  "BARANGAY" character varying(255) null,
  "MUNICIPALITY" character varying(255) null,
  "FARM LOCATION" character varying(50) null,
  "PARCEL AREA" text null,
  "MAIN LIVELIHOOD" character varying(100) null,
  "OWNERSHIP_TYPE_REGISTERED_OWNER" boolean null default false,
  "OWNERSHIP_TYPE_TENANT" boolean null default false,
  "OWNERSHIP_TYPE_LESSEE" boolean null default false,
  status character varying(50) null default 'Submitted'::character varying,
  submitted_at timestamp without time zone null default CURRENT_TIMESTAMP,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  "TOTAL FARM AREA" numeric(10, 2) null,
  "FFRS_CODE" character varying(50) null,
  age integer null,
  "FARMER_RICE" boolean null default false,
  "FARMER_CORN" boolean null default false,
  "FARMER_OTHER_CROPS" boolean null default false,
  "FARMER_OTHER_CROPS_TEXT" text null,
  "FARMER_LIVESTOCK" boolean null default false,
  "FARMER_LIVESTOCK_TEXT" text null,
  "FARMER_POULTRY" boolean null default false,
  "FARMER_POULTRY_TEXT" text null,
  archived_at timestamp with time zone null,
  archive_reason text null,
  ownership_category text null,
  status_change_reason text null,
  constraint rsbsa_submission_pkey primary key (id),
  constraint rsbsa_submission_FFRS_CODE_key unique ("FFRS_CODE")
) TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_barangay on public.rsbsa_submission using btree ("BARANGAY") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_birthday on public.rsbsa_submission using btree ("BIRTHDATE") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_ext_name on public.rsbsa_submission using btree ("EXT NAME") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_farm_location on public.rsbsa_submission using btree ("FARM LOCATION") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_farmer_corn on public.rsbsa_submission using btree ("FARMER_CORN") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_farmer_livestock on public.rsbsa_submission using btree ("FARMER_LIVESTOCK") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_farmer_other_crops on public.rsbsa_submission using btree ("FARMER_OTHER_CROPS") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_farmer_poultry on public.rsbsa_submission using btree ("FARMER_POULTRY") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_farmer_rice on public.rsbsa_submission using btree ("FARMER_RICE") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_ffrs_code on public.rsbsa_submission using btree ("FFRS_CODE") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_first_name on public.rsbsa_submission using btree ("FIRST NAME") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_gender on public.rsbsa_submission using btree ("GENDER") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_last_name on public.rsbsa_submission using btree ("LAST NAME") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_main_livelihood on public.rsbsa_submission using btree ("MAIN LIVELIHOOD") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_middle_name on public.rsbsa_submission using btree ("MIDDLE NAME") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_municipality on public.rsbsa_submission using btree ("MUNICIPALITY") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_parcel_area on public.rsbsa_submission using btree ("PARCEL AREA") TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_status on public.rsbsa_submission using btree (status) TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_submitted_at on public.rsbsa_submission using btree (submitted_at) TABLESPACE pg_default;

create index IF not exists idx_rsbsa_submission_total_farm_area on public.rsbsa_submission using btree ("TOTAL FARM AREA") TABLESPACE pg_default;

create trigger trigger_generate_ffrs_code BEFORE INSERT on rsbsa_submission for EACH row
execute FUNCTION generate_ffrs_code_trigger ();