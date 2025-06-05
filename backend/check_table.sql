-- Check if the table exists and its structure
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check the column names in the masterlist table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'masterlist';

-- Check for the test names with different case variations
SELECT "FIRST NAME" 
FROM masterlist 
WHERE UPPER("FIRST NAME") IN ('SOLANO', 'SERVITA', 'PABULAYAN', 'SUSTIGUER'); 