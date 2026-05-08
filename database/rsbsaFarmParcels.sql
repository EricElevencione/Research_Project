create table public.rsbsa_farm_parcels (
  id bigserial not null,
  submission_id bigint null,
  parcel_number character varying(50) not null,
  farm_location_barangay character varying(100) null,
  farm_location_municipality character varying(100) null,
  total_farm_area_ha numeric(10, 2) null,
  within_ancestral_domain character varying(10) null,
  ownership_document_no character varying(100) null,
  agrarian_reform_beneficiary character varying(10) null,
  ownership_type_registered_owner boolean null default false,
  ownership_type_tenant boolean null default false,
  ownership_type_lessee boolean null default false,
  ownership_type_others boolean null default false,
  tenant_land_owner_name character varying(200) null,
  lessee_land_owner_name character varying(200) null,
  ownership_others_specify text null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  tenant_land_owner_id bigint null,
  lessee_land_owner_id bigint null,
  is_current_owner boolean null default true,
  parent_parcel_id integer null,
  split_origin_area_ha numeric(10, 4) null,
  ownership_category text null,
  cultivator_submission_id bigint null,
  is_cultivating boolean not null default true,
  cultivation_status_updated_at timestamp with time zone null,
  cultivation_status_reason text null,
  constraint rsbsa_farm_parcels_pkey primary key (id),
  constraint fk_rsbsa_farm_parcels_lessee_land_owner_id foreign KEY (lessee_land_owner_id) references rsbsa_submission (id) on delete set null,
  constraint fk_rsbsa_farm_parcels_tenant_land_owner_id foreign KEY (tenant_land_owner_id) references rsbsa_submission (id) on delete set null,
  constraint fk_tenant_land_owner foreign KEY (tenant_land_owner_id) references rsbsa_submission (id) on delete set null,
  constraint rsbsa_farm_parcels_cultivator_submission_id_fkey foreign KEY (cultivator_submission_id) references rsbsa_submission (id) on delete set null,
  constraint rsbsa_farm_parcels_parent_parcel_id_fkey foreign KEY (parent_parcel_id) references rsbsa_farm_parcels (id),
  constraint fk_lessee_land_owner foreign KEY (lessee_land_owner_id) references rsbsa_submission (id) on delete set null,
  constraint rsbsa_farm_parcels_submission_id_fkey foreign KEY (submission_id) references rsbsa_submission (id) on delete CASCADE,
  constraint rsbsa_farm_parcels_within_ancestral_domain_check check (
    (
      (within_ancestral_domain)::text = any (
        array[
          ('Yes'::character varying)::text,
          ('No'::character varying)::text
        ]
      )
    )
  ),
  constraint rsbsa_farm_parcels_agrarian_reform_beneficiary_check check (
    (
      (agrarian_reform_beneficiary)::text = any (
        array[
          ('Yes'::character varying)::text,
          ('No'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_farm_parcels_current_owner on public.rsbsa_farm_parcels using btree (is_current_owner) TABLESPACE pg_default
where
  (is_current_owner = true);

create index IF not exists idx_rsbsa_farm_parcels_parcel_number on public.rsbsa_farm_parcels using btree (parcel_number) TABLESPACE pg_default;

create index IF not exists idx_rsbsa_farm_parcels_barangay_owner_lookup on public.rsbsa_farm_parcels using btree (
  farm_location_barangay,
  tenant_land_owner_id,
  lessee_land_owner_id
) TABLESPACE pg_default;

create index IF not exists idx_farm_parcels_parent on public.rsbsa_farm_parcels using btree (parent_parcel_id) TABLESPACE pg_default
where
  (parent_parcel_id is not null);

create index IF not exists idx_rsbsa_farm_parcels_area on public.rsbsa_farm_parcels using btree (total_farm_area_ha) TABLESPACE pg_default;

create index IF not exists idx_rsbsa_farm_parcels_barangay on public.rsbsa_farm_parcels using btree (farm_location_barangay) TABLESPACE pg_default;

create index IF not exists idx_rsbsa_farm_parcels_lessee_land_owner_id on public.rsbsa_farm_parcels using btree (lessee_land_owner_id) TABLESPACE pg_default;

create index IF not exists idx_rsbsa_farm_parcels_municipality on public.rsbsa_farm_parcels using btree (farm_location_municipality) TABLESPACE pg_default;

create index IF not exists idx_rsbsa_farm_parcels_submission_id on public.rsbsa_farm_parcels using btree (submission_id) TABLESPACE pg_default;

create index IF not exists idx_rsbsa_farm_parcels_tenant_land_owner_id on public.rsbsa_farm_parcels using btree (tenant_land_owner_id) TABLESPACE pg_default;

create index IF not exists idx_rsbsa_farm_parcels_parent on public.rsbsa_farm_parcels using btree (parent_parcel_id) TABLESPACE pg_default
where
  (parent_parcel_id is not null);

create trigger trg_sync_farmer_status_from_parcels
after INSERT
or DELETE
or
update on rsbsa_farm_parcels for EACH row
execute FUNCTION tg_sync_farmer_status_from_parcels ();

create trigger trigger_create_land_history_on_parcel_insert
after INSERT on rsbsa_farm_parcels for EACH row
execute FUNCTION create_land_history_from_farm_parcel ();

create trigger trigger_update_land_history_on_parcel_update
after
update on rsbsa_farm_parcels for EACH row
execute FUNCTION update_land_history_from_farm_parcel ();