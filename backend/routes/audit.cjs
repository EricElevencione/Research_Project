/**
 * Audit Trail API Routes
 * 
 * Provides endpoints for viewing, filtering, and managing audit logs.
 * Access restricted to admin users only.
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Masterlist',
    password: process.env.DB_PASSWORD || 'postgresadmin',
    port: process.env.DB_PORT || 5432,
});

// ============================================================================
// GET /api/audit/logs
// Fetch audit logs with filtering, pagination, and search
// ============================================================================
router.get('/logs', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            startDate,
            endDate,
            userId,
            userName,
            userRole,
            action,
            module,
            recordType,
            search
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const conditions = [];
        const values = [];
        let paramCount = 0;

        // Build dynamic WHERE conditions
        if (startDate) {
            paramCount++;
            conditions.push(`timestamp >= $${paramCount}::timestamptz`);
            values.push(startDate);
        }

        if (endDate) {
            paramCount++;
            conditions.push(`timestamp <= $${paramCount}::timestamptz`);
            values.push(endDate + ' 23:59:59');
        }

        if (userId) {
            paramCount++;
            conditions.push(`user_id = $${paramCount}`);
            values.push(parseInt(userId));
        }

        if (userName) {
            paramCount++;
            conditions.push(`user_name ILIKE $${paramCount}`);
            values.push(`%${userName}%`);
        }

        if (userRole) {
            paramCount++;
            conditions.push(`user_role = $${paramCount}`);
            values.push(userRole);
        }

        if (action) {
            paramCount++;
            conditions.push(`action = $${paramCount}`);
            values.push(action);
        }

        if (module) {
            paramCount++;
            conditions.push(`module = $${paramCount}`);
            values.push(module);
        }

        if (recordType) {
            paramCount++;
            conditions.push(`record_type = $${paramCount}`);
            values.push(recordType);
        }

        if (search) {
            paramCount++;
            conditions.push(`(
                description ILIKE $${paramCount} OR 
                user_name ILIKE $${paramCount} OR 
                record_id ILIKE $${paramCount}
            )`);
            values.push(`%${search}%`);
        }

        const whereClause = conditions.length > 0
            ? 'WHERE ' + conditions.join(' AND ')
            : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`;
        const countResult = await pool.query(countQuery, values);
        const totalCount = parseInt(countResult.rows[0].count);

        // Get paginated results
        paramCount++;
        values.push(parseInt(limit));
        paramCount++;
        values.push(offset);

        const query = `
            SELECT 
                id,
                timestamp,
                user_id,
                user_name,
                user_role,
                action,
                module,
                record_id,
                record_type,
                description,
                old_values,
                new_values,
                ip_address,
                session_id,
                metadata,
                TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_timestamp
            FROM audit_logs 
            ${whereClause}
            ORDER BY timestamp DESC
            LIMIT $${paramCount - 1} OFFSET $${paramCount}
        `;

        const result = await pool.query(query, values);

        res.json({
            logs: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalCount,
                totalPages: Math.ceil(totalCount / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// ============================================================================
// GET /api/audit/logs/:id
// Get a single audit log entry with full details
// ============================================================================
router.get('/logs/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                id,
                timestamp,
                user_id,
                user_name,
                user_role,
                action,
                module,
                record_id,
                record_type,
                description,
                old_values,
                new_values,
                ip_address,
                session_id,
                metadata,
                TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_timestamp
            FROM audit_logs 
            WHERE id = $1
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Audit log not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error fetching audit log:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

// ============================================================================
// GET /api/audit/stats
// Get audit log statistics for dashboard
// ============================================================================
router.get('/stats', async (req, res) => {
    try {
        const { days = 7 } = req.query;

        // Total logs in period
        const totalQuery = `
            SELECT COUNT(*) as total
            FROM audit_logs
            WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
        `;
        const totalResult = await pool.query(totalQuery);

        // Logs by action
        const actionQuery = `
            SELECT action, COUNT(*) as count
            FROM audit_logs
            WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY action
            ORDER BY count DESC
        `;
        const actionResult = await pool.query(actionQuery);

        // Logs by module
        const moduleQuery = `
            SELECT module, COUNT(*) as count
            FROM audit_logs
            WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY module
            ORDER BY count DESC
        `;
        const moduleResult = await pool.query(moduleQuery);

        // Logs by user
        const userQuery = `
            SELECT user_name, user_role, COUNT(*) as count
            FROM audit_logs
            WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY user_name, user_role
            ORDER BY count DESC
            LIMIT 10
        `;
        const userResult = await pool.query(userQuery);

        // Activity timeline (daily counts)
        const timelineQuery = `
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as count
            FROM audit_logs
            WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY DATE(timestamp)
            ORDER BY date
        `;
        const timelineResult = await pool.query(timelineQuery);

        // Recent critical actions (login failures, deletes)
        const criticalQuery = `
            SELECT *
            FROM audit_logs
            WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
            AND (action IN ('DELETE', 'LOGIN_FAILED', 'BULK_DELETE') OR user_role = 'admin')
            ORDER BY timestamp DESC
            LIMIT 10
        `;
        const criticalResult = await pool.query(criticalQuery);

        res.json({
            period: `${days} days`,
            total: parseInt(totalResult.rows[0].total),
            byAction: actionResult.rows,
            byModule: moduleResult.rows,
            byUser: userResult.rows,
            timeline: timelineResult.rows,
            criticalActions: criticalResult.rows
        });

    } catch (error) {
        console.error('Error fetching audit stats:', error);
        res.status(500).json({ error: 'Failed to fetch audit statistics' });
    }
});

// ============================================================================
// GET /api/audit/users
// Get list of users who have audit logs (for filter dropdown)
// ============================================================================
router.get('/users', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT user_name, user_role
            FROM audit_logs
            ORDER BY user_name
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching audit users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ============================================================================
// GET /api/audit/actions
// Get list of unique actions (for filter dropdown)
// ============================================================================
router.get('/actions', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT action
            FROM audit_logs
            ORDER BY action
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(r => r.action));
    } catch (error) {
        console.error('Error fetching audit actions:', error);
        res.status(500).json({ error: 'Failed to fetch actions' });
    }
});

// ============================================================================
// GET /api/audit/modules
// Get list of unique modules (for filter dropdown)
// ============================================================================
router.get('/modules', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT module
            FROM audit_logs
            ORDER BY module
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(r => r.module));
    } catch (error) {
        console.error('Error fetching audit modules:', error);
        res.status(500).json({ error: 'Failed to fetch modules' });
    }
});

// ============================================================================
// GET /api/audit/export
// Export audit logs as JSON (could be extended to CSV)
// ============================================================================
router.get('/export', async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            format = 'json'
        } = req.query;

        let query = `
            SELECT 
                id,
                TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') as timestamp,
                user_name,
                user_role,
                action,
                module,
                record_id,
                record_type,
                description,
                ip_address
            FROM audit_logs
        `;

        const conditions = [];
        const values = [];

        if (startDate) {
            conditions.push(`timestamp >= $${conditions.length + 1}::timestamptz`);
            values.push(startDate);
        }

        if (endDate) {
            conditions.push(`timestamp <= $${conditions.length + 1}::timestamptz`);
            values.push(endDate + ' 23:59:59');
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY timestamp DESC';

        const result = await pool.query(query, values);

        if (format === 'csv') {
            // Convert to CSV
            const headers = ['ID', 'Timestamp', 'User', 'Role', 'Action', 'Module', 'Record ID', 'Record Type', 'Description', 'IP Address'];
            const csvRows = [headers.join(',')];

            result.rows.forEach(row => {
                csvRows.push([
                    row.id,
                    row.timestamp,
                    `"${row.user_name}"`,
                    row.user_role,
                    row.action,
                    row.module,
                    row.record_id || '',
                    row.record_type || '',
                    `"${(row.description || '').replace(/"/g, '""')}"`,
                    row.ip_address || ''
                ].join(','));
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
            return res.send(csvRows.join('\n'));
        }

        // Default: JSON export
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.json`);
        res.json({
            exportDate: new Date().toISOString(),
            totalRecords: result.rows.length,
            logs: result.rows
        });

    } catch (error) {
        console.error('Error exporting audit logs:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});

// ============================================================================
// GET /api/audit/record/:type/:id
// Get all audit logs for a specific record
// ============================================================================
router.get('/record/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;

        const query = `
            SELECT 
                id,
                timestamp,
                user_name,
                user_role,
                action,
                description,
                old_values,
                new_values,
                TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_timestamp
            FROM audit_logs
            WHERE record_type = $1 AND record_id = $2
            ORDER BY timestamp DESC
        `;

        const result = await pool.query(query, [type, id]);

        res.json({
            recordType: type,
            recordId: id,
            history: result.rows
        });

    } catch (error) {
        console.error('Error fetching record history:', error);
        res.status(500).json({ error: 'Failed to fetch record history' });
    }
});

module.exports = router;
