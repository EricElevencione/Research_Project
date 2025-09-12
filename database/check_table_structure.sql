-- Check the actual structure of rsbsa_submission table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'rsbsa_submission' 
ORDER BY ordinal_position;
