const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
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
// IMPORTANT: Replace '../dist' with the actual path to your frontend's build output directory
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


// API endpoint to get land plots with geometry and owner info for the map


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

// Login endpoint for admin and technician
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


// GET endpoint to fetch all Registered Owners from RSBSAform
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




// POST endpoint to submit final RSBSA form
app.post('/api/rsbsa_submission', async (req, res) => {
    const { draftId, data } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Received RSBSA submission:', {
            draftId,
            data: {
                ...data,
                farmlandParcels: JSON.stringify(data.farmlandParcels, null, 2)
            }
        });

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
            null, // PARCEL AREA
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
                INSERT INTO farm_parcels (
                    submission_id, parcel_number, farm_location_barangay, farm_location_city_municipality,
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
                        parcel.withinAncestralDomain === 'Yes' || false,
                        parcel.ownershipDocumentNo || '',
                        parcel.agrarianReformBeneficiary === 'Yes' || false,
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
        console.log(`RSBSA form submitted successfully with ${data.farmlandParcels.length} parcels for farmer: ${data.firstName} ${data.surname}`);
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

// D ko sure man
app.get('/api/rsbsa_submission/:id/parcels', async (req, res) => {
    try {
        const submissionId = req.params.id;
        console.log(`Fetching farm parcels for submission ID: ${submissionId}`);

        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'farm_parcels'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('farm_parcels table does not exist');
            return res.status(500).json({
                message: 'Database error: farm_parcels table not found',
            });
        }

        const query = `
            SELECT 
                id,
                submission_id,
                parcel_number,
                farm_location_barangay,
                farm_location_city_municipality,
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
            FROM farm_parcels 
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

// API endpoint to get all farm parcels
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

// API endpoint to get parcels for a specific farmer by name
app.get('/api/rsbsa_farm_parcels/by-farmer', async (req, res) => {
    try {
        const { lastName, firstName } = req.query;

        if (!lastName || !firstName) {
            return res.status(400).json({
                message: 'Both lastName and firstName query parameters are required'
            });
        }

        console.log(`Fetching parcels for farmer: ${firstName} ${lastName}`);

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
        console.log(`Found ${result.rows.length} parcels for farmer: ${firstName} ${lastName}`);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching parcels by farmer:', error);
        res.status(500).json({ message: 'Error fetching parcels by farmer', error: error.message });
    }
});

// API endpoint to get farmer summary with parcel counts
app.get('/api/farmers/summary', async (req, res) => {
    try {
        console.log('Fetching farmer summary with parcel counts...');

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
Purpose:For the masterlist 
Where: In the file 
Description: 
*/
app.get('/api/rsbsa_submission', async (req, res) => {
    try {
        console.log('Fetching RSBSA submissions...');

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

        // First, let's check what columns actually exist
        const columnCheckQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'rsbsa_submission' 
            ORDER BY ordinal_position
        `;
        const columnResult = await pool.query(columnCheckQuery);
        console.log('Available columns:', columnResult.rows.map(row => row.column_name));

        // Check if this is the JSONB version or structured version
        const hasJsonbColumn = columnResult.rows.some(row => row.column_name === 'data'); // This is the JSONB column
        const hasStructuredColumns = columnResult.rows.some(row => row.column_name === 'LAST NAME'); // These are the structured columns
        const hasOwnershipColumns = columnResult.rows.some(row => row.column_name === 'OWNERSHIP_TYPE_REGISTERED_OWNER');

        console.log('Table structure check:', {
            hasJsonbColumn,
            hasStructuredColumns,
            hasOwnershipColumns
        });

        let query;
        if (hasJsonbColumn && !hasStructuredColumns) {
            // This is the original JSONB table
            console.log('Using JSONB table structure');
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
            console.log('Using structured table');
            // Build query dynamically based on available columns
            let selectFields = `
                id,
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
        console.log(`Found ${result.rows.length} submissions in database`);

        // Debug: Check ownership type data in raw results
        if (result.rows.length > 0) {
            console.log('Sample raw record:', JSON.stringify(result.rows[0], null, 2));
            console.log('Ownership type fields in raw data:', {
                registeredOwner: result.rows[0]["OWNERSHIP_TYPE_REGISTERED_OWNER"],
                tenant: result.rows[0]["OWNERSHIP_TYPE_TENANT"],
                lessee: result.rows[0]["OWNERSHIP_TYPE_LESSEE"]
            });
        }

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

                console.log(`Processing ${fullName}: ownershipType=`, ownershipType, `(hasOwnershipColumns=${hasOwnershipColumns})`);

                return {
                    id: row.id,
                    referenceNumber: `RSBSA-${row.id}`,
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

// PUT endpoint to update a specific RSBSA submission
app.put('/api/rsbsa_submission/:id', async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
        console.log(`Updating RSBSA submission ${id} with status:`, updateData.status);

        // Check table structure first
        const tableCheckQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'rsbsa_submission' 
            ORDER BY ordinal_position
        `;
        const tableStructure = await pool.query(tableCheckQuery);
        console.log('Table structure:', tableStructure.rows);

        const hasJsonbColumn = tableStructure.rows.some(row => row.column_name === 'data');
        const hasStatusColumn = tableStructure.rows.some(row => row.column_name === 'status');

        if (!hasStatusColumn) {
            return res.status(400).json({
                message: 'Status column does not exist in database',
                error: 'The rsbsa_submission table does not have a status column. Please run the database migration first.'
            });
        }

        // Check if the record exists
        const checkQuery = `SELECT id, status FROM rsbsa_submission WHERE id = $1`;
        const checkResult = await pool.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            return res.status(404).json({
                message: 'RSBSA submission not found',
                error: 'No record found with the provided ID'
            });
        }

        console.log('Found record:', checkResult.rows[0]);

        // Parse farmer name if provided
        let lastName = '';
        let firstName = '';
        let middleName = '';
        let extName = '';

        if (updateData.farmerName) {
            const nameParts = updateData.farmerName.split(', ');
            lastName = nameParts[0] || '';
            firstName = nameParts[1] || '';
            middleName = nameParts[2] || '';
            extName = nameParts[3] || '';
        }

        // Extract parcel area number if it contains "hectares"
        let parcelArea = updateData.parcelArea;
        if (parcelArea && parcelArea.includes('hectares')) {
            parcelArea = parcelArea.replace(/\s*hectares\s*$/i, '').trim();
        }

        // Validate status
        const validStatuses = ['Active Farmer', 'Not Active'];
        const status = validStatuses.includes(updateData.status) ? updateData.status : null;
        console.log('Validated status:', status);

        // For status-only updates, use a simpler query
        const updateQuery = `
            UPDATE rsbsa_submission SET
                status = $1
            WHERE id = $2
            RETURNING *;
        `;

        const values = [
            status,
            id
        ];

        console.log('Executing query with values:', values);
        const result = await pool.query(updateQuery, values);
        console.log('Query result:', result.rows);

        if (result.rowCount === 0) {
            console.log('No rows updated - record not found');
            return res.status(404).json({
                message: 'RSBSA submission not found',
                error: 'No record found with the provided ID'
            });
        }

        console.log(`RSBSA submission ${id} updated successfully`);
        console.log('Updated record:', result.rows[0]);
        res.json({
            message: 'RSBSA submission updated successfully',
            data: result.rows[0] // Return the updated record
        });

    } catch (error) {
        console.error('Error updating RSBSA submission:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position
        });
        res.status(500).json({
            message: 'Error updating RSBSA submission',
            error: error.message,
            details: error.detail || error.code
        });
    }
});

// For any requests not matching API routes, serve the frontend's index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
});

