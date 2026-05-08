create table public.ownership_transfers (
  id bigserial not null,
  transfer_uuid uuid not null default gen_random_uuid (),
  transfer_mode text null default 'voluntary'::text,
  source_role text null default 'registered_owner'::text,
  from_farmer_id bigint null,
  to_farmer_id bigint null,
  transfer_date date null default CURRENT_DATE,
  transfer_reason text null,
  area_mode text null default 'take_all'::text,
  area_requested_ha numeric(12, 4) null,
  area_available_ha numeric(12, 4) null,
  is_deceased_confirmed boolean not null default false,
  status text null default 'applied'::text,
  registry_applied boolean not null default false,
  created_by uuid null default auth.uid (),
  created_at timestamp with time zone not null default now(),
  applied_at timestamp with time zone null,
  updated_at timestamp with time zone not null default now(),
  transfer_type text null,
  documents jsonb null default '[]'::jsonb,
  notes text null,
  constraint ownership_transfers_pkey primary key (id),
  constraint fk_ot_from_farmer foreign KEY (from_farmer_id) references rsbsa_submission (id) on delete RESTRICT,
  constraint fk_ot_to_farmer foreign KEY (to_farmer_id) references rsbsa_submission (id) on delete RESTRICT,
  constraint chk_ot_source_role check (
    (
      source_role = any (
        array[
          'registered_owner'::text,
          'tenant'::text,
          'lessee'::text
        ]
      )
    )
  ),
  constraint chk_ot_area_mode check (
    (
      area_mode = any (array['take_all'::text, 'partial'::text])
    )
  ),
  constraint chk_ot_status check (
    (
      status = any (array['applied'::text, 'cancelled'::text])
    )
  ),
  constraint chk_ot_mode check (
    (
      transfer_mode = any (array['voluntary'::text, 'inheritance'::text])
    )
  ),
  constraint chk_ot_not_self check (
    (
      (from_farmer_id is null)
      or (to_farmer_id is null)
      or (from_farmer_id <> to_farmer_id)
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists ux_ot_uuid on public.ownership_transfers using btree (transfer_uuid) TABLESPACE pg_default;

create index IF not exists idx_ot_from_farmer on public.ownership_transfers using btree (from_farmer_id) TABLESPACE pg_default;

create index IF not exists idx_ot_to_farmer on public.ownership_transfers using btree (to_farmer_id) TABLESPACE pg_default;

create index IF not exists idx_ot_created_at on public.ownership_transfers using btree (created_at desc) TABLESPACE pg_default;

create trigger trg_ot_updated_at BEFORE
update on ownership_transfers for EACH row
execute FUNCTION set_ownership_transfers_updated_at ();