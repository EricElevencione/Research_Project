-- ============================================================================
-- MIGRATION: Add Parcel Transfer Tracking Columns
-- ============================================================================
-- Purpose: Adds columns to rsbsa_farm_parcels and land_history to properly
--          track parcel splits and transfer details.
-- Run in Supabase SQL Editor ONCE.
-- ============================================================================

-- ─── rsbsa_farm_parcels: track split lineage ────────────────────────────────

-- Links a split parcel back to its original (donor) parcel
ALTER TABLE rsbsa_farm_parcels
  ADD COLUMN IF NOT EXISTS parent_parcel_id BIGINT
    REFERENCES rsbsa_farm_parcels(id) ON DELETE SET NULL;

-- Records the original area of the donor parcel at the moment of the split
ALTER TABLE rsbsa_farm_parcels
  ADD COLUMN IF NOT EXISTS split_origin_area_ha DECIMAL(10,2);

-- Index for fast lookups of child parcels by parent
CREATE INDEX IF NOT EXISTS idx_farm_parcels_parent
  ON rsbsa_farm_parcels(parent_parcel_id)
  WHERE parent_parcel_id IS NOT NULL;

COMMENT ON COLUMN rsbsa_farm_parcels.parent_parcel_id
  IS 'References the original parcel this was split from (NULL if not a split)';
COMMENT ON COLUMN rsbsa_farm_parcels.split_origin_area_ha
  IS 'Area of the parent parcel at the time of the split (ha)';


-- ─── land_history: record transfer area details ─────────────────────────────

-- The area that was transferred in this change event
ALTER TABLE land_history
  ADD COLUMN IF NOT EXISTS transferred_area_ha DECIMAL(10,2);

-- The remaining area on the donor parcel after the transfer
ALTER TABLE land_history
  ADD COLUMN IF NOT EXISTS remaining_area_ha DECIMAL(10,2);

COMMENT ON COLUMN land_history.transferred_area_ha
  IS 'Area (ha) transferred during this ownership change event';
COMMENT ON COLUMN land_history.remaining_area_ha
  IS 'Remaining area (ha) on the donor parcel after this transfer';


-- ─── Verification ───────────────────────────────────────────────────────────

SELECT 'Migration complete — parcel transfer columns added.' AS status;
