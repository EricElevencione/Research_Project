-- ============================================================================
-- ALLOW MULTIPLE ALLOCATIONS PER SEASON
-- ============================================================================
-- Problem: The unique constraint on 'season' prevents creating multiple
-- allocations for the same season (e.g., multiple wet_2026 allocations).
--
-- Real-world scenario: You might receive multiple batches/tranches of
-- fertilizer and seeds during the same season from the Regional Office.
--
-- Solution: Remove the unique constraint on season field.
-- Allocations can be differentiated by:
-- - allocation_date (different dates)
-- - notes (e.g., "First batch", "Second tranche", etc.)
-- - id (unique allocation ID)
-- ============================================================================

-- Drop the unique constraint on season
ALTER TABLE regional_allocations 
DROP CONSTRAINT IF EXISTS unique_season;

-- Verify the constraint was dropped
SELECT 
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'regional_allocations'::regclass;

-- Optional: Add a descriptive batch_name or tranche field for clarity
-- Uncomment if you want to add this field:
-- ALTER TABLE regional_allocations 
-- ADD COLUMN IF NOT EXISTS batch_name VARCHAR(100);

-- Example: Now you can create multiple allocations for the same season
-- INSERT INTO regional_allocations (season, allocation_date, notes, urea_46_0_0_bags) 
-- VALUES 
--     ('wet_2026', '2026-05-01', 'First batch - early season', 1000),
--     ('wet_2026', '2026-07-15', 'Second batch - mid season', 800);
