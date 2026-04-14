-- ============================================================
-- DELETE MCCARTHY AND MCKINNEY FARMERS
-- Must delete from ownership_transfers first (child table)
-- before deleting from rsbsa_submission (parent table)
-- ============================================================

-- STEP 1: Preview which farmers will be deleted (run this first to confirm)
SELECT id, "FIRST NAME", "LAST NAME"
FROM rsbsa_submission
WHERE "LAST NAME" ILIKE 'McCarthy'
   OR "LAST NAME" ILIKE 'McKinney';

-- STEP 2: Delete their records from ownership_transfers
-- (covers both cases: they were the "from" or "to" farmer in a transfer)
DELETE FROM ownership_transfers
WHERE from_farmer_id IN (
    SELECT id FROM rsbsa_submission
    WHERE "LAST NAME" ILIKE 'McCarthy'
       OR "LAST NAME" ILIKE 'McKinney'
)
OR to_farmer_id IN (
    SELECT id FROM rsbsa_submission
    WHERE "LAST NAME" ILIKE 'McCarthy'
       OR "LAST NAME" ILIKE 'McKinney'
);

-- STEP 3: Now safely delete from rsbsa_submission
DELETE FROM rsbsa_submission
WHERE "LAST NAME" ILIKE 'McCarthy'
   OR "LAST NAME" ILIKE 'McKinney';

-- STEP 4: Verify both are gone
SELECT id, "FIRST NAME", "LAST NAME"
FROM rsbsa_submission
WHERE "LAST NAME" ILIKE 'McCarthy'
   OR "LAST NAME" ILIKE 'McKinney';
