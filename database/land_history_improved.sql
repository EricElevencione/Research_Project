-- ============================================================================
-- IMPROVED LAND HISTORY TABLE SCHEMA
-- ============================================================================
-- Purpose: Track complete land ownership and tenancy history over time
-- Features: Links to RSBSA submissions, tracks ownership changes, maintains audit trail
-- ============================================================================

-- Drop existing table if you want to start fresh (CAREFUL - this deletes data!)
-- DROP TABLE IF EXISTS land_history CASCADE;

-- Create improved land_history table
CREATE TABLE IF NOT EXISTS land_history (
    -- Primary Key
    id BIGSERIAL PRIMARY KEY,
    
    -- Link to RSBSA submission and farm parcel
    rsbsa_submission_id BIGINT REFERENCES rsbsa_submission(id) ON DELETE CASCADE,
    farm_parcel_id BIGINT REFERENCES rsbsa_farm_parcels(id) ON DELETE CASCADE,
    
    -- Parcel Information
    parcel_number VARCHAR(20),
    farm_location_barangay VARCHAR(100),
    farm_location_municipality VARCHAR(100),
    total_farm_area_ha DECIMAL(10,2),
    
    -- Land Owner Information (Current registered owner of the land)
    land_owner_id BIGINT,  -- Reference to farmer/person id if you have a farmers table
    land_owner_name VARCHAR(200),
    land_owner_ffrs_code VARCHAR(50),  -- FFRS code if land owner is also a farmer
    
    -- Farmer/Operator Information (Person actually farming the land)
    farmer_id BIGINT REFERENCES rsbsa_submission(id) ON DELETE SET NULL,
    farmer_name VARCHAR(200),
    farmer_ffrs_code VARCHAR(50),
    
    -- Tenant Information (if farmer is renting from owner)
    tenant_name VARCHAR(200),  -- Same as farmer_name if they are tenant
    tenant_ffrs_code VARCHAR(50),
    is_tenant BOOLEAN DEFAULT FALSE,
    
    -- Lessee Information (if farmer is leasing from owner)
    lessee_name VARCHAR(200),  -- Same as farmer_name if they are lessee
    lessee_ffrs_code VARCHAR(50),
    is_lessee BOOLEAN DEFAULT FALSE,
    
    -- Ownership Status Flags
    is_registered_owner BOOLEAN DEFAULT FALSE,  -- Farmer owns the land
    is_other_ownership BOOLEAN DEFAULT FALSE,
    ownership_type_details TEXT,  -- Additional details about ownership arrangement
    
    -- Ownership Document Details
    ownership_document_type VARCHAR(50),  -- 'Title', 'Tax Declaration', 'Lease Agreement', etc.
    ownership_document_no VARCHAR(100),
    
    -- Agrarian Reform
    agrarian_reform_beneficiary BOOLEAN DEFAULT FALSE,
    within_ancestral_domain BOOLEAN DEFAULT FALSE,
    
    -- Time Period Tracking
    period_start_date DATE DEFAULT CURRENT_DATE,  -- When this ownership/tenancy began
    period_end_date DATE,  -- When it ended (NULL if current)
    is_current BOOLEAN DEFAULT TRUE,  -- Flag for current/active record
    
    -- History Tracking
    change_type VARCHAR(50),  -- 'NEW', 'OWNERSHIP_CHANGE', 'TENANT_CHANGE', 'UPDATE', 'TERMINATION'
    change_reason TEXT,  -- Reason for the change
    previous_record_id BIGINT REFERENCES land_history(id) ON DELETE SET NULL,  -- Link to previous record
    
    -- Audit Trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),  -- User who created this record
    updated_by VARCHAR(100),  -- User who last updated
    
    -- Additional Notes
    notes TEXT,
    
    -- Constraints
    CONSTRAINT valid_period CHECK (period_end_date IS NULL OR period_end_date >= period_start_date),
    CONSTRAINT valid_ownership CHECK (
        is_registered_owner OR is_tenant OR is_lessee OR is_other_ownership
    )
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_land_history_rsbsa_submission ON land_history(rsbsa_submission_id);
CREATE INDEX IF NOT EXISTS idx_land_history_farm_parcel ON land_history(farm_parcel_id);
CREATE INDEX IF NOT EXISTS idx_land_history_farmer_id ON land_history(farmer_id);
CREATE INDEX IF NOT EXISTS idx_land_history_land_owner_name ON land_history(land_owner_name);
CREATE INDEX IF NOT EXISTS idx_land_history_farmer_name ON land_history(farmer_name);
CREATE INDEX IF NOT EXISTS idx_land_history_barangay ON land_history(farm_location_barangay);
CREATE INDEX IF NOT EXISTS idx_land_history_municipality ON land_history(farm_location_municipality);
CREATE INDEX IF NOT EXISTS idx_land_history_is_current ON land_history(is_current);
CREATE INDEX IF NOT EXISTS idx_land_history_period_dates ON land_history(period_start_date, period_end_date);
CREATE INDEX IF NOT EXISTS idx_land_history_change_type ON land_history(change_type);
CREATE INDEX IF NOT EXISTS idx_land_history_created_at ON land_history(created_at);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_land_history_current_records 
    ON land_history(farm_parcel_id, is_current) 
    WHERE is_current = TRUE;

-- ============================================================================
-- TABLE COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE land_history IS 'Comprehensive land ownership and tenancy history tracking system';

COMMENT ON COLUMN land_history.rsbsa_submission_id IS 'Link to the RSBSA submission that created or updated this record';
COMMENT ON COLUMN land_history.farm_parcel_id IS 'Link to the specific farm parcel in rsbsa_farm_parcels';
COMMENT ON COLUMN land_history.land_owner_id IS 'ID of the legal land owner (may be different from farmer)';
COMMENT ON COLUMN land_history.land_owner_name IS 'Name of the legal land owner';
COMMENT ON COLUMN land_history.farmer_id IS 'ID of the person farming the land (from rsbsa_submission)';
COMMENT ON COLUMN land_history.farmer_name IS 'Name of the person actually farming the land';
COMMENT ON COLUMN land_history.is_tenant IS 'TRUE if farmer is renting from land owner';
COMMENT ON COLUMN land_history.is_lessee IS 'TRUE if farmer is leasing from land owner';
COMMENT ON COLUMN land_history.is_registered_owner IS 'TRUE if farmer is the registered owner';
COMMENT ON COLUMN land_history.period_start_date IS 'Start date of this ownership/tenancy arrangement';
COMMENT ON COLUMN land_history.period_end_date IS 'End date (NULL if currently active)';
COMMENT ON COLUMN land_history.is_current IS 'TRUE if this is the current/active record';
COMMENT ON COLUMN land_history.change_type IS 'Type of change: NEW, OWNERSHIP_CHANGE, TENANT_CHANGE, UPDATE, TERMINATION';
COMMENT ON COLUMN land_history.previous_record_id IS 'Link to previous history record for this parcel';

-- ============================================================================
-- HELPER FUNCTION: Generate full name from RSBSA submission
-- ============================================================================

CREATE OR REPLACE FUNCTION get_farmer_full_name(submission_id BIGINT)
RETURNS VARCHAR(200) AS $$
DECLARE
    full_name VARCHAR(200);
BEGIN
    SELECT CONCAT_WS(' ',
        "FIRST NAME",
        "MIDDLE NAME",
        "LAST NAME",
        NULLIF("EXT NAME", '')
    )
    INTO full_name
    FROM rsbsa_submission
    WHERE id = submission_id;
    
    RETURN COALESCE(full_name, '');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER FUNCTION: Auto-update timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_land_history_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_land_history_timestamp
    BEFORE UPDATE ON land_history
    FOR EACH ROW
    EXECUTE FUNCTION update_land_history_timestamp();

-- ============================================================================
-- TRIGGER FUNCTION: Create land history from RSBSA farm parcel
-- ============================================================================

CREATE OR REPLACE FUNCTION create_land_history_from_farm_parcel()
RETURNS TRIGGER AS $$
DECLARE
    farmer_full_name VARCHAR(200);
    farmer_ffrs VARCHAR(50);
BEGIN
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
        
        -- Land owner (if farmer is owner, use their name; if tenant/lessee, use land owner name)
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

-- Create trigger on rsbsa_farm_parcels
CREATE TRIGGER trigger_create_land_history_on_parcel_insert
    AFTER INSERT ON rsbsa_farm_parcels
    FOR EACH ROW
    EXECUTE FUNCTION create_land_history_from_farm_parcel();

-- ============================================================================
-- TRIGGER FUNCTION: Update land history when farm parcel changes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_land_history_from_farm_parcel()
RETURNS TRIGGER AS $$
DECLARE
    ownership_changed BOOLEAN := FALSE;
    farmer_full_name VARCHAR(200);
    farmer_ffrs VARCHAR(50);
BEGIN
    -- Check if ownership type changed
    IF (OLD.ownership_type_registered_owner != NEW.ownership_type_registered_owner OR
        OLD.ownership_type_tenant != NEW.ownership_type_tenant OR
        OLD.ownership_type_lessee != NEW.ownership_type_lessee OR
        COALESCE(OLD.tenant_land_owner_name, '') != COALESCE(NEW.tenant_land_owner_name, '') OR
        COALESCE(OLD.lessee_land_owner_name, '') != COALESCE(NEW.lessee_land_owner_name, '')) THEN
        
        ownership_changed := TRUE;
        
        -- Get farmer information
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
        
        -- Mark previous record as not current and set end date
        UPDATE land_history
        SET is_current = FALSE,
            period_end_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        WHERE farm_parcel_id = NEW.id
          AND is_current = TRUE;
        
        -- Create new history record
        INSERT INTO land_history (
            rsbsa_submission_id,
            farm_parcel_id,
            parcel_number,
            farm_location_barangay,
            farm_location_municipality,
            total_farm_area_ha,
            land_owner_name,
            land_owner_ffrs_code,
            farmer_id,
            farmer_name,
            farmer_ffrs_code,
            tenant_name,
            tenant_ffrs_code,
            is_tenant,
            lessee_name,
            lessee_ffrs_code,
            is_lessee,
            is_registered_owner,
            is_other_ownership,
            ownership_document_no,
            agrarian_reform_beneficiary,
            within_ancestral_domain,
            change_type,
            is_current,
            period_start_date,
            previous_record_id
        )
        SELECT
            NEW.submission_id,
            NEW.id,
            NEW.parcel_number,
            NEW.farm_location_barangay,
            NEW.farm_location_municipality,
            NEW.total_farm_area_ha,
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
            NEW.submission_id,
            farmer_full_name,
            farmer_ffrs,
            CASE WHEN NEW.ownership_type_tenant THEN farmer_full_name ELSE NULL END,
            CASE WHEN NEW.ownership_type_tenant THEN farmer_ffrs ELSE NULL END,
            NEW.ownership_type_tenant,
            CASE WHEN NEW.ownership_type_lessee THEN farmer_full_name ELSE NULL END,
            CASE WHEN NEW.ownership_type_lessee THEN farmer_ffrs ELSE NULL END,
            NEW.ownership_type_lessee,
            NEW.ownership_type_registered_owner,
            NEW.ownership_type_others,
            NEW.ownership_document_no,
            CASE WHEN NEW.agrarian_reform_beneficiary = 'Yes' THEN TRUE ELSE FALSE END,
            CASE WHEN NEW.within_ancestral_domain = 'Yes' THEN TRUE ELSE FALSE END,
            'OWNERSHIP_CHANGE',
            TRUE,
            CURRENT_DATE,
            (SELECT id FROM land_history WHERE farm_parcel_id = NEW.id AND is_current = FALSE ORDER BY created_at DESC LIMIT 1);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updates
CREATE TRIGGER trigger_update_land_history_on_parcel_update
    AFTER UPDATE ON rsbsa_farm_parcels
    FOR EACH ROW
    EXECUTE FUNCTION update_land_history_from_farm_parcel();

COMMENT ON FUNCTION create_land_history_from_farm_parcel() IS 'Automatically creates land history record when a new farm parcel is added';
COMMENT ON FUNCTION update_land_history_from_farm_parcel() IS 'Automatically updates land history when farm parcel ownership changes';
