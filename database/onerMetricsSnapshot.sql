create table public.ownership_metrics_snapshots (
  id bigserial not null,
  captured_at timestamp with time zone not null default now(),
  capture_label text not null default 'manual'::text,
  metrics jsonb not null,
  constraint ownership_metrics_snapshots_pkey primary key (id)
) TABLESPACE pg_default;