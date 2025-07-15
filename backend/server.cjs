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
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Masterlist',
    password: process.env.DB_PASSWORD || 'postgresadmin',
    port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err);
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
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Serve static files from the frontend build directory
// IMPORTANT: Replace '../dist' with the actual path to your frontend's build output directory
const frontendBuildPath = path.join(__dirname, '../dist'); // Assuming 'dist' is in the project root
app.use(express.static(frontendBuildPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API endpoint to get land records for the table
app.get('/api/lands', async (req, res) => {
    try {
        console.log('Attempting to fetch land records...');

        // First, let's check what columns actually exist in the table
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'masterlist'
            ORDER BY ordinal_position;
        `);

        console.log('Available columns:', columnCheck.rows.map(r => r.column_name));

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

        console.log('Query successful, rows returned:', result.rows.length);

        // Set proper content type
        res.setHeader('Content-Type', 'application/json');
        res.json(result.rows);
    } catch (err) {
        console.error('Detailed error in /api/lands:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({
            error: 'Server Error',
            details: err.message,
            stack: err.stack
        });
    }
});

// API endpoint to handle land plot data from the Land Plotting Dashboard
app.post('/api/land-plots', async (req, res) => {
    console.log('Received POST request to /api/land-plots');
    const landPlotData = req.body;
    console.log('Land plot data received:', landPlotData);

    // Validate incoming data structure
    if (!landPlotData || !landPlotData.id || !landPlotData.geometry || landPlotData.geometry.type === undefined) {
        console.error('Invalid land plot data structure:', landPlotData);
        return res.status(400).json({ message: 'Invalid land plot data structure' });
    }

    try {
        // Convert GeoJSON geometry to PostGIS geometry type
        const geometry = JSON.stringify(landPlotData.geometry);
        // Determine plot_type based on geometry type
        let plotType = 'polygon';
        if (landPlotData.geometry.type && landPlotData.geometry.type.toUpperCase() === 'POINT') {
            plotType = 'point';
        }

        const insertQuery = `
    INSERT INTO land_plots (
        id, firstname, middlename, surname, gender, barangay_name, municipality_name, province_name, 
        status, street, farm_type, area, coordinateaccuracy, geom, createdat, updatedat, name,
        ffrs_id, ext_name, birthdate, parcel_address, plotSource, plot_type
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ST_GeomFromGeoJSON($14), $15, $16, $17,
        $18, $19, $20, $21, $22, $23
    )
`;
        const values = [
            landPlotData.id,
            landPlotData.firstName,
            landPlotData.middleName,
            landPlotData.surname,
            landPlotData.gender,
            landPlotData.barangay,
            landPlotData.municipality,
            landPlotData.province,
            landPlotData.status,
            landPlotData.street,
            landPlotData.farmType,
            landPlotData.area,
            landPlotData.coordinateAccuracy,
            geometry,
            landPlotData.createdAt,
            landPlotData.updatedAt,
            landPlotData.name || null,
            landPlotData.ffrs_id || null,
            landPlotData.ext_name || null,
            landPlotData.birthdate || null,
            landPlotData.parcel_address || null,
            landPlotData.plotSource || null,
            plotType
        ];

        await pool.query(insertQuery, values);

        console.log(`Land plot with ID ${landPlotData.id} saved successfully.`);
        res.status(201).json({ message: 'Land plot data saved successfully', id: landPlotData.id });
    } catch (error) {
        console.error('Error processing /api/land-plots POST:', error);
        res.status(500).json({ message: 'Error saving land plot data', error: error.message });
    }
});

// API endpoint to get land plots
app.get('/api/land-plots', async (req, res) => {
    try {
        console.log('Fetching land plots...');
        const result = await pool.query(`
            SELECT 
                id,
                name,
                firstname as "firstName",
                middlename as "middleName",
                surname,
                gender,
                barangay_name as "barangay",
                municipality_name as "municipality",
                province_name as "province",
                status,
                street,
                farm_type as "farmType",
                area,
                coordinateaccuracy as "coordinateAccuracy",
                createdat as "createdAt",
                updatedat as "updatedAt",
                ffrs_id,
                ext_name,
                birthdate,
                parcel_address,
                plotSource,
                plot_type,
                ST_AsGeoJSON(geom) as geometry
            FROM land_plots
            ORDER BY createdat DESC
        `);

        const landPlots = result.rows.map(row => ({
            ...row,
            geometry: JSON.parse(row.geometry)
        }));

        console.log(`Retrieved ${landPlots.length} land plots`);
        res.json(landPlots);
    } catch (error) {
        console.error('Error fetching land plots:', error);
        res.status(500).json({ error: 'Failed to fetch land plots' });
    }
});

// API endpoint to delete a land plot
app.delete('/api/land-plots/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM land_plots WHERE id = $1', [id]);
        res.json({ message: 'Land plot deleted successfully' });
    } catch (error) {
        console.error('Error deleting land plot:', error);
        res.status(500).json({ error: 'Failed to delete land plot' });
    }
});

// API endpoint to handle file uploads
app.post('/api/upload', upload.single('file'), async (req, res) => {
    const uploadedFile = req.file;

    if (!uploadedFile) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('File received:', uploadedFile);
    let processedCount = 0;
    let errorMessage = null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Parse the Excel file
        const workbook = XLSX.readFile(uploadedFile.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log(`Parsed ${jsonData.length} rows from Excel.`);

        // Process each row
        for (const row of jsonData) {
            try {
                // Prepare the data for insertion
                const insertQuery = `
                    INSERT INTO masterlist (
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
                        "PARCEL AREA",
                        status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `;

                const values = [
                    row['FIRST NAME'] || null,
                    row['MIDDLE NAME'] || null,
                    row['EXT NAME'] || null,
                    row['GENDER'] || null,
                    row['BIRTHDATE'] || null,
                    row['FARMER ADDRESS 1'] || null,
                    row['FARMER ADDRESS 2'] || null,
                    row['FARMER ADDRESS 3'] || null,
                    row['PARCEL NO.'] || null,
                    row['PARCEL ADDRESS'] || null,
                    row['PARCEL AREA'] || null
                ];

                // Execute the insert query
                await client.query(insertQuery, values);
                processedCount++;
            } catch (rowError) {
                console.error('Error processing row:', rowError);
                console.error('Problematic row:', row);
                // Continue processing other rows even if one fails
            }
        }

        await client.query('COMMIT');
        res.json({
            message: 'File processed successfully',
            processedRecords: processedCount,
            totalRows: jsonData.length
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing file upload:', error);
        errorMessage = error.message;
        res.status(500).json({
            message: 'Error processing file',
            error: errorMessage
        });
    } finally {
        client.release();
        // Clean up the temporary file
        fs.unlink(uploadedFile.path, (err) => {
            if (err) console.error('Error deleting temporary file:', err);
        });
    }
});

// API endpoint to add a new farmer
app.post('/api/farmers', async (req, res) => {
    console.log('Received POST request to /api/farmers');
    const farmerData = req.body;
    console.log('Farmer data received:', farmerData);

    try {
        const insertQuery = `
            INSERT INTO masterlist (
                "FIRST NAME",
                "MIDDLE NAME",
                "LAST NAME",
                "GENDER",
                "FARMER ADDRESS 1",
                "FARMER ADDRESS 2",
                "FARMER ADDRESS 3",
                "PARCEL AREA"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        const values = [
            farmerData.firstName,
            farmerData.middleName,
            farmerData.surname,
            farmerData.gender,
            farmerData.street,
            farmerData.barangay,
            `${farmerData.municipality}, ${farmerData.city}`,
            farmerData.area
        ];

        await pool.query(insertQuery, values);
        console.log('Farmer added successfully.');
        res.status(201).json({
            message: 'Farmer added successfully'
        });
    } catch (error) {
        console.error('Error adding farmer:', error);
        res.status(500).json({
            message: 'Error adding farmer',
            error: error.message
        });
    }
});

// New endpoint: Update farmer status by id
app.put('/api/farmers/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
        return res.status(400).json({ message: 'Status is required.' });
    }
    try {
        const result = await pool.query(
            'UPDATE masterlist SET status = $1 WHERE id = $2',
            [status, id]
        );
        if (result.rowCount > 0) {
            res.status(200).json({ message: 'Status updated successfully' });
        } else {
            res.status(404).json({ message: 'Farmer not found' });
        }
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ message: 'Error updating status', error: error.message });
    }
});

// DELETE endpoint for farmers - uses multiple parameters for identification
app.delete('/api/farmers/:firstName/:middleName/:surname/:area', async (req, res) => {
    const { firstName, middleName, surname, area } = req.params;
    console.log('DELETE request received with params:', {
        firstName,
        middleName,
        surname,
        area
    });

    try {
        // Decode the parameters
        const decodedFirstName = decodeURIComponent(firstName);
        const decodedMiddleName = decodeURIComponent(middleName);
        const decodedSurname = decodeURIComponent(surname);
        const decodedArea = parseFloat(decodeURIComponent(area));

        console.log('Decoded parameters:', {
            firstName: decodedFirstName,
            middleName: decodedMiddleName,
            surname: decodedSurname,
            area: decodedArea
        });

        // First, let's check if the farmer exists
        const checkQuery = `
            SELECT * FROM masterlist
            WHERE
                "FIRST NAME" = $1 AND
                ("MIDDLE NAME" = $2 OR ($2 = 'NONE' AND ("MIDDLE NAME" IS NULL OR "MIDDLE NAME" = ''))) AND
                ("LAST NAME" = $3 OR ($3 = 'NONE' AND ("LAST NAME" IS NULL OR "LAST NAME" = ''))) AND
                "PARCEL AREA" = $4;
        `;

        const checkValues = [
            decodedFirstName,
            decodedMiddleName,
            decodedSurname,
            decodedArea
        ];

        console.log('Checking if farmer exists with query:', checkQuery);
        console.log('Query values:', checkValues);

        const checkResult = await pool.query(checkQuery, checkValues);
        console.log('Check result row count:', checkResult.rowCount);

        if (checkResult.rowCount === 0) {
            console.log('Farmer not found in database');
            return res.status(404).json({ message: 'Farmer not found' });
        }

        // If farmer exists, proceed with deletion
        const deleteQuery = `
            DELETE FROM masterlist
            WHERE
                "FIRST NAME" = $1 AND
                ("MIDDLE NAME" = $2 OR ($2 = 'NONE' AND ("MIDDLE NAME" IS NULL OR "MIDDLE NAME" = ''))) AND
                ("LAST NAME" = $3 OR ($3 = 'NONE' AND ("LAST NAME" IS NULL OR "LAST NAME" = ''))) AND
                "PARCEL AREA" = $4;
        `;

        console.log('Executing delete query:', deleteQuery);
        console.log('Delete query values:', checkValues);

        const result = await pool.query(deleteQuery, checkValues);

        if (result.rowCount > 0) {
            console.log(`Farmer ${decodedFirstName} ${decodedSurname} deleted successfully.`);
            res.status(200).json({ message: 'Farmer deleted successfully' });
        } else {
            console.log(`No rows were deleted for farmer ${decodedFirstName} ${decodedSurname}`);
            res.status(404).json({ message: 'Farmer not found' });
        }
    } catch (error) {
        console.error('Error in DELETE /api/farmers:', error);
        res.status(500).json({
            message: 'Error deleting farmer',
            error: error.message,
            stack: error.stack
        });
    }
});

// GET endpoint to fetch a single farmer by identifying fields
app.get('/api/farmers/:firstName/:middleName/:surname/:area', async (req, res) => {
    const { firstName, middleName, surname, area } = req.params;
    console.log('Received GET request with params:', { firstName, middleName, surname, area });

    try {
        const selectQuery = `
            SELECT
                "FIRST NAME",
                "MIDDLE NAME",
                "LAST NAME",
                "EXT NAME",
                "GENDER",
                "BIRTHDATE",
                "FARMER ADDRESS 1",
                "FARMER ADDRESS 2",
                "FARMER ADDRESS 3",
                "PARCEL NO.",
                "PARCEL ADDRESS",
                "PARCEL AREA"
            FROM masterlist
            WHERE
                "FIRST NAME" = $1 AND
                ("MIDDLE NAME" = $2 OR ($2 = 'NONE' AND ("MIDDLE NAME" IS NULL OR "MIDDLE NAME" = ''))) AND
                ("LAST NAME" = $3 OR ($3 = 'NONE' AND ("LAST NAME" IS NULL OR "LAST NAME" = ''))) AND
                "PARCEL AREA" = $4;
        `;

        const decodedValues = [
            decodeURIComponent(firstName),
            decodeURIComponent(middleName),
            decodeURIComponent(surname),
            parseFloat(decodeURIComponent(area))
        ];

        console.log('Decoded values:', decodedValues);
        console.log('Executing query:', selectQuery);

        const result = await pool.query(selectQuery, decodedValues);
        console.log('Query result rows:', result.rows);

        if (result.rows.length > 0) {
            console.log(`Farmer ${firstName} ${surname} found.`);
            res.status(200).json(result.rows[0]);
        } else {
            console.log(`Farmer ${firstName} ${surname} not found.`);
            res.status(404).json({ message: 'Farmer not found' });
        }
    } catch (error) {
        console.error('Detailed error in GET /api/farmers:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Server Error',
            details: error.message,
            stack: error.stack
        });
    }
});

// PUT endpoint to update an existing farmer
app.put('/api/farmers/:originalFirstName/:originalMiddleName/:originalSurname/:originalArea', async (req, res) => {
    const { originalFirstName, originalMiddleName, originalSurname, originalArea } = req.params;
    const updatedFarmerData = req.body;
    console.log(`Received PUT request to update farmer: ${originalFirstName} ${originalMiddleName} ${originalSurname}, Area: ${originalArea}`);
    console.log('Updated farmer data:', updatedFarmerData);

    try {
        const updateQuery = `
            UPDATE masterlist
            SET
                "FIRST NAME" = $5,
                "MIDDLE NAME" = $6,
                "LAST NAME" = $7,
                "GENDER" = $8,
                "FARMER ADDRESS 1" = $9,
                "FARMER ADDRESS 2" = $10,
                "FARMER ADDRESS 3" = $11,
                "PARCEL AREA" = $12
            WHERE
                "FIRST NAME" = $1 AND
                ("MIDDLE NAME" = $2 OR ($2 = 'NONE' AND ("MIDDLE NAME" IS NULL OR "MIDDLE NAME" = ''))) AND
                "LAST NAME" = $3 AND
                "PARCEL AREA" = $4;
        `;

        const values = [
            decodeURIComponent(originalFirstName),
            decodeURIComponent(originalMiddleName),
            decodeURIComponent(originalSurname),
            parseFloat(decodeURIComponent(originalArea)),
            updatedFarmerData.firstName,
            updatedFarmerData.middleName,
            updatedFarmerData.surname,
            updatedFarmerData.gender,
            updatedFarmerData.street,
            updatedFarmerData.barangay,
            `${updatedFarmerData.municipality}, ${updatedFarmerData.city}`,
            updatedFarmerData.area
        ];

        console.log('Update query:', updateQuery);
        console.log('Update values:', values);

        const result = await pool.query(updateQuery, values);

        if (result.rowCount > 0) {
            console.log(`Farmer ${originalFirstName} ${originalSurname} updated successfully.`);
            res.status(200).json({ message: 'Farmer updated successfully' });
        } else {
            console.log(`Farmer ${originalFirstName} ${originalSurname} not found for update.`);
            res.status(404).json({ message: 'Farmer not found for update' });
        }
    } catch (error) {
        console.error('Error updating farmer:', error);
        res.status(500).json({ message: 'Error updating farmer', error: error.message });
    }
});

// GET endpoint to fetch all farmers (for technician dashboard/stakeholders)
app.get('/api/farmers', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                status,
                "FIRST NAME" as "firstName",
                "MIDDLE NAME" as "middleName",
                "LAST NAME" as "surname",
                "GENDER" as "gender",
                "FARMER ADDRESS 1" as "street",
                "FARMER ADDRESS 2" as "barangay",
                "FARMER ADDRESS 3" as "municipality_city",
                "PARCEL AREA" as "area"
            FROM masterlist
        `);

        // Optionally split municipality and city if needed
        const farmers = result.rows.map(row => {
            let municipality = '';
            let city = '';
            if (row.municipality_city) {
                const parts = row.municipality_city.split(',');
                municipality = parts[0]?.trim() || '';
                city = parts[1]?.trim() || '';
            }
            return {
                ...row,
                municipality,
                city
            };
        });

        res.json(farmers);
    } catch (err) {
        console.error('Error fetching farmers:', err);
        res.status(500).json({ error: 'Failed to fetch farmers' });
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
    if (!['admin', 'technician'].includes(role)) {
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
app.get('/api/RSBSAform', async (req, res) => {
    try {
        console.log('Fetching RSBSA form data...');

        // First check if the table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'rsbsaform'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('RSBSAform table does not exist');
            return res.status(404).json({
                error: 'RSBSAform table not found',
                message: 'The RSBSAform table does not exist in the database. Please create it first.'
            });
        }

        // Check what columns exist in the table
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'rsbsaform'
            ORDER BY ordinal_position;
        `);

        console.log('Available columns in rsbsaform table:', columnCheck.rows.map(r => r.column_name));

        // Build a dynamic query based on available columns
        const availableColumns = columnCheck.rows.map(r => r.column_name);

        // Define the mapping of database columns to frontend fields
        const columnMapping = {
            'id': 'id',
            'enrollment_type': 'enrollmentType',
            'date_administered': 'dateAdministered',
            'reference_region': 'referenceRegion',
            'reference_province': 'referenceProvince',
            'reference_city_muni': 'referenceCityMuni',
            'reference_barangay': 'referenceBarangay',
            'profile_picture_url': 'profilePictureUrl',
            'surname': 'surname',
            'first_name': 'firstName',
            'middle_name': 'middleName',
            'extension_name': 'extensionName',
            'sex': 'sex',
            'address_house_no': 'addressHouseNo',
            'address_street': 'addressStreet',
            'address_barangay': 'addressBarangay',
            'address_municipality': 'addressMunicipality',
            'address_province': 'addressProvince',
            'address_region': 'addressRegion',
            'mobile_number': 'mobileNumber',
            'landline_number': 'landlineNumber',
            'date_of_birth': 'dateOfBirth',
            'place_of_birth': 'placeOfBirth',
            'religion': 'religion',
            'other_religion': 'otherReligion',
            'civil_status': 'civilStatus',
            'name_of_spouse': 'nameOfSpouse',
            'mother_maiden_name': 'motherMaidenName',
            'household_head': 'householdHead',
            'household_head_name': 'householdHeadName',
            'household_head_relationship': 'householdHeadRelationship',
            'male_household_members': 'maleHouseholdMembers',
            'female_household_members': 'femaleHouseholdMembers',
            'highest_formal_education': 'highestFormalEducation',
            'pwd': 'pwd',
            'ps_beneficiary': 'psBeneficiary',
            'indigenous_group': 'indigenousGroup',
            'indigenous_group_specify': 'indigenousGroupSpecify',
            'government_id': 'governmentId',
            'id_type': 'idType',
            'id_number': 'idNumber',
            'farmer_association': 'farmerAssociation',
            'farmer_association_specify': 'farmerAssociationSpecify',
            'emergency_contact_name': 'emergencyContactName',
            'emergency_contact_number': 'emergencyContactNumber',
            'main_livelihood': 'mainLivelihood',
            'gross_annual_income_farming': 'grossAnnualIncomeFarming',
            'gross_annual_income_nonfarming': 'grossAnnualIncomeNonFarming',
            'number_of_farm_parcels': 'numberOfFarmParcels',
            'farmers_in_rotation_p1': 'farmersInRotationP1',
            'farmers_in_rotation_p2': 'farmersInRotationP2',
            'farmers_in_rotation_p3': 'farmersInRotationP3',
            'document_url': 'documentUrl',
            'created_at': 'createdAt',
            // Farm land description fields
            'farm_land_description': 'farmLandDescription',
            'farm_location_barangay': 'farmLocationBarangay',
            'farm_location_city_municipality': 'farmLocationCityMunicipality',
            'total_farm_area': 'totalFarmArea',
            'within_ancestral_domain': 'withinAncestralDomain',
            'agrarian_reform_beneficiary': 'agrarianReformBeneficiary',
            'ownership_document_no': 'ownershipDocumentNo',
            // Ownership type fields
            'ownership_type_registered_owner': 'ownershipTypeRegisteredOwner',
            'ownership_type_tenant': 'ownershipTypeTenant',
            'ownership_type_tenant_land_owner': 'ownershipTypeTenantLandOwner',
            'ownership_type_lessee': 'ownershipTypeLessee',
            'ownership_type_lessee_land_owner': 'ownershipTypeLesseeLandOwner',
            'ownership_type_others': 'ownershipTypeOthers',
            'ownership_type_others_specify': 'ownershipTypeOthersSpecify',
            // Crop and farm details
            'crop_commodity': 'cropCommodity',
            'farm_size': 'farmSize',
            'number_of_head': 'numberOfHead',
            'farm_type': 'farmType',
            'organic_practitioner': 'organicPractitioner',
            'farm_remarks': 'farmRemarks'
        };

        // Build the SELECT clause with only available columns
        const selectColumns = [];
        for (const [dbColumn, frontendField] of Object.entries(columnMapping)) {
            if (availableColumns.includes(dbColumn)) {
                selectColumns.push(`${dbColumn} as "${frontendField}"`);
            }
        }

        if (selectColumns.length === 0) {
            return res.status(500).json({
                error: 'No valid columns found in rsbsaform table',
                availableColumns: availableColumns
            });
        }

        const selectClause = selectColumns.join(', ');
        const orderClause = availableColumns.includes('created_at') ? 'ORDER BY created_at DESC' : '';

        const query = `
            SELECT ${selectClause}
            FROM rsbsaform
            ${orderClause}
        `;

        console.log('Executing query:', query);

        const result = await pool.query(query);

        console.log(`Retrieved ${result.rows.length} RSBSA form records`);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching RSBSA form data:', error);
        res.status(500).json({
            error: 'Failed to fetch RSBSA form data',
            details: error.message,
            stack: error.stack
        });
    }
});

// GET endpoint to fetch a single RSBSA record by ID
app.get('/api/RSBSAform/:id', async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`Fetching RSBSA record with ID: ${id}`);

        // Check if the table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'rsbsaform'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('RSBSAform table does not exist');
            return res.status(404).json({
                error: 'RSBSAform table not found',
                message: 'The RSBSAform table does not exist in the database.'
            });
        }

        // Check what columns exist in the table
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'rsbsaform'
            ORDER BY ordinal_position;
        `);

        const availableColumns = columnCheck.rows.map(r => r.column_name);

        // Define the mapping of database columns to frontend fields
        const columnMapping = {
            'id': 'id',
            'enrollment_type': 'enrollmentType',
            'date_administered': 'dateAdministered',
            'reference_region': 'referenceRegion',
            'reference_province': 'referenceProvince',
            'reference_city_muni': 'referenceCityMuni',
            'reference_barangay': 'referenceBarangay',
            'profile_picture_url': 'profilePictureUrl',
            'surname': 'surname',
            'first_name': 'firstName',
            'middle_name': 'middleName',
            'extension_name': 'extensionName',
            'sex': 'sex',
            'address_house_no': 'addressHouseNo',
            'address_street': 'addressStreet',
            'address_barangay': 'addressBarangay',
            'address_municipality': 'addressMunicipality',
            'address_province': 'addressProvince',
            'address_region': 'addressRegion',
            'mobile_number': 'mobileNumber',
            'landline_number': 'landlineNumber',
            'date_of_birth': 'dateOfBirth',
            'place_of_birth': 'placeOfBirth',
            'religion': 'religion',
            'other_religion': 'otherReligion',
            'civil_status': 'civilStatus',
            'name_of_spouse': 'nameOfSpouse',
            'mother_maiden_name': 'motherMaidenName',
            'household_head': 'householdHead',
            'household_head_name': 'householdHeadName',
            'household_head_relationship': 'householdHeadRelationship',
            'male_household_members': 'maleHouseholdMembers',
            'female_household_members': 'femaleHouseholdMembers',
            'highest_formal_education': 'highestFormalEducation',
            'pwd': 'pwd',
            'ps_beneficiary': 'psBeneficiary',
            'indigenous_group': 'indigenousGroup',
            'indigenous_group_specify': 'indigenousGroupSpecify',
            'government_id': 'governmentId',
            'id_type': 'idType',
            'id_number': 'idNumber',
            'farmer_association': 'farmerAssociation',
            'farmer_association_specify': 'farmerAssociationSpecify',
            'emergency_contact_name': 'emergencyContactName',
            'emergency_contact_number': 'emergencyContactNumber',
            'main_livelihood': 'mainLivelihood',
            'gross_annual_income_farming': 'grossAnnualIncomeFarming',
            'gross_annual_income_nonfarming': 'grossAnnualIncomeNonFarming',
            'number_of_farm_parcels': 'numberOfFarmParcels',
            'farmers_in_rotation_p1': 'farmersInRotationP1',
            'farmers_in_rotation_p2': 'farmersInRotationP2',
            'farmers_in_rotation_p3': 'farmersInRotationP3',
            'document_url': 'documentUrl',
            'created_at': 'createdAt',
            // Farm land description fields
            'farm_land_description': 'farmLandDescription',
            'farm_location_barangay': 'farmLocationBarangay',
            'farm_location_city_municipality': 'farmLocationCityMunicipality',
            'total_farm_area': 'totalFarmArea',
            'within_ancestral_domain': 'withinAncestralDomain',
            'agrarian_reform_beneficiary': 'agrarianReformBeneficiary',
            'ownership_document_no': 'ownershipDocumentNo',
            // Ownership type fields
            'ownership_type_registered_owner': 'ownershipTypeRegisteredOwner',
            'ownership_type_tenant': 'ownershipTypeTenant',
            'ownership_type_tenant_land_owner': 'ownershipTypeTenantLandOwner',
            'ownership_type_lessee': 'ownershipTypeLessee',
            'ownership_type_lessee_land_owner': 'ownershipTypeLesseeLandOwner',
            'ownership_type_others': 'ownershipTypeOthers',
            'ownership_type_others_specify': 'ownershipTypeOthersSpecify',
            // Crop and farm details
            'crop_commodity': 'cropCommodity',
            'farm_size': 'farmSize',
            'number_of_head': 'numberOfHead',
            'farm_type': 'farmType',
            'organic_practitioner': 'organicPractitioner',
            'farm_remarks': 'farmRemarks'
        };

        // Build the SELECT clause with only available columns
        const selectColumns = [];
        for (const [dbColumn, frontendField] of Object.entries(columnMapping)) {
            if (availableColumns.includes(dbColumn)) {
                selectColumns.push(`${dbColumn} as "${frontendField}"`);
            }
        }

        if (selectColumns.length === 0) {
            return res.status(500).json({
                error: 'No valid columns found in rsbsaform table',
                availableColumns: availableColumns
            });
        }

        const selectClause = selectColumns.join(', ');

        const query = `
            SELECT ${selectClause}
            FROM rsbsaform
            WHERE id = $1
        `;

        console.log('Executing query:', query);

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'RSBSA record not found',
                message: `No RSBSA record found with ID: ${id}`
            });
        }

        console.log(`Retrieved RSBSA record with ID: ${id}`);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching RSBSA record:', error);
        res.status(500).json({
            error: 'Failed to fetch RSBSA record',
            details: error.message,
            stack: error.stack
        });
    }
});

// POST endpoint to save RSBSA form data
app.post('/api/RSBSAform', async (req, res) => {
    const data = req.body;
    try {
        // Extract farm land description data from the first farm parcel
        const firstParcel = data.farmParcels && data.farmParcels.length > 0 ? data.farmParcels[0] : {};

        const insertQuery = `
            INSERT INTO RSBSAform (
                enrollment_type, date_administered, reference_region, reference_province, reference_city_muni, reference_barangay,
                profile_picture_url, surname, first_name, middle_name, extension_name, sex, address_house_no, address_street,
                address_barangay, address_municipality, address_province, address_region, mobile_number, landline_number,
                date_of_birth, place_of_birth, religion, other_religion, civil_status, name_of_spouse, mother_maiden_name,
                household_head, household_head_name, household_head_relationship, male_household_members, female_household_members,
                highest_formal_education, pwd, ps_beneficiary, indigenous_group, indigenous_group_specify, government_id, id_type,
                id_number, farmer_association, farmer_association_specify, emergency_contact_name, emergency_contact_number,
                main_livelihood, gross_annual_income_farming, gross_annual_income_nonfarming, number_of_farm_parcels,
                farmers_in_rotation_p1, farmers_in_rotation_p2, farmers_in_rotation_p3, document_url,
                -- Farm land description fields
                farm_land_description, farm_location_barangay, farm_location_city_municipality, total_farm_area,
                within_ancestral_domain, agrarian_reform_beneficiary, ownership_document_no,
                -- Ownership type fields
                ownership_type_registered_owner, ownership_type_tenant, ownership_type_tenant_land_owner,
                ownership_type_lessee, ownership_type_lessee_land_owner, ownership_type_others, ownership_type_others_specify,
                -- Crop and farm details
                crop_commodity, farm_size, number_of_head, farm_type, organic_practitioner, farm_remarks
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
                $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60,
                $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72
            )
        `;

        // Create farm land description text
        const farmLandDescription = firstParcel.farmLocation ?
            `Farm Location: ${firstParcel.farmLocation.barangay || ''}, ${firstParcel.farmLocation.cityMunicipality || ''}. ` +
            `Total Farm Area: ${firstParcel.totalFarmArea || ''} ha. ` +
            `Within Ancestral Domain: ${firstParcel.withinAncestralDomain || ''}. ` +
            `Agrarian Reform Beneficiary: ${firstParcel.agrarianReformBeneficiary || ''}. ` +
            `Ownership Document No: ${firstParcel.ownershipDocumentNo || ''}. ` +
            `Crop/Commodity: ${firstParcel.cropCommodity || ''}. ` +
            `Size: ${firstParcel.size || ''} ha. ` +
            `Farm Type: ${firstParcel.farmType || ''}. ` +
            `Organic Practitioner: ${firstParcel.organicPractitioner || ''}. ` +
            `Remarks: ${firstParcel.remarks || ''}` : '';

        // Helper function to convert empty strings to null for integer fields
        const convertToInt = (value) => {
            if (value === '' || value === null || value === undefined) return null;
            const num = parseInt(value);
            return isNaN(num) ? null : num;
        };

        const values = [
            data.enrollmentType || null,        // 1
            data.dateAdministered || null,      // 2
            data.referenceNumber?.region || null, // 3
            data.referenceNumber?.province || null, // 4
            data.referenceNumber?.cityMuni || null, // 5
            data.referenceNumber?.barangay || null, // 6
            data.profilePictureUrl || null,     // 7
            data.surname || null,               // 8
            data.firstName || null,             // 9
            data.middleName || null,            // 10
            data.extensionName || null,         // 11
            data.sex || data.GENDER || null,    // 12
            data.address?.houseNo || null,      // 13
            data.address?.street || null,       // 14
            data.address?.barangay || null,     // 15
            data.address?.municipality || null, // 16
            data.address?.province || null,     // 17
            data.address?.region || null,       // 18
            data.mobileNumber || null,          // 19
            data.landlineNumber || null,        // 20
            data.dateOfBirth || null,           // 21
            data.placeOfBirth || null,          // 22
            data.religion || null,              // 23
            data.otherReligion || null,         // 24
            data.civilStatus || null,           // 25
            data.nameOfSpouse || null,          // 26
            data.motherMaidenName || null,      // 27
            data.householdHead || null,         // 28
            data.householdHeadName || null,     // 29
            data.householdHeadRelationship || null, // 30
            convertToInt(data.maleHouseholdMembers), // 31
            convertToInt(data.femaleHouseholdMembers), // 32
            data.highestFormalEducation || null,        // 33
            data.pwd || null,                           // 34
            data.psBeneficiary || null,                 // 35
            data.indigenousGroup || null,               // 36
            data.indigenousGroupSpecify || null,        // 37
            data.governmentId || null,                  // 38
            data.idType || null,                        // 39
            data.idNumber || null,                      // 40
            data.farmerAssociation || null,             // 41
            data.farmerAssociationSpecify || null,      // 42
            data.emergencyContact?.name || null,        // 43
            data.emergencyContact?.contactNumber || null, // 44
            data.mainLivelihood || null,                // 45
            data.grossAnnualIncome?.farming || null,    // 46
            data.grossAnnualIncome?.nonFarming || null, // 47
            data.numberOfFarmParcels || null,           // 48
            data.farmersInRotation?.p1 || null,         // 49
            data.farmersInRotation?.p2 || null,         // 50
            data.farmersInRotation?.p3 || null,         // 51
            data.documentUrl || null,                   // 52
            // Farm land description fields
            farmLandDescription || null,                // 53
            firstParcel.farmLocation?.barangay || null, // 54
            firstParcel.farmLocation?.cityMunicipality || null, // 55
            firstParcel.totalFarmArea || null,          // 56
            firstParcel.withinAncestralDomain || null,  // 57
            firstParcel.agrarianReformBeneficiary || null, // 58
            firstParcel.ownershipDocumentNo || null,    // 59
            // Ownership type fields
            firstParcel.ownershipType?.registeredOwner || false, // 60
            firstParcel.ownershipType?.tenant || false, // 61
            firstParcel.ownershipType?.tenantLandOwner || null, // 62
            firstParcel.ownershipType?.lessee || false, // 63
            firstParcel.ownershipType?.lesseeLandOwner || null, // 64
            firstParcel.ownershipType?.others || false, // 65
            firstParcel.ownershipType?.othersSpecify || null, // 66
            // Crop and farm details
            firstParcel.cropCommodity || null,          // 67
            firstParcel.size || null,                   // 68
            convertToInt(firstParcel.numberOfHead),     // 69
            firstParcel.farmType || null,               // 70
            firstParcel.organicPractitioner || null,    // 71
            firstParcel.remarks || null                 // 72
        ];

        console.log('Insert values:', values);
        await pool.query(insertQuery, values);
        res.status(201).json({ message: 'RSBSA form saved successfully!' });
    } catch (error) {
        console.error('Error saving RSBSA form:', error);
        res.status(500).json({ message: 'Error saving RSBSA form', error: error.message });
    }
});

// PUT endpoint to update RSBSA ownership type
app.put('/api/RSBSAform/:id/ownership', async (req, res) => {
    const { id } = req.params;
    const { ownershipType, landOwnerName } = req.body;

    try {
        // Reset all ownership type flags
        const updateQuery = `
            UPDATE rsbsaform 
            SET 
                ownership_type_registered_owner = false,
                ownership_type_tenant = false,
                ownership_type_tenant_land_owner = null,
                ownership_type_lessee = false,
                ownership_type_lessee_land_owner = null,
                ownership_type_others = false,
                ownership_type_others_specify = null
            WHERE id = $1
        `;

        await pool.query(updateQuery, [id]);

        // Set the appropriate ownership type based on the request
        let specificUpdateQuery = '';
        let values = [id];

        switch (ownershipType) {
            case 'REGISTERED OWNER':
                specificUpdateQuery = `
                    UPDATE rsbsaform 
                    SET ownership_type_registered_owner = true 
                    WHERE id = $1
                `;
                break;
            case 'TENANT':
                specificUpdateQuery = `
                    UPDATE rsbsaform 
                    SET ownership_type_tenant = true, ownership_type_tenant_land_owner = $2 
                    WHERE id = $1
                `;
                values.push(landOwnerName || null);
                break;
            case 'LESSEE':
                specificUpdateQuery = `
                    UPDATE rsbsaform 
                    SET ownership_type_lessee = true, ownership_type_lessee_land_owner = $2 
                    WHERE id = $1
                `;
                values.push(landOwnerName || null);
                break;
            case 'OTHERS':
                specificUpdateQuery = `
                    UPDATE rsbsaform 
                    SET ownership_type_others = true, ownership_type_others_specify = $2 
                    WHERE id = $1
                `;
                values.push(landOwnerName || null);
                break;
            default:
                return res.status(400).json({ message: 'Invalid ownership type' });
        }

        await pool.query(specificUpdateQuery, values);

        console.log(`Updated ownership type for RSBSA record ${id} to ${ownershipType}`);
        res.json({ message: 'Ownership type updated successfully' });
    } catch (error) {
        console.error('Error updating ownership type:', error);
        res.status(500).json({ message: 'Error updating ownership type', error: error.message });
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

// Endpoint to upload a photo for a farmer and insert into farmer_photos
app.post('/api/RSBSAform/:id/photo', upload.single('photo'), async (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Check if the farmer exists in rsbsaform table
    try {
        const farmerCheck = await pool.query('SELECT id FROM rsbsaform WHERE id = $1', [id]);
        if (farmerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Farmer not found' });
        }
    } catch (err) {
        console.error('Error checking farmer existence:', err);
        return res.status(500).json({ error: 'Database error while checking farmer' });
    }
    const filePath = `/uploads/${req.file.filename}`;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    try {
        // Insert into farmer_photos
        await pool.query(
            'INSERT INTO farmer_photos (farmer_id, file_name, file_path, file_size) VALUES ($1, $2, $3, $4)',
            [id, fileName, filePath, fileSize]
        );
        // Also update the latest photo_path in rsbsaform
        await pool.query(
            'UPDATE rsbsaform SET photo_path = $1 WHERE id = $2',
            [filePath, id]
        );
        res.json({ message: 'Photo uploaded successfully', filePath });
    } catch (err) {
        console.error('Error inserting photo:', err);
        if (err.code === '23503') {
            res.status(400).json({ error: 'Invalid farmer ID - farmer does not exist' });
        } else {
            res.status(500).json({ error: 'Failed to save photo to database' });
        }
    }
});

// GET all photos for a farmer
app.get('/api/RSBSAform/:id/photos', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT id, file_name, file_path, upload_time FROM farmer_photos WHERE farmer_id = $1 ORDER BY upload_time ASC',
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching farmer photos:', err);
        res.status(500).json({ error: 'Failed to fetch farmer photos' });
    }
});

// Endpoint to delete a photo from farmer_photos and remove the file from disk
app.delete('/api/RSBSAform/photo/:photoId', async (req, res) => {
    const { photoId } = req.params;
    try {
        // Get file path before deleting from DB
        const result = await pool.query('SELECT file_path FROM farmer_photos WHERE id = $1', [photoId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Photo not found' });
        }
        const filePath = result.rows[0].file_path;
        // Delete from DB
        await pool.query('DELETE FROM farmer_photos WHERE id = $1', [photoId]);
        // Delete file from disk
        const absolutePath = path.join(__dirname, filePath);
        fs.unlink(absolutePath, err => {
            // Ignore error if file doesn't exist
        });
        res.json({ message: 'Photo deleted successfully' });
    } catch (err) {
        console.error('Error deleting photo:', err);
        res.status(500).json({ error: 'Failed to delete photo' });
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