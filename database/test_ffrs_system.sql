-- ============================================================================
-- FFRS SYSTEM TEST SCRIPT
-- ============================================================================
-- This script helps you verify that the FFRS system is working correctly
-- ============================================================================

-- 1. CHECK IF FFRS_CODE COLUMN EXISTS
-- ============================================================================
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'rsbsa_submission' 
  AND column_name = 'FFRS_CODE';

-- Expected: Should return 1 row showing FFRS_CODE column exists

-- 2. CHECK IF COUNTER TABLE EXISTS
-- ============================================================================
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ffrs_counter'
);

-- Expected: Should return 't' (true)

-- 3. VIEW CURRENT COUNTER VALUES
-- ============================================================================
SELECT 
    barangay_code,
    current_count,
    CASE barangay_code
        WHEN '001' THEN 'Balabag'
        WHEN '002' THEN 'Bantud Fabrica'
        WHEN '003' THEN 'Bantud Ilaud'
        WHEN '004' THEN 'Bantud Ilaya'
        WHEN '005' THEN 'Bilao'
        WHEN '006' THEN 'Bolilao'
        WHEN '007' THEN 'Calao'
        WHEN '008' THEN 'Capaliz'
        WHEN '009' THEN 'Cayos'
        WHEN '010' THEN 'Dacutan'
        WHEN '011' THEN 'Dulangan'
        WHEN '012' THEN 'Dungon'
        WHEN '013' THEN 'Ilaya 1st'
        WHEN '014' THEN 'Ilaya 2nd'
        WHEN '015' THEN 'Jardin'
        WHEN '016' THEN 'Lonoy'
        WHEN '017' THEN 'Manggalag'
        WHEN '018' THEN 'Mauguic'
        WHEN '019' THEN 'Pandan'
        WHEN '020' THEN 'Poblacion'
        WHEN '021' THEN 'Sapao'
        WHEN '022' THEN 'Sua'
        WHEN '023' THEN 'Suguidan'
        WHEN '024' THEN 'Tabucan'
        WHEN '025' THEN 'Talusan'
        WHEN '026' THEN 'Tigbawan'
        WHEN '027' THEN 'Tuburan'
        WHEN '028' THEN 'Tumcon Ilaya'
        WHEN '029' THEN 'Tumcon Ilawod'
        ELSE 'Unknown'
    END as barangay_name
FROM ffrs_counter
ORDER BY barangay_code;

-- Expected: Should show counter values for each barangay that has farmers

-- 4. CHECK IF ALL FARMERS HAVE FFRS CODES
-- ============================================================================
SELECT 
    COUNT(*) as total_farmers,
    COUNT("FFRS_CODE") as farmers_with_code,
    COUNT(*) - COUNT("FFRS_CODE") as farmers_without_code
FROM rsbsa_submission;

-- Expected: farmers_without_code should be 0

-- 5. VIEW SAMPLE FFRS CODES
-- ============================================================================
SELECT 
    "FFRS_CODE",
    "BARANGAY",
    "FIRST NAME",
    "LAST NAME",
    created_at
FROM rsbsa_submission
WHERE "FFRS_CODE" IS NOT NULL
ORDER BY "FFRS_CODE"
LIMIT 20;

-- Expected: Should show FFRS codes in format 06-30-18-XXX-YYYYYY

-- 6. VERIFY SEQUENTIAL NUMBERING PER BARANGAY
-- ============================================================================
SELECT 
    "BARANGAY",
    COUNT(*) as total_farmers,
    MIN("FFRS_CODE") as first_code,
    MAX("FFRS_CODE") as last_code,
    MIN(CAST(SUBSTRING("FFRS_CODE", 12) AS INTEGER)) as first_number,
    MAX(CAST(SUBSTRING("FFRS_CODE", 12) AS INTEGER)) as last_number
FROM rsbsa_submission
WHERE "FFRS_CODE" IS NOT NULL
GROUP BY "BARANGAY"
ORDER BY "BARANGAY";

-- Expected: Numbers should be sequential from 1 to total_farmers for each barangay

-- 7. CHECK FOR DUPLICATE FFRS CODES
-- ============================================================================
SELECT 
    "FFRS_CODE",
    COUNT(*) as duplicate_count
FROM rsbsa_submission
WHERE "FFRS_CODE" IS NOT NULL
GROUP BY "FFRS_CODE"
HAVING COUNT(*) > 1;

-- Expected: Should return 0 rows (no duplicates)

-- 8. VERIFY TRIGGER EXISTS
-- ============================================================================
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_generate_ffrs_code';

-- Expected: Should return 1 row showing the trigger exists

-- 9. TEST FFRS CODE GENERATION FUNCTION
-- ============================================================================
SELECT generate_ffrs_code('Calao') as test_code_1;
SELECT generate_ffrs_code('Poblacion') as test_code_2;
SELECT generate_ffrs_code('Sapao') as test_code_3;

-- Expected: Should return codes in format 06-30-18-XXX-YYYYYY
-- Note: These will increment the counters!

-- 10. SUMMARY STATISTICS
-- ============================================================================
SELECT 
    'Total Farmers' as metric,
    COUNT(*)::TEXT as value
FROM rsbsa_submission
UNION ALL
SELECT 
    'Farmers with FFRS Code' as metric,
    COUNT("FFRS_CODE")::TEXT as value
FROM rsbsa_submission
UNION ALL
SELECT 
    'Farmers without FFRS Code' as metric,
    (COUNT(*) - COUNT("FFRS_CODE"))::TEXT as value
FROM rsbsa_submission
UNION ALL
SELECT 
    'Unique Barangays' as metric,
    COUNT(DISTINCT "BARANGAY")::TEXT as value
FROM rsbsa_submission
WHERE "FFRS_CODE" IS NOT NULL
UNION ALL
SELECT 
    'Active Farmers' as metric,
    COUNT(*)::TEXT as value
FROM rsbsa_submission
WHERE status = 'Active Farmer';

-- ============================================================================
-- TEST COMPLETE
-- ============================================================================
-- Review the results above. All tests should pass with expected values.
-- If any test fails, check the FFRS_REIMPLEMENTATION_GUIDE.md for solutions.
-- ============================================================================
