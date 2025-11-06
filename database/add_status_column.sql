-- First check if status column exists
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rsbsa_submission' 
        AND column_name = 'status'
    ) THEN
        -- Add status column if it doesn't exist
        ALTER TABLE rsbsa_submission 
        ADD COLUMN status VARCHAR(20) DEFAULT 'Not Active';

        -- Update existing rows to have a default status
        UPDATE rsbsa_submission 
        SET status = 'Not Active' 
        WHERE status IS NULL;
    END IF;
END $$;