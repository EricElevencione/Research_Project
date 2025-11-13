-- ========================================
-- QUICK DELETE - FARMER DATA ONLY
-- ========================================
-- This script IMMEDIATELY deletes all farmer data
-- NO ROLLBACK - USE WITH CAUTION!
-- ========================================

-- Disable triggers
SET session_replication_role = replica;

-- Delete in correct order (foreign keys)
TRUNCATE TABLE ownership_transfers CASCADE;
TRUNCATE TABLE incentive_distribution_log CASCADE;
TRUNCATE TABLE land_history CASCADE;
TRUNCATE TABLE rsbsa_farm_parcels CASCADE;
TRUNCATE TABLE farm_parcels CASCADE;
TRUNCATE TABLE rsbsa_submission CASCADE;
TRUNCATE TABLE rsbsaform CASCADE;
TRUNCATE TABLE masterlist CASCADE;
TRUNCATE TABLE barangay_farmer_counters CASCADE;

-- Reset sequences
ALTER SEQUENCE rsbsa_submission_id_seq RESTART WITH 1;
ALTER SEQUENCE rsbsa_farm_parcels_id_seq RESTART WITH 1;
ALTER SEQUENCE rsbsaform_id_seq RESTART WITH 1;
ALTER SEQUENCE masterlist_id_seq RESTART WITH 1;
ALTER SEQUENCE land_history_id_seq RESTART WITH 1;
ALTER SEQUENCE ownership_transfers_id_seq RESTART WITH 1;
ALTER SEQUENCE incentive_distribution_log_id_seq RESTART WITH 1;
ALTER SEQUENCE farm_parcels_id_seq RESTART WITH 1;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Verify
SELECT 
    'rsbsa_submission' as table_name, COUNT(*) as remaining_rows FROM rsbsa_submission
UNION ALL SELECT 'rsbsa_farm_parcels', COUNT(*) FROM rsbsa_farm_parcels
UNION ALL SELECT 'masterlist', COUNT(*) FROM masterlist
UNION ALL SELECT 'land_history', COUNT(*) FROM land_history
UNION ALL SELECT 'ownership_transfers', COUNT(*) FROM ownership_transfers;

-- Done
SELECT '✅ ALL FARMER DATA DELETED!' as status;
