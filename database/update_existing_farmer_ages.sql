-- Script to update age for all existing farmers in the database
-- This calculates age based on the BIRTHDATE column

-- First, let's see how many records need updating
SELECT COUNT(*) as total_farmers, 
       COUNT("BIRTHDATE") as with_birthdate,
       COUNT(age) as with_age
FROM rsbsa_submission;

-- Update age for all records that have a birthdate
UPDATE rsbsa_submission 
SET age = EXTRACT(YEAR FROM AGE(CURRENT_DATE, "BIRTHDATE"))
WHERE "BIRTHDATE" IS NOT NULL;

-- Show summary of updated records
SELECT 
    COUNT(*) as total_updated,
    MIN(age) as youngest_age,
    MAX(age) as oldest_age,
    ROUND(AVG(age), 1) as average_age
FROM rsbsa_submission 
WHERE age IS NOT NULL;

-- Show sample of updated farmers
SELECT 
    id,
    "FIRST NAME" || ' ' || "LAST NAME" as farmer_name,
    "BIRTHDATE",
    age,
    "BARANGAY"
FROM rsbsa_submission 
WHERE age IS NOT NULL
ORDER BY id
LIMIT 20;
