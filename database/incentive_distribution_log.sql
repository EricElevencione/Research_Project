-- ============================================================
-- Municipal Incentive Distribution Log Schema
-- Purpose: Record-only system for physical seed distribution events
-- NO online requests, approvals, printing, or stock management
-- ============================================================

-- ============================================================
-- PREREQUISITES
-- ============================================================
-- This script requires:
-- 1. masterlist table (for farmer_id foreign key)
-- 2. users table (for encoder_id foreign key) - will be created if not exists
--
-- Run this script AFTER creating the masterlist table
-- The users table will be created automatically if it doesn't exist
-- ============================================================

-- ============================================================
-- STEP 1: Create users table if it doesn't exist
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'technician', 'jo', 'encoder', 'farmer', 'lgu')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster login queries
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

COMMENT ON TABLE users IS 'System users for authentication and authorization';
COMMENT ON COLUMN users.role IS 'User role: admin, technician, jo, encoder, farmer, lgu';

-- ============================================================
-- STEP 2: Drop existing incentive table if needed (for clean migrations)
-- ============================================================
DROP TABLE IF EXISTS incentive_distribution_log CASCADE;

-- ============================================================
-- STEP 3: Create incentive distribution log table
-- ============================================================
CREATE TABLE incentive_distribution_log (
    id SERIAL PRIMARY KEY,
    farmer_id INTEGER NOT NULL,
    event_date DATE NOT NULL,
    incentive_type VARCHAR(100) NOT NULL,
    qty_requested DECIMAL(6,2) NOT NULL CHECK (qty_requested > 0),
    qty_received DECIMAL(6,2) NOT NULL CHECK (qty_received >= 0 AND qty_received <= qty_requested),
    is_signed BOOLEAN NOT NULL DEFAULT false,
    note TEXT,
    encoder_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign Keys
    CONSTRAINT fk_farmer
        FOREIGN KEY (farmer_id)
        REFERENCES masterlist(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_encoder
        FOREIGN KEY (encoder_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    
    -- Business Rule: Must be signed before recording
    CONSTRAINT chk_signed
        CHECK (is_signed = true)
);

-- ============================================================
-- Indexes for Performance
-- ============================================================
CREATE INDEX idx_incentive_farmer_id 
    ON incentive_distribution_log(farmer_id);

CREATE INDEX idx_incentive_event_date 
    ON incentive_distribution_log(event_date);

CREATE INDEX idx_incentive_type 
    ON incentive_distribution_log(incentive_type);

CREATE INDEX idx_incentive_encoder 
    ON incentive_distribution_log(encoder_id);

CREATE INDEX idx_incentive_created 
    ON incentive_distribution_log(created_at);

-- Composite index for common queries
CREATE INDEX idx_incentive_farmer_date 
    ON incentive_distribution_log(farmer_id, event_date DESC);

-- ============================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_incentive_log_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incentive_log_updated
    BEFORE UPDATE ON incentive_distribution_log
    FOR EACH ROW
    EXECUTE FUNCTION update_incentive_log_timestamp();

-- ============================================================
-- Comments for Documentation
-- ============================================================
COMMENT ON TABLE incentive_distribution_log IS 'Records completed physical incentive distributions. NO online requests or approvals.';
COMMENT ON COLUMN incentive_distribution_log.farmer_id IS 'Reference to masterlist farmer';
COMMENT ON COLUMN incentive_distribution_log.event_date IS 'Date of physical distribution event';
COMMENT ON COLUMN incentive_distribution_log.incentive_type IS 'e.g., "Rice Seeds 20kg", "Fertilizer 50kg"';
COMMENT ON COLUMN incentive_distribution_log.qty_requested IS 'Amount farmer requested at event';
COMMENT ON COLUMN incentive_distribution_log.qty_received IS 'Actual amount distributed (may be less due to shortage)';
COMMENT ON COLUMN incentive_distribution_log.is_signed IS 'Confirms farmer signed paper receipt. MUST be true.';
COMMENT ON COLUMN incentive_distribution_log.note IS 'Optional notes, e.g., "Shortage: only 15kg available"';
COMMENT ON COLUMN incentive_distribution_log.encoder_id IS 'Staff who entered this record';

-- ============================================================
-- Sample Data (Optional - for testing)
-- ============================================================
-- IMPORTANT: First create a test user if you want to use this sample data
/*
-- Create test encoder user (only if users table is empty)
INSERT INTO users (username, email, password_hash, role)
VALUES 
    ('test.encoder', 'encoder@test.com', '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'encoder'),
    ('admin.dev', 'admin@test.com', '$2b$10$abcdefghijklmnopqrstuvwxyz123456', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Then insert test distribution logs (adjust farmer_id and encoder_id as needed)
INSERT INTO incentive_distribution_log 
    (farmer_id, event_date, incentive_type, qty_requested, qty_received, is_signed, note, encoder_id)
VALUES
    (1, '2025-01-15', 'Rice Seeds 20kg', 20.00, 20.00, true, 'Fully fulfilled', 1),
    (2, '2025-01-15', 'Rice Seeds 20kg', 20.00, 15.00, true, 'Shortage: only 15kg available', 1),
    (3, '2025-01-15', 'Corn Seeds 10kg', 10.00, 0.00, true, 'Out of stock - issued IOU', 1),
    (1, '2025-02-10', 'Fertilizer 50kg', 50.00, 50.00, true, NULL, 2);
*/

-- ============================================================
-- Useful Queries (Copy to query_examples.sql if needed)
-- ============================================================

-- Get all distributions for a farmer
-- SELECT * FROM incentive_distribution_log WHERE farmer_id = 101 ORDER BY event_date DESC;

-- Calculate shortage rate per incentive type
-- SELECT 
--     incentive_type,
--     COUNT(*) as total_distributions,
--     SUM(qty_requested) as total_requested,
--     SUM(qty_received) as total_received,
--     ROUND((1 - SUM(qty_received) / NULLIF(SUM(qty_requested), 0)) * 100, 2) as shortage_pct
-- FROM incentive_distribution_log
-- GROUP BY incentive_type
-- ORDER BY shortage_pct DESC;

-- Daily distribution summary
-- SELECT 
--     event_date,
--     COUNT(DISTINCT farmer_id) as farmers_served,
--     COUNT(*) as total_transactions,
--     SUM(CASE WHEN qty_received = qty_requested THEN 1 ELSE 0 END) as fully_fulfilled,
--     SUM(CASE WHEN qty_received > 0 AND qty_received < qty_requested THEN 1 ELSE 0 END) as partially_fulfilled,
--     SUM(CASE WHEN qty_received = 0 THEN 1 ELSE 0 END) as unfulfilled
-- FROM incentive_distribution_log
-- GROUP BY event_date
-- ORDER BY event_date DESC;
