create table public.shortages_fertilizers (
  id text not null,
  name text not null,
  category text null,
  tier integer not null,
  nutrient_role text null,
  nutrient_type text null,
  application_timing text null,
  form text null,
  description text null,
  sort_order integer not null default 1000,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint shortages_fertilizers_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_shortages_fertilizers_role_tier on public.shortages_fertilizers using btree (nutrient_role, tier, is_active, sort_order) TABLESPACE pg_default;