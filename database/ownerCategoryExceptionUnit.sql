create table public.ownership_category_exception_audit (
  id bigserial not null,
  source_table text not null,
  source_id bigint not null,
  reason_code text not null,
  reason_detail text not null,
  legacy_registered_owner boolean null,
  legacy_tenant boolean null,
  legacy_lessee boolean null,
  existing_ownership_category text null,
  suggested_ownership_category text null,
  capture_payload jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_at timestamp with time zone null,
  resolution_notes text null,
  detected_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  constraint ownership_category_exception_audit_pkey primary key (id),
  constraint ownership_category_exception_source_table_check check (
    (
      source_table = any (
        array[
          'rsbsa_submission'::text,
          'rsbsa_farm_parcels'::text,
          'land_history'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists ownership_category_exception_audit_unique_idx on public.ownership_category_exception_audit using btree (source_table, source_id, reason_code) TABLESPACE pg_default;