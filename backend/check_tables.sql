-- List all tables in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- List all tables that might be related to uploads
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ILIKE '%upload%'; 