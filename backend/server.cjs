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
    // 'file' is the name of the input field on the frontend
    const uploadedFile = req.file;

    // You can access other form data like uploadId via req.body
    // const uploadId = req.body.uploadId; 

    if (!uploadedFile) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('File received:', uploadedFile);
    let processedCount = 0;
    let errorMessage = null;

    const client = await pool.connect(); // Get a database client
    try {
        // Start a database transaction (optional, but recommended for data consistency)
        await client.query('BEGIN');

        // --- Optional: Update file_uploads table status to 'processing' ---
        // If you are sending uploadId from the frontend and tracking in file_uploads table
        // await client.query('UPDATE file_uploads SET status = $1, last_modified = CURRENT_TIMESTAMP WHERE id = $2', ['processing', uploadId]);

        // --- Parse the Excel file ---
        const workbook = XLSX.readFile(uploadedFile.path); // Read the file using xlsx
        const sheetName = workbook.SheetNames[0]; // Assume data is in the first sheet
        const worksheet = workbook.Sheets[sheetName];
        // Convert sheet to JSON array (header row is used as keys)
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log(`Parsed ${jsonData.length} rows from Excel.`);

        // --- Implement your data processing and database interaction logic here ---
        // Loop through the jsonData array:
        for (const row of jsonData) {
            // Example: Access data using column headers from the Excel file
            // const firstName = row['FIRST NAME'];
            // const parcelNo = row['PARCEL NO.'];

            // 1. Validate the data in the 'row' object
            // 2. Prepare your SQL INSERT or UPDATE query for the 'masterlist' table
            // 3. Execute the query using the 'client': await client.query('YOUR_SQL_QUERY', [values]);
            // 4. Increment processedCount if the operation was successful

            // --- Placeholder for your logic ---
            // Replace this with your actual database operations based on Excel data
            // Example: if (row['SomeRequiredColumn']) { 
            //              await client.query('INSERT INTO your_table ...', [...]); 
            //              processedCount++; 
            //          }
            // For now, just counting rows:
            processedCount++; // Remove this and use your actual logic
        }
        // --- End of data processing logic ---


        // --- Update file_uploads table status to 'completed' ---
        // If you are tracking in file_uploads table:
        // await client.query('UPDATE file_uploads SET status = $1, processed_records = $2, last_modified = CURRENT_TIMESTAMP WHERE id = $3', ['completed', processedCount, uploadId]);

        await client.query('COMMIT'); // Commit the transaction if everything was successful

        // Send success response
        res.json({ message: 'File processed successfully', processedRecords: processedCount });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback transaction on error
        console.error('Error processing file upload:', error);
        errorMessage = error.message;

        // --- Update file_uploads table status to 'failed' ---
        // If you are tracking in file_uploads table:
        // await client.query('UPDATE file_uploads SET status = $1, error_message = $2, last_modified = CURRENT_TIMESTAMP WHERE id = $3', ['failed', errorMessage, uploadId]);

        // Send error response
        res.status(500).json({ message: 'Error processing file', error: errorMessage });

    } finally {
        // Always release the database client
        client.release();
        // Always clean up the temporary uploaded file
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
