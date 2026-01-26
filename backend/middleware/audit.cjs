/**
 * Audit Trail Middleware and Utility Functions
 * 
 * This module provides middleware and helper functions for logging
 * all significant actions in the RSBSA Management System.
 */

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
// AUDIT LOG CONSTANTS
// ============================================================================

const AUDIT_ACTIONS = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    LOGIN_FAILED: 'LOGIN_FAILED',
    EXPORT: 'EXPORT',
    IMPORT: 'IMPORT',
    APPROVE: 'APPROVE',
    REJECT: 'REJECT',
    VIEW: 'VIEW',
    DOWNLOAD: 'DOWNLOAD',
    BULK_UPDATE: 'BULK_UPDATE',
    BULK_DELETE: 'BULK_DELETE',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
    DISTRIBUTE: 'DISTRIBUTE'
};

const AUDIT_MODULES = {
    AUTH: 'AUTH',
    RSBSA: 'RSBSA',
    FARMERS: 'FARMERS',
    DISTRIBUTION: 'DISTRIBUTION',
    INCENTIVES: 'INCENTIVES',
    LAND_PLOTS: 'LAND_PLOTS',
    LAND_HISTORY: 'LAND_HISTORY',
    REPORTS: 'REPORTS',
    SYSTEM: 'SYSTEM',
    USERS: 'USERS'
};

// ============================================================================
// CORE AUDIT LOGGING FUNCTION
// ============================================================================

/**
 * Log an action to the audit trail
 * 
 * @param {Object} options - Audit log options
 * @param {number} options.userId - ID of the user performing the action
 * @param {string} options.userName - Username of the user
 * @param {string} options.userRole - Role of the user (admin, technician, jo)
 * @param {string} options.action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @param {string} options.module - System module (RSBSA, DISTRIBUTION, etc.)
 * @param {string} options.recordId - ID of the affected record (optional)
 * @param {string} options.recordType - Type/table of the record (optional)
 * @param {string} options.description - Human-readable description
 * @param {Object} options.oldValues - Previous values before change (optional)
 * @param {Object} options.newValues - New values after change (optional)
 * @param {string} options.ipAddress - Client IP address (optional)
 * @param {string} options.sessionId - Session identifier (optional)
 * @param {Object} options.metadata - Additional context (optional)
 * @returns {Promise<Object>} - The created audit log entry
 */
async function logAudit(options) {
    const {
        userId = null,
        userName = 'SYSTEM',
        userRole = 'system',
        action,
        module,
        recordId = null,
        recordType = null,
        description,
        oldValues = null,
        newValues = null,
        ipAddress = null,
        sessionId = null,
        metadata = null
    } = options;

    try {
        const query = `
            INSERT INTO audit_logs (
                user_id, user_name, user_role, action, module,
                record_id, record_type, description,
                old_values, new_values,
                ip_address, session_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `;

        const values = [
            userId,
            userName,
            userRole,
            action,
            module,
            recordId,
            recordType,
            description,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            ipAddress,
            sessionId,
            metadata ? JSON.stringify(metadata) : null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error logging audit entry:', error);
        // Don't throw - audit logging should not break the application
        return null;
    }
}

// ============================================================================
// HELPER FUNCTIONS FOR COMMON AUDIT SCENARIOS
// ============================================================================

/**
 * Log a user login event
 */
async function logLogin(userId, userName, userRole, ipAddress, success = true) {
    return logAudit({
        userId,
        userName,
        userRole,
        action: success ? AUDIT_ACTIONS.LOGIN : AUDIT_ACTIONS.LOGIN_FAILED,
        module: AUDIT_MODULES.AUTH,
        recordType: 'users',
        description: success
            ? `User ${userName} logged in successfully`
            : `Failed login attempt for user ${userName}`,
        ipAddress,
        metadata: { success }
    });
}

/**
 * Log a user logout event
 */
async function logLogout(userId, userName, userRole, ipAddress) {
    return logAudit({
        userId,
        userName,
        userRole,
        action: AUDIT_ACTIONS.LOGOUT,
        module: AUDIT_MODULES.AUTH,
        recordType: 'users',
        description: `User ${userName} logged out`,
        ipAddress
    });
}

/**
 * Log a record creation event
 */
async function logCreate(user, module, recordId, recordType, description, newValues, req = null) {
    return logAudit({
        userId: user.id,
        userName: user.username,
        userRole: user.role,
        action: AUDIT_ACTIONS.CREATE,
        module,
        recordId: String(recordId),
        recordType,
        description,
        newValues,
        ipAddress: req ? getClientIp(req) : null
    });
}

/**
 * Log a record update event
 */
async function logUpdate(user, module, recordId, recordType, description, oldValues, newValues, req = null) {
    return logAudit({
        userId: user.id,
        userName: user.username,
        userRole: user.role,
        action: AUDIT_ACTIONS.UPDATE,
        module,
        recordId: String(recordId),
        recordType,
        description,
        oldValues,
        newValues,
        ipAddress: req ? getClientIp(req) : null
    });
}

/**
 * Log a record deletion event
 */
async function logDelete(user, module, recordId, recordType, description, oldValues, req = null) {
    return logAudit({
        userId: user.id,
        userName: user.username,
        userRole: user.role,
        action: AUDIT_ACTIONS.DELETE,
        module,
        recordId: String(recordId),
        recordType,
        description,
        oldValues,
        ipAddress: req ? getClientIp(req) : null
    });
}

/**
 * Log an approval event
 */
async function logApproval(user, module, recordId, recordType, description, approved = true, req = null) {
    return logAudit({
        userId: user.id,
        userName: user.username,
        userRole: user.role,
        action: approved ? AUDIT_ACTIONS.APPROVE : AUDIT_ACTIONS.REJECT,
        module,
        recordId: String(recordId),
        recordType,
        description,
        ipAddress: req ? getClientIp(req) : null,
        metadata: { approved }
    });
}

/**
 * Log a distribution event
 */
async function logDistribution(user, recordId, farmerName, items, req = null) {
    return logAudit({
        userId: user.id,
        userName: user.username,
        userRole: user.role,
        action: AUDIT_ACTIONS.DISTRIBUTE,
        module: AUDIT_MODULES.DISTRIBUTION,
        recordId: String(recordId),
        recordType: 'distribution_logs',
        description: `Distributed items to farmer ${farmerName}`,
        newValues: items,
        ipAddress: req ? getClientIp(req) : null
    });
}

/**
 * Log an export event
 */
async function logExport(user, module, description, metadata = {}, req = null) {
    return logAudit({
        userId: user.id,
        userName: user.username,
        userRole: user.role,
        action: AUDIT_ACTIONS.EXPORT,
        module,
        description,
        ipAddress: req ? getClientIp(req) : null,
        metadata
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get client IP address from request
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.connection?.remoteAddress
        || req.socket?.remoteAddress
        || req.ip
        || null;
}

/**
 * Calculate the difference between two objects
 * Returns only the fields that changed
 */
function getChangedFields(oldObj, newObj) {
    const changes = {};
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

    allKeys.forEach(key => {
        const oldVal = oldObj?.[key];
        const newVal = newObj?.[key];

        // Skip if both are null/undefined
        if (oldVal == null && newVal == null) return;

        // Compare JSON stringified values for objects
        const oldStr = JSON.stringify(oldVal);
        const newStr = JSON.stringify(newVal);

        if (oldStr !== newStr) {
            changes[key] = {
                old: oldVal,
                new: newVal
            };
        }
    });

    return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Sanitize sensitive data before logging
 * Removes passwords, tokens, etc.
 */
function sanitizeForAudit(obj) {
    if (!obj) return null;

    const sensitiveFields = ['password', 'password_hash', 'token', 'access_token', 'refresh_token', 'secret'];
    const sanitized = { ...obj };

    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });

    return sanitized;
}

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

/**
 * Middleware to attach user info to request for audit logging
 * Should be used after authentication middleware
 */
function attachAuditContext(req, res, next) {
    // Store the original json method
    const originalJson = res.json.bind(res);

    // Attach IP to request
    req.clientIp = getClientIp(req);

    // Override json to potentially log responses
    res.json = function (data) {
        // Store response data for potential logging
        res.auditData = data;
        return originalJson(data);
    };

    next();
}

/**
 * Create audit middleware for specific routes
 * @param {Object} options - Middleware options
 */
function createAuditMiddleware(options = {}) {
    const {
        module = AUDIT_MODULES.SYSTEM,
        action = null,
        getRecordId = null,
        getDescription = null
    } = options;

    return async (req, res, next) => {
        // Store original end method
        const originalEnd = res.end;

        res.end = async function (...args) {
            // Only log successful responses (2xx)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const user = req.user || { id: null, username: 'anonymous', role: 'anonymous' };
                    const recordId = getRecordId ? getRecordId(req, res) : req.params.id;
                    const description = getDescription
                        ? getDescription(req, res)
                        : `${req.method} ${req.originalUrl}`;

                    await logAudit({
                        userId: user.id,
                        userName: user.username,
                        userRole: user.role,
                        action: action || req.method,
                        module,
                        recordId,
                        description,
                        ipAddress: req.clientIp
                    });
                } catch (err) {
                    console.error('Audit middleware error:', err);
                }
            }

            return originalEnd.apply(this, args);
        };

        next();
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Core function
    logAudit,

    // Helper functions
    logLogin,
    logLogout,
    logCreate,
    logUpdate,
    logDelete,
    logApproval,
    logDistribution,
    logExport,

    // Utilities
    getClientIp,
    getChangedFields,
    sanitizeForAudit,

    // Middleware
    attachAuditContext,
    createAuditMiddleware,

    // Constants
    AUDIT_ACTIONS,
    AUDIT_MODULES,

    // Database pool (for direct queries if needed)
    pool
};
