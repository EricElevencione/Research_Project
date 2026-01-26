/**
 * RSBSA Management System - Main Server
 * 
 * This is the main entry point for the backend server.
 * All route handlers have been modularized into separate files in the /routes directory.
 * 
 * Route Structure:
 * - /api/health          - Health check endpoints
 * - /api/auth            - Authentication (login, register)
 * - /api/landowners      - Landowner management
 * - /api/lands           - Land records
 * - /api/land-plots      - Land plots (database-backed)
 * - /api/spatial         - Spatial analysis (PostGIS)
 * - /api/rsbsa_submission - RSBSA submission management
 * - /api/rsbsa-farm-parcels - Farm parcel management
 * - /api/farmers         - Farmer summaries
 * - /api/land-history    - Land ownership history
 * - /api/distribution    - Agricultural input distribution system
 * - /api/transfer-ownership - Ownership transfer
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================
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
    console.log('✅ Successfully connected to database');
    release();
});

// ============================================================================
// IMPORT ROUTES
// ============================================================================
const healthRoutes = require('./routes/health.cjs');
const authRoutes = require('./routes/auth.cjs');
const landownerRoutes = require('./routes/landowner.cjs');
const landsRoutes = require('./routes/lands.cjs');
const landPlotsRoutes = require('./routes/land-plots.cjs');
const spatialQueriesRoutes = require('./routes/spatial-queries.cjs');
const rsbsaSubmissionRoutes = require('./routes/rsbsa_submission.cjs');
const rsbsaFarmParcelsRoutes = require('./routes/rsbsa-farm-parcels.cjs');
const farmersRoutes = require('./routes/farmers.cjs');
const landHistoryRoutes = require('./routes/land-history.cjs');
const distributionRoutes = require('./routes/distribution.cjs');
const transferRoutes = require('./routes/transfer.cjs');
const auditRoutes = require('./routes/audit.cjs');

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================
const app = express();
const port = process.env.PORT || 5000;

console.log('server.cjs is running and loaded');

// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// STATIC FILES
// ============================================================================
const frontendBuildPath = path.join(__dirname, '../dist');
app.use(express.static(frontendBuildPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================================
// API ROUTES
// ============================================================================

// Health check
app.use('/api/health', healthRoutes);

// Authentication
app.use('/api', authRoutes); // Provides /api/register and /api/login

// Core RSBSA routes
app.use('/api/landowners', landownerRoutes);
app.use('/api/lands', landsRoutes);
app.use('/api/land-plots', landPlotsRoutes);
app.use('/api/spatial', spatialQueriesRoutes);
app.use('/api/rsbsa_submission', rsbsaSubmissionRoutes);
app.use('/api/rsbsa_farm_parcels', rsbsaFarmParcelsRoutes);
app.use('/api/rsbsa-farm-parcels', rsbsaFarmParcelsRoutes); // Alias with hyphens
app.use('/api/farmers', farmersRoutes);

// Land history & ownership
app.use('/api/land-history', landHistoryRoutes);
app.use('/api/land_rights_history', landHistoryRoutes); // Legacy route alias -> uses /rights endpoint
app.use('/api/crop-planting-info', (req, res, next) => {
    // Redirect to land-history router's crop-planting-info endpoint
    req.url = '/crop-planting-info' + req.url;
    landHistoryRoutes(req, res, next);
});
app.use('/api/land-owners-with-tenants', (req, res, next) => {
    // Redirect to land-history router's owners-with-tenants endpoint
    req.url = '/owners-with-tenants';
    landHistoryRoutes(req, res, next);
});

// Ownership transfer
app.use('/api/transfer-ownership', transferRoutes);

// Agricultural input distribution system (DSS)
app.use('/api/distribution', distributionRoutes);

// Audit trail system
app.use('/api/audit', auditRoutes);

// ============================================================================
// CATCH-ALL ROUTE - MUST BE AFTER ALL API ENDPOINTS
// ============================================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// ============================================================================
// START SERVER
// ============================================================================
app.listen(port, () => {
    console.log(`\n🚀 Backend server listening on port ${port}`);
    console.log('✅ All API endpoints registered successfully');
    console.log('✅ Modular route structure active');
    console.log('\n📁 Route modules loaded:');
    console.log('   - /api/health');
    console.log('   - /api/auth (register, login)');
    console.log('   - /api/landowners');
    console.log('   - /api/lands');
    console.log('   - /api/land-plots');
    console.log('   - /api/spatial');
    console.log('   - /api/rsbsa_submission');
    console.log('   - /api/rsbsa-farm-parcels');
    console.log('   - /api/farmers');
    console.log('   - /api/land-history');
    console.log('   - /api/distribution');
    console.log('   - /api/transfer-ownership');
    console.log('   - /api/audit\n');
});
