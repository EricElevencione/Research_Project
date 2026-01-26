-- ============================================================================
-- AUDIT LOGS TABLE
-- Tracks all significant actions and changes made in the RSBSA system
-- ============================================================================

-- Create the audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- User information
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    
    -- Action information
    action VARCHAR(50) NOT NULL,  -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, APPROVE, REJECT, etc.
    module VARCHAR(100) NOT NULL, -- RSBSA, DISTRIBUTION, INCENTIVES, AUTH, FARMERS, LAND_PLOTS, etc.
    
    -- Record information
    record_id VARCHAR(100),       -- ID of the affected record (can be NULL for system actions)
    record_type VARCHAR(100),     -- Table/entity name (farmers, distributions, allocations, etc.)
    
    -- Description
    description TEXT NOT NULL,
    
    -- Change tracking (JSONB for flexibility)
    old_values JSONB,             -- Previous state (for updates/deletes)
    new_values JSONB,             -- New state (for creates/updates)
    
    -- Context information
    ip_address VARCHAR(45),       -- IPv4 or IPv6
    session_id VARCHAR(255),
    
    -- Additional metadata
    metadata JSONB                -- For any additional context
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_role ON audit_logs(user_role);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_action ON audit_logs(module, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp_module ON audit_logs(timestamp DESC, module);

-- GIN index for JSONB searches (if needed)
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON audit_logs USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_values ON audit_logs USING GIN(old_values);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_values ON audit_logs USING GIN(new_values);

-- Comments for documentation
COMMENT ON TABLE audit_logs IS 'Stores all audit trail records for system activity tracking';
COMMENT ON COLUMN audit_logs.action IS 'Type of action: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, APPROVE, REJECT, VIEW, DOWNLOAD';
COMMENT ON COLUMN audit_logs.module IS 'System module: AUTH, RSBSA, DISTRIBUTION, INCENTIVES, FARMERS, LAND_PLOTS, REPORTS, SYSTEM';
COMMENT ON COLUMN audit_logs.old_values IS 'JSON object containing previous values before update/delete';
COMMENT ON COLUMN audit_logs.new_values IS 'JSON object containing new values after create/update';

-- ============================================================================
-- SAMPLE AUDIT LOG ENTRIES (for testing)
-- ============================================================================

-- Uncomment to insert sample data
/*
INSERT INTO audit_logs (user_name, user_role, action, module, record_id, record_type, description, ip_address)
VALUES 
    ('admin.dev', 'admin', 'LOGIN', 'AUTH', NULL, 'users', 'User logged in successfully', '192.168.1.100'),
    ('juan.jo', 'jo', 'CREATE', 'RSBSA', 'RSBSA-2026-00145', 'rsbsa_submission', 'Created new RSBSA registration for farmer Pedro Santos', '192.168.1.101'),
    ('maria.tech', 'technician', 'UPDATE', 'FARMERS', '12345', 'farmers', 'Updated farmer contact information', '192.168.1.102'),
    ('admin.dev', 'admin', 'APPROVE', 'DISTRIBUTION', 'wet_2026', 'regional_allocations', 'Approved regional allocation for Wet 2026 season', '192.168.1.100');
*/

-- ============================================================================
-- FUNCTION TO AUTOMATICALLY LOG CHANGES (Optional - for trigger-based logging)
-- ============================================================================

-- This function can be used with triggers to automatically log changes
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_name VARCHAR(255);
    audit_user_role VARCHAR(50);
    audit_action VARCHAR(50);
    audit_old_values JSONB;
    audit_new_values JSONB;
BEGIN
    -- Get user info from session variable (if set)
    audit_user_name := COALESCE(current_setting('app.current_user_name', true), 'SYSTEM');
    audit_user_role := COALESCE(current_setting('app.current_user_role', true), 'system');
    
    IF TG_OP = 'INSERT' THEN
        audit_action := 'CREATE';
        audit_old_values := NULL;
        audit_new_values := to_jsonb(NEW);
        
        INSERT INTO audit_logs (user_name, user_role, action, module, record_id, record_type, description, old_values, new_values)
        VALUES (audit_user_name, audit_user_role, audit_action, TG_TABLE_SCHEMA, NEW.id::TEXT, TG_TABLE_NAME, 
                'Created new record in ' || TG_TABLE_NAME, audit_old_values, audit_new_values);
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        audit_action := 'UPDATE';
        audit_old_values := to_jsonb(OLD);
        audit_new_values := to_jsonb(NEW);
        
        INSERT INTO audit_logs (user_name, user_role, action, module, record_id, record_type, description, old_values, new_values)
        VALUES (audit_user_name, audit_user_role, audit_action, TG_TABLE_SCHEMA, NEW.id::TEXT, TG_TABLE_NAME,
                'Updated record in ' || TG_TABLE_NAME, audit_old_values, audit_new_values);
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        audit_action := 'DELETE';
        audit_old_values := to_jsonb(OLD);
        audit_new_values := NULL;
        
        INSERT INTO audit_logs (user_name, user_role, action, module, record_id, record_type, description, old_values, new_values)
        VALUES (audit_user_name, audit_user_role, audit_action, TG_TABLE_SCHEMA, OLD.id::TEXT, TG_TABLE_NAME,
                'Deleted record from ' || TG_TABLE_NAME, audit_old_values, audit_new_values);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEW FOR EASY AUDIT LOG QUERIES
-- ============================================================================

CREATE OR REPLACE VIEW audit_logs_view AS
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
    -- Formatted timestamp for display
    TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_timestamp,
    -- Date only for grouping
    DATE(timestamp) as log_date,
    -- Time ago calculation
    CASE 
        WHEN timestamp > NOW() - INTERVAL '1 minute' THEN 'Just now'
        WHEN timestamp > NOW() - INTERVAL '1 hour' THEN EXTRACT(MINUTE FROM NOW() - timestamp)::INT || ' minutes ago'
        WHEN timestamp > NOW() - INTERVAL '1 day' THEN EXTRACT(HOUR FROM NOW() - timestamp)::INT || ' hours ago'
        WHEN timestamp > NOW() - INTERVAL '7 days' THEN EXTRACT(DAY FROM NOW() - timestamp)::INT || ' days ago'
        ELSE TO_CHAR(timestamp, 'Mon DD, YYYY')
    END as time_ago
FROM audit_logs
ORDER BY timestamp DESC;

COMMENT ON VIEW audit_logs_view IS 'Formatted view of audit logs with time ago calculation';
