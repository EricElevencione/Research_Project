-- Add age column to rsbsa_submission table (already exists)
ALTER TABLE rsbsa_submission 
ADD COLUMN IF NOT EXISTS age INTEGER;

-- Calculate and update age for all existing records based on BIRTHDATE
UPDATE rsbsa_submission 
SET age = EXTRACT(YEAR FROM AGE(CURRENT_DATE, "BIRTHDATE"))
WHERE "BIRTHDATE" IS NOT NULL;

-- Show updated records
SELECT id, "FIRST NAME", "LAST NAME", "BIRTHDATE", age 
FROM rsbsa_submission 
WHERE "BIRTHDATE" IS NOT NULL
ORDER BY id
LIMIT 10;
