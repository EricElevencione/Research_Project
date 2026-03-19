-- ============================================================================
-- ADD ALLOCATION_ID TO FARMER_REQUESTS
-- ============================================================================
-- Problem: Farmer requests are only linked by season (e.g., "dry_2026"),
-- not by specific allocation ID. When there are multiple allocations for
-- the same season (e.g., two dry_2026 allocations on different dates),
-- ALL farmers appear in BOTH allocations.
--
-- Real-world scenario:
-- - Allocation 1: Dry 2026 January 17 (receives 1000 bags fertilizer)
-- - Allocation 2: Dry 2026 May 19 (receives 800 bags additional fertilizer)
-- - Farmer John registered to Allocation 1 incorrectly shows in Allocation 2
--
-- Solution: Add allocation_id foreign key to link each request to a specific
-- allocation, not just the season.
-- ============================================================================

-- Step 1: Add the allocation_id column
ALTER TABLE farmer_requests 
ADD COLUMN IF NOT EXISTS allocation_id INTEGER;

-- Step 2: Add foreign key constraint
ALTER TABLE farmer_requests 
ADD CONSTRAINT fk_farmer_requests_allocation 
FOREIGN KEY (allocation_id) REFERENCES regional_allocations(id) 
ON DELETE CASCADE;

-- Step 3: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_farmer_requests_allocation_id 
ON farmer_requests(allocation_id);

-- Step 4: Update existing data (assign to first matching allocation by season)
-- This handles legacy requests that don't have allocation_id yet
UPDATE farmer_requests fr
SET allocation_id = (
    SELECT ra.id 
    FROM regional_allocations ra 
    WHERE ra.season = fr.season 
    ORDER BY ra.allocation_date ASC 
    LIMIT 1
)
WHERE allocation_id IS NULL;

-- Step 5: Verify the changes
SELECT 
    fr.id,
    fr.farmer_name,
    fr.season,
    fr.allocation_id,
    ra.allocation_date,
    ra.notes
FROM farmer_requests fr
LEFT JOIN regional_allocations ra ON fr.allocation_id = ra.id
ORDER BY fr.id DESC
LIMIT 10;

-- Step 6: Check for any requests without allocation_id (should be none after Step 4)
SELECT COUNT(*) as requests_without_allocation
FROM farmer_requests
WHERE allocation_id IS NULL;
