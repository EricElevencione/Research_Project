const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Import database pool
const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Masterlist',
    password: process.env.DB_PASSWORD || 'postgresadmin',
    port: process.env.DB_PORT || 5432,
});

// Import audit logging
const { logLogin, logCreate, getClientIp, AUDIT_MODULES } = require('../middleware/audit.cjs');

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/register
 * Register a new admin, technician, or JO user
 */
router.post('/register', async (req, res) => {
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
        const userCheck = await pool.query(
            'SELECT 1 FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
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
        console.error('Error in /api/auth/register:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * POST /api/auth/login
 * Authenticate user and return user info
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const clientIp = getClientIp(req);

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const userResult = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rowCount === 0) {
            // Log failed login attempt
            await logLogin(null, username, 'unknown', clientIp, false);
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const user = userResult.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            // Log failed login attempt
            await logLogin(user.id, username, user.role, clientIp, false);
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        // Log successful login
        await logLogin(user.id, user.username, user.role, clientIp, true);

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
        console.error('Error in /api/auth/login:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;
