-- ============================================================
-- Backfill land_plots.ffrs_id from rsbsa_submission.FFRS_CODE
-- ============================================================
-- Run this ONCE to fix existing rows that were saved before
-- the ffrs_id field was being populated on the frontend.
--
-- Matching strategy:
--   1. Primary: match by first_name + surname + a barangay that
--      corresponds to either the farmer's home barangay OR one of
--      their rsbsa_farm_parcels.farm_location_barangay values.
--   2. Only updates rows where ffrs_id IS NULL or empty string.
--   3. Skips updates where the match is ambiguous (multiple
--      farmers with the same first+last name).
-- ============================================================

BEGIN;

-- Step 1: Preview what will be updated (run SELECT first to verify)
-- Comment out the UPDATE below and run this to inspect before committing.
/*
SELECT
    lp.id            AS plot_id,
    lp.first_name    AS plot_first_name,
    lp.surname       AS plot_surname,
    lp.barangay      AS plot_barangay,
    rs.id            AS farmer_id,
    rs."FFRS_CODE"   AS ffrs_code,
    rs."BARANGAY"    AS farmer_home_barangay
FROM land_plots lp
JOIN rsbsa_submission rs
    ON LOWER(TRIM(lp.first_name)) = LOWER(TRIM(rs."FIRST NAME"))
    AND LOWER(TRIM(lp.surname))   = LOWER(TRIM(rs."LAST NAME"))
WHERE (lp.ffrs_id IS NULL OR lp.ffrs_id = '')
-- Only match where the barangay also aligns (home OR any farm parcel)
AND (
    LOWER(TRIM(lp.barangay)) = LOWER(TRIM(rs."BARANGAY"))
    OR EXISTS (
        SELECT 1 FROM rsbsa_farm_parcels rfp
        WHERE rfp.submission_id = rs.id
          AND LOWER(TRIM(rfp.farm_location_barangay)) = LOWER(TRIM(lp.barangay))
    )
)
-- Safety: skip ambiguous matches (same name maps to 2+ farmers)
AND (
    SELECT COUNT(*) FROM rsbsa_submission rs2
    WHERE LOWER(TRIM(rs2."FIRST NAME")) = LOWER(TRIM(lp.first_name))
      AND LOWER(TRIM(rs2."LAST NAME"))  = LOWER(TRIM(lp.surname))
) = 1;
*/

-- Step 2: Perform the backfill update
UPDATE land_plots lp
SET
    ffrs_id    = rs."FFRS_CODE",
    updated_at = NOW()
FROM rsbsa_submission rs
WHERE
    -- Only fix rows that are missing ffrs_id
    (lp.ffrs_id IS NULL OR lp.ffrs_id = '')
    -- Match on normalized first name + surname
    AND LOWER(TRIM(lp.first_name)) = LOWER(TRIM(rs."FIRST NAME"))
    AND LOWER(TRIM(lp.surname))    = LOWER(TRIM(rs."LAST NAME"))
    -- Barangay must correspond to farmer's home OR one of their registered parcels
    AND (
        LOWER(TRIM(lp.barangay)) = LOWER(TRIM(rs."BARANGAY"))
        OR EXISTS (
            SELECT 1 FROM rsbsa_farm_parcels rfp
            WHERE rfp.submission_id = rs.id
              AND LOWER(TRIM(rfp.farm_location_barangay)) = LOWER(TRIM(lp.barangay))
        )
    )
    -- Safety guard: only proceed when the name match is unambiguous
    AND (
        SELECT COUNT(*) FROM rsbsa_submission rs2
        WHERE LOWER(TRIM(rs2."FIRST NAME")) = LOWER(TRIM(lp.first_name))
          AND LOWER(TRIM(rs2."LAST NAME"))  = LOWER(TRIM(lp.surname))
    ) = 1;

-- Step 3: Report how many rows still have no ffrs_id after the update
-- (These will need manual review)
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count
    FROM land_plots
    WHERE ffrs_id IS NULL OR ffrs_id = '';

    IF remaining_count > 0 THEN
        RAISE NOTICE 'Backfill complete. % land_plot row(s) still have no ffrs_id and require manual review.', remaining_count;
    ELSE
        RAISE NOTICE 'Backfill complete. All land_plot rows now have an ffrs_id.';
    END IF;
END $$;

COMMIT;

-- ============================================================
-- Optional: Index to speed up dashboard matching queries
-- (safe to run multiple times due to IF NOT EXISTS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_land_plots_ffrs_barangay
    ON land_plots (ffrs_id, barangay);
