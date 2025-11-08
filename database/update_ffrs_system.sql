-- Update FFRS code generation function with correct barangay codes
CREATE OR REPLACE FUNCTION generate_ffrs_code(barangay_name VARCHAR) RETURNS VARCHAR AS $$
DECLARE
    establishment_code VARCHAR := '06-30-18';
    barangay_code VARCHAR;
    person_code VARCHAR;
    counter_value INT;
BEGIN
    -- Map barangay names to codes (matching Dumangas barangays)
    barangay_code := CASE LOWER(TRIM(barangay_name))
        WHEN 'balabag' THEN '001'
        WHEN 'bantud fabrica' THEN '002'
        WHEN 'bantud ilaud' THEN '003'
        WHEN 'bantud ilaya' THEN '004'
        WHEN 'bilao' THEN '005'
        WHEN 'bolilao' THEN '006'
        WHEN 'calao' THEN '007'
        WHEN 'capaliz' THEN '008'
        WHEN 'cayos' THEN '009'
        WHEN 'dacutan' THEN '010'
        WHEN 'dulangan' THEN '011'
        WHEN 'dungon' THEN '012'
        WHEN 'ilaya 1st' THEN '013'
        WHEN 'ilaya 2nd' THEN '014'
        WHEN 'jardin' THEN '015'
        WHEN 'lonoy' THEN '016'
        WHEN 'manggalag' THEN '017'
        WHEN 'mauguic' THEN '018'
        WHEN 'pandan' THEN '019'
        WHEN 'poblacion' THEN '020'
        WHEN 'sapao' THEN '021'
        WHEN 'sua' THEN '022'
        WHEN 'suguidan' THEN '023'
        WHEN 'tabucan' THEN '024'
        WHEN 'talusan' THEN '025'
        WHEN 'tigbawan' THEN '026'
        WHEN 'tuburan' THEN '027'
        WHEN 'tumcon ilaya' THEN '028'
        WHEN 'tumcon ilawod' THEN '029'
        ELSE '000'
    END;
    
    -- Create counter table if it doesn't exist
    CREATE TABLE IF NOT EXISTS ffrs_counter (
        barangay_code VARCHAR(3) PRIMARY KEY,
        current_count INT DEFAULT 0
    );
    
    -- Insert barangay code if it doesn't exist
    INSERT INTO ffrs_counter (barangay_code, current_count)
    VALUES (barangay_code, 0)
    ON CONFLICT (barangay_code) DO NOTHING;
    
    -- Get and increment counter
    UPDATE ffrs_counter 
    SET current_count = current_count + 1
    WHERE barangay_code = barangay_code
    RETURNING current_count INTO counter_value;
    
    -- Format counter value with leading zeros (6 digits)
    person_code := LPAD(counter_value::TEXT, 6, '0');
    
    RETURN establishment_code || '-' || barangay_code || '-' || person_code;
END;
$$ LANGUAGE plpgsql;

-- Function to update FFRS codes for all existing records
CREATE OR REPLACE FUNCTION update_all_ffrs_codes() RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    -- Reset the counter table
    DROP TABLE IF EXISTS ffrs_counter;
    CREATE TABLE ffrs_counter (
        barangay_code VARCHAR(3) PRIMARY KEY,
        current_count INT DEFAULT 0
    );
    
    -- Clear existing FFRS codes
    UPDATE rsbsa_submission SET "FFRS_CODE" = NULL;
    
    -- Process records ordered by created date (oldest first)
    FOR r IN 
        SELECT id, "BARANGAY", created_at 
        FROM rsbsa_submission 
        WHERE "BARANGAY" IS NOT NULL
        ORDER BY created_at ASC, id ASC
    LOOP
        -- Keep trying until we get a unique code
        LOOP
            BEGIN
                UPDATE rsbsa_submission 
                SET "FFRS_CODE" = generate_ffrs_code(r."BARANGAY")
                WHERE id = r.id;
                EXIT; -- Exit loop if update succeeds
            EXCEPTION WHEN unique_violation THEN
                -- If we get a duplicate, the loop will try again with a new counter value
            END;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update trigger function to use new generation
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_generate_ffrs_code ON rsbsa_submission;
CREATE TRIGGER trigger_generate_ffrs_code
    BEFORE INSERT ON rsbsa_submission
    FOR EACH ROW
    EXECUTE FUNCTION generate_ffrs_code_trigger();

-- Run the update to generate codes for all existing records
SELECT update_all_ffrs_codes();

-- Verify the results
SELECT 
    "BARANGAY",
    COUNT(*) as total_farmers,
    MIN("FFRS_CODE") as first_code,
    MAX("FFRS_CODE") as last_code
FROM rsbsa_submission
WHERE "FFRS_CODE" IS NOT NULL
GROUP BY "BARANGAY"
ORDER BY "BARANGAY";
