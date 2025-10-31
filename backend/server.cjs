const express = require('express'); // Import express
const { Pool } = require('pg'); // Import pg Pool
const cors = require('cors'); // Import cors
const path = require('path'); // Import path
const multer = require('multer'); // Import multer
const XLSX = require('xlsx');   // Import xlsx
const fs = require('fs');       // Import file system module for cleanup
const bcrypt = require('bcrypt'); // Add at the top if not present

const app = express();
const port = process.env.PORT || 5000;

console.log('server.cjs is running and loaded');

// Set up multer for file uploads
// Configure destination and filename if needed, or use default temp directory
const upload = multer({ dest: 'uploads/' }); // Files will be temporarily stored here

// Database connection configuration
const pool = new Pool({
    user: process.env.DB_USER || 'postgres', // Replace with your database username
    host: process.env.DB_HOST || 'localhost', // Replace with your database host
    database: process.env.DB_NAME || 'Masterlist', // Replace with your database name
    password: process.env.DB_PASSWORD || 'postgresadmin', // Replace with your database password 
    // password: process.env.DB_PASSWORD || 'postgresadmin', 
    port: process.env.DB_PORT || 5432, // Replace with your database port
});

// Test database connection
pool.connect((err, client, release) => { // Connect to the database
    if (err) {
        console.error('Error connecting to the database:', err); // Log the error
        return;
    }
    console.log('Successfully connected to database');
    release();
});

// Middleware
// In production, frontend is served statically, so CORS is only needed for API calls from other origins if applicable
// For this setup where backend serves frontend, cors() might not be strictly needed for the served files
app.use(cors()); // Allows cross-origin requests (can be configured more restrictively)
app.use(express.json()); // Parses incoming JSON requests

// Get landowners endpoint (from structured rsbsa_submission)
app.get('/api/landowners', async (req, res) => {
    try {
        // Check existence of tables and columns for robust querying
        const tableExists = async (tableName) => {
            const q = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = $1
                ) AS exists;
            `;
            const r = await pool.query(q, [tableName]);
            return !!r.rows?.[0]?.exists;
        };

        const rsbsaExists = await tableExists('rsbsa_submission');
        if (!rsbsaExists) {
            return res.json([]);
        }

        const columnsResult = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'rsbsa_submission'
        `);
        const columnNames = columnsResult.rows.map(r => r.column_name);
        const hasLast = columnNames.includes('LAST NAME');
        const hasFirst = columnNames.includes('FIRST NAME');
        const hasMiddle = columnNames.includes('MIDDLE NAME');
        const hasExt = columnNames.includes('EXT NAME');
        const hasOwnerFlag = columnNames.includes('OWNERSHIP_TYPE_REGISTERED_OWNER');

        const farmParcelsExists = await tableExists('farm_parcels');

        const subSelects = [];

        // Build SELECT for parcels path if table exists
        if (farmParcelsExists && hasLast && hasFirst) {
            subSelects.push(`
                SELECT DISTINCT
                    rs.id,
                    TRIM(BOTH ', ' FROM (
                        COALESCE(rs."LAST NAME", '') || ', ' || COALESCE(rs."FIRST NAME", '') ||
                        ${hasMiddle ? `CASE WHEN COALESCE(rs."MIDDLE NAME", '') <> '' THEN ' ' || rs."MIDDLE NAME" ELSE '' END ||` : `'' ||`}
                        ${hasExt ? `CASE WHEN COALESCE(rs."EXT NAME", '') <> '' THEN ' ' || rs."EXT NAME" ELSE '' END` : `''`}
                    )) AS name
                FROM rsbsa_submission rs
                WHERE EXISTS (
                    SELECT 1 FROM farm_parcels fp
                    WHERE fp.submission_id = rs.id
                      AND COALESCE(fp.ownership_type_registered_owner, false) = true
                )
                  AND LENGTH(TRIM(BOTH ' ' FROM (
                        COALESCE(rs."LAST NAME", '') || COALESCE(rs."FIRST NAME", '')
                  ))) > 0
            `);
        }

        // Build SELECT for submission-level flag if column exists
        if (hasOwnerFlag && hasLast && hasFirst) {
            subSelects.push(`
                SELECT DISTINCT
                    id,
                    TRIM(BOTH ', ' FROM (
                        COALESCE("LAST NAME", '') || ', ' || COALESCE("FIRST NAME", '') ||
                        ${hasMiddle ? `CASE WHEN COALESCE("MIDDLE NAME", '') <> '' THEN ' ' || "MIDDLE NAME" ELSE '' END ||` : `'' ||`}
                        ${hasExt ? `CASE WHEN COALESCE("EXT NAME", '') <> '' THEN ' ' || "EXT NAME" ELSE '' END` : `''`}
                    )) AS name
                FROM rsbsa_submission
                WHERE COALESCE("OWNERSHIP_TYPE_REGISTERED_OWNER", false) = true
                  AND LENGTH(TRIM(BOTH ' ' FROM (
                        COALESCE("LAST NAME", '') || COALESCE("FIRST NAME", '')
                  ))) > 0
            `);
        }

        if (!subSelects.length) {
            // Not enough structure to build names
            return res.json([]);
        }

        const finalQuery = `
            SELECT DISTINCT id, name
            FROM (
                ${subSelects.join('\n                UNION ALL\n')}
            ) owners
            WHERE name IS NOT NULL AND name <> ''
            ORDER BY name;
        `;

        const result = await pool.query(finalQuery);
        res.json(result.rows || []);
    } catch (error) {
        console.error('Error fetching landowners:', error);
        res.status(500).json({ error: 'Failed to fetch landowners' });
    }
});

// Delete RSBSA record endpoint
app.delete('/api/rsbsa_submission/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Convert string ID to integer for PostgreSQL
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
            return res.status(400).json({
                error: 'Invalid ID format',
                message: 'The provided ID must be a number'
            });
        }

        const result = await pool.query(
            'DELETE FROM rsbsa_submission WHERE id = $1 RETURNING *',
            [numericId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                error: 'Record not found',
                message: 'The specified RSBSA record was not found.'
            });
        }

        res.json({
            message: 'Record deleted successfully',
            deletedRecord: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({
            error: 'Database error',
            message: 'Failed to delete the record'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => { // Health check
    res.json({
        status: 'OK', // Status
        message: 'Server is running', // Custom message
        timestamp: new Date().toISOString() // Current timestamp
    });
});

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) as count FROM rsbsaform');
        res.json({
            status: 'OK',
            message: 'Database connection successful',
            recordCount: result.rows[0].count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Serve static files from the frontend build directory
const frontendBuildPath = path.join(__dirname, '../dist'); // Assuming 'dist' is in the project root
app.use(express.static(frontendBuildPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API endpoint to get land records for the table
app.get('/api/lands', async (req, res) => { // Get land records in the table
    try {
        console.log('Attempting to fetch land records...'); // Log a message

        // First, let's check what columns actually exist in the table
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'masterlist'
            ORDER BY ordinal_position;
        `);

        // Then try to fetch the data with the updated column names
        const result = await pool.query(`
            SELECT 
                "LAST NAME", 
                "FIRST NAME", 
                "MIDDLE NAME", 
                "EXT NAME", 
                "GENDER", 
                "BIRTHDATE", 
                "FARMER ADDRESS 1", 
                "FARMER ADDRESS 2", 
                "FARMER ADDRESS 3", 
                "PARCEL NO.", 
                "PARCEL ADDRESS", 
                "PARCEL AREA" 
            FROM public."masterlist"
        `);

        // Set proper content type
        res.setHeader('Content-Type', 'application/json'); // Set the content type
        res.json(result.rows); // Send the rows as the response
    } catch (err) {
        console.error('Detailed error in /api/lands:', err); // Log the error
        console.error('Error stack:', err.stack); // Log the stack
        res.status(500).json({
            error: 'Server Error',
            details: err.message,
            stack: err.stack
        });
    }
});


// Registration endpoint for admin and technician
app.post('/api/register', async (req, res) => {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password || !role) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    // Username format validation
    if (role === 'admin' && !username.endsWith('.dev')) {
        return res.status(400).json({ message: 'Admin username must end with .dev' });
    }
    if (role === 'technician' && !username.endsWith('.tech')) {
        return res.status(400).json({ message: 'Technician username must end with .tech' });
    }
    if (role === 'jo' && !username.endsWith('.jo')) {
        return res.status(400).json({ message: 'JO username must end with .jo' });
    }
    if (!['admin', 'technician', 'jo'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role.' });
    }
    try {
        // Check for duplicate username or email
        const userCheck = await pool.query('SELECT 1 FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (userCheck.rowCount > 0) {
            return res.status(409).json({ message: 'Username or email already exists.' });
        }
        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);
        // Insert user
        await pool.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
            [username, email, password_hash, role]
        );
        res.status(201).json({ message: 'Registration successful.' });
    } catch (err) {
        console.error('Error in /api/register:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

/*
Purpose: Login endpoint
Where: 
Description: This endpoint handles user login.
*/
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userResult.rowCount === 0) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        const user = userResult.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        // On success, return user info (excluding password)
        res.json({
            message: 'Login successful.',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                created_at: user.created_at
            }
        });
    } catch (err) {
        console.error('Error in /api/login:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET endpoint to fetch RSBSA form data

// DELETE endpoint to delete a farm parcel


/*
Purpose: Fetches all Registered Owners from RSBSAform
Where: Used in backend API route '/api/registered-owners' in server.cjs
Description: This endpoint fetches all Registered Owners from the RSBSAform table.
*/
app.get('/api/registered-owners', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, first_name, middle_name, surname, address_barangay, address_municipality, address_province
            FROM rsbsaform
            WHERE ownership_type_registered_owner = true
            ORDER BY surname, first_name
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching registered owners:', err);
        res.status(500).json({ error: 'Failed to fetch registered owners' });
    }
});

/*
Purpose: Handles the submission of the final RSBSA form along with multiple farmland parcels. 
Validates data, calculates totals, and stores everything in the database.
Where: Used in backend API route '/api/rsbsa_submission' in server.cjs.
Description: This endpoint handles the submission of the final RSBSA form along with multiple farmland parcels. 
Validates data, calculates totals, and stores everything in the database.
*/
app.post('/api/rsbsa_submission', async (req, res) => {
    const { draftId, data } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // console.log('Received RSBSA submission:', {
        //     draftId,
        //     data: {
        //         ...data,
        //         farmlandParcels: JSON.stringify(data.farmlandParcels, null, 2)
        //     }
        // });

        const totalFarmArea = data.farmlandParcels
            ? data.farmlandParcels.reduce((total, parcel) => {
                const area = parseFloat(parcel.totalFarmAreaHa) || 0;
                return total + area;
            }, 0)
            : 0;

        // Derive FARM LOCATION from the first parcel, if available
        let farmLocation = '';
        if (data.farmlandParcels && data.farmlandParcels.length > 0) {
            const firstParcel = data.farmlandParcels[0];
            farmLocation = `${firstParcel.farmLocationBarangay || ''}, ${firstParcel.farmLocationMunicipality || ''}`.trim();
            if (farmLocation === ',') farmLocation = '';
        }

        // Validate ownership type
        if (data.farmlandParcels && data.farmlandParcels.length > 0) {
            const hasValidOwnershipType = data.farmlandParcels.some(
                parcel =>
                    parcel.ownershipTypeRegisteredOwner ||
                    parcel.ownershipTypeTenant ||
                    parcel.ownershipTypeLessee
            );
            if (!hasValidOwnershipType) {
                throw new Error('At least one parcel must have a valid ownership type (Registered Owner, Tenant, or Lessee)');
            }
        } else {
            throw new Error('At least one farmland parcel is required');
        }

        // Derive ownership types from the first parcel (or adjust logic as needed)
        const firstParcel = data.farmlandParcels && data.farmlandParcels.length > 0 ? data.farmlandParcels[0] : {};
        const ownershipTypeRegisteredOwner = firstParcel.ownershipTypeRegisteredOwner || false;
        const ownershipTypeTenant = firstParcel.ownershipTypeTenant || false;
        const ownershipTypeLessee = firstParcel.ownershipTypeLessee || false;

        // Get all parcel areas and join them with commas
        const parcelAreasArray = data.farmlandParcels
            ? data.farmlandParcels
                .map(parcel => parcel.totalFarmAreaHa ? parseFloat(parcel.totalFarmAreaHa) : null)
                .filter(area => area !== null) // Remove null values
            : [];
        const parcelArea = parcelAreasArray.length > 0 ? parcelAreasArray.join(', ') : null;

        const insertSubmissionQuery = `
            INSERT INTO rsbsa_submission (
                "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE",
                "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "TOTAL FARM AREA",
                "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT",
                "OWNERSHIP_TYPE_LESSEE", status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
            RETURNING id, submitted_at
        `;

        const submissionValues = [
            data.surname || '',
            data.firstName || '',
            data.middleName || '',
            data.extensionName || '',
            data.gender || '',
            data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            data.barangay || '',
            data.municipality || '',
            farmLocation,
            parcelArea, // PARCEL AREA - now uses first parcel's area
            totalFarmArea,
            data.mainLivelihood || '',
            ownershipTypeRegisteredOwner,
            ownershipTypeTenant,
            ownershipTypeLessee,
            'Submitted',
        ];

        const submissionResult = await client.query(insertSubmissionQuery, submissionValues);
        const submissionId = submissionResult.rows[0].id;
        const submittedAt = submissionResult.rows[0].submitted_at;

        if (data.farmlandParcels && data.farmlandParcels.length > 0) {
            const parcelInsertQuery = `
                INSERT INTO rsbsa_farm_parcels (
                    submission_id, parcel_number, farm_location_barangay, farm_location_municipality,
                    total_farm_area_ha, within_ancestral_domain, ownership_document_no,
                    agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant,
                    ownership_type_lessee, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
                )
            `;
            for (let parcel of data.farmlandParcels) {
                try {
                    if (!parcel.farmLocationBarangay || !parcel.totalFarmAreaHa) {
                        console.warn('Skipping parcel due to missing required fields:', parcel);
                        continue;
                    }
                    const area = parseFloat(parcel.totalFarmAreaHa);
                    if (isNaN(area)) throw new Error('Invalid totalFarmAreaHa');
                    await client.query(parcelInsertQuery, [
                        submissionId,
                        parcel.parcelNo || `Parcel-${submissionId}-${data.farmlandParcels.indexOf(parcel) + 1}`,
                        parcel.farmLocationBarangay || '',
                        parcel.farmLocationMunicipality || '',
                        area,
                        parcel.withinAncestralDomain === 'Yes' ? 'Yes' : 'No',  // Fixed: Must be 'Yes' or 'No' string
                        parcel.ownershipDocumentNo || '',
                        parcel.agrarianReformBeneficiary === 'Yes' ? 'Yes' : 'No',  // Fixed: Must be 'Yes' or 'No' string
                        parcel.ownershipTypeRegisteredOwner || false,
                        parcel.ownershipTypeTenant || false,
                        parcel.ownershipTypeLessee || false,
                        parcel.tenantLandOwnerName || '',
                        parcel.lesseeLandOwnerName || '',
                        parcel.ownershipOthersSpecify || '',
                    ]);
                } catch (err) {
                    console.error('Error inserting parcel:', err, 'Parcel data:', parcel);
                    throw err;
                }
            }
        }

        await client.query('COMMIT');
        // console.log(`RSBSA form submitted successfully with ${data.farmlandParcels.length} parcels for farmer: ${data.firstName} ${data.surname}`);
        res.status(201).json({
            message: 'RSBSA form submitted successfully!',
            submissionId: submissionId,
            submittedAt: submittedAt,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting RSBSA form:', error);
        res.status(400).json({
            message: 'Error submitting RSBSA form',
            error: error.message,
        });
    } finally {
        client.release();
    }
});

/*
Purpose: Fetches a summary of farmers along with their parcel counts and total farm area. Useful for overview dashboards or reports.
Where: Used in backend API route '/api/farmers/summary' in server.cjs. Consumed by frontend farmer page/component.
Description: This endpoint fetches a summary of farmers along with their parcel counts and total farm area. 
Handles both legacy JSONB and structured table formats. 
Returns a list of farmers with their details, parcel counts, total farm area, and submission timestamps.
*/
app.get('/api/rsbsa_submission/:id/parcels', async (req, res) => {
    try {
        const submissionId = req.params.id;
        // console.log(`Fetching farm parcels for submission ID: ${submissionId}`);

        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'rsbsa_farm_parcels'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('rsbsa_farm_parcels table does not exist');
            return res.status(500).json({
                message: 'Database error: rsbsa_farm_parcels table not found',
            });
        }

        const query = `
            SELECT 
                id,
                submission_id,
                parcel_number,
                farm_location_barangay,
                farm_location_municipality,
                total_farm_area_ha,
                within_ancestral_domain,
                ownership_document_no,
                agrarian_reform_beneficiary,
                ownership_type_registered_owner,
                ownership_type_tenant,
                ownership_type_lessee,
                tenant_land_owner_name,
                lessee_land_owner_name,
                ownership_others_specify,
                created_at,
                updated_at
            FROM rsbsa_farm_parcels 
            WHERE submission_id = $1
            ORDER BY parcel_number
        `;

        const result = await pool.query(query, [submissionId]);
        console.log(`Found ${result.rows.length} farm parcels for submission ${submissionId}`);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching farm parcels:', error);
        res.status(500).json({ message: 'Error fetching farm parcels', error: error.message });
    }
});

/*
Purpose: Fetches all farm parcels along with associated farmer details. Useful for overview dashboards or reports.
Where: Used in backend API route '/api/rsbsa_farm_parcels' in server.cjs. Consumed by frontend farmer page/component.
Description: This endpoint fetches all farm parcels along with associated farmer details by joining the parcels with submission data. 
Returns a list of parcels with detailed information including farmer names and parcel specifics.
*/
app.get('/api/rsbsa_farm_parcels', async (req, res) => {
    try {
        console.log('Fetching all farm parcels...');

        const query = `
            SELECT 
                fp.id,
                fp.submission_id,
                fp.parcel_number,
                fp.farm_location_barangay,
                fp.farm_location_municipality,
                fp.total_farm_area_ha,
                fp.within_ancestral_domain,
                fp.ownership_document_no,
                fp.agrarian_reform_beneficiary,
                fp.ownership_type_registered_owner,
                fp.ownership_type_tenant,
                fp.ownership_type_lessee,
                fp.ownership_type_others,
                fp.tenant_land_owner_name,
                fp.lessee_land_owner_name,
                fp.ownership_others_specify,
                fp.created_at,
                fp.updated_at,
                rs."LAST NAME",
                rs."FIRST NAME",
                rs."MIDDLE NAME"
            FROM rsbsa_farm_parcels fp
            JOIN rsbsa_submission rs ON fp.submission_id = rs.id
            ORDER BY fp.submission_id, fp.parcel_number
        `;

        const result = await pool.query(query);
        console.log(`Found ${result.rows.length} farm parcels`);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching farm parcels:', error);
        res.status(500).json({ message: 'Error fetching farm parcels', error: error.message });
    }
});

/*
Purpose: Fetches farm parcels associated with a specific farmer identified by their last and first names. Useful for detailed farmer views.
Where: Used in backend API route '/api/rsbsa_farm_parcels/by-farmer' in server.cjs. Consumed by frontend farmer detail page/component.
Description: This endpoint fetches farm parcels associated with a specific farmer identified by their last and first names. 
It joins the parcels with submission data to retrieve farmer details. 
Requires both lastName and firstName as query parameters. Returns a list of parcels with detailed information.
*/
app.get('/api/rsbsa_farm_parcels/by-farmer', async (req, res) => {
    try {
        const { lastName, firstName } = req.query;

        if (!lastName || !firstName) {
            return res.status(400).json({
                message: 'Both lastName and firstName query parameters are required'
            });
        }

        // console.log(`Fetching parcels for farmer: ${firstName} ${lastName}`);

        const query = `
            SELECT 
                fp.id,
                fp.submission_id,
                fp.parcel_number,
                fp.farm_location_barangay,
                fp.farm_location_municipality,
                fp.total_farm_area_ha,
                fp.within_ancestral_domain,
                fp.ownership_document_no,
                fp.agrarian_reform_beneficiary,
                fp.ownership_type_registered_owner,
                fp.ownership_type_tenant,
                fp.ownership_type_lessee,
                fp.ownership_type_others,
                fp.tenant_land_owner_name,
                fp.lessee_land_owner_name,
                fp.ownership_others_specify,
                fp.created_at,
                fp.updated_at,
                rs."LAST NAME",
                rs."FIRST NAME",
                rs."MIDDLE NAME",
                rs."BARANGAY",
                rs."MUNICIPALITY"
            FROM rsbsa_farm_parcels fp
            JOIN rsbsa_submission rs ON fp.submission_id = rs.id
            WHERE rs."LAST NAME" = $1 AND rs."FIRST NAME" = $2
            ORDER BY fp.parcel_number
        `;

        const result = await pool.query(query, [lastName, firstName]);
        // console.log(`Found ${result.rows.length} parcels for farmer: ${firstName} ${lastName}`);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching parcels by farmer:', error);
        res.status(500).json({ message: 'Error fetching parcels by farmer', error: error.message });
    }
});

/*
Purpose: Fetches a summary of farmers along with their parcel counts and total farm area. Useful for overview dashboards or reports.
Where: Used in backend API route '/api/farmers/summary' in server.cjs. Consumed by frontend farmer page/component.
Description: This endpoint fetches a summary of farmers along with their parcel counts and total farm area. Handles both legacy JSONB and structured table formats. 
Returns a list of farmers with their details, parcel counts, total farm area, and submission timestamps.
*/
app.get('/api/farmers/summary', async (req, res) => {
    try {
        // console.log('Fetching farmer summary with parcel counts...');

        const query = `
            SELECT 
                rs.id as submission_id,
                rs."LAST NAME",
                rs."FIRST NAME", 
                rs."MIDDLE NAME",
                rs."BARANGAY",
                rs."MUNICIPALITY",
                COUNT(fp.id) as total_parcels,
                COALESCE(SUM(fp.total_farm_area_ha), 0) as total_farm_area,
                rs.submitted_at
            FROM rsbsa_submission rs
            LEFT JOIN rsbsa_farm_parcels fp ON rs.id = fp.submission_id
            GROUP BY rs.id, rs."LAST NAME", rs."FIRST NAME", rs."MIDDLE NAME", 
                     rs."BARANGAY", rs."MUNICIPALITY", rs.submitted_at
            ORDER BY total_parcels DESC, rs."LAST NAME"
        `;

        const result = await pool.query(query);
        console.log(`Found ${result.rows.length} farmers`);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching farmer summary:', error);
        res.status(500).json({ message: 'Error fetching farmer summary', error: error.message });
    }
});

// GET endpoint to fetch RSBSA submissions for masterlist for the 

/*
Purpose: Fetches RSBSA submissions for the masterlist. Dynamically adapts to table structure (JSONB or structured columns) and transforms results for frontend use.
Where: Used in backend API route '/api/rsbsa_submission' in server.cjs. Consumed by frontend masterlist page/component.
Description: This endpoint checks the database table structure, builds the appropriate query, fetches all RSBSA submissions, and transforms the data to match frontend expectations. 
Handles both legacy JSONB and structured table formats, including ownership type fields if present. Returns a list of submissions with farmer details, parcel info, and status.
*/
app.get('/api/rsbsa_submission', async (req, res) => {
    try {
        // console.log('Fetching RSBSA submissions...');

        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'rsbsa_submission'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('rsbsa_submission table does not exist');
            return res.status(404).json({ // Table not found
                error: 'rsbsa_submission table not found',
                message: 'The rsbsa_submission table does not exist in the database.'
            });
        }
        /*
        Purpose: Fetches RSBSA submissions for the masterlist. Dynamically adapts to table structure (JSONB or structured columns) and transforms results for frontend use.
        Where: Used in backend API route '/api/rsbsa_submission' in server.cjs. Consumed by frontend masterlist page/component.
        Description: This endpoint checks the database table structure, builds the appropriate query, fetches all RSBSA submissions, and transforms the data to match frontend expectations. Handles both legacy JSONB and structured table formats, including ownership type fields if present. Returns a list of submissions with farmer details, parcel info, and status.
        */
        // First, let's check what columns actually exist
        const columnCheckQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'rsbsa_submission' 
            ORDER BY ordinal_position
        `;
        const columnResult = await pool.query(columnCheckQuery);
        // console.log('Available columns:', columnResult.rows.map(row => row.column_name));

        // Check if this is the JSONB version or structured version
        const hasJsonbColumn = columnResult.rows.some(row => row.column_name === 'data'); // This is the JSONB column
        const hasStructuredColumns = columnResult.rows.some(row => row.column_name === 'LAST NAME'); // These are the structured columns
        const hasOwnershipColumns = columnResult.rows.some(row => row.column_name === 'OWNERSHIP_TYPE_REGISTERED_OWNER');

        // console.log('Table structure check:', {
        //     hasJsonbColumn,
        //     hasStructuredColumns,
        //     hasOwnershipColumns
        // });

        let query;
        const hasFFRSCode = columnResult.rows.some(row => row.column_name === 'FFRS_CODE');

        if (hasJsonbColumn && !hasStructuredColumns) {
            // This is the original JSONB table
            // console.log('Using JSONB table structure');
            query = `
                SELECT 
                    id,
                    data,
                    submitted_at,
                    created_at
                FROM rsbsa_submission 
                WHERE data IS NOT NULL 
                ORDER BY submitted_at DESC
            `;
        } else {
            // This is the structured table
            // console.log('Using structured table');
            // Build query dynamically based on available columns
            let selectFields = `
                id,
                "FFRS_CODE" as "referenceNumber",
                "LAST NAME",
                "FIRST NAME", 
                "MIDDLE NAME",
                "EXT NAME",
                "GENDER",
                "BIRTHDATE",
                "BARANGAY",
                "MUNICIPALITY", 
                "FARM LOCATION",
                "PARCEL AREA",
                "TOTAL FARM AREA",
                "MAIN LIVELIHOOD",
                status,
                submitted_at,
                created_at,
                updated_at
            `;

            if (hasOwnershipColumns) {
                selectFields += `,
                "OWNERSHIP_TYPE_REGISTERED_OWNER",
                "OWNERSHIP_TYPE_TENANT",
                "OWNERSHIP_TYPE_LESSEE"`;
            }

            query = `
                SELECT ${selectFields}
                FROM rsbsa_submission 
                WHERE "LAST NAME" IS NOT NULL 
                ORDER BY submitted_at DESC
            `;
        }
        const result = await pool.query(query);
        // console.log(`Found ${result.rows.length} submissions in database`);

        // // Debug: Check ownership type data in raw results
        // if (result.rows.length > 0) {
        //     console.log('Sample raw record:', JSON.stringify(result.rows[0], null, 2));
        //     console.log('Ownership type fields in raw data:', {
        //         registeredOwner: result.rows[0]["OWNERSHIP_TYPE_REGISTERED_OWNER"],
        //         tenant: result.rows[0]["OWNERSHIP_TYPE_TENANT"],
        //         lessee: result.rows[0]["OWNERSHIP_TYPE_LESSEE"]
        //     });
        // }

        // Transform the data to match the frontend's expected format
        const submissions = result.rows.map(row => {
            if (hasJsonbColumn && !hasStructuredColumns) {
                // Handle JSONB data
                const data = row.data;
                const fullName = [data.surname, data.firstName, data.middleName]
                    .filter(Boolean)
                    .join(', ');

                const farmLocation = data.farmlandParcels && data.farmlandParcels.length > 0
                    ? `${data.farmlandParcels[0].farmLocationBarangay || ''}, ${data.farmlandParcels[0].farmLocationMunicipality || ''}`.replace(/^,\s*|,\s*$/g, '')
                    : 'N/A';

                const parcelArea = data.farmlandParcels && data.farmlandParcels.length > 0
                    ? data.farmlandParcels[0].totalFarmAreaHa
                    : 'N/A';

                return {
                    id: row.id,
                    referenceNumber: `RSBSA-${row.id}`,
                    farmerName: fullName || '—',
                    farmerAddress: `${data.barangay || ''}, ${data.municipality || ''}`.replace(/^,\s*|,\s*$/g, '') || '—',
                    farmLocation: farmLocation || '—',
                    gender: data.gender || '—',
                    birthdate: data.dateOfBirth || null,
                    dateSubmitted: row.submitted_at || row.created_at,
                    status: 'Not Active', // Default status for JSONB records
                    parcelArea: parcelArea ? String(parcelArea) : '—',
                    totalFarmArea: 0,
                    landParcel: farmLocation || 'N/A',
                    ownershipType: {
                        registeredOwner: false,
                        tenant: false,
                        lessee: false
                    }
                };
            } else {
                // Handle structured data
                const fullName = [row["LAST NAME"], row["FIRST NAME"], row["MIDDLE NAME"], row["EXT NAME"]]
                    .filter(Boolean)
                    .join(', ');

                const parcelInfo = row["FARM LOCATION"]
                    ? `${row["FARM LOCATION"]}${row["PARCEL AREA"] ? ` (${row["PARCEL AREA"]} ha)` : ''}`
                    : 'N/A';

                const ownershipType = {
                    registeredOwner: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_REGISTERED_OWNER"] : false,
                    tenant: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_TENANT"] : false,
                    lessee: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_LESSEE"] : false
                };

                // console.log(`Processing ${fullName}: ownershipType=`, ownershipType, `(hasOwnershipColumns=${hasOwnershipColumns})`);

                return {
                    id: row.id,
                    referenceNumber: row.referenceNumber || `RSBSA-${row.id}`,
                    farmerName: fullName || '—',
                    farmerAddress: `${row["BARANGAY"] || ''}, ${row["MUNICIPALITY"] || ''}`.replace(/^,\s*|,\s*$/g, '') || '—',
                    farmLocation: row["FARM LOCATION"] || '—',
                    gender: row["GENDER"] || '—',
                    birthdate: row["BIRTHDATE"] || null,
                    dateSubmitted: row.submitted_at || row.created_at,
                    status: row.status || 'Not Active',
                    parcelArea: row["PARCEL AREA"] ? String(row["PARCEL AREA"]) : '—',
                    totalFarmArea: parseFloat(row["TOTAL FARM AREA"]) || 0,
                    landParcel: parcelInfo,
                    ownershipType: ownershipType
                };
            }
        });

        res.json(submissions);
    } catch (error) {
        console.error('Error fetching RSBSA submissions:', error);
        res.status(500).json({
            message: 'Error fetching RSBSA submissions',
            error: error.message
        });
    }
});

// PUT endpoint to update a specific RSBSA submission in technician masterlist 
app.put('/api/rsbsa_submission/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('Updating RSBSA submission:', { id, updateData });

        // Initialize queryValues and updateFields
        let queryValues = [];
        const updateFields = [];
        let paramCounter = 1;

        // Check if only status is provided (e.g., from Masterlist toggle)
        if (Object.keys(updateData).length === 1 && updateData.status) {
            // Validate status
            if (!['Active Farmer', 'Not Active'].includes(updateData.status)) {
                return res.status(400).json({
                    message: 'Invalid status value',
                    error: 'Status must be either "Active Farmer" or "Not Active"'
                });
            }

            // Use simple status update query
            const updateQuery = `
                UPDATE rsbsa_submission 
                SET status = $1, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *;
            `;
            queryValues = [updateData.status, id];

            console.log('Executing status update query:', { query: updateQuery, params: queryValues });

            const result = await pool.query(updateQuery, queryValues);

            if (result.rowCount === 0) {
                return res.status(404).json({
                    message: 'Record not found',
                    error: 'No record found with the provided ID'
                });
            }

            console.log('Status update successful:', result.rows[0]);

            return res.json({
                message: 'Status updated successfully',
                updatedRecord: result.rows[0]
            });
        }

        // For other updates (e.g., RSBSA form updates with multiple fields)
        // Handle status if provided
        if (updateData.status) {
            if (!['Active Farmer', 'Not Active'].includes(updateData.status)) {
                return res.status(400).json({
                    message: 'Invalid status value',
                    error: 'Status must be either "Active Farmer" or "Not Active"'
                });
            }
            updateFields.push(`status = $${paramCounter}`);
            queryValues.push(updateData.status);
            paramCounter++;
        }

        // Handle farmer name components if provided
        if (updateData.farmerName) {
            const nameParts = updateData.farmerName.split(', ');
            const [lName, fName, mName, eName] = nameParts;

            updateFields.push('"LAST NAME" = $' + paramCounter);
            queryValues.push(lName || '');
            paramCounter++;

            updateFields.push('"FIRST NAME" = $' + paramCounter);
            queryValues.push(fName || '');
            paramCounter++;

            updateFields.push('"MIDDLE NAME" = $' + paramCounter);
            queryValues.push(mName || '');
            paramCounter++;

            updateFields.push('"EXT NAME" = $' + paramCounter);
            queryValues.push(eName || '');
            paramCounter++;
        }

        // Handle other fields if provided
        if (updateData.gender) {
            updateFields.push('"GENDER" = $' + paramCounter);
            queryValues.push(updateData.gender);
            paramCounter++;
        }

        if (updateData.birthdate) {
            updateFields.push('"BIRTHDATE" = $' + paramCounter);
            queryValues.push(updateData.birthdate);
            paramCounter++;
        }

        if (updateData.farmLocation) {
            updateFields.push('"FARM LOCATION" = $' + paramCounter);
            queryValues.push(updateData.farmLocation);
            paramCounter++;
        }

        if (updateData.parcelArea) {
            const areaValue = updateData.parcelArea.replace(/\s*hectares\s*$/i, '').trim();
            if (!isNaN(parseFloat(areaValue))) {
                updateFields.push('"PARCEL AREA" = $' + paramCounter);
                queryValues.push(parseFloat(areaValue));
                paramCounter++;
            }
        }

        // If no fields to update, return early
        if (updateFields.length === 0) {
            return res.status(400).json({
                message: 'No valid fields to update',
                error: 'Please provide at least one field to update'
            });
        }

        // Add updated_at timestamp
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        // Construct the dynamic query
        const finalQuery = `
            UPDATE rsbsa_submission 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING *;
        `;

        // Add the ID as the last parameter
        queryValues.push(id);

        console.log('Executing dynamic update query:', { query: finalQuery, params: queryValues });

        // Execute the dynamically constructed query
        const result = await pool.query(finalQuery, queryValues);

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: 'Record not found',
                error: 'No record found with the provided ID'
            });
        }

        console.log('Update successful:', result.rows[0]);

        // Return success response
        res.json({
            message: 'Record updated successfully',
            updatedRecord: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating RSBSA submission:', error);

        // Detailed error logging
        const errorDetails = {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position,
            where: error.where,
            schema: error.schema,
            table: error.table,
            constraint: error.constraint
        };
        console.error('Error details:', errorDetails);

        // Send a more informative error response
        res.status(500).json({
            message: 'Error updating RSBSA submission',
            error: error.message || 'Unknown error occurred',
            details: error.detail || 'No additional details available'
        });
    }
});

// ============================================================================
// PUT endpoint to update a specific farm parcel
// ============================================================================
app.put('/api/rsbsa_farm_parcels/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('Updating farm parcel:', { id, updateData });

        // Build the UPDATE query dynamically based on provided fields
        const allowedFields = [
            'total_farm_area_ha',
            'farm_location_barangay',
            'farm_location_municipality',
            'within_ancestral_domain',
            'ownership_document_no',
            'agrarian_reform_beneficiary',
            'ownership_type_registered_owner',
            'ownership_type_tenant',
            'ownership_type_lessee',
            'tenant_land_owner_name',
            'lessee_land_owner_name',
            'ownership_others_specify'
        ];

        const updateFields = [];
        const queryValues = [];
        let paramCounter = 1;

        // Build SET clause dynamically
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key) && value !== undefined) {
                updateFields.push(`${key} = $${paramCounter}`);
                queryValues.push(value);
                paramCounter++;
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        // Add updated_at timestamp
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        // Add the parcel ID as the last parameter
        queryValues.push(id);

        const updateQuery = `
            UPDATE rsbsa_farm_parcels
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING *;
        `;

        console.log('Executing parcel update query:', { query: updateQuery, params: queryValues });

        const result = await pool.query(updateQuery, queryValues);

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: 'Farm parcel not found',
                parcelId: id
            });
        }

        // After updating parcel, recalculate and update the submission's PARCEL AREA field
        const parcelSubmissionId = result.rows[0].submission_id;

        // Get all parcels for this submission to recalculate the comma-separated list
        const allParcelsResult = await pool.query(`
            SELECT total_farm_area_ha
            FROM rsbsa_farm_parcels
            WHERE submission_id = $1
            ORDER BY parcel_number
        `, [parcelSubmissionId]);

        const parcelAreasArray = allParcelsResult.rows
            .map(p => p.total_farm_area_ha)
            .filter(area => area !== null);

        const newParcelAreaString = parcelAreasArray.join(', ');
        const newTotalFarmArea = parcelAreasArray.reduce((sum, area) => sum + parseFloat(area), 0);

        // Update the submission record
        await pool.query(`
            UPDATE rsbsa_submission
            SET "PARCEL AREA" = $1,
                "TOTAL FARM AREA" = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [newParcelAreaString, newTotalFarmArea, parcelSubmissionId]);

        res.json({
            message: 'Farm parcel updated successfully',
            updatedParcel: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating farm parcel:', error);
        res.status(500).json({
            message: 'Error updating farm parcel',
            error: error.message
        });
    }
});

// ============================================================================
// LAND HISTORY API ENDPOINTS
// ============================================================================
// These endpoints handle land ownership and tenancy history tracking
// ============================================================================

// ============================================================================
// 1. GET CURRENT OWNERSHIP STATUS FOR A SPECIFIC PARCEL
// ============================================================================
// GET /api/land-history/parcel/:parcelId/current
// Returns the current ownership/tenancy information for a farm parcel
app.get('/api/land-history/parcel/:parcelId/current', async (req, res) => {
    try {
        const { parcelId } = req.params;

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.farm_location_municipality,
                lh.total_farm_area_ha,
                lh.land_owner_name,
                lh.land_owner_ffrs_code,
                lh.farmer_name,
                lh.farmer_ffrs_code,
                lh.is_registered_owner,
                lh.is_tenant,
                lh.is_lessee,
                lh.tenant_name,
                lh.lessee_name,
                CASE 
                    WHEN lh.is_registered_owner THEN 'Owner'
                    WHEN lh.is_tenant THEN 'Tenant'
                    WHEN lh.is_lessee THEN 'Lessee'
                    ELSE 'Other'
                END as ownership_status,
                lh.period_start_date,
                lh.ownership_document_no,
                lh.agrarian_reform_beneficiary,
                lh.within_ancestral_domain,
                lh.created_at,
                lh.notes
            FROM land_history lh
            WHERE lh.farm_parcel_id = $1
              AND lh.is_current = TRUE
            LIMIT 1
        `, [parcelId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'No current ownership information found for this parcel',
                parcelId: parcelId
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching current land history:', error);
        res.status(500).json({
            error: 'Failed to fetch current land history',
            details: error.message
        });
    }
});

// ============================================================================
// 2. GET COMPLETE HISTORY FOR A PARCEL
// ============================================================================
// GET /api/land-history/parcel/:parcelId/history
// Returns all historical records (current and past) for a farm parcel
app.get('/api/land-history/parcel/:parcelId/history', async (req, res) => {
    try {
        const { parcelId } = req.params;

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.land_owner_name,
                lh.farmer_name,
                lh.farmer_ffrs_code,
                CASE 
                    WHEN lh.is_registered_owner THEN 'Owner'
                    WHEN lh.is_tenant THEN 'Tenant'
                    WHEN lh.is_lessee THEN 'Lessee'
                    ELSE 'Other'
                END as relationship_type,
                lh.period_start_date,
                lh.period_end_date,
                lh.is_current,
                CASE 
                    WHEN lh.is_current THEN 'Current'
                    ELSE 'Past'
                END as status,
                CASE 
                    WHEN lh.period_end_date IS NOT NULL THEN 
                        EXTRACT(YEAR FROM AGE(lh.period_end_date, lh.period_start_date)) || ' years'
                    ELSE 
                        EXTRACT(YEAR FROM AGE(CURRENT_DATE, lh.period_start_date)) || ' years (ongoing)'
                END as duration,
                lh.change_type,
                lh.change_reason,
                TO_CHAR(lh.period_start_date, 'Month DD, YYYY') as formatted_start_date,
                CASE 
                    WHEN lh.period_end_date IS NULL THEN 'Present'
                    ELSE TO_CHAR(lh.period_end_date, 'Month DD, YYYY')
                END as formatted_end_date
            FROM land_history lh
            WHERE lh.farm_parcel_id = $1
            ORDER BY lh.is_current DESC, lh.period_start_date DESC
        `, [parcelId]);

        res.json({
            parcelId: parcelId,
            totalRecords: result.rows.length,
            currentRecords: result.rows.filter(r => r.is_current).length,
            historicalRecords: result.rows.filter(r => !r.is_current).length,
            history: result.rows
        });
    } catch (error) {
        console.error('Error fetching land history:', error);
        res.status(500).json({
            error: 'Failed to fetch land history',
            details: error.message
        });
    }
});

// ============================================================================
// 3. GET TENANT/LESSEE HISTORY (For Dropdown)
// ============================================================================
// GET /api/land-history/parcel/:parcelId/tenants
// Returns list of all tenants/lessees who have farmed this parcel
// Perfect for populating dropdown menus
app.get('/api/land-history/parcel/:parcelId/tenants', async (req, res) => {
    try {
        const { parcelId } = req.params;

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farmer_name as name,
                lh.farmer_ffrs_code as ffrs_code,
                CASE 
                    WHEN lh.is_tenant THEN 'Tenant'
                    WHEN lh.is_lessee THEN 'Lessee'
                    ELSE 'Other'
                END as type,
                TO_CHAR(lh.period_start_date, 'YYYY-MM-DD') as start_date,
                CASE 
                    WHEN lh.period_end_date IS NOT NULL THEN TO_CHAR(lh.period_end_date, 'YYYY-MM-DD')
                    ELSE NULL
                END as end_date,
                lh.is_current,
                CASE 
                    WHEN lh.period_end_date IS NOT NULL THEN 
                        TO_CHAR(lh.period_start_date, 'Mon YYYY') || ' to ' || TO_CHAR(lh.period_end_date, 'Mon YYYY')
                    ELSE 
                        TO_CHAR(lh.period_start_date, 'Mon YYYY') || ' to Present'
                END as period_display,
                CASE 
                    WHEN lh.period_end_date IS NOT NULL THEN 
                        EXTRACT(YEAR FROM AGE(lh.period_end_date, lh.period_start_date))::INTEGER
                    ELSE 
                        EXTRACT(YEAR FROM AGE(CURRENT_DATE, lh.period_start_date))::INTEGER
                END as years_duration
            FROM land_history lh
            WHERE lh.farm_parcel_id = $1
              AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
            ORDER BY lh.is_current DESC, lh.period_start_date DESC
        `, [parcelId]);

        res.json({
            parcelId: parcelId,
            count: result.rows.length,
            tenants: result.rows
        });
    } catch (error) {
        console.error('Error fetching tenant history:', error);
        res.status(500).json({
            error: 'Failed to fetch tenant history',
            details: error.message
        });
    }
});

// ============================================================================
// 4. GET ALL LANDS OWNED BY A SPECIFIC PERSON
// ============================================================================
// GET /api/land-history/owner/:ownerName
// Returns all lands where the specified person is the legal owner
app.get('/api/land-history/owner/:ownerName', async (req, res) => {
    try {
        const { ownerName } = req.params;

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.farm_location_municipality,
                lh.total_farm_area_ha,
                lh.land_owner_name,
                lh.farmer_name,
                lh.farmer_ffrs_code,
                CASE 
                    WHEN lh.farmer_name = lh.land_owner_name THEN 'Self-Farmed'
                    WHEN lh.is_tenant THEN 'Rented to Tenant'
                    WHEN lh.is_lessee THEN 'Leased to Lessee'
                    ELSE 'Other Arrangement'
                END as farming_arrangement,
                lh.period_start_date,
                lh.ownership_document_no,
                lh.total_farm_area_ha,
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, lh.period_start_date))::INTEGER as years_owned
            FROM land_history lh
            WHERE lh.land_owner_name ILIKE $1
              AND lh.is_current = TRUE
            ORDER BY lh.farm_location_barangay, lh.parcel_number
        `, [`%${ownerName}%`]);

        // Calculate summary statistics
        const totalArea = result.rows.reduce((sum, row) => sum + parseFloat(row.total_farm_area_ha || 0), 0);
        const selfFarmedCount = result.rows.filter(r => r.farming_arrangement === 'Self-Farmed').length;
        const rentedOutCount = result.rows.filter(r => r.farming_arrangement.includes('Rented') || r.farming_arrangement.includes('Leased')).length;

        res.json({
            ownerName: ownerName,
            totalParcels: result.rows.length,
            totalArea: totalArea.toFixed(2),
            selfFarmedParcels: selfFarmedCount,
            rentedOutParcels: rentedOutCount,
            parcels: result.rows
        });
    } catch (error) {
        console.error('Error fetching owner lands:', error);
        res.status(500).json({
            error: 'Failed to fetch owner lands',
            details: error.message
        });
    }
});

// ============================================================================
// 5. GET LIST OF ALL LAND OWNERS
// ============================================================================
// GET /api/land-history/owners
// Returns unique list of all land owners with summary statistics
app.get('/api/land-history/owners', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                lh.land_owner_name as name,
                lh.land_owner_ffrs_code as ffrs_code,
                COUNT(DISTINCT lh.farm_parcel_id)::INTEGER as parcel_count,
                SUM(lh.total_farm_area_ha)::NUMERIC(10,2) as total_area_ha,
                STRING_AGG(DISTINCT lh.farm_location_barangay, ', ') as barangays,
                MIN(lh.period_start_date) as earliest_ownership_date,
                SUM(CASE WHEN lh.farmer_name = lh.land_owner_name THEN 1 ELSE 0 END)::INTEGER as self_farmed_count,
                SUM(CASE WHEN lh.is_tenant THEN 1 ELSE 0 END)::INTEGER as rented_out_count
            FROM land_history lh
            WHERE lh.is_current = TRUE
              AND lh.land_owner_name IS NOT NULL
              AND lh.land_owner_name != ''
            GROUP BY lh.land_owner_name, lh.land_owner_ffrs_code
            ORDER BY total_area_ha DESC, lh.land_owner_name
        `);

        res.json({
            totalOwners: result.rows.length,
            owners: result.rows
        });
    } catch (error) {
        console.error('Error fetching land owners:', error);
        res.status(500).json({
            error: 'Failed to fetch land owners',
            details: error.message
        });
    }
});

// ============================================================================
// 6. GET OWNERSHIP SUMMARY BY BARANGAY
// ============================================================================
// GET /api/land-history/summary/barangay
// Returns statistical summary of land ownership by barangay
app.get('/api/land-history/summary/barangay', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                lh.farm_location_barangay as barangay,
                COUNT(*)::INTEGER as total_parcels,
                SUM(lh.total_farm_area_ha)::NUMERIC(10,2) as total_area_ha,
                SUM(CASE WHEN lh.is_registered_owner THEN 1 ELSE 0 END)::INTEGER as owner_operated,
                SUM(CASE WHEN lh.is_tenant THEN 1 ELSE 0 END)::INTEGER as tenant_operated,
                SUM(CASE WHEN lh.is_lessee THEN 1 ELSE 0 END)::INTEGER as lessee_operated,
                SUM(CASE WHEN lh.agrarian_reform_beneficiary THEN 1 ELSE 0 END)::INTEGER as agrarian_reform_count,
                COUNT(DISTINCT lh.land_owner_name)::INTEGER as unique_owners
            FROM land_history lh
            WHERE lh.is_current = TRUE
              AND lh.farm_location_barangay IS NOT NULL
            GROUP BY lh.farm_location_barangay
            ORDER BY total_area_ha DESC
        `);

        // Calculate totals
        const totals = {
            totalParcels: result.rows.reduce((sum, row) => sum + row.total_parcels, 0),
            totalAreaHa: result.rows.reduce((sum, row) => sum + parseFloat(row.total_area_ha || 0), 0).toFixed(2),
            totalOwnerOperated: result.rows.reduce((sum, row) => sum + row.owner_operated, 0),
            totalTenantOperated: result.rows.reduce((sum, row) => sum + row.tenant_operated, 0),
            totalBarangays: result.rows.length
        };

        res.json({
            totals: totals,
            barangays: result.rows
        });
    } catch (error) {
        console.error('Error fetching barangay summary:', error);
        res.status(500).json({
            error: 'Failed to fetch barangay summary',
            details: error.message
        });
    }
});

// ============================================================================
// 7. GET RECENT OWNERSHIP CHANGES
// ============================================================================
// GET /api/land-history/changes/recent?days=30
// Returns land parcels where ownership/tenancy changed recently
app.get('/api/land-history/changes/recent', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.change_type,
                lh.land_owner_name,
                lh.farmer_name,
                lh.period_start_date,
                lh.change_reason,
                lh.created_at,
                TO_CHAR(lh.created_at, 'Month DD, YYYY at HH12:MI AM') as formatted_created_at,
                EXTRACT(DAY FROM AGE(CURRENT_TIMESTAMP, lh.created_at))::INTEGER as days_ago
            FROM land_history lh
            WHERE lh.created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
              AND lh.change_type IN ('OWNERSHIP_CHANGE', 'TENANT_CHANGE', 'NEW')
            ORDER BY lh.created_at DESC
            LIMIT 100
        `, [days]);

        res.json({
            periodDays: days,
            changesFound: result.rows.length,
            changes: result.rows
        });
    } catch (error) {
        console.error('Error fetching recent changes:', error);
        res.status(500).json({
            error: 'Failed to fetch recent changes',
            details: error.message
        });
    }
});

// ============================================================================
// 8. SEARCH LAND HISTORY
// ============================================================================
// GET /api/land-history/search?q=searchTerm
// Search across land owners, farmers, and locations
app.get('/api/land-history/search', async (req, res) => {
    try {
        const searchTerm = req.query.q || '';

        if (!searchTerm || searchTerm.trim().length < 2) {
            return res.status(400).json({
                error: 'Search term must be at least 2 characters'
            });
        }

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.farm_location_municipality,
                lh.total_farm_area_ha,
                lh.land_owner_name,
                lh.farmer_name,
                CASE 
                    WHEN lh.is_registered_owner THEN 'Owner'
                    WHEN lh.is_tenant THEN 'Tenant'
                    WHEN lh.is_lessee THEN 'Lessee'
                    ELSE 'Other'
                END as ownership_status,
                lh.period_start_date,
                lh.is_current
            FROM land_history lh
            WHERE lh.is_current = TRUE
              AND (
                  lh.land_owner_name ILIKE $1
                  OR lh.farmer_name ILIKE $1
                  OR lh.farm_location_barangay ILIKE $1
                  OR lh.parcel_number ILIKE $1
                  OR lh.farmer_ffrs_code ILIKE $1
              )
            ORDER BY lh.farm_location_barangay, lh.land_owner_name
            LIMIT 50
        `, [`%${searchTerm}%`]);

        res.json({
            searchTerm: searchTerm,
            resultsFound: result.rows.length,
            results: result.rows
        });
    } catch (error) {
        console.error('Error searching land history:', error);
        res.status(500).json({
            error: 'Failed to search land history',
            details: error.message
        });
    }
});

// ============================================================================
// 9. GET COMPREHENSIVE OWNER PROFILE
// ============================================================================
// GET /api/land-history/owner-profile/:ownerName
// Complete profile of a land owner including owned and rented lands
app.get('/api/land-history/owner-profile/:ownerName', async (req, res) => {
    try {
        const { ownerName } = req.params;

        // Get owned lands
        const ownedLands = await pool.query(`
            SELECT 
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.total_farm_area_ha,
                lh.farmer_name,
                CASE 
                    WHEN lh.farmer_name = lh.land_owner_name THEN 'Self-Farmed'
                    WHEN lh.is_tenant THEN 'Rented Out'
                    WHEN lh.is_lessee THEN 'Leased Out'
                    ELSE 'Other'
                END as status
            FROM land_history lh
            WHERE lh.land_owner_name ILIKE $1
              AND lh.is_current = TRUE
            ORDER BY lh.farm_location_barangay, lh.parcel_number
        `, [`%${ownerName}%`]);

        // Get rented/leased lands
        const rentedLands = await pool.query(`
            SELECT 
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.total_farm_area_ha,
                lh.land_owner_name,
                CASE 
                    WHEN lh.is_tenant THEN 'Tenant'
                    WHEN lh.is_lessee THEN 'Lessee'
                    ELSE 'Other'
                END as arrangement_type,
                lh.period_start_date
            FROM land_history lh
            WHERE lh.farmer_name ILIKE $1
              AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
              AND lh.is_current = TRUE
            ORDER BY lh.farm_location_barangay, lh.parcel_number
        `, [`%${ownerName}%`]);

        // Calculate totals
        const ownedAreaTotal = ownedLands.rows.reduce((sum, row) =>
            sum + parseFloat(row.total_farm_area_ha || 0), 0);
        const rentedAreaTotal = rentedLands.rows.reduce((sum, row) =>
            sum + parseFloat(row.total_farm_area_ha || 0), 0);
        const selfFarmedArea = ownedLands.rows
            .filter(r => r.status === 'Self-Farmed')
            .reduce((sum, row) => sum + parseFloat(row.total_farm_area_ha || 0), 0);

        res.json({
            name: ownerName,
            summary: {
                parcelsOwned: ownedLands.rows.length,
                ownedAreaHa: ownedAreaTotal.toFixed(2),
                selfFarmedAreaHa: selfFarmedArea.toFixed(2),
                parcelsRented: rentedLands.rows.length,
                rentedAreaHa: rentedAreaTotal.toFixed(2),
                totalFarmingAreaHa: (selfFarmedArea + rentedAreaTotal).toFixed(2)
            },
            ownedLands: ownedLands.rows,
            rentedLands: rentedLands.rows
        });
    } catch (error) {
        console.error('Error fetching owner profile:', error);
        res.status(500).json({
            error: 'Failed to fetch owner profile',
            details: error.message
        });
    }
});

// ============================================================================
// 10. DATA QUALITY CHECK
// ============================================================================
// GET /api/land-history/quality-check
// Checks for data quality issues and orphaned records
app.get('/api/land-history/quality-check', async (req, res) => {
    try {
        // Check for parcels without current history
        const missingHistory = await pool.query(`
            SELECT 
                fp.id as parcel_id,
                fp.parcel_number,
                fp.submission_id,
                fp.created_at
            FROM rsbsa_farm_parcels fp
            LEFT JOIN land_history lh ON fp.id = lh.farm_parcel_id AND lh.is_current = TRUE
            WHERE lh.id IS NULL
            ORDER BY fp.created_at DESC
            LIMIT 20
        `);

        // Check for duplicate current records (should not happen!)
        const duplicateCurrents = await pool.query(`
            SELECT 
                farm_parcel_id,
                COUNT(*)::INTEGER as count
            FROM land_history
            WHERE is_current = TRUE
            GROUP BY farm_parcel_id
            HAVING COUNT(*) > 1
        `);

        // Check for records with invalid dates
        const invalidDates = await pool.query(`
            SELECT 
                id,
                farm_parcel_id,
                period_start_date,
                period_end_date
            FROM land_history
            WHERE period_end_date IS NOT NULL 
              AND period_end_date < period_start_date
            LIMIT 20
        `);

        res.json({
            issues: {
                missingCurrentHistory: missingHistory.rows.length,
                duplicateCurrentRecords: duplicateCurrents.rows.length,
                invalidDateRanges: invalidDates.rows.length
            },
            details: {
                missingHistory: missingHistory.rows,
                duplicateCurrents: duplicateCurrents.rows,
                invalidDates: invalidDates.rows
            },
            status: (missingHistory.rows.length === 0 &&
                duplicateCurrents.rows.length === 0 &&
                invalidDates.rows.length === 0) ? 'HEALTHY' : 'ISSUES_FOUND'
        });
    } catch (error) {
        console.error('Error running quality check:', error);
        res.status(500).json({
            error: 'Failed to run quality check',
            details: error.message
        });
    }
});

// ============================================================================
// END OF LAND HISTORY API ENDPOINTS
// ============================================================================

console.log('✅ Land History API endpoints loaded successfully');

// ============================================================================
// LAND OWNERS WITH TENANTS/LESSEES API ENDPOINT
// ============================================================================
// GET /api/land-owners-with-tenants
// Returns land owners grouped with their tenants and lessees
app.get('/api/land-owners-with-tenants', async (req, res) => {
    try {
        // Get all registered land owners with their parcels
        const query = `
            WITH land_owners AS (
                SELECT DISTINCT 
                    rs.id as owner_id,
                    rs."LAST NAME" || ', ' || rs."FIRST NAME" || 
                        CASE WHEN rs."MIDDLE NAME" IS NOT NULL AND rs."MIDDLE NAME" != '' 
                        THEN ' ' || rs."MIDDLE NAME" 
                        ELSE '' END as owner_name,
                    rs."FIRST NAME" as first_name,
                    rs."LAST NAME" as last_name,
                    rs."MIDDLE NAME" as middle_name
                FROM rsbsa_submission rs
                WHERE rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = true
            ),
            tenants_lessees AS (
                SELECT 
                    fp.id,
                    fp.submission_id,
                    CASE 
                        WHEN fp.ownership_type_tenant THEN fp.tenant_land_owner_name
                        WHEN fp.ownership_type_lessee THEN fp.lessee_land_owner_name
                        ELSE NULL
                    END as land_owner_name,
                    rs."LAST NAME" || ', ' || rs."FIRST NAME" || 
                        CASE WHEN rs."MIDDLE NAME" IS NOT NULL AND rs."MIDDLE NAME" != '' 
                        THEN ' ' || rs."MIDDLE NAME" 
                        ELSE '' END as tenant_lessee_name,
                    CASE 
                        WHEN fp.ownership_type_tenant THEN 'Tenant'
                        WHEN fp.ownership_type_lessee THEN 'Lessee'
                        ELSE NULL
                    END as relationship_type,
                    fp.farm_location_barangay,
                    fp.total_farm_area_ha,
                    fp.created_at
                FROM rsbsa_farm_parcels fp
                JOIN rsbsa_submission rs ON fp.submission_id = rs.id
                WHERE (fp.ownership_type_tenant = true OR fp.ownership_type_lessee = true)
                    AND (fp.tenant_land_owner_name IS NOT NULL OR fp.lessee_land_owner_name IS NOT NULL)
            )
            SELECT 
                lo.owner_id,
                lo.owner_name,
                lo.first_name,
                lo.last_name,
                lo.middle_name,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', tl.id,
                            'name', tl.tenant_lessee_name,
                            'type', tl.relationship_type,
                            'location', tl.farm_location_barangay,
                            'area', tl.total_farm_area_ha,
                            'createdAt', tl.created_at
                        ) ORDER BY tl.created_at DESC
                    ) FILTER (WHERE tl.id IS NOT NULL),
                    '[]'::json
                ) as tenants_lessees
            FROM land_owners lo
            LEFT JOIN tenants_lessees tl ON (
                LOWER(TRIM(lo.owner_name)) = LOWER(TRIM(tl.land_owner_name))
                OR LOWER(TRIM(tl.land_owner_name)) LIKE LOWER(TRIM(lo.owner_name)) || '%'
                OR LOWER(TRIM(lo.owner_name)) LIKE LOWER(TRIM(tl.land_owner_name)) || '%'
            )
            GROUP BY lo.owner_id, lo.owner_name, lo.first_name, lo.last_name, lo.middle_name
            ORDER BY lo.last_name, lo.first_name;
        `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching land owners with tenants:', error);
        res.status(500).json({
            error: 'Failed to fetch land owners with tenants',
            details: error.message
        });
    }
});

// ============================================================================
// CATCH-ALL ROUTE - MUST BE AFTER ALL API ENDPOINTS
// ============================================================================
// For any requests not matching API routes, serve the frontend's index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// ============================================================================
// START SERVER - MUST BE LAST
// ============================================================================
app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
    console.log(`✅ All API endpoints registered successfully`);
    console.log(`✅ Land History API endpoints are active`);
});