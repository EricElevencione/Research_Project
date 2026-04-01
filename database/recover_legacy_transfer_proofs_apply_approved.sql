-- ============================================================================
-- Legacy Transfer Proof Recovery - Apply Approved Queue Rows
-- ============================================================================
-- Purpose:
-- 1) Take APPROVED queue rows from ownership_transfer_proof_recovery_queue.
-- 2) Write proof JSON arrays into ownership_transfers.documents.
-- 3) Mark queue rows as APPLIED.
--
-- Safe behavior:
-- - Only touches transfers where documents is missing/empty.
-- - Ignores REJECTED/PENDING rows.
-- - Writes grouped JSON in ProofItem-compatible shape.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ownership_transfer_proof_recovery_queue') IS NULL THEN
    RAISE EXCEPTION 'Recovery queue table does not exist. Run database/recover_legacy_transfer_proofs_prepare_queue.sql first.';
  END IF;
END
$$;

WITH approved_rows AS (
  SELECT
    q.transfer_id,
    q.storage_bucket,
    q.storage_path,
    q.file_name,
    q.mime_type,
    q.file_size_bytes
  FROM public.ownership_transfer_proof_recovery_queue q
  WHERE q.approval_status = 'APPROVED'
),
payload_by_transfer AS (
  SELECT
    ar.transfer_id,
    jsonb_agg(
      jsonb_build_object(
        'storage_bucket', ar.storage_bucket,
        'storage_path', ar.storage_path,
        'file_name', COALESCE(ar.file_name, regexp_replace(ar.storage_path, '^.*/', '')),
        'mime_type', ar.mime_type,
        'file_size_bytes', ar.file_size_bytes
      )
      ORDER BY ar.storage_path
    ) AS proofs_json
  FROM approved_rows ar
  GROUP BY ar.transfer_id
),
updated_transfers AS (
  UPDATE public.ownership_transfers ot
  SET documents = p.proofs_json
  FROM payload_by_transfer p
  WHERE ot.id = p.transfer_id
    AND (
      ot.documents IS NULL
      OR jsonb_typeof(ot.documents) <> 'array'
      OR (
        jsonb_typeof(ot.documents) = 'array'
        AND jsonb_array_length(ot.documents) = 0
      )
    )
  RETURNING ot.id
)
UPDATE public.ownership_transfer_proof_recovery_queue q
SET
  approval_status = 'APPLIED',
  updated_at = NOW()
WHERE q.approval_status = 'APPROVED'
  AND q.transfer_id IN (SELECT id FROM updated_transfers);

-- --------------------------------------------------------------------------
-- Reports
-- --------------------------------------------------------------------------

-- 1) Updated transfer count in this run
SELECT
  COUNT(*) AS updated_transfer_count
FROM public.ownership_transfers ot
WHERE ot.documents IS NOT NULL
  AND jsonb_typeof(ot.documents) = 'array'
  AND jsonb_array_length(ot.documents) > 0
  AND ot.id IN (
    SELECT DISTINCT transfer_id
    FROM public.ownership_transfer_proof_recovery_queue
    WHERE approval_status = 'APPLIED'
  );

-- 2) Remaining approved rows not yet applied (usually means target already had documents)
SELECT
  COUNT(*) AS approved_not_applied
FROM public.ownership_transfer_proof_recovery_queue
WHERE approval_status = 'APPROVED';

-- 3) Remaining unresolved rows
SELECT
  approval_status,
  match_confidence,
  COUNT(*) AS row_count
FROM public.ownership_transfer_proof_recovery_queue
GROUP BY approval_status, match_confidence
ORDER BY approval_status, match_confidence;

COMMIT;
