-- Create a structured RSBSA submission table similar to the masterlist format
CREATE TABLE IF NOT EXISTS rsbsa_submission(
    id BIGSERIAL PRIMARY KEY,
    
    -- Personal Information
    "LAST NAME" VARCHAR(255),
    "FIRST NAME" VARCHAR(255),
    "MIDDLE NAME" VARCHAR(255),
    "EXT NAME" VARCHAR(255),
    "GENDER" VARCHAR(10),
    "BIRTHDATE" DATE,
    
    -- Address Information
    "BARANGAY" VARCHAR(255),  -- Barangay
    "MUNICIPALITY" VARCHAR(255),  -- Mucipality
    
    -- Farm Parcel Information
    "FARM_LOCATION" VARCHAR(50),
    "PARCEL_AREA" DECIMAL(10,2),
    
    -- Additional InformatioN
    "MAIN LIVELIHOOD" VARCHAR(100),
    "OWNERSHIP_TYPE_REGISTERED_OWNER" BOOLEAN DEFAULT FALSE,
    "OWNERSHIP_TYPE_TENANT" BOOLEAN DEFAULT FALSE,
    "OWNERSHIP_TYPE_LESSEE" BOOLEAN DEFAULT FALSE,
    
    -- System Information
    status VARCHAR(50) DEFAULT 'Submitted',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_last_name ON rsbsa_submission("LAST NAME");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_first_name ON rsbsa_submission("FIRST NAME");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_middle_name ON rsbsa_submission("MIDDLE NAME");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_ext_name ON rsbsa_submission("EXT NAME");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_gender ON rsbsa_submission("GENDER");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_birthday ON rsbsa_submission("BIRTHDATE");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_barangay ON rsbsa_submission("BARANGAY");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_municipality ON rsbsa_submission("MUNICIPALITY");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_farm_location ON rsbsa_submission("FARM_LOCATION");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_parcel_area ON rsbsa_submission("PARCEL_AREA");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_main_livelihood ON rsbsa_submission("MAIN LIVELIHOOD");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_status ON rsbsa_submission(status);
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_submitted_at ON rsbsa_submission(submitted_at);

-- Add comments for clarity
COMMENT ON TABLE rsbsa_submission IS 'Structured RSBSA submission table with individual columns for each field';
COMMENT ON COLUMN rsbsa_submission.id IS 'Unique identifier for the submission';
COMMENT ON COLUMN rsbsa_submission."LAST_NAME" IS 'Last name of the farmer';
COMMENT ON COLUMN rsbsa_submission."FIRST_NAME" IS 'First name of the farmer';
COMMENT ON COLUMN rsbsa_submission."MIDDLE_NAME" IS 'Middle name of the farmer';
COMMENT ON COLUMN rsbsa_submission."EXT_NAME" IS 'Extension name of the farmer';
COMMENT ON COLUMN rsbsa_submission."GENDER" IS 'Gender of the farmer';
COMMENT ON COLUMN rsbsa_submission."BIRTHDATE" IS 'Birthdate of the farmer';
COMMENT ON COLUMN rsbsa_submission."BARANGAY" IS 'Barangay of the farmer';
COMMENT ON COLUMN rsbsa_submission."MUNICIPALITY" IS 'Municipality of the farmer';
COMMENT ON COLUMN rsbsa_submission."FARM_LOCATION" IS 'Farm location of the farmer';
COMMENT ON COLUMN rsbsa_submission."PARCEL_AREA" IS 'Area of the farm parcel';
COMMENT ON COLUMN rsbsa_submission."MAIN LIVELIHOOD" IS 'Main livelihood of the farmer';
