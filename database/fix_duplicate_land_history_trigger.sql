-- ============================================================================
-- FIX: Duplicate land_history records after partial/full transfer
-- ============================================================================
-- ROOT CAUSE:
--   The trigger "trigger_create_land_history_on_parcel_insert" fires on every
--   INSERT into rsbsa_farm_parcels and auto-creates a land_history row with
--   change_type = 'NEW'. However, the transfer RPCs
--   (execute_partial_parcel_transfer, create_ownership_transfer_no_review)
--   also INSERT into rsbsa_farm_parcels to create the recipient's new parcel
--   AND explicitly insert their own land_history row with change_type =
--   'TRANSFER_PARTIAL' or 'TRANSFER'. This results in 2 is_current history
--   rows per parcel — the "NEW" trigger-row and the "TRANSFER_*" RPC-row.
--
-- FIX:
--   Part A — Patch the trigger function to skip parcels that were created by
--             a transfer (identified by parent_parcel_id IS NOT NULL). The
--             transfer RPCs already handle their own land_history inserts.
--   Part B — Clean up existing duplicate 'NEW' rows that were created before
--             this patch was applied.
--
-- HOW TO RUN:
--   Run this entire script in Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================================


-- ============================================================================
-- PART A: Patch the trigger function
-- ============================================================================
-- Add an early-exit guard: if parent_parcel_id IS NOT NULL, the parcel was
-- created by a transfer RPC (not a direct registration), so we skip the
-- auto-history insert and let the RPC handle it.

CREATE OR REPLACE FUNCTION public.create_land_history_from_farm_parcel()
RETURNS TRIGGER AS $$
DECLARE
    farmer_full_name VARCHAR(200);
    farmer_ffrs VARCHAR(50);
BEGIN
    -- ── Guard: skip parcels created by transfer RPCs ──────────────────────
    -- Transfer RPCs set parent_parcel_id on the new recipient parcel and
    -- insert their own land_history row (change_type = TRANSFER_PARTIAL /
    -- TRANSFER). Letting the trigger also fire would produce a duplicate 'NEW'
    -- row for the same parcel.
    IF NEW.parent_parcel_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get farmer information from the linked RSBSA submission
    SELECT
        CONCAT_WS(' ',
            "FIRST NAME",
            "MIDDLE NAME",
            "LAST NAME",
            NULLIF("EXT NAME", '')
        ),
        "FFRS_CODE"
    INTO farmer_full_name, farmer_ffrs
    FROM rsbsa_submission
    WHERE id = NEW.submission_id;

    -- Create a new land history record
    INSERT INTO land_history (
        rsbsa_submission_id,
        farm_parcel_id,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,

        -- Set land owner based on ownership type
        land_owner_name,
        land_owner_ffrs_code,

        -- Farmer information
        farmer_id,
        farmer_name,
        farmer_ffrs_code,

        -- Tenant information
        tenant_name,
        tenant_ffrs_code,
        is_tenant,

        -- Lessee information
        lessee_name,
        lessee_ffrs_code,
        is_lessee,

        -- Ownership flags
        is_registered_owner,
        is_other_ownership,

        -- Documents
        ownership_document_no,
        agrarian_reform_beneficiary,
        within_ancestral_domain,

        -- History tracking
        change_type,
        is_current,
        period_start_date
    )
    VALUES (
        NEW.submission_id,
        NEW.id,
        NEW.parcel_number,
        NEW.farm_location_barangay,
        NEW.farm_location_municipality,
        NEW.total_farm_area_ha,

        -- Land owner
        CASE
            WHEN NEW.ownership_type_registered_owner THEN farmer_full_name
            WHEN NEW.ownership_type_tenant THEN NEW.tenant_land_owner_name
            WHEN NEW.ownership_type_lessee THEN NEW.lessee_land_owner_name
            ELSE farmer_full_name
        END,
        CASE
            WHEN NEW.ownership_type_registered_owner THEN farmer_ffrs
            ELSE NULL
        END,

        -- Farmer
        NEW.submission_id,
        farmer_full_name,
        farmer_ffrs,

        -- Tenant
        CASE WHEN NEW.ownership_type_tenant THEN farmer_full_name ELSE NULL END,
        CASE WHEN NEW.ownership_type_tenant THEN farmer_ffrs ELSE NULL END,
        NEW.ownership_type_tenant,

        -- Lessee
        CASE WHEN NEW.ownership_type_lessee THEN farmer_full_name ELSE NULL END,
        CASE WHEN NEW.ownership_type_lessee THEN farmer_ffrs ELSE NULL END,
        NEW.ownership_type_lessee,

        -- Ownership
        NEW.ownership_type_registered_owner,
        NEW.ownership_type_others,

        -- Documents
        NEW.ownership_document_no,
        CASE WHEN NEW.agrarian_reform_beneficiary = 'Yes' THEN TRUE ELSE FALSE END,
        CASE WHEN NEW.within_ancestral_domain = 'Yes' THEN TRUE ELSE FALSE END,

        -- History
        'NEW',
        TRUE,
        CURRENT_DATE
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART B: Clean up existing duplicate 'NEW' rows
-- ============================================================================
-- Delete ALL land_history rows with change_type = 'NEW' where a
-- TRANSFER / TRANSFER_PARTIAL row already exists for the same farm_parcel_id.
-- This covers both is_current = TRUE and is_current = FALSE 'NEW' rows, since
-- the first run of this script only cleaned up is_current = TRUE ones.
--
-- Safe: normal registered-farmer parcels only have 'NEW' rows (no TRANSFER
-- sibling), so they are not touched. Only transfer-recipient parcels — which
-- have both a trigger-created 'NEW' row AND an RPC-inserted 'TRANSFER*' row —
-- are affected.

DELETE FROM land_history
WHERE change_type = 'NEW'
  AND farm_parcel_id IN (
      SELECT DISTINCT farm_parcel_id
      FROM land_history
      WHERE change_type IN ('TRANSFER', 'TRANSFER_PARTIAL')
        AND farm_parcel_id IS NOT NULL
  );


-- ============================================================================
-- VERIFICATION QUERY (optional — run separately to confirm)
-- ============================================================================
-- SELECT farm_parcel_id, COUNT(*) AS cnt, array_agg(change_type ORDER BY id) AS types
-- FROM land_history
-- WHERE is_current = TRUE
-- GROUP BY farm_parcel_id
-- HAVING COUNT(*) > 1
-- ORDER BY cnt DESC;
-- Expected result: 0 rows (no more duplicates).
