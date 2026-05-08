create table public.shortages_fertilizer_role_fallback (
  nutrient_role text not null,
  fallback_fertilizer_id text not null,
  sort_order integer not null default 1000,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint shortages_fertilizer_role_fallback_pkey primary key (nutrient_role, fallback_fertilizer_id),
  constraint shortages_fertilizer_role_fallback_fallback_fertilizer_id_fkey foreign KEY (fallback_fertilizer_id) references shortages_fertilizers (id) on delete CASCADE
) TABLESPACE pg_default;