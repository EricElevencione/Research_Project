create table public.barangay_codes (
  id serial not null,
  barangay_name character varying(100) not null,
  barangay_code character varying(3) not null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  constraint barangay_codes_pkey primary key (id),
  constraint barangay_codes_barangay_code_key unique (barangay_code),
  constraint barangay_codes_barangay_name_key unique (barangay_name)
) TABLESPACE pg_default;