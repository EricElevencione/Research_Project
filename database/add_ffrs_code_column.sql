-- Add FFRS code column to rsbsa_submission table
ALTER TABLE rsbsa_submission
ADD COLUMN IF NOT EXISTS "FFRS_CODE" VARCHAR(50) UNIQUE;

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_ffrs_code ON rsbsa_submission("FFRS_CODE");

-- Function to generate FFRS code
CREATE OR REPLACE FUNCTION generate_ffrs_code(barangay_name VARCHAR) RETURNS VARCHAR AS $$
DECLARE
    establishment_code VARCHAR := '06-30-18';
    barangay_code VARCHAR;
    person_code VARCHAR;
BEGIN
    -- Map barangay names to codes
    barangay_code := CASE barangay_name
        WHEN 'Aurora-Del Pilar' THEN '001'
        WHEN 'Bacay' THEN '002'
        WHEN 'Bacong' THEN '003'
        WHEN 'Balabag' THEN '004'
        WHEN 'Balud' THEN '005'
        WHEN 'Bantud' THEN '006'
        WHEN 'Bantud Fabrica' THEN '007'
        WHEN 'Binaobawan' THEN '008'
        WHEN 'Bolilao' THEN '009'
        WHEN 'Cabilao Grande' THEN '010'
        WHEN 'Cabilao Pequeño' THEN '011'
        WHEN 'Calao' THEN '012'
        WHEN 'Dumangas' THEN '013'
        WHEN 'Ilaya' THEN '014'
        WHEN 'Jalaud' THEN '015'
        WHEN 'Lacturan' THEN '016'
        WHEN 'Lawa-an' THEN '017'
        WHEN 'Paco' THEN '018'
        WHEN 'Paloc Bigque' THEN '019'
        WHEN 'Pulao' THEN '020'
        WHEN 'Sapao' THEN '021'
        WHEN 'Tabucan' THEN '022'
        WHEN 'Taminla' THEN '023'
        WHEN 'Tiring' THEN '024'
        WHEN 'Victoria' THEN '025'
        WHEN 'Zaldivar' THEN '026'
        ELSE '000'
    END;
    
    -- Generate random 6-digit person code
    person_code := LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    
    RETURN establishment_code || '-' || barangay_code || '-' || person_code;
END;
$$ LANGUAGE plpgsql;

-- Function to update FFRS codes for all records
CREATE OR REPLACE FUNCTION update_all_ffrs_codes() RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, "BARANGAY" FROM rsbsa_submission WHERE "FFRS_CODE" IS NULL
    LOOP
        -- Keep trying until we get a unique code
        LOOP
            BEGIN
                UPDATE rsbsa_submission 
                SET "FFRS_CODE" = generate_ffrs_code(r."BARANGAY")
                WHERE id = r.id;
                EXIT; -- Exit loop if update succeeds
            EXCEPTION WHEN unique_violation THEN
                -- If we get a duplicate, the loop will try again with a new random number
            END;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update existing records with new FFRS codes
SELECT update_all_ffrs_codes();

-- Add trigger to automatically generate FFRS code for new records
CREATE OR REPLACE FUNCTION generate_ffrs_code_trigger() RETURNS TRIGGER AS $$
BEGIN
    IF NEW."FFRS_CODE" IS NULL THEN
        LOOP
            BEGIN
                NEW."FFRS_CODE" := generate_ffrs_code(NEW."BARANGAY");
                EXIT;
            EXCEPTION WHEN unique_violation THEN
                -- If we get a duplicate, the loop will try again
            END;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_ffrs_code
    BEFORE INSERT ON rsbsa_submission
    FOR EACH ROW
    EXECUTE FUNCTION generate_ffrs_code_trigger();

-- Add comment for the new column
COMMENT ON COLUMN rsbsa_submission."FFRS_CODE" IS 'Unique FFRS code in format 06-30-18-XXX-YYYYYY where XXX is barangay code and YYYYYY is person code';