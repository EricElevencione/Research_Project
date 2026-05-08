create table public.shortages_role_bridge (
  from_role text not null,
  to_role text not null,
  sort_order integer not null default 1000,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint shortages_role_bridge_pkey primary key (from_role, to_role)
) TABLESPACE pg_default;