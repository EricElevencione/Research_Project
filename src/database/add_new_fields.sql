-- Add new fields to Masterlist table
ALTER TABLE Masterlist
ADD COLUMN ffrs_id VARCHAR(50) UNIQUE,
ADD COLUMN ext_name VARCHAR(10),
ADD COLUMN birthdate DATE,
ADD COLUMN parcel_address TEXT;

-- Add comment to explain the ffrs_id field
COMMENT ON COLUMN Masterlist.ffrs_id IS 'FFRS System generated unique identifier';

-- Add comment to explain the ext_name field
COMMENT ON COLUMN Masterlist.ext_name IS 'Name extension (e.g., Jr., Sr., III)';

-- Add comment to explain the birthdate field
COMMENT ON COLUMN Masterlist.birthdate IS 'Date of birth of the land owner';

-- Add comment to explain the parcel_address field
COMMENT ON COLUMN Masterlist.parcel_address IS 'Complete address of the land parcel';

-- Add new fields to lands_plot table
ALTER TABLE lands_plot
ADD COLUMN ffrs_id VARCHAR(50) UNIQUE,
ADD COLUMN ext_name VARCHAR(10),
ADD COLUMN birthdate DATE,
ADD COLUMN parcel_address TEXT;

-- Add comments to explain the fields
COMMENT ON COLUMN lands_plot.ffrs_id IS 'FFRS System generated unique identifier';
COMMENT ON COLUMN lands_plot.ext_name IS 'Name extension (e.g., Jr., Sr., III)';
COMMENT ON COLUMN lands_plot.birthdate IS 'Date of birth of the land owner';
COMMENT ON COLUMN lands_plot.parcel_address IS 'Complete address of the land parcel';

-- Revert changes if needed (uncomment to use)
/*
ALTER TABLE lands_plot
DROP COLUMN ffrs_id,
DROP COLUMN ext_name,
DROP COLUMN birthdate,
DROP COLUMN parcel_address;
*/ 