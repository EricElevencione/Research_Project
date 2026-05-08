create table public.land_history (
  id serial not null,
  land_parcel_id integer null,
  parcel_number character varying(50) null,
  farm_location_barangay character varying(100) null,
  farm_location_municipality character varying(100) null default 'Dumangas'::character varying,
  total_farm_area_ha numeric(10, 4) null,
  farmer_id integer null,
  farmer_name character varying(200) null,
  farmer_ffrs_code character varying(50) null,
  is_registered_owner boolean null default false,
  is_tenant boolean null default false,
  is_lessee boolean null default false,
  land_owner_id integer null,
  land_owner_name character varying(200) null,
  period_start_date date not null,
  period_end_date date null,
  is_current boolean null default true,
  change_type character varying(50) not null default 'NEW'::character varying,
  change_reason text null,
  previous_history_id integer null,
  rsbsa_submission_id integer null,
  within_ancestral_domain boolean null default false,
  agrarian_reform_beneficiary boolean null default false,
  ownership_document_no character varying(100) null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  created_by character varying(100) null,
  notes text null,
  farm_parcel_id bigint null,
  land_owner_ffrs_code character varying(50) null,
  tenant_name character varying(200) null,
  tenant_ffrs_code character varying(50) null,
  lessee_name character varying(200) null,
  lessee_ffrs_code character varying(50) null,
  is_other_ownership boolean null default false,
  transferred_area_ha numeric(10, 4) null,
  remaining_area_ha numeric(10, 4) null,
  ownership_category text null,
  constraint land_history_new_pkey primary key (id),
  constraint land_history_land_parcel_id_fkey foreign KEY (land_parcel_id) references land_parcels (id) on delete CASCADE,
  constraint land_history_previous_history_id_fkey foreign KEY (previous_history_id) references land_history (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists ux_land_history_one_current_per_farm_parcel on public.land_history using btree (farm_parcel_id) TABLESPACE pg_default
where
  (
    (is_current = true)
    and (farm_parcel_id is not null)
  );

create index IF not exists idx_land_history_parcel_id on public.land_history using btree (land_parcel_id) TABLESPACE pg_default;

create index IF not exists idx_land_history_parcel_number on public.land_history using btree (parcel_number) TABLESPACE pg_default;

create index IF not exists idx_land_history_farmer on public.land_history using btree (farmer_id) TABLESPACE pg_default;

create index IF not exists idx_land_history_current on public.land_history using btree (is_current) TABLESPACE pg_default
where
  (is_current = true);

create index IF not exists idx_land_history_owner on public.land_history using btree (land_owner_id) TABLESPACE pg_default;

create index IF not exists idx_land_history_dates on public.land_history using btree (period_start_date, period_end_date) TABLESPACE pg_default;

create trigger trg_enforce_transfer_owner_from_reason BEFORE INSERT
or
update OF change_type,
change_reason,
land_owner_name,
land_owner_id on land_history for EACH row
execute FUNCTION tg_enforce_transfer_owner_from_reason ();

create trigger trg_land_history_single_current_ins BEFORE INSERT on land_history for EACH row
execute FUNCTION land_history_keep_single_current ();

create trigger trg_land_history_single_current_upd BEFORE
update OF is_current,
farm_parcel_id on land_history for EACH row when (new.is_current = true)
execute FUNCTION land_history_keep_single_current ();

create trigger trg_sync_farmer_status_from_land_history
after INSERT
or DELETE
or
update on land_history for EACH row
execute FUNCTION tg_sync_farmer_status_from_land_history ();

create trigger trigger_update_land_history_timestamp BEFORE
update on land_history for EACH row
execute FUNCTION update_land_history_timestamp ();