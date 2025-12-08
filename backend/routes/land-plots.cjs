const express = require('express');
const router = express.Router();

// Import database pool
const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Masterlist',
    password: process.env.DB_PASSWORD || 'postgresadmin',
    port: process.env.DB_PORT || 5432,
});

// ============================================================================
// GET /api/land-plots - Fetch all land plots
// ============================================================================
router.get('/', async (req, res) => {
    try {
        console.log('📋 GET /api/land-plots - Fetching all land plots');

        const result = await pool.query(`
            SELECT 
                id,
                name,
                ffrs_id,
                area,
                coordinate_accuracy,
                barangay,
                first_name,
                middle_name,
                surname,
                ext_name,
                gender,
                municipality,
                province,
                parcel_address,
                status,
                street,
                farm_type,
                plot_source,
                parcel_number,
                geometry,
                created_at,
                updated_at
            FROM land_plots
            ORDER BY created_at DESC
        `);

        console.log(`✅ Found ${result.rows.length} land plots`);
        res.json(result.rows);

    } catch (error) {
        console.error('❌ Error fetching land plots:', error.message);
        res.status(500).json({
            message: 'Failed to load land plots',
            error: error.message
        });
    }
});

// ============================================================================
// POST /api/land-plots - Create a new land plot
// ============================================================================
router.post('/', async (req, res) => {
    try {
        const body = req.body || {};

        console.log('📝 POST /api/land-plots - Creating new land plot');

        // Validate required fields
        if (!body.geometry) {
            return res.status(400).json({ message: 'Missing geometry' });
        }

        // Generate ID if not provided
        if (!body.id) {
            body.id = `plot-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }

        // Check if ID already exists
        const existsResult = await pool.query(
            'SELECT id FROM land_plots WHERE id = $1',
            [body.id]
        );

        if (existsResult.rowCount > 0) {
            return res.status(409).json({ message: 'Plot with id already exists' });
        }

        // Insert new land plot
        const insertQuery = `
            INSERT INTO land_plots (
                id, name, ffrs_id, area, coordinate_accuracy,
                barangay, first_name, middle_name, surname, ext_name,
                gender, municipality, province, parcel_address, status,
                street, farm_type, plot_source, parcel_number, geometry,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22
            )
            RETURNING *
        `;

        const now = new Date();
        const values = [
            body.id,
            body.name || '',
            body.ffrs_id || '',
            body.area || 0,
            body.coordinateAccuracy || 'approximate',
            body.barangay || '',
            body.firstName || '',
            body.middleName || '',
            body.surname || '',
            body.ext_name || '',
            body.gender || '',
            body.municipality || '',
            body.province || '',
            body.parcel_address || '',
            body.status || '',
            body.street || '',
            body.farmType || '',
            body.plotSource || 'manual',
            body.parcelNumber || '',
            JSON.stringify(body.geometry),
            body.createdAt || now,
            body.updatedAt || now
        ];

        const result = await pool.query(insertQuery, values);

        console.log(`✅ Created land plot with ID: ${body.id}`);
        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error('❌ Error creating land plot:', error.message);
        res.status(500).json({
            message: 'Failed to save land plot',
            error: error.message
        });
    }
});

// ============================================================================
// PUT /api/land-plots/:id - Update an existing land plot
// ============================================================================
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};

        console.log(`📝 PUT /api/land-plots/${id} - Updating land plot`);

        // Check if land plot exists
        const existsResult = await pool.query(
            'SELECT id FROM land_plots WHERE id = $1',
            [id]
        );

        if (existsResult.rowCount === 0) {
            return res.status(404).json({ message: 'Plot not found' });
        }

        // Build dynamic UPDATE query
        const allowedFields = {
            name: 'name',
            ffrs_id: 'ffrs_id',
            area: 'area',
            coordinateAccuracy: 'coordinate_accuracy',
            barangay: 'barangay',
            firstName: 'first_name',
            middleName: 'middle_name',
            surname: 'surname',
            ext_name: 'ext_name',
            gender: 'gender',
            municipality: 'municipality',
            province: 'province',
            parcel_address: 'parcel_address',
            status: 'status',
            street: 'street',
            farmType: 'farm_type',
            plotSource: 'plot_source',
            parcelNumber: 'parcel_number',
            geometry: 'geometry'
        };

        const updateFields = [];
        const values = [];
        let paramCounter = 1;

        for (const [bodyKey, dbColumn] of Object.entries(allowedFields)) {
            if (body[bodyKey] !== undefined) {
                // Special handling for geometry (JSONB)
                if (bodyKey === 'geometry') {
                    updateFields.push(`${dbColumn} = $${paramCounter}`);
                    values.push(JSON.stringify(body[bodyKey]));
                } else {
                    updateFields.push(`${dbColumn} = $${paramCounter}`);
                    values.push(body[bodyKey]);
                }
                paramCounter++;
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        // Add updated_at timestamp
        updateFields.push(`updated_at = $${paramCounter}`);
        values.push(new Date());
        paramCounter++;

        // Add ID as last parameter
        values.push(id);

        const updateQuery = `
            UPDATE land_plots
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING *
        `;

        const result = await pool.query(updateQuery, values);

        console.log(`✅ Updated land plot: ${id}`);
        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Error updating land plot:', error.message);
        res.status(500).json({
            message: 'Failed to update land plot',
            error: error.message
        });
    }
});

// ============================================================================
// DELETE /api/land-plots/:id - Delete a land plot
// ============================================================================
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`🗑️ DELETE /api/land-plots/${id} - Deleting land plot`);

        const result = await pool.query(
            'DELETE FROM land_plots WHERE id = $1 RETURNING id',
            [id]
        );

        console.log(`🔍 Delete result - rowCount: ${result.rowCount}`);

        if (result.rowCount === 0) {
            console.log(`⚠️ Plot not found: ${id}`);
            return res.status(404).json({ message: 'Plot not found' });
        }

        console.log(`✅ Deleted land plot: ${id}`);
        res.json({ success: true, deletedId: id });

    } catch (error) {
        console.error('❌ Error deleting land plot:', error.message);
        res.status(500).json({
            message: 'Failed to delete land plot',
            error: error.message
        });
    }
});

module.exports = router;
