-- ========================================
-- PGADMIN CLEANUP SCRIPT
-- ========================================
-- Deletes all farmer data, keeps users & barangay codes
-- Designed for direct execution in pgAdmin
-- ========================================

-- Show what will be deleted
SELECT 
    'BEFORE CLEANUP' as status,
    (SELECT COUNT(*) FROM rsbsa_submission) as farmers,
    (SELECT COUNT(*) FROM rsbsa_farm_parcels) as parcels,
    (SELECT COUNT(*) FROM land_history) as history_records,
    (SELECT COUNT(*) FROM ownership_transfers) as transfers,
    (SELECT COUNT(*) FROM users) as users_kept,
    (SELECT COUNT(*) FROM barangay_codes) as barangay_codes_kept;

-- ========================================
-- DELETE FARMER DATA
-- ========================================

-- Step 1: Disable triggers temporarily
SET session_replication_role = replica;

-- Step 2: Delete data (order matters due to foreign keys)
DELETE FROM ownership_transfers;
DELETE FROM incentive_distribution_log;
DELETE FROM land_history;
DELETE FROM rsbsa_farm_parcels;
DELETE FROM farm_parcels;
DELETE FROM rsbsa_submission;
DELETE FROM rsbsaform;
DELETE FROM masterlist;
DELETE FROM barangay_farmer_counters;

-- Step 3: Reset ID sequences
ALTER SEQUENCE rsbsa_submission_id_seq RESTART WITH 1;
ALTER SEQUENCE rsbsa_farm_parcels_id_seq RESTART WITH 1;
ALTER SEQUENCE rsbsaform_id_seq RESTART WITH 1;
ALTER SEQUENCE masterlist_id_seq RESTART WITH 1;
ALTER SEQUENCE land_history_id_seq RESTART WITH 1;
ALTER SEQUENCE ownership_transfers_id_seq RESTART WITH 1;
ALTER SEQUENCE incentive_distribution_log_id_seq RESTART WITH 1;
ALTER SEQUENCE farm_parcels_id_seq RESTART WITH 1;

-- Step 4: Re-enable triggers
SET session_replication_role = DEFAULT;

-- ========================================
-- VERIFICATION
-- ========================================

SELECT 
    '✅ CLEANUP COMPLETE!' as status,
    (SELECT COUNT(*) FROM rsbsa_submission) as farmers_remaining,
    (SELECT COUNT(*) FROM rsbsa_farm_parcels) as parcels_remaining,
    (SELECT COUNT(*) FROM land_history) as history_remaining,
    (SELECT COUNT(*) FROM users) as users_preserved,
    (SELECT COUNT(*) FROM barangay_codes) as barangay_codes_preserved;

-- Show preserved user accounts
SELECT 
    '👥 PRESERVED USERS' as info,
    username,
    role,
    email
FROM users
ORDER BY role, username;

-- ========================================
-- SUMMARY
-- ========================================

SELECT 
    '✅ Deleted: All farmer records' as summary
UNION ALL SELECT '✅ Deleted: All farm parcels'
UNION ALL SELECT '✅ Deleted: All land history'
UNION ALL SELECT '✅ Deleted: All ownership transfers'
UNION ALL SELECT '✅ Deleted: All incentive logs'
UNION ALL SELECT '✅ Preserved: User accounts'
UNION ALL SELECT '✅ Preserved: Barangay codes'
UNION ALL SELECT '✅ Reset: All ID sequences to 1';
