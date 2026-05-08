create table public.ownership_transfer_items (
  id bigserial not null,
  transfer_id bigint not null,
  land_parcel_id integer not null,
  land_history_id integer null,
  parcel_number character varying(80) null,
  farm_location_barangay character varying(100) null,
  donor_area_ha numeric(12, 4) not null,
  transferred_area_ha numeric(12, 4) not null,
  scope text not null default 'take_all'::text,
  created_at timestamp with time zone not null default now(),
  constraint ownership_transfer_items_pkey primary key (id),
  constraint uq_oti_transfer_parcel unique (transfer_id, land_parcel_id),
  constraint ownership_transfer_items_land_parcel_id_fkey foreign KEY (land_parcel_id) references land_parcels (id) on delete RESTRICT,
  constraint ownership_transfer_items_land_history_id_fkey foreign KEY (land_history_id) references land_history (id) on delete set null,
  constraint ownership_transfer_items_transfer_id_fkey foreign KEY (transfer_id) references ownership_transfers (id) on delete CASCADE,
  constraint chk_oti_scope check (
    (
      scope = any (array['take_all'::text, 'partial'::text])
    )
  ),
  constraint chk_oti_area_positive check (
    (
      (donor_area_ha > (0)::numeric)
      and (transferred_area_ha > (0)::numeric)
    )
  ),
  constraint chk_oti_area_bounds check ((transferred_area_ha <= donor_area_ha))
) TABLESPACE pg_default;

create index IF not exists idx_oti_transfer_id on public.ownership_transfer_items using btree (transfer_id) TABLESPACE pg_default;

create index IF not exists idx_oti_land_parcel_id on public.ownership_transfer_items using btree (land_parcel_id) TABLESPACE pg_default;