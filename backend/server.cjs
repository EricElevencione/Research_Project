const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // Import multer
const XLSX = require('xlsx');   // Import xlsx
const fs = require('fs');       // Import file system module for cleanup

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

// For any requests not matching API routes, serve the frontend's index.html
// This is important for client-side routing (like React Router)
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
});
