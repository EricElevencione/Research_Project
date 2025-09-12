-- Create rsbsa_draft table for storing draft RSBSA forms
CREATE TABLE IF NOT EXISTS rsbsa_draft (
    id BIGSERIAL PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on the created_at column for better query performance
CREATE INDEX IF NOT EXISTS idx_rsbsa_draft_created_at ON rsbsa_draft(created_at);

-- Create an index on the updated_at column for better query performance
CREATE INDEX IF NOT EXISTS idx_rsbsa_draft_updated_at ON rsbsa_draft(updated_at);

-- Optional: Create a GIN index on the JSONB data column for better JSON query performance
CREATE INDEX IF NOT EXISTS idx_rsbsa_draft_data ON rsbsa_draft USING GIN (data);

-- Add a comment to the table
COMMENT ON TABLE rsbsa_draft IS 'Stores draft RSBSA forms before final submission';
COMMENT ON COLUMN rsbsa_draft.id IS 'Unique identifier for the draft';
COMMENT ON COLUMN rsbsa_draft.data IS 'JSON data containing the form fields';
COMMENT ON COLUMN rsbsa_draft.created_at IS 'Timestamp when the draft was first created';
COMMENT ON COLUMN rsbsa_draft.updated_at IS 'Timestamp when the draft was last updated';
