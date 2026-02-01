-- Migration: Add land_owner_farmer_id foreign key to rsbsa_farm_parcels
-- This creates a proper relationship between tenants/lessees and their land owners
-- Instead of just storing names as text, we now link to the actual farmer record

-- ============================================================================
-- STEP 1: Add the new foreign key columns
-- ============================================================================

-- Add land owner foreign key for tenants
ALTER TABLE rsbsa_farm_parcels 
ADD COLUMN IF NOT EXISTS tenant_land_owner_id BIGINT;

-- Add land owner foreign key for lessees
ALTER TABLE rsbsa_farm_parcels 
ADD COLUMN IF NOT EXISTS lessee_land_owner_id BIGINT;

-- ============================================================================
-- STEP 2: Add foreign key constraints with ON DELETE SET NULL
-- This means when a land owner is deleted, the reference is automatically set to NULL
-- ============================================================================

-- Check if constraint exists before adding (to make migration idempotent)
DO $$
BEGIN
    -- Add foreign key for tenant_land_owner_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_tenant_land_owner' 
        AND table_name = 'rsbsa_farm_parcels'
    ) THEN
        ALTER TABLE rsbsa_farm_parcels
        ADD CONSTRAINT fk_tenant_land_owner
        FOREIGN KEY (tenant_land_owner_id) 
        REFERENCES rsbsa_submission(id) 
        ON DELETE SET NULL;
    END IF;

    -- Add foreign key for lessee_land_owner_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_lessee_land_owner' 
        AND table_name = 'rsbsa_farm_parcels'
    ) THEN
        ALTER TABLE rsbsa_farm_parcels
        ADD CONSTRAINT fk_lessee_land_owner
        FOREIGN KEY (lessee_land_owner_id) 
        REFERENCES rsbsa_submission(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Create indexes for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rsbsa_farm_parcels_tenant_land_owner_id 
ON rsbsa_farm_parcels(tenant_land_owner_id);

CREATE INDEX IF NOT EXISTS idx_rsbsa_farm_parcels_lessee_land_owner_id 
ON rsbsa_farm_parcels(lessee_land_owner_id);

-- ============================================================================
-- STEP 4: Migrate existing data - try to match text names to farmer IDs
-- ============================================================================

-- Update tenant_land_owner_id based on matching tenant_land_owner_name
UPDATE rsbsa_farm_parcels fp
SET tenant_land_owner_id = rs.id
FROM rsbsa_submission rs
WHERE fp.tenant_land_owner_name IS NOT NULL
AND fp.tenant_land_owner_id IS NULL
AND fp.ownership_type_tenant = true
AND LOWER(TRIM(fp.tenant_land_owner_name)) = LOWER(TRIM(
    CONCAT_WS(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME")
));

-- Update lessee_land_owner_id based on matching lessee_land_owner_name
UPDATE rsbsa_farm_parcels fp
SET lessee_land_owner_id = rs.id
FROM rsbsa_submission rs
WHERE fp.lessee_land_owner_name IS NOT NULL
AND fp.lessee_land_owner_id IS NULL
AND fp.ownership_type_lessee = true
AND LOWER(TRIM(fp.lessee_land_owner_name)) = LOWER(TRIM(
    CONCAT_WS(' ', rs."FIRST NAME", rs."MIDDLE NAME", rs."LAST NAME")
));

-- ============================================================================
-- STEP 5: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN rsbsa_farm_parcels.tenant_land_owner_id IS 
'Foreign key reference to the land owner (rsbsa_submission.id) if farmer is a tenant. Automatically set to NULL when land owner is deleted.';

COMMENT ON COLUMN rsbsa_farm_parcels.lessee_land_owner_id IS 
'Foreign key reference to the land owner (rsbsa_submission.id) if farmer is a lessee. Automatically set to NULL when land owner is deleted.';

-- ============================================================================
-- STEP 6: Create a view to easily see tenant/lessee relationships
-- ============================================================================

CREATE OR REPLACE VIEW v_tenant_lessee_relationships AS
SELECT 
    fp.id AS parcel_id,
    fp.submission_id AS farmer_id,
    CONCAT_WS(' ', farmer."FIRST NAME", farmer."MIDDLE NAME", farmer."LAST NAME") AS farmer_name,
    farmer."BARANGAY" AS farmer_barangay,
    
    -- Ownership type
    CASE 
        WHEN fp.ownership_type_tenant THEN 'Tenant'
        WHEN fp.ownership_type_lessee THEN 'Lessee'
        WHEN fp.ownership_type_registered_owner THEN 'Registered Owner'
        ELSE 'Other'
    END AS ownership_type,
    
    -- Tenant's land owner info
    fp.tenant_land_owner_id,
    fp.tenant_land_owner_name AS tenant_land_owner_name_text,
    CONCAT_WS(' ', tenant_owner."FIRST NAME", tenant_owner."MIDDLE NAME", tenant_owner."LAST NAME") AS tenant_land_owner_name_linked,
    
    -- Lessee's land owner info
    fp.lessee_land_owner_id,
    fp.lessee_land_owner_name AS lessee_land_owner_name_text,
    CONCAT_WS(' ', lessee_owner."FIRST NAME", lessee_owner."MIDDLE NAME", lessee_owner."LAST NAME") AS lessee_land_owner_name_linked,
    
    -- Farm parcel details
    fp.farm_location_barangay,
    fp.total_farm_area_ha

FROM rsbsa_farm_parcels fp
JOIN rsbsa_submission farmer ON fp.submission_id = farmer.id
LEFT JOIN rsbsa_submission tenant_owner ON fp.tenant_land_owner_id = tenant_owner.id
LEFT JOIN rsbsa_submission lessee_owner ON fp.lessee_land_owner_id = lessee_owner.id
WHERE fp.ownership_type_tenant = true OR fp.ownership_type_lessee = true;

-- ============================================================================
-- Verification queries (run these after migration to check results)
-- ============================================================================

-- Check how many records were linked
-- SELECT 
--     COUNT(*) AS total_tenant_parcels,
--     COUNT(tenant_land_owner_id) AS linked_to_farmer,
--     COUNT(*) - COUNT(tenant_land_owner_id) AS unlinked
-- FROM rsbsa_farm_parcels 
-- WHERE ownership_type_tenant = true;

-- SELECT 
--     COUNT(*) AS total_lessee_parcels,
--     COUNT(lessee_land_owner_id) AS linked_to_farmer,
--     COUNT(*) - COUNT(lessee_land_owner_id) AS unlinked
-- FROM rsbsa_farm_parcels 
-- WHERE ownership_type_lessee = true;

-- View the relationships
-- SELECT * FROM v_tenant_lessee_relationships;
