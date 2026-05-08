create table public.ownership_transfer_proof_recovery_queue (
  id bigserial not null,
  transfer_id bigint not null,
  storage_bucket text not null,
  storage_path text not null,
  file_name text null,
  mime_type text null,
  file_size_bytes bigint null,
  object_created_at timestamp with time zone null,
  transfer_created_at timestamp with time zone null,
  second_diff bigint null,
  match_confidence text not null,
  match_reason text not null,
  approval_status text not null default 'PENDING'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint ownership_transfer_proof_recovery_queue_pkey primary key (id),
  constraint ownership_transfer_proof_reco_transfer_id_storage_bucket_st_key unique (transfer_id, storage_bucket, storage_path),
  constraint ownership_transfer_proof_recovery_queue_transfer_id_fkey foreign KEY (transfer_id) references ownership_transfers (id) on delete CASCADE,
  constraint ownership_transfer_proof_recovery_queue_approval_status_check check (
    (
      approval_status = any (
        array[
          'PENDING'::text,
          'APPROVED'::text,
          'REJECTED'::text,
          'APPLIED'::text
        ]
      )
    )
  ),
  constraint ownership_transfer_proof_recovery_queue_match_confidence_check check (
    (
      match_confidence = any (array['HIGH'::text, 'REVIEW'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_otprq_transfer_id on public.ownership_transfer_proof_recovery_queue using btree (transfer_id) TABLESPACE pg_default;

create index IF not exists idx_otprq_approval_status on public.ownership_transfer_proof_recovery_queue using btree (approval_status, match_confidence) TABLESPACE pg_default;

create index IF not exists idx_otprq_storage_path on public.ownership_transfer_proof_recovery_queue using btree (storage_bucket, storage_path) TABLESPACE pg_default;