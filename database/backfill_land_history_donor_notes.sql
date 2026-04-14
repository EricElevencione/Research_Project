-- ============================================================================
-- Backfill: land_history donor notes for legacy transfer rows
-- ============================================================================
-- Purpose:
-- - Fix older transfer rows that only have "to farmer <id>" in notes,
--   which causes UI donor parsing to show "Unknown donor".
--
-- Strategy:
-- - For transfer rows where notes has "to farmer <id>" but not
--   "from farmer <id>", inject donor id using current row farmer_id:
--   "... from farmer <farmer_id> to farmer <id>"
--
-- Safe behavior:
-- - Touches only TRANSFER / TRANSFER_PARTIAL rows.
-- - Only rows missing "from farmer <id>" are updated.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- A) Preview rows that will be updated
-- --------------------------------------------------------------------------
SELECT
  id,
  parcel_number,
  period_start_date,
  farmer_id,
  notes
FROM land_history
WHERE change_type IN ('TRANSFER', 'TRANSFER_PARTIAL')
  AND notes ~* 'to farmer [0-9]+'
  AND notes !~* 'from farmer [0-9]+'
ORDER BY period_start_date DESC, id DESC;

-- --------------------------------------------------------------------------
-- B) Apply backfill
-- --------------------------------------------------------------------------
UPDATE land_history lh
SET
  notes = regexp_replace(
    lh.notes,
    '(?i)to farmer\s+([0-9]+)',
    format('from farmer %s to farmer \\1', lh.farmer_id)
  ),
  updated_at = NOW()
WHERE lh.change_type IN ('TRANSFER', 'TRANSFER_PARTIAL')
  AND lh.notes ~* 'to farmer [0-9]+'
  AND lh.notes !~* 'from farmer [0-9]+'
  AND lh.farmer_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- C) Verify remaining unresolved rows
-- --------------------------------------------------------------------------
SELECT
  id,
  parcel_number,
  period_start_date,
  farmer_id,
  notes
FROM land_history
WHERE change_type IN ('TRANSFER', 'TRANSFER_PARTIAL')
  AND (notes IS NULL OR notes !~* 'from farmer [0-9]+')
ORDER BY period_start_date DESC, id DESC;

COMMIT;
