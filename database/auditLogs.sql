create table public.audit_logs (
  id bigserial not null,
  timestamp timestamp with time zone not null default now(),
  user_id uuid null,
  user_name character varying(255) null default 'Anonymous'::character varying,
  user_role character varying(50) null default 'anonymous'::character varying,
  action character varying(50) not null,
  module character varying(100) not null,
  record_id character varying(255) null,
  record_type character varying(100) null,
  description text not null,
  old_values jsonb null,
  new_values jsonb null,
  ip_address inet null,
  session_id character varying(255) null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint audit_logs_pkey primary key (id),
  constraint audit_logs_user_id_fkey foreign KEY (user_id) references users (id)
) TABLESPACE pg_default;

create index IF not exists idx_audit_logs_timestamp on public.audit_logs using btree ("timestamp" desc) TABLESPACE pg_default;

create index IF not exists idx_audit_logs_action on public.audit_logs using btree (action) TABLESPACE pg_default;

create index IF not exists idx_audit_logs_module on public.audit_logs using btree (module) TABLESPACE pg_default;

create index IF not exists idx_audit_logs_user_name on public.audit_logs using btree (user_name) TABLESPACE pg_default;

create index IF not exists idx_audit_logs_created_at on public.audit_logs using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_audit_logs_description on public.audit_logs using gin (to_tsvector('english'::regconfig, description)) TABLESPACE pg_default;

create index IF not exists idx_audit_logs_user_id on public.audit_logs using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_audit_logs_metadata_route_path on public.audit_logs using btree (
  COALESCE(
    NULLIF((metadata ->> 'route_path'::text), ''::text),
    NULLIF((metadata ->> 'route_full_path'::text), ''::text),
    NULLIF((metadata ->> 'path'::text), ''::text),
    NULLIF((metadata ->> 'pathname'::text), ''::text),
    NULLIF((metadata ->> 'route'::text), ''::text),
    NULLIF((metadata ->> 'page'::text), ''::text)
  )
) TABLESPACE pg_default;