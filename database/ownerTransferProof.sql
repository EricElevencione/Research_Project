create table public.ownership_transfer_proofs (
  id bigserial not null,
  transfer_id bigint not null,
  storage_bucket text not null default 'ownership-transfer-proofs'::text,
  storage_path text not null,
  image_url text null,
  file_name text null,
  mime_type text null,
  file_size_bytes bigint null,
  uploaded_by uuid null default auth.uid (),
  uploaded_at timestamp with time zone not null default now(),
  is_active boolean not null default true,
  constraint ownership_transfer_proofs_pkey primary key (id),
  constraint uq_otp_path unique (transfer_id, storage_bucket, storage_path),
  constraint ownership_transfer_proofs_transfer_id_fkey foreign KEY (transfer_id) references ownership_transfers (id) on delete CASCADE,
  constraint chk_otp_mime check (
    (
      (mime_type is null)
      or (
        mime_type = any (
          array[
            'image/png'::text,
            'image/jpeg'::text,
            'image/jpg'::text
          ]
        )
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_otp_transfer_id on public.ownership_transfer_proofs using btree (transfer_id) TABLESPACE pg_default;

create index IF not exists idx_otp_bucket_path on public.ownership_transfer_proofs using btree (storage_bucket, storage_path) TABLESPACE pg_default;