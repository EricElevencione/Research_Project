-- ============================================================
-- FINALIZE MIGRATION - Rename Tables
-- ============================================================
-- Run this AFTER verifying the migration was successful.
-- This renames land_history_new to land_history.
-- ============================================================

-- Step 1: Rename old table to backup (this also renames its sequence)
ALTER TABLE IF EXISTS land_history RENAME TO land_history_old;

-- Step 2: Rename the old sequence to avoid conflict
ALTER SEQUENCE IF EXISTS land_history_id_seq RENAME TO land_history_old_id_seq;

-- Step 3: Rename new table to production name
ALTER TABLE IF EXISTS land_history_new RENAME TO land_history;

-- Step 4: Update sequence name for new table
ALTER SEQUENCE IF EXISTS land_history_new_id_seq RENAME TO land_history_id_seq;

-- Step 4: Update foreign key constraint references
ALTER TABLE IF EXISTS land_history 
    DROP CONSTRAINT IF EXISTS land_history_new_land_parcel_id_fkey;

ALTER TABLE IF EXISTS land_history 
    ADD CONSTRAINT land_history_land_parcel_id_fkey 
    FOREIGN KEY (land_parcel_id) REFERENCES land_parcels(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS land_history 
    DROP CONSTRAINT IF EXISTS land_history_new_previous_history_id_fkey;

ALTER TABLE IF EXISTS land_history 
    ADD CONSTRAINT land_history_previous_history_id_fkey 
    FOREIGN KEY (previous_history_id) REFERENCES land_history(id);

-- Step 5: Rename indexes
ALTER INDEX IF EXISTS idx_land_history_new_parcel_id RENAME TO idx_land_history_parcel_id;
ALTER INDEX IF EXISTS idx_land_history_new_parcel_number RENAME TO idx_land_history_parcel_number;
ALTER INDEX IF EXISTS idx_land_history_new_farmer RENAME TO idx_land_history_farmer;
ALTER INDEX IF EXISTS idx_land_history_new_current RENAME TO idx_land_history_current;
ALTER INDEX IF EXISTS idx_land_history_new_owner RENAME TO idx_land_history_owner;
ALTER INDEX IF EXISTS idx_land_history_new_dates RENAME TO idx_land_history_dates;

-- Step 6: Rename trigger
DROP TRIGGER IF EXISTS trigger_update_land_history_timestamp ON land_history;

CREATE TRIGGER trigger_update_land_history_timestamp
    BEFORE UPDATE ON land_history
    FOR EACH ROW
    EXECUTE FUNCTION update_land_history_timestamp();

-- Step 7: Update RLS policies
DROP POLICY IF EXISTS "Allow authenticated read access" ON land_history;
DROP POLICY IF EXISTS "Allow authenticated insert" ON land_history;
DROP POLICY IF EXISTS "Allow authenticated update" ON land_history;

CREATE POLICY "Allow authenticated read access" ON land_history
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON land_history
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON land_history
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Step 8: Grant permissions
GRANT ALL ON land_history TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE land_history_id_seq TO authenticated;

-- Step 9: Update transfer_land_ownership function to use new table name
CREATE OR REPLACE FUNCTION transfer_land_ownership(
    p_land_parcel_id INTEGER,
    p_new_farmer_id INTEGER,
    p_new_farmer_name VARCHAR,
    p_is_owner BOOLEAN,
    p_is_tenant BOOLEAN,
    p_is_lessee BOOLEAN,
    p_land_owner_id INTEGER DEFAULT NULL,
    p_land_owner_name VARCHAR DEFAULT NULL,
    p_change_type VARCHAR DEFAULT 'TRANSFER',
    p_change_reason TEXT DEFAULT NULL,
    p_rsbsa_submission_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_previous_id INTEGER;
    v_parcel_number VARCHAR;
    v_barangay VARCHAR;
    v_municipality VARCHAR;
    v_area DECIMAL;
    v_new_id INTEGER;
BEGIN
    -- Get current holder's record and parcel info
    SELECT 
        lh.id,
        lh.parcel_number,
        lh.farm_location_barangay,
        lh.farm_location_municipality,
        lh.total_farm_area_ha
    INTO 
        v_previous_id,
        v_parcel_number,
        v_barangay,
        v_municipality,
        v_area
    FROM land_history lh
    WHERE lh.land_parcel_id = p_land_parcel_id 
      AND lh.is_current = TRUE
    LIMIT 1;
    
    -- If no parcel info from history, get from land_parcels
    IF v_parcel_number IS NULL THEN
        SELECT 
            parcel_number,
            farm_location_barangay,
            farm_location_municipality,
            total_farm_area_ha
        INTO 
            v_parcel_number,
            v_barangay,
            v_municipality,
            v_area
        FROM land_parcels
        WHERE id = p_land_parcel_id;
    END IF;
    
    -- Close the previous holder's record
    IF v_previous_id IS NOT NULL THEN
        UPDATE land_history
        SET 
            is_current = FALSE,
            period_end_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_previous_id;
    END IF;
    
    -- Create new ownership record
    INSERT INTO land_history (
        land_parcel_id,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,
        farmer_id,
        farmer_name,
        is_registered_owner,
        is_tenant,
        is_lessee,
        land_owner_id,
        land_owner_name,
        period_start_date,
        is_current,
        change_type,
        change_reason,
        previous_history_id,
        rsbsa_submission_id
    ) VALUES (
        p_land_parcel_id,
        v_parcel_number,
        v_barangay,
        v_municipality,
        v_area,
        p_new_farmer_id,
        p_new_farmer_name,
        p_is_owner,
        p_is_tenant,
        p_is_lessee,
        p_land_owner_id,
        p_land_owner_name,
        CURRENT_DATE,
        TRUE,
        p_change_type,
        p_change_reason,
        v_previous_id,
        p_rsbsa_submission_id
    )
    RETURNING id INTO v_new_id;
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Verification
SELECT 'Table rename completed!' AS status;

SELECT 
    'land_history' AS table_name,
    COUNT(*) AS records
FROM land_history
UNION ALL
SELECT 
    'land_parcels' AS table_name,
    COUNT(*) AS records
FROM land_parcels;
