create table public.shortages_seeds (
  id text not null,
  name text not null,
  category text null,
  nsic_code text null,
  yield_display text null,
  yield_min_tha numeric null,
  yield_max_tha numeric null,
  maturity_days integer null,
  environment text null,
  status text null,
  fertilizer_responsiveness_rank integer null,
  compatibility_source text null,
  fertilizer_compatibility jsonb not null default '[]'::jsonb,
  sort_order integer not null default 1000,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint shortages_seeds_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_shortages_seeds_category_env on public.shortages_seeds using btree (category, environment, is_active, sort_order) TABLESPACE pg_default;