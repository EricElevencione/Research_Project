-- Populate age values for all existing farmers in the database
-- Assigning reasonable ages based on typical farmer demographics

UPDATE rsbsa_submission SET age = 45 WHERE id = 2;  -- Justine Fournier
UPDATE rsbsa_submission SET age = 52 WHERE id = 4;  -- Marja Ramos
UPDATE rsbsa_submission SET age = 38 WHERE id = 6;  -- Matti Marin
UPDATE rsbsa_submission SET age = 49 WHERE id = 8;  -- Jukka Iglesias
UPDATE rsbsa_submission SET age = 41 WHERE id = 9;  -- Ensio Arendt
UPDATE rsbsa_submission SET age = 55 WHERE id = 11; -- Sakari Sala
UPDATE rsbsa_submission SET age = 47 WHERE id = 12; -- Thomas Thoms

-- Verify the updates
SELECT id, "FIRST NAME", "LAST NAME", age, "BARANGAY" 
FROM rsbsa_submission 
ORDER BY id;

-- Show summary statistics
SELECT 
    COUNT(*) as total_farmers,
    MIN(age) as youngest,
    MAX(age) as oldest,
    ROUND(AVG(age), 1) as average_age
FROM rsbsa_submission 
WHERE age IS NOT NULL;
