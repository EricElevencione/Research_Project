-- Create rsbsa_submission table for storing final RSBSA form submissions
CREATE TABLE IF NOT EXISTS rsbsa_submission (
    id BIGSERIAL PRIMARY KEY,
    data JSONB NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on the submitted_at column for better query performance
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_submitted_at ON rsbsa_submission(submitted_at);

-- Add a comment to the table
COMMENT ON TABLE rsbsa_submission IS 'Stores final submitted RSBSA forms';
COMMENT ON COLUMN rsbsa_submission.id IS 'Unique identifier for the submission';
COMMENT ON COLUMN rsbsa_submission.data IS 'JSON data containing the form fields';
COMMENT ON COLUMN rsbsa_submission.submitted_at IS 'Timestamp when the form was submitted';
