-- =====================================================
-- AGRICULTURAL INPUT DISTRIBUTION MANAGEMENT SYSTEM
-- Request Management + Prioritization System
-- =====================================================

-- 1. REGIONAL ALLOCATIONS TABLE
-- Tracks what Regional Office provides each season
CREATE TABLE IF NOT EXISTS regional_allocations (
    id SERIAL PRIMARY KEY,
    season VARCHAR(50) NOT NULL,           -- 'dry_2025', 'wet_2025', etc.
    allocation_date DATE DEFAULT CURRENT_DATE,
    season_start_date DATE,
    season_end_date DATE,
    
    -- FERTILIZER ALLOCATIONS (in bags of 50kg)
    urea_46_0_0_bags INTEGER DEFAULT 0,
    complete_14_14_14_bags INTEGER DEFAULT 0,
    complete_16_16_16_bags INTEGER DEFAULT 0,
    ammonium_sulfate_21_0_0_bags INTEGER DEFAULT 0,
    ammonium_phosphate_16_20_0_bags INTEGER DEFAULT 0,
    muriate_potash_0_0_60_bags INTEGER DEFAULT 0,
    
    -- SEED ALLOCATIONS (in kg)
    rice_seeds_nsic_rc160_kg DECIMAL(10,2) DEFAULT 0,
    rice_seeds_nsic_rc222_kg DECIMAL(10,2) DEFAULT 0,
    rice_seeds_nsic_rc440_kg DECIMAL(10,2) DEFAULT 0,
    corn_seeds_hybrid_kg DECIMAL(10,2) DEFAULT 0,
    corn_seeds_opm_kg DECIMAL(10,2) DEFAULT 0,
    vegetable_seeds_kg DECIMAL(10,2) DEFAULT 0,
    
    -- TRACKING
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',   -- 'active', 'completed', 'archived'
    created_by INTEGER,                     -- User ID who entered data
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_season UNIQUE(season)
);

-- 2. FARMER REQUESTS TABLE
-- Records individual farmer requests for fertilizer/seeds
CREATE TABLE IF NOT EXISTS farmer_requests (
    id SERIAL PRIMARY KEY,
    season VARCHAR(50) NOT NULL,
    request_date DATE DEFAULT CURRENT_DATE,
    
    -- FARMER INFORMATION (from RSBSA)
    farmer_id INTEGER,                      -- Reference to rsbsa_submission
    farmer_name VARCHAR(255) NOT NULL,
    barangay VARCHAR(100),
    farm_area_ha DECIMAL(10,2) NOT NULL,
    crop_type VARCHAR(100),                 -- 'rice', 'corn', 'vegetables', etc.
    ownership_type VARCHAR(50),             -- 'registered_owner', 'tenant', 'lessee', 'usufructuary'
    num_parcels INTEGER DEFAULT 1,
    
    -- REQUEST DETAILS (Generic - farmer doesn't specify exact types)
    fertilizer_requested BOOLEAN DEFAULT FALSE,
    seeds_requested BOOLEAN DEFAULT FALSE,
    request_notes TEXT,
    
    -- PRIORITY CALCULATION (Auto-calculated by system)
    priority_score INTEGER DEFAULT 0,      -- 0-100 score
    priority_rank INTEGER,                  -- 1, 2, 3... (after sorting)
    
    -- ASSIGNMENT (Filled by DA/JO)
    assigned_fertilizer_type VARCHAR(100), -- 'Urea 46-0-0', 'Complete 14-14-14', etc.
    assigned_fertilizer_bags INTEGER,
    assigned_seed_type VARCHAR(100),       -- 'Rice NSIC Rc160', 'Corn Hybrid', etc.
    assigned_seed_kg DECIMAL(10,2),
    
    -- FARMER RESPONSE
    fertilizer_accepted BOOLEAN,
    seeds_accepted BOOLEAN,
    rejection_reason TEXT,
    
    -- STATUS TRACKING
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'approved', 'distributed', 'rejected', 'waitlisted'
    
    -- METADATA
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (farmer_id) REFERENCES rsbsa_submission(id) ON DELETE SET NULL
);

-- 3. DISTRIBUTION RECORDS TABLE
-- Tracks actual distribution (what was physically given)
CREATE TABLE IF NOT EXISTS distribution_records (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL,
    distribution_date DATE DEFAULT CURRENT_DATE,
    
    -- WHAT WAS DISTRIBUTED
    fertilizer_type VARCHAR(100),
    fertilizer_bags_given INTEGER,
    seed_type VARCHAR(100),
    seed_kg_given DECIMAL(10,2),
    
    -- VOUCHER TRACKING
    voucher_code VARCHAR(100) UNIQUE,
    qr_code_data TEXT,
    claimed BOOLEAN DEFAULT FALSE,
    claim_date TIMESTAMP,
    
    -- VERIFICATION
    farmer_signature BOOLEAN DEFAULT FALSE,
    verified_by INTEGER,                   -- User ID who verified distribution
    verification_notes TEXT,
    
    -- METADATA
    created_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (request_id) REFERENCES farmer_requests(id) ON DELETE CASCADE
);

-- 4. PRIORITY CONFIGURATIONS TABLE
-- Stores customizable priority weights (for research tuning)
CREATE TABLE IF NOT EXISTS priority_configurations (
    id SERIAL PRIMARY KEY,
    config_name VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    
    -- PRIORITY WEIGHTS (Total should = 100)
    farm_area_weight INTEGER DEFAULT 30,      -- Smaller farms = higher priority
    ownership_weight INTEGER DEFAULT 25,      -- Tenants/lessees = higher priority
    history_weight INTEGER DEFAULT 20,        -- Less assistance = higher priority
    location_weight INTEGER DEFAULT 15,       -- Remote areas = higher priority
    crop_weight INTEGER DEFAULT 10,           -- Food security crops = higher priority
    
    -- SCORING RULES (JSON for flexibility)
    farm_area_rules JSONB,                    -- {"<1ha": 30, "1-2ha": 20, ">3ha": 5}
    ownership_rules JSONB,                    -- {"tenant": 25, "lessee": 20, "owner": 10}
    location_rules JSONB,                     -- {"remote": 15, "accessible": 5}
    
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_requests_season ON farmer_requests(season);
CREATE INDEX IF NOT EXISTS idx_requests_status ON farmer_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_priority ON farmer_requests(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_requests_farmer ON farmer_requests(farmer_id);
CREATE INDEX IF NOT EXISTS idx_allocations_season ON regional_allocations(season);
CREATE INDEX IF NOT EXISTS idx_distributions_request ON distribution_records(request_id);

-- 6. INSERT DEFAULT PRIORITY CONFIGURATION
INSERT INTO priority_configurations (
    config_name,
    is_active,
    farm_area_weight,
    ownership_weight,
    history_weight,
    location_weight,
    crop_weight,
    farm_area_rules,
    ownership_rules,
    location_rules,
    description
) VALUES (
    'default_equity_based',
    TRUE,
    30,
    25,
    20,
    15,
    10,
    '{"<1ha": 30, "1-2ha": 20, "2-3ha": 10, ">3ha": 5}'::jsonb,
    '{"tenant": 25, "lessee": 20, "usufructuary": 15, "registered_owner": 10}'::jsonb,
    '{"remote": 15, "moderate": 10, "accessible": 5}'::jsonb,
    'Default equity-based prioritization: Prioritizes small farmers, tenants, and remote areas'
) ON CONFLICT (config_name) DO NOTHING;

-- 7. COMMENTS
COMMENT ON TABLE regional_allocations IS 'Tracks fertilizer/seed allocations received from Regional Office per season';
COMMENT ON TABLE farmer_requests IS 'Individual farmer requests for agricultural inputs with priority scoring';
COMMENT ON TABLE distribution_records IS 'Actual distribution records with voucher tracking';
COMMENT ON TABLE priority_configurations IS 'Customizable priority weights for research and tuning';

COMMENT ON COLUMN farmer_requests.priority_score IS 'Auto-calculated score (0-100) based on priority criteria';
COMMENT ON COLUMN farmer_requests.priority_rank IS 'Rank after sorting all farmers (1=highest priority)';
COMMENT ON COLUMN farmer_requests.status IS 'pending=awaiting review, approved=will receive, distributed=already given, waitlisted=next batch, rejected=denied';
