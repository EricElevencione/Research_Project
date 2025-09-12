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
app.get('/api/land-plots', async (req, res) => {
	try {
		// Prefer PostGIS if available to ensure proper GeoJSON output
		const queryWithPostGIS = `
			SELECT 
				fp.id,
				fp.parcel_number AS "parcelNumber",
				fp.farm_location_barangay AS "barangay",
				fp.farm_location_city_municipality AS "municipality",
				fp.total_farm_area AS "totalFarmArea",
				fp.crop_commodity AS "cropCommodity",
				r.surname AS "surname",
				r.first_name AS "firstName",
				r.middle_name AS "middleName",
				ST_AsGeoJSON(fp.geometry)::json AS geometry
			FROM farm_parcels fp
			LEFT JOIN rsbsaform r ON r.id = fp.owner_id
			WHERE fp.geometry IS NOT NULL
		`;

		let result;
		try {
			result = await pool.query(queryWithPostGIS);
		} catch (err) {
			// If PostGIS is not installed (undefined function), fall back to raw geometry
			if (err && (err.code === '42883' || (err.message || '').includes('ST_AsGeoJSON'))) {
				const fallbackQuery = `
					SELECT 
						fp.id,
						fp.parcel_number AS "parcelNumber",
						fp.farm_location_barangay AS "barangay",
						fp.farm_location_city_municipality AS "municipality",
						fp.total_farm_area AS "totalFarmArea",
						fp.crop_commodity AS "cropCommodity",
						r.surname AS "surname",
						r.first_name AS "firstName",
						r.middle_name AS "middleName",
						fp.geometry AS geometry
					FROM farm_parcels fp
					LEFT JOIN rsbsaform r ON r.id = fp.owner_id
					WHERE fp.geometry IS NOT NULL
				`;
				result = await pool.query(fallbackQuery);
				// Best-effort: try to parse geometry if it looks like JSON
				result.rows = result.rows.map(row => {
					if (row && row.geometry && typeof row.geometry === 'string') {
						try {
							row.geometry = JSON.parse(row.geometry);
						} catch (_) {
							// leave as-is if not JSON (e.g., WKB/WKT)
						}
					}
					return row;
				});
			} else {
				throw err;
			}
		}

		res.json(result.rows || []);
	} catch (error) {
		console.error('Error fetching land plots:', error);
		// If table or column is missing, avoid blocking UI and return empty list
		if (error && (error.code === '42P01' || error.code === '42703')) {
			return res.json([]);
		}
		// Fallback: non-blocking empty response
		return res.json([]);
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


// GET endpoint to fetch all farm parcels for a specific farmer
app.get('/api/farm-parcels/:ownerId', async (req, res) => {
    const { ownerId } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                id,
                parcel_number,
                farm_location_barangay,
                farm_location_city_municipality,
                total_farm_area,
                crop_commodity,
                farm_size,
                farm_type,
                organic_practitioner,
                plot_status,
                last_plotted_at,
                geometry,
                -- New columns (will be NULL if they don't exist yet)
                within_ancestral_domain,
                agrarian_reform_beneficiary,
                ownership_document_no,
                ownership_type_registered_owner,
                ownership_type_tenant,
                ownership_type_tenant_land_owner,
                ownership_type_lessee,
                ownership_type_lessee_land_owner,
                ownership_type_others,
                ownership_type_others_specify,
                number_of_head,
                farm_remarks,
                created_at,
                updated_at
            FROM farm_parcels
            WHERE owner_id = $1
            ORDER BY parcel_number
        `, [ownerId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching farm parcels:', error);
        res.status(500).json({
            message: 'Error fetching farm parcels',
            error: error.message
        });
    }
});

// PUT endpoint to update a specific farm parcel
app.put('/api/farm-parcels/:parcelId', async (req, res) => { 
    const { parcelId } = req.params;
    const updateData = req.body;

    try {
        const updateQuery = `
            UPDATE farm_parcels SET
                parcel_number = COALESCE($1, parcel_number),
                farm_location_barangay = COALESCE($2, farm_location_barangay),
                farm_location_city_municipality = COALESCE($3, farm_location_city_municipality),
                total_farm_area = COALESCE($4, total_farm_area),
                crop_commodity = COALESCE($5, crop_commodity),
                farm_size = COALESCE($6, farm_size),
                farm_type = COALESCE($7, farm_type),
                organic_practitioner = COALESCE($8, organic_practitioner),
                within_ancestral_domain = COALESCE($9, within_ancestral_domain),
                agrarian_reform_beneficiary = COALESCE($10, agrarian_reform_beneficiary),
                ownership_document_no = COALESCE($11, ownership_document_no),
                ownership_type_registered_owner = COALESCE($12, ownership_type_registered_owner),
                ownership_type_tenant = COALESCE($13, ownership_type_tenant),
                ownership_type_tenant_land_owner = COALESCE($14, ownership_type_tenant_land_owner),
                ownership_type_lessee = COALESCE($15, ownership_type_lessee),
                ownership_type_lessee_land_owner = COALESCE($16, ownership_type_lessee_land_owner),
                ownership_type_others = COALESCE($17, ownership_type_others),
                ownership_type_others_specify = COALESCE($18, ownership_type_others_specify),
                number_of_head = COALESCE($19, number_of_head),
                farm_remarks = COALESCE($20, farm_remarks),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $21
        `;

        const values = [
            updateData.parcelNumber,
            updateData.farmLocationBarangay,
            updateData.farmLocationCityMunicipality,
            updateData.totalFarmArea,
            updateData.cropCommodity,
            updateData.farmSize,
            updateData.farmType,
            updateData.organicPractitioner,
            updateData.withinAncestralDomain,
            updateData.agrarianReformBeneficiary,
            updateData.ownershipDocumentNo,
            updateData.ownershipTypeRegisteredOwner,
            updateData.ownershipTypeTenant,
            updateData.ownershipTypeTenantLandOwner,
            updateData.ownershipTypeLessee,
            updateData.ownershipTypeLesseeLandOwner,
            updateData.ownershipTypeOthers,
            updateData.ownershipTypeOthersSpecify,
            updateData.numberOfHead,
            updateData.farmRemarks,
            parcelId
        ];

        await pool.query(updateQuery, values);
        res.json({ message: 'Farm parcel updated successfully' });
    } catch (error) {
        console.error('Error updating farm parcel:', error);
        res.status(500).json({
            message: 'Error updating farm parcel',
            error: error.message
        });
    }
});

// DELETE endpoint to delete a farm parcel
app.delete('/api/farm-parcels/:parcelId', async (req, res) => {
    const { parcelId } = req.params;

    try {
        await pool.query('DELETE FROM farm_parcels WHERE id = $1', [parcelId]);
        res.json({ message: 'Farm parcel deleted successfully' });
    } catch (error) {
        console.error('Error deleting farm parcel:', error);
        res.status(500).json({
            message: 'Error deleting farm parcel',
            error: error.message
        });
    }
});


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

// POST endpoint to save RSBSA draft
app.post('/api/rsbsa-draft', async (req, res) => {
    const { data } = req.body; // Get the data from the request body
    try {
        const insertQuery = ` 
            INSERT INTO rsbsa_draft (data) VALUES ($1) RETURNING id
        `;
        const values = [data];
        const result = await pool.query(insertQuery, values);
        res.status(201).json({
            message: 'RSBSA draft saved successfully!',
            id: result.rows[0].id
        });
    } catch (error) {
        console.error('Error saving RSBSA draft:', error);
        res.status(500).json({ message: 'Error saving RSBSA draft', error: error.message });
    }
});



// POST endpoint to submit final RSBSA form
app.post('/api/rsbsa_submission', async (req, res) => {
    const { draftId, data } = req.body;
    try {
        console.log('Received RSBSA submission:', { draftId, data });

        // Extract farmland parcel data (use first parcel if multiple)
        const firstParcel = data.farmlandParcels && data.farmlandParcels.length > 0 ? data.farmlandParcels[0] : {};

        // Insert the form data into rsbsa_submission table with correct column names
        const insertQuery = `
            INSERT INTO rsbsa_submission (
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
                "MAIN LIVELIHOOD",
                "OWNERSHIP_TYPE_REGISTERED_OWNER",
                "OWNERSHIP_TYPE_TENANT",
                "OWNERSHIP_TYPE_LESSEE",
                status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            ) 
            RETURNING id, submitted_at
        `;

        const values = [
            data.surname || '',
            data.firstName || '',
            data.middleName || '',
            data.extensionName || '',
            data.gender || '',
            data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            data.barangay || '',
            data.municipality || '',
            firstParcel.farmLocationBarangay || '',
            firstParcel.totalFarmAreaHa ? parseFloat(firstParcel.totalFarmAreaHa) : null,
            data.mainLivelihood || '',
            firstParcel.ownershipTypeRegisteredOwner || false,
            firstParcel.ownershipTypeTenant || false,
            firstParcel.ownershipTypeLessee || false,
            'Submitted'
        ];

        const result = await pool.query(insertQuery, values);

        const submissionId = result.rows[0].id;
        const submittedAt = result.rows[0].submitted_at;

        console.log(`RSBSA form submitted successfully with ID: ${submissionId}`);

        // If there's a draftId, we can optionally delete the draft after successful submission
        if (draftId) {
            console.log(`Processing submission for draft ID: ${draftId}`);
            // Optional: Delete the draft after successful submission
            // await pool.query('DELETE FROM rsbsa_draft WHERE id = $1', [draftId]);
        }

        res.status(201).json({
            message: 'RSBSA form submitted successfully!',
            submissionId: submissionId,
            submittedAt: submittedAt
        });
    } catch (error) {
        console.error('Error submitting RSBSA form:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position
        });
        res.status(500).json({
            message: 'Error submitting RSBSA form',
            error: error.message,
            details: error.detail || error.code
        });
    }
});

// GET endpoint to fetch RSBSA submissions for masterlist
app.get('/api/rsbsa_submission', async (req, res) => {
    try {
        console.log('Fetching RSBSA submissions...');

        // First check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'rsbsa_submission'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('rsbsa_submission table does not exist');
            return res.status(404).json({
                error: 'rsbsa_submission table not found',
                message: 'The rsbsa_submission table does not exist in the database.'
            });
        }

        const query = `
            SELECT 
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
                "MAIN LIVELIHOOD",
                "OWNERSHIP_TYPE_REGISTERED_OWNER",
                "OWNERSHIP_TYPE_TENANT",
                "OWNERSHIP_TYPE_LESSEE",
                status,
                submitted_at,
                created_at,
                updated_at
            FROM rsbsa_submission 
            WHERE "LAST NAME" IS NOT NULL 
            ORDER BY submitted_at DESC
        `;
        const result = await pool.query(query);
        console.log(`Found ${result.rows.length} submissions in database`);

        // Transform the data to match the expected format
        const submissions = result.rows.map(row => {
            // Create farmer name from structured columns
            const fullName = [row["LAST NAME"], row["FIRST NAME"], row["MIDDLE NAME"]]
                .filter(Boolean)
                .join(', ');

            // Create parcel info from structured columns
            const parcelInfo = row["PARCEL NO."] && row["FARM LOCATION"]
                ? `Parcel ${row["PARCEL NO."]}: ${row["FARM LOCATION"]}${row["PARCEL AREA"] ? ` (${row["PARCEL AREA"]} ha)` : ''}`
                : 'N/A';

            return {
                id: row.id,
                referenceNumber: `RSBSA-${row.id}`,
                farmerName: fullName || '—',
                farmerAddress: `${row["BARANGAY"] || ''}, ${row["MUNICIPALITY"] || ''}`.replace(/^,\s*|,\s*$/g, '') || 'N/A',
                farmLocation: row["FARM LOCATION"] || 'N/A',
                gender: row["GENDER"] || 'N/A',
                birthdate: row["BIRTHDATE"] || null,
                dateSubmitted: row.submitted_at,
                status: row.status || 'Submitted',
                parcelArea: row["PARCEL AREA"] || null,
                landParcel: parcelInfo,
                ownershipType: {
                    registeredOwner: row["OWNERSHIP_TYPE_REGISTERED_OWNER"] || false,
                    tenant: row["OWNERSHIP_TYPE_TENANT"] || false,
                    lessee: row["OWNERSHIP_TYPE_LESSEE"] || false
                }
            };
        });

        res.json(submissions);
    } catch (error) {
        console.error('Error fetching RSBSA submissions:', error);
        res.status(500).json({ message: 'Error fetching RSBSA submissions', error: error.message });
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

