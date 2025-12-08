-- Create land_plots table to store farm plot data
-- This replaces the file-based storage in backend/uploads/land_plots.json

CREATE TABLE IF NOT EXISTS land_plots (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255),
    ffrs_id VARCHAR(100),
    area DECIMAL(10, 2),
    coordinate_accuracy VARCHAR(50),
    barangay VARCHAR(100),
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    surname VARCHAR(100),
    ext_name VARCHAR(50),
    gender VARCHAR(20),
    municipality VARCHAR(100),
    province VARCHAR(100),
    parcel_address TEXT,
    status VARCHAR(50),
    street VARCHAR(255),
    farm_type VARCHAR(50),
    plot_source VARCHAR(50),
    parcel_number VARCHAR(50),
    geometry JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_land_plots_barangay ON land_plots(barangay);
CREATE INDEX IF NOT EXISTS idx_land_plots_municipality ON land_plots(municipality);
CREATE INDEX IF NOT EXISTS idx_land_plots_status ON land_plots(status);
CREATE INDEX IF NOT EXISTS idx_land_plots_surname ON land_plots(surname);
CREATE INDEX IF NOT EXISTS idx_land_plots_geometry ON land_plots USING GIN(geometry);

-- Add comment to table
COMMENT ON TABLE land_plots IS 'Stores land plot/farm parcel geographic and ownership data';
