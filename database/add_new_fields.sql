-- Add plot_type column to distinguish between marker (point) and polygon parcels
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS plot_type VARCHAR(16) DEFAULT 'polygon';
-- Optionally, update existing rows to set plot_type based on geometry type
UPDATE land_plots SET plot_type = 'point' WHERE GeometryType(geom) = 'POINT';
UPDATE land_plots SET plot_type = 'polygon' WHERE GeometryType(geom) = 'POLYGON'; 