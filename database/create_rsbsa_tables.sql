-- Create comprehensive RSBSA tables for the system

-- 1. RSBSA Drafts table (for saving work in progress)
CREATE TABLE IF NOT EXISTS rsbsa_draft (
    id BIGSERIAL PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. RSBSA Submissions table (for final submitted forms)
CREATE TABLE IF NOT EXISTS rsbsa_submissions (
    id BIGSERIAL PRIMARY KEY,
    draft_id BIGINT REFERENCES rsbsa_draft(id) ON DELETE SET NULL,
    data JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected')),
    submitted_by VARCHAR(100),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. RSBSA Farmland Parcels table (for storing farmland details)
CREATE TABLE IF NOT EXISTS rsbsa_farmland_parcels (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT REFERENCES rsbsa_submissions(id) ON DELETE CASCADE,
    parcel_number VARCHAR(20),
    farm_location_barangay VARCHAR(100),
    farm_location_municipality VARCHAR(100),
    total_farm_area_ha DECIMAL(10,2),
    within_ancestral_domain VARCHAR(10) CHECK (within_ancestral_domain IN ('Yes', 'No')),
    ownership_document_no VARCHAR(100),
    agrarian_reform_beneficiary VARCHAR(10) CHECK (agrarian_reform_beneficiary IN ('Yes', 'No')),
    ownership_type_registered_owner BOOLEAN DEFAULT FALSE,
    ownership_type_tenant BOOLEAN DEFAULT FALSE,
    ownership_type_lessee BOOLEAN DEFAULT FALSE,
    ownership_type_others BOOLEAN DEFAULT FALSE,
    tenant_land_owner_name VARCHAR(200),
    lessee_land_owner_name VARCHAR(200),
    ownership_others_specify TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rsbsa_draft_created_at ON rsbsa_draft(created_at);
CREATE INDEX IF NOT EXISTS idx_rsbsa_draft_updated_at ON rsbsa_draft(updated_at);
CREATE INDEX IF NOT EXISTS idx_rsbsa_draft_data ON rsbsa_draft USING GIN (data);

CREATE INDEX IF NOT EXISTS idx_rsbsa_submissions_status ON rsbsa_submissions(status);
CREATE INDEX IF NOT EXISTS idx_rsbsa_submissions_submitted_at ON rsbsa_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_rsbsa_submissions_data ON rsbsa_submissions USING GIN (data);

CREATE INDEX IF NOT EXISTS idx_rsbsa_farmland_submission_id ON rsbsa_farmland_parcels(submission_id);
CREATE INDEX IF NOT EXISTS idx_rsbsa_farmland_barangay ON rsbsa_farmland_parcels(farm_location_barangay);
CREATE INDEX IF NOT EXISTS idx_rsbsa_farmland_municipality ON rsbsa_farmland_parcels(farm_location_municipality);

-- Add table comments
COMMENT ON TABLE rsbsa_draft IS 'Stores draft RSBSA forms before final submission';
COMMENT ON TABLE rsbsa_submissions IS 'Stores final submitted RSBSA forms';
COMMENT ON TABLE rsbsa_farmland_parcels IS 'Stores farmland parcel details for RSBSA submissions';

-- Add column comments for rsbsa_draft
COMMENT ON COLUMN rsbsa_draft.id IS 'Unique identifier for the draft';
COMMENT ON COLUMN rsbsa_draft.data IS 'JSON data containing the form fields';
COMMENT ON COLUMN rsbsa_draft.created_at IS 'Timestamp when the draft was first created';
COMMENT ON COLUMN rsbsa_draft.updated_at IS 'Timestamp when the draft was last updated';

-- Add column comments for rsbsa_submissions
COMMENT ON COLUMN rsbsa_submissions.id IS 'Unique identifier for the submission';
COMMENT ON COLUMN rsbsa_submissions.draft_id IS 'Reference to the original draft (if any)';
COMMENT ON COLUMN rsbsa_submissions.data IS 'JSON data containing the submitted form fields';
COMMENT ON COLUMN rsbsa_submissions.status IS 'Current status of the submission';
COMMENT ON COLUMN rsbsa_submissions.submitted_by IS 'User who submitted the form';
COMMENT ON COLUMN rsbsa_submissions.submitted_at IS 'Timestamp when the form was submitted';
COMMENT ON COLUMN rsbsa_submissions.reviewed_by IS 'User who reviewed the submission';
COMMENT ON COLUMN rsbsa_submissions.reviewed_at IS 'Timestamp when the submission was reviewed';
COMMENT ON COLUMN rsbsa_submissions.review_notes IS 'Notes from the reviewer';

-- Add column comments for rsbsa_farmland_parcels
COMMENT ON COLUMN rsbsa_farmland_parcels.id IS 'Unique identifier for the farmland parcel';
COMMENT ON COLUMN rsbsa_farmland_parcels.submission_id IS 'Reference to the RSBSA submission';
COMMENT ON COLUMN rsbsa_farmland_parcels.parcel_number IS 'Parcel number or identifier';
COMMENT ON COLUMN rsbsa_farmland_parcels.farm_location_barangay IS 'Barangay where the farm is located';
COMMENT ON COLUMN rsbsa_farmland_parcels.farm_location_municipality IS 'Municipality where the farm is located';
COMMENT ON COLUMN rsbsa_farmland_parcels.total_farm_area_ha IS 'Total farm area in hectares';
COMMENT ON COLUMN rsbsa_farmland_parcels.within_ancestral_domain IS 'Whether the farm is within ancestral domain';
COMMENT ON COLUMN rsbsa_farmland_parcels.ownership_document_no IS 'Document number proving ownership';
COMMENT ON COLUMN rsbsa_farmland_parcels.agrarian_reform_beneficiary IS 'Whether the farmer is an agrarian reform beneficiary';
