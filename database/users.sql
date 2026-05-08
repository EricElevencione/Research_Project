create table public.users (
  id uuid not null,
  username character varying(100) null,
  email character varying(255) not null,
  password_hash character varying(255) null,
  role character varying(50) not null,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  first_name text null,
  last_name text null,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_username_key unique (username),
  constraint users_role_check check (
    (
      (role)::text = any (
        (
          array[
            'admin'::character varying,
            'technician'::character varying,
            'jo'::character varying,
            'encoder'::character varying,
            'farmer'::character varying,
            'lgu'::character varying,
            'brgychair'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_users_email on public.users using btree (email) TABLESPACE pg_default;

create index IF not exists idx_users_role on public.users using btree (role) TABLESPACE pg_default;

create index IF not exists idx_users_username on public.users using btree (username) TABLESPACE pg_default;

create trigger trg_users_updated BEFORE
update on users for EACH row
execute FUNCTION update_users_timestamp (); 