-- Delete test data from masterlist table
DELETE FROM masterlist 
WHERE "FIRST NAME" IN (
    'SOLANO',
    'SERVITA',
    'PABULAYAN',
    'SUSTIGUER',
    'Solano',
    'Servita',
    'Pabulayan',
    'Sustiguer',
    'solano',
    'servita',
    'pabulayan',
    'sustiguer'
);

-- Verify the deletion
SELECT "FIRST NAME" 
FROM masterlist 
WHERE UPPER("FIRST NAME") IN ('SOLANO', 'SERVITA', 'PABULAYAN', 'SUSTIGUER'); 