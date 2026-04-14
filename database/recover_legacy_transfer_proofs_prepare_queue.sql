-- ============================================================================
-- Legacy Transfer Proof Recovery - Prepare Queue (Dry Run + Candidate Build)
-- ============================================================================
-- Purpose:
-- 1) Find ownership_transfers rows that still have missing/empty documents.
-- 2) Find uploaded proof files in storage that are not yet linked.
-- 3) Build conservative transfer-to-proof candidates into a review queue.
-- 4) Mark candidates as HIGH or REVIEW confidence. Nothing is applied yet.
--
-- Safe behavior:
-- - No changes to ownership_transfers.documents in this script.
-- - Uses ON CONFLICT to avoid duplicate queue rows.
-- - Keeps APPLIED rows untouched on re-run.
--
-- Notes:
-- - This script relies on storage.objects visibility in SQL Editor.
-- - Candidate matching uses transfer_date + timestamp proximity.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ownership_transfer_proof_recovery_queue (
  id BIGSERIAL PRIMARY KEY,
  transfer_id BIGINT NOT NULL REFERENCES public.ownership_transfers(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT,
  object_created_at TIMESTAMPTZ,
  transfer_created_at TIMESTAMPTZ,
  second_diff BIGINT,
  match_confidence TEXT NOT NULL CHECK (match_confidence IN ('HIGH', 'REVIEW')),
  match_reason TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transfer_id, storage_bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_otprq_transfer_id
  ON public.ownership_transfer_proof_recovery_queue (transfer_id);

CREATE INDEX IF NOT EXISTS idx_otprq_approval_status
  ON public.ownership_transfer_proof_recovery_queue (approval_status, match_confidence);

CREATE INDEX IF NOT EXISTS idx_otprq_storage_path
  ON public.ownership_transfer_proof_recovery_queue (storage_bucket, storage_path);

WITH referenced_paths AS (
  SELECT DISTINCT
    COALESCE(NULLIF(doc->>'storage_bucket', ''), 'ownership-transfer-proofs') AS bucket_id,
    doc->>'storage_path' AS storage_path
  FROM public.ownership_transfers ot
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN ot.documents IS NULL THEN '[]'::jsonb
      WHEN jsonb_typeof(ot.documents) = 'array' THEN ot.documents
      ELSE '[]'::jsonb
    END
  ) AS docs(doc)
  WHERE COALESCE(doc->>'storage_path', '') <> ''
),
orphan_objects AS (
  SELECT
    obj.bucket_id,
    obj.name AS storage_path,
    regexp_replace(obj.name, '^.*/', '') AS file_name_guess,
    COALESCE(
      NULLIF(obj.metadata->>'mimetype', ''),
      NULLIF(obj.metadata->>'contentType', ''),
      NULL
    ) AS mime_type_guess,
    CASE
      WHEN COALESCE(obj.metadata->>'size', '') ~ '^[0-9]+$'
        THEN (obj.metadata->>'size')::BIGINT
      ELSE NULL
    END AS file_size_guess,
    obj.created_at AS object_created_at
  FROM storage.objects obj
  LEFT JOIN referenced_paths ref
    ON ref.bucket_id = obj.bucket_id
   AND ref.storage_path = obj.name
  WHERE obj.bucket_id = 'ownership-transfer-proofs'
    AND ref.storage_path IS NULL
),
target_transfers AS (
  SELECT
    ot.id AS transfer_id,
    ot.transfer_date,
    ot.created_at::timestamptz AS transfer_created_at
  FROM public.ownership_transfers ot
  WHERE ot.from_farmer_id IS NOT NULL
    AND ot.to_farmer_id IS NOT NULL
    AND (
      ot.documents IS NULL
      OR jsonb_typeof(ot.documents) <> 'array'
      OR (
        jsonb_typeof(ot.documents) = 'array'
        AND jsonb_array_length(ot.documents) = 0
      )
    )
),
candidates AS (
  SELECT
    t.transfer_id,
    o.bucket_id,
    o.storage_path,
    o.file_name_guess,
    o.mime_type_guess,
    o.file_size_guess,
    o.object_created_at,
    t.transfer_created_at,
    ABS(EXTRACT(EPOCH FROM (t.transfer_created_at - o.object_created_at)))::BIGINT AS second_diff
  FROM orphan_objects o
  JOIN target_transfers t
    ON ABS((t.transfer_date - o.object_created_at::date)) <= 1
   AND ABS(EXTRACT(EPOCH FROM (t.transfer_created_at - o.object_created_at))) <= 21600
),
ranked AS (
  SELECT
    c.*,
    ROW_NUMBER() OVER (
      PARTITION BY c.storage_path
      ORDER BY c.second_diff, c.transfer_id
    ) AS object_rank,
    COUNT(*) OVER (PARTITION BY c.storage_path) AS object_candidate_count,
    LEAD(c.second_diff) OVER (
      PARTITION BY c.storage_path
      ORDER BY c.second_diff, c.transfer_id
    ) AS next_best_second_diff
  FROM candidates c
),
best_candidate_per_object AS (
  SELECT
    r.transfer_id,
    r.bucket_id,
    r.storage_path,
    r.file_name_guess,
    r.mime_type_guess,
    r.file_size_guess,
    r.object_created_at,
    r.transfer_created_at,
    r.second_diff,
    CASE
      WHEN r.object_candidate_count = 1
       AND r.second_diff <= 900
        THEN 'HIGH'
      WHEN r.object_candidate_count > 1
       AND r.second_diff <= 300
       AND COALESCE(r.next_best_second_diff, 999999999) - r.second_diff >= 600
        THEN 'HIGH'
      ELSE 'REVIEW'
    END AS match_confidence,
    CASE
      WHEN r.object_candidate_count = 1
       AND r.second_diff <= 900
        THEN format('Unique candidate in %s seconds', r.second_diff)
      WHEN r.object_candidate_count > 1
       AND r.second_diff <= 300
       AND COALESCE(r.next_best_second_diff, 999999999) - r.second_diff >= 600
        THEN format('Best-vs-next gap is %s seconds (best=%s)', COALESCE(r.next_best_second_diff, 0) - r.second_diff, r.second_diff)
      ELSE format('Needs review: %s candidate(s), best=%s seconds', r.object_candidate_count, r.second_diff)
    END AS match_reason
  FROM ranked r
  WHERE r.object_rank = 1
)
INSERT INTO public.ownership_transfer_proof_recovery_queue (
  transfer_id,
  storage_bucket,
  storage_path,
  file_name,
  mime_type,
  file_size_bytes,
  object_created_at,
  transfer_created_at,
  second_diff,
  match_confidence,
  match_reason,
  approval_status,
  updated_at
)
SELECT
  b.transfer_id,
  b.bucket_id,
  b.storage_path,
  b.file_name_guess,
  b.mime_type_guess,
  b.file_size_guess,
  b.object_created_at,
  b.transfer_created_at,
  b.second_diff,
  b.match_confidence,
  b.match_reason,
  'PENDING' AS approval_status,
  NOW() AS updated_at
FROM best_candidate_per_object b
ON CONFLICT (transfer_id, storage_bucket, storage_path)
DO UPDATE
SET
  file_name = EXCLUDED.file_name,
  mime_type = EXCLUDED.mime_type,
  file_size_bytes = EXCLUDED.file_size_bytes,
  object_created_at = EXCLUDED.object_created_at,
  transfer_created_at = EXCLUDED.transfer_created_at,
  second_diff = EXCLUDED.second_diff,
  match_confidence = EXCLUDED.match_confidence,
  match_reason = EXCLUDED.match_reason,
  updated_at = NOW()
WHERE public.ownership_transfer_proof_recovery_queue.approval_status <> 'APPLIED';

-- --------------------------------------------------------------------------
-- Reports (read-only)
-- --------------------------------------------------------------------------

-- 1) How many transfers still have missing documents
SELECT
  COUNT(*) AS transfers_missing_documents
FROM public.ownership_transfers ot
WHERE ot.documents IS NULL
   OR jsonb_typeof(ot.documents) <> 'array'
   OR (
     jsonb_typeof(ot.documents) = 'array'
     AND jsonb_array_length(ot.documents) = 0
   );

-- 2) Queue totals by confidence and approval state
SELECT
  match_confidence,
  approval_status,
  COUNT(*) AS row_count
FROM public.ownership_transfer_proof_recovery_queue
GROUP BY match_confidence, approval_status
ORDER BY match_confidence, approval_status;

-- 3) Review list (top candidates still pending)
SELECT
  q.id,
  q.transfer_id,
  q.storage_bucket,
  q.storage_path,
  q.file_name,
  q.second_diff,
  q.match_confidence,
  q.match_reason,
  q.approval_status,
  q.object_created_at,
  q.transfer_created_at
FROM public.ownership_transfer_proof_recovery_queue q
WHERE q.approval_status = 'PENDING'
ORDER BY
  CASE q.match_confidence WHEN 'HIGH' THEN 0 ELSE 1 END,
  q.second_diff NULLS LAST,
  q.id
LIMIT 300;

COMMIT;

-- --------------------------------------------------------------------------
-- Manual review helpers (run after inspecting report rows)
-- --------------------------------------------------------------------------
-- Approve one row:
-- UPDATE public.ownership_transfer_proof_recovery_queue
-- SET approval_status = 'APPROVED', updated_at = NOW()
-- WHERE id = <queue_row_id>;
--
-- Reject one row:
-- UPDATE public.ownership_transfer_proof_recovery_queue
-- SET approval_status = 'REJECTED', updated_at = NOW()
-- WHERE id = <queue_row_id>;
--
-- Bulk-approve HIGH confidence rows (optional):
-- UPDATE public.ownership_transfer_proof_recovery_queue
-- SET approval_status = 'APPROVED', updated_at = NOW()
-- WHERE approval_status = 'PENDING'
--   AND match_confidence = 'HIGH';
