-- ============================================================================
-- OWNERSHIP TRANSFERS TABLE
-- ============================================================================
-- This table tracks the history of land ownership transfers between farmers.
-- Used when land ownership changes due to inheritance, sale, donation, etc.

CREATE TABLE IF NOT EXISTS ownership_transfers (
    id SERIAL PRIMARY KEY,
    from_farmer_id INTEGER NOT NULL,
    to_farmer_id INTEGER NOT NULL,
    transfer_date DATE NOT NULL,
    transfer_type VARCHAR(100) NOT NULL, -- 'ownership_change', 'inheritance', 'sale', 'donation', 'agrarian_reform'
    transfer_reason TEXT,
    documents JSONB, -- Store uploaded document paths (for future use)
    processed_by INTEGER, -- ID of JO user who processed the transfer (for future use)
    created_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    
    -- Foreign key constraints
    CONSTRAINT fk_from_farmer
        FOREIGN KEY (from_farmer_id) 
        REFERENCES rsbsa_submission(id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_to_farmer
        FOREIGN KEY (to_farmer_id) 
        REFERENCES rsbsa_submission(id)
        ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_from_farmer 
    ON ownership_transfers(from_farmer_id);

CREATE INDEX IF NOT EXISTS idx_ownership_transfers_to_farmer 
    ON ownership_transfers(to_farmer_id);

CREATE INDEX IF NOT EXISTS idx_ownership_transfers_date 
    ON ownership_transfers(transfer_date);

-- Add comment to table
COMMENT ON TABLE ownership_transfers IS 'Tracks land ownership transfer history between farmers';
COMMENT ON COLUMN ownership_transfers.from_farmer_id IS 'ID of the farmer transferring ownership (original owner)';
COMMENT ON COLUMN ownership_transfers.to_farmer_id IS 'ID of the farmer receiving ownership (new owner)';
COMMENT ON COLUMN ownership_transfers.transfer_date IS 'Date when the ownership transfer occurred';
COMMENT ON COLUMN ownership_transfers.transfer_type IS 'Type of transfer: ownership_change, inheritance, sale, donation, agrarian_reform';
COMMENT ON COLUMN ownership_transfers.transfer_reason IS 'Detailed reason for the transfer (free text)';
COMMENT ON COLUMN ownership_transfers.processed_by IS 'ID of the JO user who processed this transfer';

-- Query example to see transfer history for a specific farmer
-- SELECT 
--     ot.id,
--     ot.transfer_date,
--     ot.transfer_type,
--     ot.transfer_reason,
--     old_owner."LAST NAME" || ', ' || old_owner."FIRST NAME" as from_farmer,
--     new_owner."LAST NAME" || ', ' || new_owner."FIRST NAME" as to_farmer
-- FROM ownership_transfers ot
-- JOIN rsbsa_submission old_owner ON ot.from_farmer_id = old_owner.id
-- JOIN rsbsa_submission new_owner ON ot.to_farmer_id = new_owner.id
-- WHERE ot.from_farmer_id = [FARMER_ID] OR ot.to_farmer_id = [FARMER_ID]
-- ORDER BY ot.transfer_date DESC;
