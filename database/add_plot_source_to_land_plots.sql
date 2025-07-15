-- Migration: Add plotSource column to land_plots table
ALTER TABLE land_plots ADD COLUMN IF NOT EXISTS plotSource VARCHAR(20);
COMMENT ON COLUMN land_plots.plotSource IS 'Source of the plot: manual or lot_plan'; 