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

// Serve static files from the frontend build directory
// IMPORTANT: Replace '../dist' with the actual path to your frontend's build output directory
const frontendBuildPath = path.join(__dirname, '../dist'); // Assuming 'dist' is in the project root
app.use(express.static(frontendBuildPath));

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

        const insertQuery = `
    INSERT INTO land_plots (
        id, firstname, middlename, surname, gender, barangay_name, municipality_name, province_name, 
        status, street, farm_type, area, coordinateaccuracy, geom, createdat, updatedat, name,
        ffrs_id, ext_name, birthdate, parcel_address
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ST_GeomFromGeoJSON($14), $15, $16, $17,
        $18, $19, $20, $21
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
            landPlotData.parcel_address || null
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
                        "PARCEL AREA"
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

// For any requests not matching API routes, serve the frontend's index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
});