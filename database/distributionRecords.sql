create table public.distribution_records (
  id serial not null,
  request_id integer not null,
  distribution_date date null default CURRENT_DATE,
  fertilizer_type character varying(100) null,
  fertilizer_bags_given integer null,
  seed_type character varying(100) null,
  seed_kg_given numeric(10, 2) null,
  voucher_code character varying(100) null,
  qr_code_data text null,
  claimed boolean null default false,
  claim_date timestamp without time zone null,
  farmer_signature boolean null default false,
  verified_by integer null,
  verification_notes text null,
  created_at timestamp without time zone null default now(),
  constraint distribution_records_pkey primary key (id),
  constraint distribution_records_voucher_code_key unique (voucher_code),
  constraint distribution_records_request_id_fkey foreign KEY (request_id) references farmer_requests (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_distributions_request on public.distribution_records using btree (request_id) TABLESPACE pg_default;