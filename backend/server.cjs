const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Database connection configuration
const pool = new Pool({
    user: 'postgres', // Replace with your PostgreSQL username
    host: 'localhost', // Replace with your PostgreSQL host (often localhost)
    database: 'Masterlist', // Corrected database name to 'Masterlist' based on image
    password: 'postgresadmin', // Replace with your PostgreSQL password
    port: 5432, // Replace with your PostgreSQL port (default is 5432)
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
        const result = await pool.query('SELECT "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "FARMER ADDRESS", "PARCEL NO.", "PARCEL ADDRESS", "PARCEL AREA" FROM public."masterlist"');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching land records:', err);
        res.status(500).send('Server Error');
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
