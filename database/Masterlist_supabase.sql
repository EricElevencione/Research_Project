--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- SET statement_timeout = 0;
-- SET lock_timeout = 0;
-- SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
-- SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

-- PostGIS already enabled in Supabase

--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

--
-- Name: create_land_history_from_farm_parcel(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_land_history_from_farm_parcel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    farmer_full_name VARCHAR(200);
    farmer_ffrs VARCHAR(50);
BEGIN
    -- Get farmer information from the linked RSBSA submission
    SELECT 
        CONCAT_WS(' ',
            "FIRST NAME",
            "MIDDLE NAME", 
            "LAST NAME",
            NULLIF("EXT NAME", '')
        ),
        "FFRS_CODE"
    INTO farmer_full_name, farmer_ffrs
    FROM rsbsa_submission
    WHERE id = NEW.submission_id;
    
    -- Create a new land history record
    INSERT INTO land_history (
        rsbsa_submission_id,
        farm_parcel_id,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,
        
        -- Set land owner based on ownership type
        land_owner_name,
        land_owner_ffrs_code,
        
        -- Farmer information
        farmer_id,
        farmer_name,
        farmer_ffrs_code,
        
        -- Tenant information
        tenant_name,
        tenant_ffrs_code,
        is_tenant,
        
        -- Lessee information
        lessee_name,
        lessee_ffrs_code,
        is_lessee,
        
        -- Ownership flags
        is_registered_owner,
        is_other_ownership,
        
        -- Documents
        ownership_document_no,
        agrarian_reform_beneficiary,
        within_ancestral_domain,
        
        -- History tracking
        change_type,
        is_current,
        period_start_date
    )
    VALUES (
        NEW.submission_id,
        NEW.id,
        NEW.parcel_number,
        NEW.farm_location_barangay,
        NEW.farm_location_municipality,
        NEW.total_farm_area_ha,
        
        -- Land owner (if farmer is owner, use their name; if tenant/lessee, use land owner name)
        CASE 
            WHEN NEW.ownership_type_registered_owner THEN farmer_full_name
            WHEN NEW.ownership_type_tenant THEN NEW.tenant_land_owner_name
            WHEN NEW.ownership_type_lessee THEN NEW.lessee_land_owner_name
            ELSE farmer_full_name
        END,
        CASE 
            WHEN NEW.ownership_type_registered_owner THEN farmer_ffrs
            ELSE NULL
        END,
        
        -- Farmer
        NEW.submission_id,
        farmer_full_name,
        farmer_ffrs,
        
        -- Tenant
        CASE WHEN NEW.ownership_type_tenant THEN farmer_full_name ELSE NULL END,
        CASE WHEN NEW.ownership_type_tenant THEN farmer_ffrs ELSE NULL END,
        NEW.ownership_type_tenant,
        
        -- Lessee
        CASE WHEN NEW.ownership_type_lessee THEN farmer_full_name ELSE NULL END,
        CASE WHEN NEW.ownership_type_lessee THEN farmer_ffrs ELSE NULL END,
        NEW.ownership_type_lessee,
        
        -- Ownership
        NEW.ownership_type_registered_owner,
        NEW.ownership_type_others,
        
        -- Documents
        NEW.ownership_document_no,
        CASE WHEN NEW.agrarian_reform_beneficiary = 'Yes' THEN TRUE ELSE FALSE END,
        CASE WHEN NEW.within_ancestral_domain = 'Yes' THEN TRUE ELSE FALSE END,
        
        -- History
        'NEW',
        TRUE,
        CURRENT_DATE
    );
    
    RETURN NEW;
END;
$$;

--
-- Name: FUNCTION create_land_history_from_farm_parcel(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_land_history_from_farm_parcel() IS 'Automatically creates land history record when a new farm parcel is added';

--
-- Name: generate_ffrs_code(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_ffrs_code(barangay_name character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
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
        WHEN 'Cabilao PequeÃ±o' THEN '011'
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
$$;

--
-- Name: generate_ffrs_code_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_ffrs_code_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

--
-- Name: get_farmer_full_name(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_farmer_full_name(submission_id bigint) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    full_name VARCHAR(200);
BEGIN
    SELECT CONCAT_WS(' ',
        "FIRST NAME",
        "MIDDLE NAME",
        "LAST NAME",
        NULLIF("EXT NAME", '')
    )
    INTO full_name
    FROM rsbsa_submission
    WHERE id = submission_id;
    
    RETURN COALESCE(full_name, '');
END;
$$;

--
-- Name: update_all_ffrs_codes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_all_ffrs_codes() RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;

--
-- Name: update_incentive_log_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_incentive_log_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

--
-- Name: update_land_history_from_farm_parcel(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_land_history_from_farm_parcel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    ownership_changed BOOLEAN := FALSE;
    farmer_full_name VARCHAR(200);
    farmer_ffrs VARCHAR(50);
BEGIN
    -- Check if ownership type changed
    IF (OLD.ownership_type_registered_owner != NEW.ownership_type_registered_owner OR
        OLD.ownership_type_tenant != NEW.ownership_type_tenant OR
        OLD.ownership_type_lessee != NEW.ownership_type_lessee OR
        COALESCE(OLD.tenant_land_owner_name, '') != COALESCE(NEW.tenant_land_owner_name, '') OR
        COALESCE(OLD.lessee_land_owner_name, '') != COALESCE(NEW.lessee_land_owner_name, '')) THEN
        
        ownership_changed := TRUE;
        
        -- Get farmer information
        SELECT 
            CONCAT_WS(' ',
                "FIRST NAME",
                "MIDDLE NAME",
                "LAST NAME",
                NULLIF("EXT NAME", '')
            ),
            "FFRS_CODE"
        INTO farmer_full_name, farmer_ffrs
        FROM rsbsa_submission
        WHERE id = NEW.submission_id;
        
        -- Mark previous record as not current and set end date
        UPDATE land_history
        SET is_current = FALSE,
            period_end_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        WHERE farm_parcel_id = NEW.id
          AND is_current = TRUE;
        
        -- Create new history record
        INSERT INTO land_history (
            rsbsa_submission_id,
            farm_parcel_id,
            parcel_number,
            farm_location_barangay,
            farm_location_municipality,
            total_farm_area_ha,
            land_owner_name,
            land_owner_ffrs_code,
            farmer_id,
            farmer_name,
            farmer_ffrs_code,
            tenant_name,
            tenant_ffrs_code,
            is_tenant,
            lessee_name,
            lessee_ffrs_code,
            is_lessee,
            is_registered_owner,
            is_other_ownership,
            ownership_document_no,
            agrarian_reform_beneficiary,
            within_ancestral_domain,
            change_type,
            is_current,
            period_start_date,
            previous_record_id
        )
        SELECT
            NEW.submission_id,
            NEW.id,
            NEW.parcel_number,
            NEW.farm_location_barangay,
            NEW.farm_location_municipality,
            NEW.total_farm_area_ha,
            CASE 
                WHEN NEW.ownership_type_registered_owner THEN farmer_full_name
                WHEN NEW.ownership_type_tenant THEN NEW.tenant_land_owner_name
                WHEN NEW.ownership_type_lessee THEN NEW.lessee_land_owner_name
                ELSE farmer_full_name
            END,
            CASE 
                WHEN NEW.ownership_type_registered_owner THEN farmer_ffrs
                ELSE NULL
            END,
            NEW.submission_id,
            farmer_full_name,
            farmer_ffrs,
            CASE WHEN NEW.ownership_type_tenant THEN farmer_full_name ELSE NULL END,
            CASE WHEN NEW.ownership_type_tenant THEN farmer_ffrs ELSE NULL END,
            NEW.ownership_type_tenant,
            CASE WHEN NEW.ownership_type_lessee THEN farmer_full_name ELSE NULL END,
            CASE WHEN NEW.ownership_type_lessee THEN farmer_ffrs ELSE NULL END,
            NEW.ownership_type_lessee,
            NEW.ownership_type_registered_owner,
            NEW.ownership_type_others,
            NEW.ownership_document_no,
            CASE WHEN NEW.agrarian_reform_beneficiary = 'Yes' THEN TRUE ELSE FALSE END,
            CASE WHEN NEW.within_ancestral_domain = 'Yes' THEN TRUE ELSE FALSE END,
            'OWNERSHIP_CHANGE',
            TRUE,
            CURRENT_DATE,
            (SELECT id FROM land_history WHERE farm_parcel_id = NEW.id AND is_current = FALSE ORDER BY created_at DESC LIMIT 1);
    END IF;
    
    RETURN NEW;
END;
$$;

--
-- Name: FUNCTION update_land_history_from_farm_parcel(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_land_history_from_farm_parcel() IS 'Automatically updates land history when farm parcel ownership changes';

--
-- Name: update_land_history_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_land_history_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

--
-- Name: update_users_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_users_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: barangay_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.barangay_codes (
    id integer NOT NULL,
    barangay_name character varying(100) NOT NULL,
    barangay_code character varying(3) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: barangay_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.barangay_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: barangay_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.barangay_codes_id_seq OWNED BY public.barangay_codes.id;

--
-- Name: distribution_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.distribution_records (
    id integer NOT NULL,
    request_id integer NOT NULL,
    distribution_date date DEFAULT CURRENT_DATE,
    fertilizer_type character varying(100),
    fertilizer_bags_given integer,
    seed_type character varying(100),
    seed_kg_given numeric(10,2),
    voucher_code character varying(100),
    qr_code_data text,
    claimed boolean DEFAULT false,
    claim_date timestamp without time zone,
    farmer_signature boolean DEFAULT false,
    verified_by integer,
    verification_notes text,
    created_at timestamp without time zone DEFAULT now()
);

--
-- Name: TABLE distribution_records; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.distribution_records IS 'Actual distribution records with voucher tracking';

--
-- Name: distribution_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.distribution_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: distribution_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.distribution_records_id_seq OWNED BY public.distribution_records.id;

--
-- Name: farm_parcels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.farm_parcels (
    id integer NOT NULL,
    submission_id integer NOT NULL,
    parcel_number character varying(50) NOT NULL,
    farm_location_barangay character varying(100),
    farm_location_city_municipality character varying(100),
    total_farm_area_ha numeric(10,2) NOT NULL,
    within_ancestral_domain boolean DEFAULT false,
    ownership_document_no character varying(100),
    agrarian_reform_beneficiary boolean DEFAULT false,
    ownership_type_registered_owner boolean DEFAULT false,
    ownership_type_tenant boolean DEFAULT false,
    ownership_type_lessee boolean DEFAULT false,
    tenant_land_owner_name character varying(100),
    lessee_land_owner_name character varying(100),
    ownership_others_specify character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT farm_parcels_total_farm_area_ha_check CHECK ((total_farm_area_ha >= (0)::numeric))
);

--
-- Name: farm_parcels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.farm_parcels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: farm_parcels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.farm_parcels_id_seq OWNED BY public.farm_parcels.id;

--
-- Name: farmer_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.farmer_requests (
    id integer NOT NULL,
    season character varying(50) NOT NULL,
    request_date date DEFAULT CURRENT_DATE,
    farmer_id integer,
    farmer_name character varying(255) NOT NULL,
    barangay character varying(100),
    farm_area_ha numeric(10,2) NOT NULL,
    crop_type character varying(100),
    ownership_type character varying(50),
    num_parcels integer DEFAULT 1,
    fertilizer_requested boolean DEFAULT false,
    seeds_requested boolean DEFAULT false,
    request_notes text,
    priority_score integer DEFAULT 0,
    priority_rank integer,
    assigned_fertilizer_type character varying(100),
    assigned_fertilizer_bags integer,
    assigned_seed_type character varying(100),
    assigned_seed_kg numeric(10,2),
    fertilizer_accepted boolean,
    seeds_accepted boolean,
    rejection_reason text,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    requested_urea_bags numeric(10,2) DEFAULT 0,
    requested_complete_14_bags numeric(10,2) DEFAULT 0,
    requested_complete_16_bags numeric(10,2) DEFAULT 0,
    requested_ammonium_sulfate_bags numeric(10,2) DEFAULT 0,
    requested_ammonium_phosphate_bags numeric(10,2) DEFAULT 0,
    requested_muriate_potash_bags numeric(10,2) DEFAULT 0,
    requested_jackpot_kg numeric(10,2) DEFAULT 0,
    requested_us88_kg numeric(10,2) DEFAULT 0,
    requested_th82_kg numeric(10,2) DEFAULT 0,
    requested_rh9000_kg numeric(10,2) DEFAULT 0,
    requested_lumping143_kg numeric(10,2) DEFAULT 0,
    requested_lp296_kg numeric(10,2) DEFAULT 0
);

--
-- Name: TABLE farmer_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.farmer_requests IS 'Individual farmer requests for agricultural inputs with priority scoring';

--
-- Name: COLUMN farmer_requests.priority_score; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.farmer_requests.priority_score IS 'Auto-calculated score (0-100) based on priority criteria';

--
-- Name: COLUMN farmer_requests.priority_rank; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.farmer_requests.priority_rank IS 'Rank after sorting all farmers (1=highest priority)';

--
-- Name: COLUMN farmer_requests.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.farmer_requests.status IS 'pending=awaiting review, approved=will receive, distributed=already given, waitlisted=next batch, rejected=denied';

--
-- Name: farmer_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.farmer_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: farmer_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.farmer_requests_id_seq OWNED BY public.farmer_requests.id;

--
-- Name: incentive_distribution_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incentive_distribution_log (
    id integer NOT NULL,
    farmer_id integer NOT NULL,
    event_date date NOT NULL,
    incentive_type character varying(100) NOT NULL,
    qty_requested numeric(6,2) NOT NULL,
    qty_received numeric(6,2) NOT NULL,
    is_signed boolean DEFAULT false NOT NULL,
    note text,
    encoder_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT chk_signed CHECK ((is_signed = true)),
    CONSTRAINT incentive_distribution_log_check CHECK (((qty_received >= (0)::numeric) AND (qty_received <= qty_requested))),
    CONSTRAINT incentive_distribution_log_qty_requested_check CHECK ((qty_requested > (0)::numeric))
);

--
-- Name: TABLE incentive_distribution_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.incentive_distribution_log IS 'Records completed physical incentive distributions. NO online requests or approvals.';

--
-- Name: COLUMN incentive_distribution_log.farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.farmer_id IS 'Reference to masterlist farmer';

--
-- Name: COLUMN incentive_distribution_log.event_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.event_date IS 'Date of physical distribution event';

--
-- Name: COLUMN incentive_distribution_log.incentive_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.incentive_type IS 'e.g., "Rice Seeds 20kg", "Fertilizer 50kg"';

--
-- Name: COLUMN incentive_distribution_log.qty_requested; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.qty_requested IS 'Amount farmer requested at event';

--
-- Name: COLUMN incentive_distribution_log.qty_received; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.qty_received IS 'Actual amount distributed (may be less due to shortage)';

--
-- Name: COLUMN incentive_distribution_log.is_signed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.is_signed IS 'Confirms farmer signed paper receipt. MUST be true.';

--
-- Name: COLUMN incentive_distribution_log.note; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.note IS 'Optional notes, e.g., "Shortage: only 15kg available"';

--
-- Name: COLUMN incentive_distribution_log.encoder_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.encoder_id IS 'Staff who entered this record';

--
-- Name: incentive_distribution_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.incentive_distribution_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: incentive_distribution_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.incentive_distribution_log_id_seq OWNED BY public.incentive_distribution_log.id;

--
-- Name: land_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.land_history (
    id bigint NOT NULL,
    rsbsa_submission_id bigint,
    farm_parcel_id bigint,
    parcel_number character varying(20),
    farm_location_barangay character varying(100),
    farm_location_municipality character varying(100),
    total_farm_area_ha numeric(10,2),
    land_owner_id bigint,
    land_owner_name character varying(200),
    land_owner_ffrs_code character varying(50),
    farmer_id bigint,
    farmer_name character varying(200),
    farmer_ffrs_code character varying(50),
    tenant_name character varying(200),
    tenant_ffrs_code character varying(50),
    is_tenant boolean DEFAULT false,
    lessee_name character varying(200),
    lessee_ffrs_code character varying(50),
    is_lessee boolean DEFAULT false,
    is_registered_owner boolean DEFAULT false,
    is_other_ownership boolean DEFAULT false,
    ownership_type_details text,
    ownership_document_type character varying(50),
    ownership_document_no character varying(100),
    agrarian_reform_beneficiary boolean DEFAULT false,
    within_ancestral_domain boolean DEFAULT false,
    period_start_date date DEFAULT CURRENT_DATE,
    period_end_date date,
    is_current boolean DEFAULT true,
    change_type character varying(50),
    change_reason text,
    previous_record_id bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    updated_by character varying(100),
    notes text,
    CONSTRAINT valid_ownership CHECK ((is_registered_owner OR is_tenant OR is_lessee OR is_other_ownership)),
    CONSTRAINT valid_period CHECK (((period_end_date IS NULL) OR (period_end_date >= period_start_date)))
);

--
-- Name: TABLE land_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.land_history IS 'Comprehensive land ownership and tenancy history tracking system';

--
-- Name: COLUMN land_history.rsbsa_submission_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.rsbsa_submission_id IS 'Link to the RSBSA submission that created or updated this record';

--
-- Name: COLUMN land_history.farm_parcel_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farm_parcel_id IS 'Link to the specific farm parcel in rsbsa_farm_parcels';

--
-- Name: COLUMN land_history.land_owner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.land_owner_id IS 'ID of the legal land owner (may be different from farmer)';

--
-- Name: COLUMN land_history.land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.land_owner_name IS 'Name of the legal land owner';

--
-- Name: COLUMN land_history.farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farmer_id IS 'ID of the person farming the land (from rsbsa_submission)';

--
-- Name: COLUMN land_history.farmer_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farmer_name IS 'Name of the person actually farming the land';

--
-- Name: COLUMN land_history.is_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_tenant IS 'TRUE if farmer is renting from land owner';

--
-- Name: COLUMN land_history.is_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_lessee IS 'TRUE if farmer is leasing from land owner';

--
-- Name: COLUMN land_history.is_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_registered_owner IS 'TRUE if farmer is the registered owner';

--
-- Name: COLUMN land_history.period_start_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.period_start_date IS 'Start date of this ownership/tenancy arrangement';

--
-- Name: COLUMN land_history.period_end_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.period_end_date IS 'End date (NULL if currently active)';

--
-- Name: COLUMN land_history.is_current; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_current IS 'TRUE if this is the current/active record';

--
-- Name: COLUMN land_history.change_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.change_type IS 'Type of change: NEW, OWNERSHIP_CHANGE, TENANT_CHANGE, UPDATE, TERMINATION';

--
-- Name: COLUMN land_history.previous_record_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.previous_record_id IS 'Link to previous history record for this parcel';

--
-- Name: land_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.land_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: land_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.land_history_id_seq OWNED BY public.land_history.id;

--
-- Name: land_plots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.land_plots (
    id character varying(100) NOT NULL,
    name character varying(255),
    ffrs_id character varying(100),
    area numeric(10,2),
    coordinate_accuracy character varying(50),
    barangay character varying(100),
    first_name character varying(100),
    middle_name character varying(100),
    surname character varying(100),
    ext_name character varying(50),
    gender character varying(20),
    municipality character varying(100),
    province character varying(100),
    parcel_address text,
    status character varying(50),
    street character varying(255),
    farm_type character varying(50),
    plot_source character varying(50),
    parcel_number character varying(50),
    geometry jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    geometry_postgis public.geometry(Geometry,4326)
);

--
-- Name: TABLE land_plots; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.land_plots IS 'Stores land plot/farm parcel geographic and ownership data';

--
-- Name: COLUMN land_plots.geometry_postgis; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_plots.geometry_postgis IS 'PostGIS geometry column storing spatial data. Enables spatial queries like area calculation, overlap detection, and proximity analysis.';

--
-- Name: masterlist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.masterlist (
    "FFRS System Generated" character varying(30),
    "LAST NAME" text,
    "FIRST NAME" text,
    "MIDDLE NAME" text,
    "EXT NAME" text,
    "GENDER" text,
    "BIRTHDATE" character varying(30),
    "FARMER ADDRESS 1" text,
    "FARMER ADDRESS 2" text,
    "FARMER ADDRESS 3" text,
    "PARCEL NO." integer,
    "PARCEL ADDRESS" text,
    "PARCEL AREA" integer,
    id integer NOT NULL,
    status character varying(32),
    "STATUS" character varying(20) DEFAULT 'Active Farmer'::character varying,
    CONSTRAINT check_masterlist_status CHECK ((("STATUS")::text = ANY ((ARRAY['Active Farmer'::character varying, 'Inactive Farmer'::character varying])::text[])))
);

--
-- Name: masterlist_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.masterlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: masterlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.masterlist_id_seq OWNED BY public.masterlist.id;

--
-- Name: ownership_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ownership_transfers (
    id integer NOT NULL,
    from_farmer_id integer NOT NULL,
    to_farmer_id integer NOT NULL,
    transfer_date date NOT NULL,
    transfer_type character varying(100) NOT NULL,
    transfer_reason text,
    documents jsonb,
    processed_by integer,
    created_at timestamp without time zone DEFAULT now(),
    notes text
);

--
-- Name: TABLE ownership_transfers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ownership_transfers IS 'Tracks land ownership transfer history between farmers';

--
-- Name: COLUMN ownership_transfers.from_farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.from_farmer_id IS 'ID of the farmer transferring ownership (original owner)';

--
-- Name: COLUMN ownership_transfers.to_farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.to_farmer_id IS 'ID of the farmer receiving ownership (new owner)';

--
-- Name: COLUMN ownership_transfers.transfer_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_date IS 'Date when the ownership transfer occurred';

--
-- Name: COLUMN ownership_transfers.transfer_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_type IS 'Type of transfer: ownership_change, inheritance, sale, donation, agrarian_reform';

--
-- Name: COLUMN ownership_transfers.transfer_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_reason IS 'Detailed reason for the transfer (free text)';

--
-- Name: COLUMN ownership_transfers.processed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.processed_by IS 'ID of the JO user who processed this transfer';

--
-- Name: ownership_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ownership_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ownership_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ownership_transfers_id_seq OWNED BY public.ownership_transfers.id;

--
-- Name: priority_configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.priority_configurations (
    id integer NOT NULL,
    config_name character varying(100) NOT NULL,
    is_active boolean DEFAULT false,
    farm_area_weight integer DEFAULT 30,
    ownership_weight integer DEFAULT 25,
    history_weight integer DEFAULT 20,
    location_weight integer DEFAULT 15,
    crop_weight integer DEFAULT 10,
    farm_area_rules jsonb,
    ownership_rules jsonb,
    location_rules jsonb,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

--
-- Name: TABLE priority_configurations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.priority_configurations IS 'Customizable priority weights for research and tuning';

--
-- Name: priority_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.priority_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: priority_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.priority_configurations_id_seq OWNED BY public.priority_configurations.id;

--
-- Name: regional_allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.regional_allocations (
    id integer NOT NULL,
    season character varying(50) NOT NULL,
    allocation_date date DEFAULT CURRENT_DATE,
    season_start_date date,
    season_end_date date,
    urea_46_0_0_bags integer DEFAULT 0,
    complete_14_14_14_bags integer DEFAULT 0,
    complete_16_16_16_bags integer DEFAULT 0,
    ammonium_sulfate_21_0_0_bags integer DEFAULT 0,
    ammonium_phosphate_16_20_0_bags integer DEFAULT 0,
    muriate_potash_0_0_60_bags integer DEFAULT 0,
    rice_seeds_nsic_rc160_kg numeric(10,2) DEFAULT 0,
    rice_seeds_nsic_rc222_kg numeric(10,2) DEFAULT 0,
    rice_seeds_nsic_rc440_kg numeric(10,2) DEFAULT 0,
    corn_seeds_hybrid_kg numeric(10,2) DEFAULT 0,
    corn_seeds_opm_kg numeric(10,2) DEFAULT 0,
    vegetable_seeds_kg numeric(10,2) DEFAULT 0,
    notes text,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    jackpot_kg numeric(10,2) DEFAULT 0,
    us88_kg numeric(10,2) DEFAULT 0,
    th82_kg numeric(10,2) DEFAULT 0,
    rh9000_kg numeric(10,2) DEFAULT 0,
    lumping143_kg numeric(10,2) DEFAULT 0,
    lp296_kg numeric(10,2) DEFAULT 0
);

--
-- Name: TABLE regional_allocations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.regional_allocations IS 'Tracks fertilizer/seed allocations received from Regional Office per season';

--
-- Name: regional_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.regional_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: regional_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.regional_allocations_id_seq OWNED BY public.regional_allocations.id;

--
-- Name: rsbsa_farm_parcels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rsbsa_farm_parcels (
    id bigint NOT NULL,
    submission_id bigint,
    parcel_number character varying(20) NOT NULL,
    farm_location_barangay character varying(100),
    farm_location_municipality character varying(100),
    total_farm_area_ha numeric(10,2),
    within_ancestral_domain character varying(10),
    ownership_document_no character varying(100),
    agrarian_reform_beneficiary character varying(10),
    ownership_type_registered_owner boolean DEFAULT false,
    ownership_type_tenant boolean DEFAULT false,
    ownership_type_lessee boolean DEFAULT false,
    ownership_type_others boolean DEFAULT false,
    tenant_land_owner_name character varying(200),
    lessee_land_owner_name character varying(200),
    ownership_others_specify text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tenant_land_owner_id bigint,
    lessee_land_owner_id bigint,
    CONSTRAINT rsbsa_farm_parcels_agrarian_reform_beneficiary_check CHECK (((agrarian_reform_beneficiary)::text = ANY ((ARRAY['Yes'::character varying, 'No'::character varying])::text[]))),
    CONSTRAINT rsbsa_farm_parcels_within_ancestral_domain_check CHECK (((within_ancestral_domain)::text = ANY ((ARRAY['Yes'::character varying, 'No'::character varying])::text[])))
);

--
-- Name: TABLE rsbsa_farm_parcels; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rsbsa_farm_parcels IS 'Stores individual farm parcels for each RSBSA submission';

--
-- Name: COLUMN rsbsa_farm_parcels.submission_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.submission_id IS 'Reference to the main RSBSA submission';

--
-- Name: COLUMN rsbsa_farm_parcels.parcel_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.parcel_number IS 'Parcel number (1, 2, 3, etc.)';

--
-- Name: COLUMN rsbsa_farm_parcels.farm_location_barangay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.farm_location_barangay IS 'Barangay where the farm parcel is located';

--
-- Name: COLUMN rsbsa_farm_parcels.farm_location_municipality; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.farm_location_municipality IS 'Municipality where the farm parcel is located';

--
-- Name: COLUMN rsbsa_farm_parcels.total_farm_area_ha; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.total_farm_area_ha IS 'Area of this specific parcel in hectares';

--
-- Name: COLUMN rsbsa_farm_parcels.within_ancestral_domain; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.within_ancestral_domain IS 'Whether this parcel is within ancestral domain';

--
-- Name: COLUMN rsbsa_farm_parcels.ownership_document_no; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_document_no IS 'Document number proving ownership of this parcel';

--
-- Name: COLUMN rsbsa_farm_parcels.agrarian_reform_beneficiary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.agrarian_reform_beneficiary IS 'Whether the farmer is an agrarian reform beneficiary for this parcel';

--
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_registered_owner IS 'Whether the farmer is the registered owner of this parcel';

--
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_tenant IS 'Whether the farmer is a tenant of this parcel';

--
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_lessee IS 'Whether the farmer is a lessee of this parcel';

--
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_others; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_others IS 'Whether the farmer has other ownership type for this parcel';

--
-- Name: COLUMN rsbsa_farm_parcels.tenant_land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.tenant_land_owner_name IS 'Name of land owner if farmer is a tenant';

--
-- Name: COLUMN rsbsa_farm_parcels.lessee_land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.lessee_land_owner_name IS 'Name of land owner if farmer is a lessee';

--
-- Name: COLUMN rsbsa_farm_parcels.ownership_others_specify; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_others_specify IS 'Specification of other ownership type';

--
-- Name: COLUMN rsbsa_farm_parcels.tenant_land_owner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.tenant_land_owner_id IS 'Foreign key reference to the land owner (rsbsa_submission.id) if farmer is a tenant. Automatically set to NULL when land owner is deleted.';

--
-- Name: COLUMN rsbsa_farm_parcels.lessee_land_owner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.lessee_land_owner_id IS 'Foreign key reference to the land owner (rsbsa_submission.id) if farmer is a lessee. Automatically set to NULL when land owner is deleted.';

--
-- Name: rsbsa_farm_parcels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rsbsa_farm_parcels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: rsbsa_farm_parcels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rsbsa_farm_parcels_id_seq OWNED BY public.rsbsa_farm_parcels.id;

--
-- Name: rsbsa_submission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rsbsa_submission (
    id bigint NOT NULL,
    "LAST NAME" character varying(255),
    "FIRST NAME" character varying(255),
    "MIDDLE NAME" character varying(255),
    "EXT NAME" character varying(255),
    "GENDER" character varying(10),
    "BIRTHDATE" date,
    "BARANGAY" character varying(255),
    "MUNICIPALITY" character varying(255),
    "FARM LOCATION" character varying(50),
    "PARCEL AREA" text,
    "MAIN LIVELIHOOD" character varying(100),
    "OWNERSHIP_TYPE_REGISTERED_OWNER" boolean DEFAULT false,
    "OWNERSHIP_TYPE_TENANT" boolean DEFAULT false,
    "OWNERSHIP_TYPE_LESSEE" boolean DEFAULT false,
    status character varying(50) DEFAULT 'Submitted'::character varying,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "TOTAL FARM AREA" numeric(10,2),
    "FFRS_CODE" character varying(50),
    age integer,
    "FARMER_RICE" boolean DEFAULT false,
    "FARMER_CORN" boolean DEFAULT false,
    "FARMER_OTHER_CROPS" boolean DEFAULT false,
    "FARMER_OTHER_CROPS_TEXT" text,
    "FARMER_LIVESTOCK" boolean DEFAULT false,
    "FARMER_LIVESTOCK_TEXT" text,
    "FARMER_POULTRY" boolean DEFAULT false,
    "FARMER_POULTRY_TEXT" text
);

--
-- Name: TABLE rsbsa_submission; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rsbsa_submission IS 'Structured RSBSA submission table with farming activity tracking';

--
-- Name: COLUMN rsbsa_submission.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission.id IS 'Unique identifier for the submission';

--
-- Name: COLUMN rsbsa_submission."LAST NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."LAST NAME" IS 'Last name of the farmer';

--
-- Name: COLUMN rsbsa_submission."FIRST NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FIRST NAME" IS 'First name of the farmer';

--
-- Name: COLUMN rsbsa_submission."MIDDLE NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MIDDLE NAME" IS 'Middle name of the farmer';

--
-- Name: COLUMN rsbsa_submission."EXT NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."EXT NAME" IS 'Extension name of the farmer';

--
-- Name: COLUMN rsbsa_submission."GENDER"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."GENDER" IS 'Gender of the farmer';

--
-- Name: COLUMN rsbsa_submission."BIRTHDATE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."BIRTHDATE" IS 'Birthdate of the farmer';

--
-- Name: COLUMN rsbsa_submission."BARANGAY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."BARANGAY" IS 'Barangay of the farmer';

--
-- Name: COLUMN rsbsa_submission."MUNICIPALITY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MUNICIPALITY" IS 'Municipality of the farmer';

--
-- Name: COLUMN rsbsa_submission."FARM LOCATION"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARM LOCATION" IS 'Farm location of the farmer';

--
-- Name: COLUMN rsbsa_submission."PARCEL AREA"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."PARCEL AREA" IS 'Area of the farm parcel';

--
-- Name: COLUMN rsbsa_submission."MAIN LIVELIHOOD"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MAIN LIVELIHOOD" IS 'Main livelihood of the farmer';

--
-- Name: COLUMN rsbsa_submission."TOTAL FARM AREA"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."TOTAL FARM AREA" IS 'Total farm area in hectares (sum of all parcels for this farmer)';

--
-- Name: COLUMN rsbsa_submission."FFRS_CODE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FFRS_CODE" IS 'Unique FFRS code in format 06-30-18-XXX-YYYYYY where XXX is barangay code and YYYYYY is person code';

--
-- Name: COLUMN rsbsa_submission."FARMER_RICE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_RICE" IS 'Indicates if farmer grows rice';

--
-- Name: COLUMN rsbsa_submission."FARMER_CORN"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_CORN" IS 'Indicates if farmer grows corn';

--
-- Name: COLUMN rsbsa_submission."FARMER_OTHER_CROPS"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_OTHER_CROPS" IS 'Indicates if farmer grows other crops';

--
-- Name: COLUMN rsbsa_submission."FARMER_OTHER_CROPS_TEXT"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_OTHER_CROPS_TEXT" IS 'Specific other crops grown';

--
-- Name: COLUMN rsbsa_submission."FARMER_LIVESTOCK"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_LIVESTOCK" IS 'Indicates if farmer raises livestock';

--
-- Name: COLUMN rsbsa_submission."FARMER_LIVESTOCK_TEXT"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_LIVESTOCK_TEXT" IS 'Specific livestock types';

--
-- Name: COLUMN rsbsa_submission."FARMER_POULTRY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_POULTRY" IS 'Indicates if farmer raises poultry';

--
-- Name: COLUMN rsbsa_submission."FARMER_POULTRY_TEXT"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_POULTRY_TEXT" IS 'Specific poultry types';

--
-- Name: rsbsa_submission_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rsbsa_submission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: rsbsa_submission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rsbsa_submission_id_seq OWNED BY public.rsbsa_submission.id;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'technician'::character varying, 'jo'::character varying, 'encoder'::character varying, 'farmer'::character varying, 'lgu'::character varying])::text[])))
);

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'System users for authentication and authorization';

--
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.id IS 'Unique user identifier';

--
-- Name: COLUMN users.username; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.username IS 'Unique username for login';

--
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.email IS 'Unique email address';

--
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.password_hash IS 'Bcrypt hashed password';

--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.role IS 'User role: admin, technician, jo, encoder, farmer, lgu';

--
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.created_at IS 'Account creation timestamp';

--
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.updated_at IS 'Last update timestamp';

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

--
-- Name: v_tenant_lessee_relationships; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_tenant_lessee_relationships AS
 SELECT fp.id AS parcel_id,
    fp.submission_id AS farmer_id,
    concat_ws(' '::text, farmer."FIRST NAME", farmer."MIDDLE NAME", farmer."LAST NAME") AS farmer_name,
    farmer."BARANGAY" AS farmer_barangay,
        CASE
            WHEN fp.ownership_type_tenant THEN 'Tenant'::text
            WHEN fp.ownership_type_lessee THEN 'Lessee'::text
            WHEN fp.ownership_type_registered_owner THEN 'Registered Owner'::text
            ELSE 'Other'::text
        END AS ownership_type,
    fp.tenant_land_owner_id,
    fp.tenant_land_owner_name AS tenant_land_owner_name_text,
    concat_ws(' '::text, tenant_owner."FIRST NAME", tenant_owner."MIDDLE NAME", tenant_owner."LAST NAME") AS tenant_land_owner_name_linked,
    fp.lessee_land_owner_id,
    fp.lessee_land_owner_name AS lessee_land_owner_name_text,
    concat_ws(' '::text, lessee_owner."FIRST NAME", lessee_owner."MIDDLE NAME", lessee_owner."LAST NAME") AS lessee_land_owner_name_linked,
    fp.farm_location_barangay,
    fp.total_farm_area_ha
   FROM (((public.rsbsa_farm_parcels fp
     JOIN public.rsbsa_submission farmer ON ((fp.submission_id = farmer.id)))
     LEFT JOIN public.rsbsa_submission tenant_owner ON ((fp.tenant_land_owner_id = tenant_owner.id)))
     LEFT JOIN public.rsbsa_submission lessee_owner ON ((fp.lessee_land_owner_id = lessee_owner.id)))
  WHERE ((fp.ownership_type_tenant = true) OR (fp.ownership_type_lessee = true));

--
-- Name: barangay_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes ALTER COLUMN id SET DEFAULT nextval('public.barangay_codes_id_seq'::regclass);

--
-- Name: distribution_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records ALTER COLUMN id SET DEFAULT nextval('public.distribution_records_id_seq'::regclass);

--
-- Name: farm_parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels ALTER COLUMN id SET DEFAULT nextval('public.farm_parcels_id_seq'::regclass);

--
-- Name: farmer_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_requests ALTER COLUMN id SET DEFAULT nextval('public.farmer_requests_id_seq'::regclass);

--
-- Name: incentive_distribution_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log ALTER COLUMN id SET DEFAULT nextval('public.incentive_distribution_log_id_seq'::regclass);

--
-- Name: land_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history ALTER COLUMN id SET DEFAULT nextval('public.land_history_id_seq'::regclass);

--
-- Name: masterlist id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterlist ALTER COLUMN id SET DEFAULT nextval('public.masterlist_id_seq'::regclass);

--
-- Name: ownership_transfers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers ALTER COLUMN id SET DEFAULT nextval('public.ownership_transfers_id_seq'::regclass);

--
-- Name: priority_configurations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priority_configurations ALTER COLUMN id SET DEFAULT nextval('public.priority_configurations_id_seq'::regclass);

--
-- Name: regional_allocations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regional_allocations ALTER COLUMN id SET DEFAULT nextval('public.regional_allocations_id_seq'::regclass);

--
-- Name: rsbsa_farm_parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels ALTER COLUMN id SET DEFAULT nextval('public.rsbsa_farm_parcels_id_seq'::regclass);

--
-- Name: rsbsa_submission id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission ALTER COLUMN id SET DEFAULT nextval('public.rsbsa_submission_id_seq'::regclass);

--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

--
-- Data for Name: barangay_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (1, 'Balabag', '001', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (2, 'Bantud Fabrica', '002', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (3, 'Bantud Ilaud', '003', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (4, 'Bantud Ilaya', '004', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (5, 'Bilao', '005', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (6, 'Bolilao', '006', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (7, 'Calao', '007', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (8, 'Capaliz', '008', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (9, 'Cayos', '009', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (10, 'Dacutan', '010', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (11, 'Dulangan', '011', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (12, 'Dungon', '012', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (13, 'Ilaya 1st', '013', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (14, 'Ilaya 2nd', '014', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (15, 'Jardin', '015', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (16, 'Lonoy', '016', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (17, 'Manggalag', '017', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (18, 'Mauguic', '018', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (19, 'Pandan', '019', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (20, 'Poblacion', '020', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (21, 'Sapao', '021', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (22, 'Sua', '022', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (23, 'Suguidan', '023', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (24, 'Tabucan', '024', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (25, 'Talusan', '025', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (26, 'Tigbawan', '026', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (27, 'Tuburan', '027', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (28, 'Tumcon Ilaya', '028', '2025-07-31 21:40:17.018376');
INSERT INTO public.barangay_codes (id, barangay_name, barangay_code, created_at) VALUES (29, 'Tumcon Ilawod', '029', '2025-07-31 21:40:17.018376');

--
-- Data for Name: distribution_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: farm_parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: farmer_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.farmer_requests (id, season, request_date, farmer_id, farmer_name, barangay, farm_area_ha, crop_type, ownership_type, num_parcels, fertilizer_requested, seeds_requested, request_notes, priority_score, priority_rank, assigned_fertilizer_type, assigned_fertilizer_bags, assigned_seed_type, assigned_seed_kg, fertilizer_accepted, seeds_accepted, rejection_reason, status, created_by, created_at, updated_at, requested_urea_bags, requested_complete_14_bags, requested_complete_16_bags, requested_ammonium_sulfate_bags, requested_ammonium_phosphate_bags, requested_muriate_potash_bags, requested_jackpot_kg, requested_us88_kg, requested_th82_kg, requested_rh9000_kg, requested_lumping143_kg, requested_lp296_kg) VALUES (37, 'dry_2026', '2026-01-22', 74, 'Villanueva, Rosa', 'Baras', 0.00, 'Rice', 'Owner', 1, true, true, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'pending', NULL, '2026-01-22 09:45:39.978769', '2026-01-22 09:45:39.978769', 4.00, 4.00, 0.00, 0.00, 0.00, 0.00, 0.00, 4.00, 4.00, 0.00, 0.00, 4.00);

--
-- Data for Name: incentive_distribution_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: land_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (88, 74, 88, '1', 'Baras', 'Dumangas', 2.00, NULL, 'Rosa Torres Villanueva', '06-30-18-000-580447', 74, 'Rosa Torres Villanueva', '06-30-18-000-580447', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (89, 75, 89, '1', 'Bolilao', 'Dumangas', 4.50, NULL, 'Roberto Aquino Fernandez', '06-30-18-009-913582', 75, 'Roberto Aquino Fernandez', '06-30-18-009-913582', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (90, 76, 90, '1', 'Calao', 'Dumangas', 1.50, NULL, 'Carmen Ramos Lopez', '06-30-18-012-959123', 76, 'Carmen Ramos Lopez', '06-30-18-012-959123', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (91, 77, 91, '1', 'Cali', 'Dumangas', 2.80, NULL, 'Antonio Castro Bautista', '06-30-18-000-688797', 77, 'Antonio Castro Bautista', '06-30-18-000-688797', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (92, 78, 92, '1', 'Cansilayan', 'Dumangas', 2.20, NULL, 'Elena Santiago Gonzales', '06-30-18-000-560415', 78, 'Elena Santiago Gonzales', '06-30-18-000-560415', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (93, 79, 93, '1', 'Capaliz', 'Dumangas', 3.00, NULL, 'Ricardo Navarro Flores', '06-30-18-000-309460', 79, 'Ricardo Navarro Flores', '06-30-18-000-309460', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (94, 80, 94, '1', 'Cayos', 'Dumangas', 1.90, NULL, 'Gloria Mercado Diaz', '06-30-18-000-462796', 80, 'Gloria Mercado Diaz', '06-30-18-000-462796', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (95, 81, 95, '1', 'Compayan', 'Dumangas', 2.70, NULL, 'Miguel Pascual Soriano', '06-30-18-000-130691', 81, 'Miguel Pascual Soriano', '06-30-18-000-130691', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (96, 82, 96, '1', 'Dacutan', 'Dumangas', 1.60, NULL, 'Luz Valencia Castillo', '06-30-18-000-354801', 82, 'Luz Valencia Castillo', '06-30-18-000-354801', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (97, 83, 97, '1', 'Ermita', 'Dumangas', 3.50, NULL, 'Jose Morales Hernandez', '06-30-18-000-942303', 83, 'Jose Morales Hernandez', '06-30-18-000-942303', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (98, 84, 98, '1', 'Ilaya 1st', 'Dumangas', 2.10, NULL, 'Teresita Domingo Valdez', '06-30-18-000-597170', 84, 'Teresita Domingo Valdez', '06-30-18-000-597170', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (99, 85, 99, '1', 'Ilaya 2nd', 'Dumangas', 2.90, NULL, 'Fernando Cruz Aguilar', '06-30-18-000-945966', 85, 'Fernando Cruz Aguilar', '06-30-18-000-945966', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (100, 86, 100, '1', 'Ilaya 3rd', 'Dumangas', 1.40, NULL, 'Angelica Miranda Robles', '06-30-18-000-399760', 86, 'Angelica Miranda Robles', '06-30-18-000-399760', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (101, 87, 101, '1', 'Jardin', 'Dumangas', 3.30, NULL, 'Eduardo Gutierrez Santiago', '06-30-18-000-446719', 87, 'Eduardo Gutierrez Santiago', '06-30-18-000-446719', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (102, 88, 102, '1', 'Lacturan', 'Dumangas', 2.30, NULL, 'Imelda Ocampo Jimenez', '06-30-18-016-660893', 88, 'Imelda Ocampo Jimenez', '06-30-18-016-660893', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (103, 89, 103, '1', 'Managuit', 'Dumangas', 4.00, NULL, 'Ramon Perez Del Rosario', '06-30-18-000-090304', 89, 'Ramon Perez Del Rosario', '06-30-18-000-090304', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (104, 90, 104, '1', 'Maquina', 'Dumangas', 1.70, NULL, 'Nora Rivera Salazar', '06-30-18-000-026948', 90, 'Nora Rivera Salazar', '06-30-18-000-026948', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (105, 91, 105, '1', 'Nanding Lopez', 'Dumangas', 3.80, NULL, 'Alfredo Silva Romero', '06-30-18-000-634038', 91, 'Alfredo Silva Romero', '06-30-18-000-634038', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (106, 92, 106, '1', 'Pagdugue', 'Dumangas', 2.00, NULL, 'Josefina Alvarez Velasco', '06-30-18-000-822424', 92, 'Josefina Alvarez Velasco', '06-30-18-000-822424', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (107, 93, 107, '1', 'Paloc Bigque', 'Dumangas', 2.60, NULL, 'Daniel Iglesias Medina', '06-30-18-019-495378', 93, 'Daniel Iglesias Medina', '06-30-18-019-495378', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (108, 94, 108, '1', 'Paloc Sool', 'Dumangas', 1.80, NULL, 'Corazon Tan Manalo', '06-30-18-000-971461', 94, 'Corazon Tan Manalo', '06-30-18-000-971461', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (109, 95, 109, '1', 'Patlad', 'Dumangas', 3.10, NULL, 'Vicente Rosales Paguio', '06-30-18-000-463111', 95, 'Vicente Rosales Paguio', '06-30-18-000-463111', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (110, 96, 110, '1', 'Pulao', 'Dumangas', 2.40, NULL, 'Amelita Gomez Cordero', '06-30-18-020-919404', 96, 'Amelita Gomez Cordero', '06-30-18-020-919404', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (111, 97, 111, '1', 'Rosario', 'Dumangas', 2.90, NULL, 'Benjamin Laurel Padilla', '06-30-18-000-128144', 97, 'Benjamin Laurel Padilla', '06-30-18-000-128144', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (112, 98, 112, '1', 'Sapao', 'Dumangas', 1.50, NULL, 'Lydia Cabrera Marquez', '06-30-18-021-832580', 98, 'Lydia Cabrera Marquez', '06-30-18-021-832580', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (113, 99, 113, '1', 'Sulangan', 'Dumangas', 4.20, NULL, 'Ronaldo Abad Enriquez', '06-30-18-000-182702', 99, 'Ronaldo Abad Enriquez', '06-30-18-000-182702', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (114, 100, 114, '1', 'Tabucan', 'Dumangas', 2.10, NULL, 'Rosario Suarez Lim', '06-30-18-022-450982', 100, 'Rosario Suarez Lim', '06-30-18-022-450982', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (115, 101, 115, '1', 'Talusan', 'Dumangas', 3.40, NULL, 'Ernesto Villar Magno', '06-30-18-000-510376', 101, 'Ernesto Villar Magno', '06-30-18-000-510376', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (116, 102, 116, '1', 'Tambobo', 'Dumangas', 1.60, NULL, 'Divina Pascual Ocampo', '06-30-18-000-233008', 102, 'Divina Pascual Ocampo', '06-30-18-000-233008', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (117, 103, 117, '1', 'Tamboilan', 'Dumangas', 3.60, NULL, 'Rodrigo Luna Prado', '06-30-18-000-713431', 103, 'Rodrigo Luna Prado', '06-30-18-000-713431', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (118, 104, 118, '1', 'Victorias', 'Dumangas', 2.30, NULL, 'Estrella Solis Ibarra', '06-30-18-000-443727', 104, 'Estrella Solis Ibarra', '06-30-18-000-443727', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (119, 105, 119, '1', 'Bacong', 'Dumangas', 3.90, NULL, 'Gregorio Ortega Navarro', '06-30-18-003-174339', 105, 'Gregorio Ortega Navarro', '06-30-18-003-174339', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (120, 106, 120, '1', 'Balud', 'Dumangas', 1.70, NULL, 'Pacita Zamora Villareal', '06-30-18-005-801864', 106, 'Pacita Zamora Villareal', '06-30-18-005-801864', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (121, 107, 121, '1', 'Bantud Fabrica', 'Dumangas', 4.10, NULL, 'Leonido Delgado Caballero', '06-30-18-007-879578', 107, 'Leonido Delgado Caballero', '06-30-18-007-879578', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (122, 108, 122, '1', 'Barasan', 'Dumangas', 1.90, NULL, 'Violeta Reyes Paredes', '06-30-18-000-397732', 108, 'Violeta Reyes Paredes', '06-30-18-000-397732', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (123, 109, 123, '1', 'Aurora-Del Pilar', 'Dumangas', 2.80, NULL, 'Ignacio Natividad Benitez', '06-30-18-001-108771', 109, 'Ignacio Natividad Benitez', '06-30-18-001-108771', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (124, 110, 124, '1', 'Bacay', 'Dumangas', 1.80, NULL, 'Milagros Carreon Arellano', '06-30-18-002-262330', 110, 'Milagros Carreon Arellano', '06-30-18-002-262330', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (125, 111, 125, '1', 'Balabag', 'Dumangas', 3.70, NULL, 'Nestor Gallardo Palma', '06-30-18-004-080485', 111, 'Nestor Gallardo Palma', '06-30-18-004-080485', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (126, 112, 126, '1', 'Bantud', 'Dumangas', 2.20, NULL, 'Felicidad Cortez Espinosa', '06-30-18-006-016134', 112, 'Felicidad Cortez Espinosa', '06-30-18-006-016134', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (127, 113, 127, '1', 'Baras', 'Dumangas', 3.00, NULL, 'Arturo Mendoza Concepcion', '06-30-18-000-568536', 113, 'Arturo Mendoza Concepcion', '06-30-18-000-568536', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (128, 114, 128, '1', 'Bolilao', 'Dumangas', 1.50, NULL, 'Esperanza Bautista Trinidad', '06-30-18-009-570924', 114, 'Esperanza Bautista Trinidad', '06-30-18-009-570924', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (129, 115, 129, '1', 'Calao', 'Dumangas', 4.30, NULL, 'Rodolfo Vitug Buenaventura', '06-30-18-012-451231', 115, 'Rodolfo Vitug Buenaventura', '06-30-18-012-451231', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (130, 116, 130, '1', 'Cali', 'Dumangas', 2.00, NULL, 'Soledad De Leon Guerrero', '06-30-18-000-621945', 116, 'Soledad De Leon Guerrero', '06-30-18-000-621945', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (131, 117, 131, '1', 'Cansilayan', 'Dumangas', 3.20, NULL, 'Arsenio Salvador Montero', '06-30-18-000-705489', 117, 'Arsenio Salvador Montero', '06-30-18-000-705489', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (132, 118, 132, '1', 'Capaliz', 'Dumangas', 1.60, NULL, 'Basilisa De Guzman Navales', '06-30-18-000-810863', 118, 'Basilisa De Guzman Navales', '06-30-18-000-810863', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (133, 119, 133, '1', 'Cayos', 'Dumangas', 3.50, NULL, 'Wilfredo Aquino Macapagal', '06-30-18-000-172443', 119, 'Wilfredo Aquino Macapagal', '06-30-18-000-172443', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (134, 120, 134, '1', 'Compayan', 'Dumangas', 2.50, NULL, 'Zenaida Quinto Laurente', '06-30-18-000-542838', 120, 'Zenaida Quinto Laurente', '06-30-18-000-542838', NULL, NULL, false, NULL, NULL, false, true, false, NULL, NULL, NULL, false, false, '2025-12-07', NULL, true, 'NEW', NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL, NULL);
INSERT INTO public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) VALUES (202, 188, 202, '1', 'Baras', 'Dumangas', 2.00, NULL, 'Villanueva, Rosa Torres', NULL, 188, 'Mary Jane Serc Blanco', '06-30-18-000-857480', 'Mary Jane Serc Blanco', '06-30-18-000-857480', true, NULL, NULL, false, false, false, NULL, NULL, '', false, false, '2026-01-29', NULL, true, 'NEW', NULL, NULL, '2026-01-29 05:23:01.47861', '2026-01-29 05:23:01.47861', NULL, NULL, NULL);

--
-- Data for Name: land_plots; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.land_plots (id, name, ffrs_id, area, coordinate_accuracy, barangay, first_name, middle_name, surname, ext_name, gender, municipality, province, parcel_address, status, street, farm_type, plot_source, parcel_number, geometry, created_at, updated_at, geometry_postgis) VALUES ('shape-1769548305315-89a79077eaa7c', '', '', 4.50, 'approximate', 'Bolilao', 'Roberto', 'Aquino', 'Fernandez', '', 'Male', 'Dumangas', 'Iloilo', 'Bolilao, Dumangas', 'Tenant', '', 'Irrigated', 'manual', '1', '{"type": "Polygon", "coordinates": [[[122.755294, 10.86901], [122.755788, 10.868704], [122.755562, 10.868114], [122.75552, 10.867609], [122.755219, 10.867187], [122.754285, 10.867788], [122.755294, 10.86901]]]}', '2026-01-27 21:11:46.14', '2026-01-27 21:11:46.14', '0103000020E610000001000000070000005D37A5BC56B05E403ECBF3E0EEBC254064ADA1D45EB05E400BCF4BC5C6BC25406C06B8205BB05E4045662E7079BC254055DE8E705AB05E40376E313F37BC25405794128255B05E405F0839EFFFBB254041B7973446B05E40F5B86FB54EBC25405D37A5BC56B05E403ECBF3E0EEBC2540');
INSERT INTO public.land_plots (id, name, ffrs_id, area, coordinate_accuracy, barangay, first_name, middle_name, surname, ext_name, gender, municipality, province, parcel_address, status, street, farm_type, plot_source, parcel_number, geometry, created_at, updated_at, geometry_postgis) VALUES ('shape-1769547200571-1cc6f91aea93c8', '', '', 0.00, 'approximate', 'Baras', 'Rosa', 'Torres', 'Villanueva', '', 'Male', 'Dumangas', 'Iloilo', 'Baras, Dumangas', 'Tenant', '', 'Irrigated', 'manual', '1', '{"type": "Polygon", "coordinates": [[[122.708346, 10.828867], [122.708486, 10.828782], [122.708464, 10.828514], [122.708754, 10.828466], [122.708942, 10.829014], [122.708545, 10.829293], [122.708346, 10.828867]]]}', '2026-01-27 20:53:21.638', '2026-01-28 05:24:01.750859', '0103000020E610000001000000070000002810768A55AD5E409F77634161A8254020EBA9D557AD5E40E606431D56A825402D99637957AD5E40698EACFC32A8254030BABC395CAD5E4025B20FB22CA82540B130444E5FAD5E4030DAE38574A82540A3AF20CD58AD5E407C9A931799A825402810768A55AD5E409F77634161A82540');
INSERT INTO public.land_plots (id, name, ffrs_id, area, coordinate_accuracy, barangay, first_name, middle_name, surname, ext_name, gender, municipality, province, parcel_address, status, street, farm_type, plot_source, parcel_number, geometry, created_at, updated_at, geometry_postgis) VALUES ('shape-1768425620851-4fc9876656d5c', '', '', 2.80, 'approximate', 'Cali', 'Antonio', 'Castro', 'Bautista', '', 'Male', 'Dumangas', 'Iloilo', 'Cali, Dumangas', 'Tenant', '', 'Irrigated', 'manual', '1', '{"type": "Polygon", "coordinates": [[[122.70504, 10.836841], [122.704053, 10.836135], [122.704332, 10.835629], [122.705212, 10.836293], [122.705319, 10.836472], [122.70504, 10.836841]]]}', '2026-01-14 21:20:21.635', '2026-01-14 21:20:21.635', '0103000020E61000000100000006000000CC9717601FAD5E4064E76D6C76AC2540A56950340FAD5E40F91400E319AC2540AE6186C613AD5E40AA2D7590D7AB2540CB2F833122AD5E4059BF99982EAC2540D68F4DF223AD5E40180AD80E46AC2540CC9717601FAD5E4064E76D6C76AC2540');

--
-- Data for Name: masterlist; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: ownership_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: priority_configurations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.priority_configurations (id, config_name, is_active, farm_area_weight, ownership_weight, history_weight, location_weight, crop_weight, farm_area_rules, ownership_rules, location_rules, description, created_at, updated_at) VALUES (1, 'default_equity_based', true, 30, 25, 20, 15, 10, '{"<1ha": 30, ">3ha": 5, "1-2ha": 20, "2-3ha": 10}', '{"lessee": 20, "tenant": 25, "usufructuary": 15, "registered_owner": 10}', '{"remote": 15, "moderate": 10, "accessible": 5}', 'Default equity-based prioritization: Prioritizes small farmers, tenants, and remote areas', '2025-11-16 19:11:59.574126', '2025-11-16 19:11:59.574126');

--
-- Data for Name: regional_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.regional_allocations (id, season, allocation_date, season_start_date, season_end_date, urea_46_0_0_bags, complete_14_14_14_bags, complete_16_16_16_bags, ammonium_sulfate_21_0_0_bags, ammonium_phosphate_16_20_0_bags, muriate_potash_0_0_60_bags, rice_seeds_nsic_rc160_kg, rice_seeds_nsic_rc222_kg, rice_seeds_nsic_rc440_kg, corn_seeds_hybrid_kg, corn_seeds_opm_kg, vegetable_seeds_kg, notes, status, created_by, created_at, updated_at, jackpot_kg, us88_kg, th82_kg, rh9000_kg, lumping143_kg, lp296_kg) VALUES (19, 'dry_2026', '2026-01-17', NULL, NULL, 400, 400, 0, 400, 0, 40, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '', 'active', NULL, '2026-01-18 05:23:13.251534', '2026-01-18 05:23:13.251534', 40.00, 40.00, 40.00, 40.00, 40.00, 39.98);

--
-- Data for Name: rsbsa_farm_parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (88, 74, '1', 'Baras', 'Dumangas', 2.00, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (89, 75, '1', 'Bolilao', 'Dumangas', 4.50, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (90, 76, '1', 'Calao', 'Dumangas', 1.50, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (91, 77, '1', 'Cali', 'Dumangas', 2.80, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (92, 78, '1', 'Cansilayan', 'Dumangas', 2.20, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (93, 79, '1', 'Capaliz', 'Dumangas', 3.00, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (94, 80, '1', 'Cayos', 'Dumangas', 1.90, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (95, 81, '1', 'Compayan', 'Dumangas', 2.70, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (96, 82, '1', 'Dacutan', 'Dumangas', 1.60, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (97, 83, '1', 'Ermita', 'Dumangas', 3.50, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (98, 84, '1', 'Ilaya 1st', 'Dumangas', 2.10, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (99, 85, '1', 'Ilaya 2nd', 'Dumangas', 2.90, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (100, 86, '1', 'Ilaya 3rd', 'Dumangas', 1.40, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (101, 87, '1', 'Jardin', 'Dumangas', 3.30, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (102, 88, '1', 'Lacturan', 'Dumangas', 2.30, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (103, 89, '1', 'Managuit', 'Dumangas', 4.00, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (104, 90, '1', 'Maquina', 'Dumangas', 1.70, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (105, 91, '1', 'Nanding Lopez', 'Dumangas', 3.80, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (106, 92, '1', 'Pagdugue', 'Dumangas', 2.00, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (107, 93, '1', 'Paloc Bigque', 'Dumangas', 2.60, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (108, 94, '1', 'Paloc Sool', 'Dumangas', 1.80, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (109, 95, '1', 'Patlad', 'Dumangas', 3.10, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (110, 96, '1', 'Pulao', 'Dumangas', 2.40, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (111, 97, '1', 'Rosario', 'Dumangas', 2.90, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (112, 98, '1', 'Sapao', 'Dumangas', 1.50, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (113, 99, '1', 'Sulangan', 'Dumangas', 4.20, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (114, 100, '1', 'Tabucan', 'Dumangas', 2.10, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (115, 101, '1', 'Talusan', 'Dumangas', 3.40, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (116, 102, '1', 'Tambobo', 'Dumangas', 1.60, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (117, 103, '1', 'Tamboilan', 'Dumangas', 3.60, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (118, 104, '1', 'Victorias', 'Dumangas', 2.30, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (119, 105, '1', 'Bacong', 'Dumangas', 3.90, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (120, 106, '1', 'Balud', 'Dumangas', 1.70, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (121, 107, '1', 'Bantud Fabrica', 'Dumangas', 4.10, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (122, 108, '1', 'Barasan', 'Dumangas', 1.90, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (123, 109, '1', 'Aurora-Del Pilar', 'Dumangas', 2.80, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (124, 110, '1', 'Bacay', 'Dumangas', 1.80, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (125, 111, '1', 'Balabag', 'Dumangas', 3.70, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (126, 112, '1', 'Bantud', 'Dumangas', 2.20, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (127, 113, '1', 'Baras', 'Dumangas', 3.00, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (128, 114, '1', 'Bolilao', 'Dumangas', 1.50, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (129, 115, '1', 'Calao', 'Dumangas', 4.30, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (130, 116, '1', 'Cali', 'Dumangas', 2.00, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (131, 117, '1', 'Cansilayan', 'Dumangas', 3.20, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (132, 118, '1', 'Capaliz', 'Dumangas', 1.60, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (133, 119, '1', 'Cayos', 'Dumangas', 3.50, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (134, 120, '1', 'Compayan', 'Dumangas', 2.50, NULL, NULL, NULL, true, false, false, false, NULL, NULL, NULL, '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', NULL, NULL);
INSERT INTO public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) VALUES (202, 188, '1', 'Baras', 'Dumangas', 2.00, 'No', '', 'No', false, true, false, false, 'Villanueva, Rosa Torres', '', '', '2026-01-29 05:23:01.47861', '2026-01-29 05:23:01.47861', NULL, NULL);

--
-- Data for Name: rsbsa_submission; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (74, 'Villanueva', 'Rosa', 'Torres', NULL, 'Female', '1979-05-18', 'Baras', 'Dumangas', 'Baras, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.00, '06-30-18-000-580447', 45, true, false, true, 'Vegetables', false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (75, 'Fernandez', 'Roberto', 'Aquino', NULL, 'Male', '1985-09-12', 'Bolilao', 'Dumangas', 'Bolilao, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 4.50, '06-30-18-009-913582', 39, false, true, false, NULL, true, 'Carabao', false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (76, 'Lopez', 'Carmen', 'Ramos', NULL, 'Female', '1990-02-28', 'Calao', 'Dumangas', 'Calao, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.50, '06-30-18-012-959123', 34, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (77, 'Bautista', 'Antonio', 'Castro', NULL, 'Male', '1972-06-05', 'Cali', 'Dumangas', 'Cali, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.80, '06-30-18-000-688797', 52, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (78, 'Gonzales', 'Elena', 'Santiago', NULL, 'Female', '1987-12-14', 'Cansilayan', 'Dumangas', 'Cansilayan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.20, '06-30-18-000-560415', 37, true, false, false, NULL, false, NULL, true, 'Chickens');
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (79, 'Flores', 'Ricardo', 'Navarro', NULL, 'Male', '1980-04-20', 'Capaliz', 'Dumangas', 'Capaliz, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.00, '06-30-18-000-309460', 44, false, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (80, 'Diaz', 'Gloria', 'Mercado', NULL, 'Female', '1976-08-30', 'Cayos', 'Dumangas', 'Cayos, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.90, '06-30-18-000-462796', 48, true, false, true, 'Tomatoes', false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (82, 'Castillo', 'Luz', 'Valencia', NULL, 'Female', '1988-10-10', 'Dacutan', 'Dumangas', 'Dacutan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.60, '06-30-18-000-354801', 36, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (83, 'Hernandez', 'Jose', 'Morales', NULL, 'Male', '1970-07-03', 'Ermita', 'Dumangas', 'Ermita, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.50, '06-30-18-000-942303', 54, false, true, false, NULL, true, 'Goats', false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (84, 'Valdez', 'Teresita', 'Domingo', NULL, 'Female', '1981-03-19', 'Ilaya 1st', 'Dumangas', 'Ilaya 1st, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.10, '06-30-18-000-597170', 43, true, false, false, NULL, false, NULL, true, 'Ducks');
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (85, 'Aguilar', 'Fernando', 'Cruz', NULL, 'Male', '1977-11-27', 'Ilaya 2nd', 'Dumangas', 'Ilaya 2nd, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.90, '06-30-18-000-945966', 47, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (86, 'Robles', 'Angelica', 'Miranda', NULL, 'Female', '1992-05-08', 'Ilaya 3rd', 'Dumangas', 'Ilaya 3rd, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.40, '06-30-18-000-399760', 32, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (87, 'Santiago', 'Eduardo', 'Gutierrez', NULL, 'Male', '1974-09-16', 'Jardin', 'Dumangas', 'Jardin, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.30, '06-30-18-000-446719', 50, false, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (88, 'Jimenez', 'Imelda', 'Ocampo', NULL, 'Female', '1984-12-02', 'Lacturan', 'Dumangas', 'Lacturan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.30, '06-30-18-016-660893', 40, true, false, true, 'Eggplant', false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (89, 'Del Rosario', 'Ramon', 'Perez', NULL, 'Male', '1969-02-11', 'Managuit', 'Dumangas', 'Managuit, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 4.00, '06-30-18-000-090304', 55, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (90, 'Salazar', 'Nora', 'Rivera', NULL, 'Female', '1986-06-24', 'Maquina', 'Dumangas', 'Maquina, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.70, '06-30-18-000-026948', 38, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (91, 'Romero', 'Alfredo', 'Silva', NULL, 'Male', '1978-08-07', 'Nanding Lopez', 'Dumangas', 'Nanding Lopez, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.80, '06-30-18-000-634038', 46, false, true, false, NULL, true, 'Pigs', false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (92, 'Velasco', 'Josefina', 'Alvarez', NULL, 'Female', '1991-04-13', 'Pagdugue', 'Dumangas', 'Pagdugue, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.00, '06-30-18-000-822424', 33, true, false, false, NULL, false, NULL, true, 'Chickens');
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (93, 'Medina', 'Daniel', 'Iglesias', NULL, 'Male', '1973-10-29', 'Paloc Bigque', 'Dumangas', 'Paloc Bigque, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.60, '06-30-18-019-495378', 51, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (94, 'Manalo', 'Corazon', 'Tan', NULL, 'Female', '1989-01-17', 'Paloc Sool', 'Dumangas', 'Paloc Sool, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.80, '06-30-18-000-971461', 35, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (95, 'Paguio', 'Vicente', 'Rosales', NULL, 'Male', '1971-07-21', 'Patlad', 'Dumangas', 'Patlad, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.10, '06-30-18-000-463111', 53, false, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (96, 'Cordero', 'Amelita', 'Gomez', NULL, 'Female', '1985-11-09', 'Pulao', 'Dumangas', 'Pulao, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.40, '06-30-18-020-919404', 39, true, false, true, 'Okra', false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (97, 'Padilla', 'Benjamin', 'Laurel', NULL, 'Male', '1976-03-26', 'Rosario', 'Dumangas', 'Rosario, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.90, '06-30-18-000-128144', 48, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (98, 'Marquez', 'Lydia', 'Cabrera', NULL, 'Female', '1993-09-05', 'Sapao', 'Dumangas', 'Sapao, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.50, '06-30-18-021-832580', 31, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (99, 'Enriquez', 'Ronaldo', 'Abad', NULL, 'Male', '1980-12-18', 'Sulangan', 'Dumangas', 'Sulangan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 4.20, '06-30-18-000-182702', 44, false, true, false, NULL, true, 'Carabao', false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (100, 'Lim', 'Rosario', 'Suarez', NULL, 'Female', '1987-05-31', 'Tabucan', 'Dumangas', 'Tabucan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.10, '06-30-18-022-450982', 37, true, false, false, NULL, false, NULL, true, 'Ducks');
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (101, 'Magno', 'Ernesto', 'Villar', NULL, 'Male', '1972-08-14', 'Talusan', 'Dumangas', 'Talusan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.40, '06-30-18-000-510376', 52, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (102, 'Ocampo', 'Divina', 'Pascual', NULL, 'Female', '1990-10-22', 'Tambobo', 'Dumangas', 'Tambobo, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.60, '06-30-18-000-233008', 34, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (103, 'Prado', 'Rodrigo', 'Luna', NULL, 'Male', '1975-04-06', 'Tamboilan', 'Dumangas', 'Tamboilan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.60, '06-30-18-000-713431', 49, false, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (104, 'Ibarra', 'Estrella', 'Solis', NULL, 'Female', '1983-02-15', 'Victorias', 'Dumangas', 'Victorias, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.30, '06-30-18-000-443727', 41, true, false, true, 'Peppers', false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (105, 'Navarro', 'Gregorio', 'Ortega', NULL, 'Male', '1969-06-11', 'Bacong', 'Dumangas', 'Bacong, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.90, '06-30-18-003-174339', 55, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (106, 'Villareal', 'Pacita', 'Zamora', NULL, 'Female', '1988-07-28', 'Balud', 'Dumangas', 'Balud, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.70, '06-30-18-005-801864', 36, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (107, 'Caballero', 'Leonido', 'Delgado', NULL, 'Male', '1977-09-03', 'Bantud Fabrica', 'Dumangas', 'Bantud Fabrica, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 4.10, '06-30-18-007-879578', 47, false, true, false, NULL, true, 'Goats', false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (108, 'Paredes', 'Violeta', 'Reyes', NULL, 'Female', '1991-12-07', 'Barasan', 'Dumangas', 'Barasan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.90, '06-30-18-000-397732', 33, true, false, false, NULL, false, NULL, true, 'Chickens');
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (81, 'Soriano', 'Miguel', 'Pascual', NULL, 'Male', '1983-01-25', 'Compayan', 'Dumangas', 'Compayan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2026-01-05 18:54:29.980864', 2.70, '06-30-18-000-130691', 41, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (188, 'Blanco', 'Mary Jane', 'Serc', '', 'Female', '2026-01-06', 'Baras', 'Dumangas', 'Baras, Dumangas', '2', 'farmer', false, true, false, 'Active Farmer', '2026-01-29 05:23:01.47861', '2026-01-29 05:23:01.47861', '2026-01-29 05:23:01.47861', 2.00, '06-30-18-000-857480', 0, true, true, false, '', false, '', false, '');
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (109, 'Benitez', 'Ignacio', 'Natividad', NULL, 'Male', '1974-01-19', 'Aurora-Del Pilar', 'Dumangas', 'Aurora-Del Pilar, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.80, '06-30-18-001-108771', 50, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (110, 'Arellano', 'Milagros', 'Carreon', NULL, 'Female', '1986-11-25', 'Bacay', 'Dumangas', 'Bacay, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.80, '06-30-18-002-262330', 38, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (111, 'Palma', 'Nestor', 'Gallardo', NULL, 'Male', '1970-05-14', 'Balabag', 'Dumangas', 'Balabag, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.70, '06-30-18-004-080485', 54, false, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (112, 'Espinosa', 'Felicidad', 'Cortez', NULL, 'Female', '1982-03-09', 'Bantud', 'Dumangas', 'Bantud, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.20, '06-30-18-006-016134', 42, true, false, true, 'Bitter Gourd', false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (113, 'Concepcion', 'Arturo', 'Mendoza', NULL, 'Male', '1979-10-01', 'Baras', 'Dumangas', 'Baras, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.00, '06-30-18-000-568536', 45, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (114, 'Trinidad', 'Esperanza', 'Bautista', NULL, 'Female', '1992-06-16', 'Bolilao', 'Dumangas', 'Bolilao, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.50, '06-30-18-009-570924', 32, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (115, 'Buenaventura', 'Rodolfo', 'Vitug', NULL, 'Male', '1973-08-23', 'Calao', 'Dumangas', 'Calao, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 4.30, '06-30-18-012-451231', 51, false, true, false, NULL, true, 'Pigs', false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (116, 'Guerrero', 'Soledad', 'De Leon', NULL, 'Female', '1984-04-30', 'Cali', 'Dumangas', 'Cali, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.00, '06-30-18-000-621945', 40, true, false, false, NULL, false, NULL, true, 'Ducks');
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (117, 'Montero', 'Arsenio', 'Salvador', NULL, 'Male', '1971-12-12', 'Cansilayan', 'Dumangas', 'Cansilayan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 3.20, '06-30-18-000-705489', 53, true, true, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (118, 'Navales', 'Basilisa', 'De Guzman', NULL, 'Female', '1989-07-04', 'Capaliz', 'Dumangas', 'Capaliz, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 1.60, '06-30-18-000-810863', 35, true, false, false, NULL, false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (120, 'Laurente', 'Zenaida', 'Quinto', NULL, 'Female', '1985-09-29', 'Compayan', 'Dumangas', 'Compayan, Dumangas', NULL, 'farmer', true, false, false, 'Active Farmer', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', 2.50, '06-30-18-000-542838', 39, true, false, true, 'String Beans', false, NULL, false, NULL);
INSERT INTO public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") VALUES (119, 'Macapagal', 'Wilfredo', 'Aquino', NULL, 'Male', '1976-02-20', 'Cayos', 'Dumangas', 'Cayos, Dumangas', NULL, 'farmer', true, false, false, 'Not Active', '2025-12-07 08:51:49.733464', '2025-12-07 08:51:49.733464', '2026-01-05 21:19:26.691854', 3.50, '06-30-18-000-172443', 48, false, true, false, NULL, false, NULL, false, NULL);

--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Name: barangay_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.barangay_codes_id_seq', 118, true);

--
-- Name: distribution_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.distribution_records_id_seq', 15, true);

--
-- Name: farm_parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.farm_parcels_id_seq', 1, false);

--
-- Name: farmer_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.farmer_requests_id_seq', 37, true);

--
-- Name: incentive_distribution_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.incentive_distribution_log_id_seq', 1, false);

--
-- Name: land_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.land_history_id_seq', 202, true);

--
-- Name: masterlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.masterlist_id_seq', 1, false);

--
-- Name: ownership_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ownership_transfers_id_seq', 8, true);

--
-- Name: priority_configurations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.priority_configurations_id_seq', 1, true);

--
-- Name: regional_allocations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.regional_allocations_id_seq', 19, true);

--
-- Name: rsbsa_farm_parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsa_farm_parcels_id_seq', 202, true);

--
-- Name: rsbsa_submission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsa_submission_id_seq', 188, true);

--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);

--
-- Name: barangay_codes barangay_codes_barangay_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_barangay_code_key UNIQUE (barangay_code);

--
-- Name: barangay_codes barangay_codes_barangay_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_barangay_name_key UNIQUE (barangay_name);

--
-- Name: barangay_codes barangay_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_pkey PRIMARY KEY (id);

--
-- Name: distribution_records distribution_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records
    ADD CONSTRAINT distribution_records_pkey PRIMARY KEY (id);

--
-- Name: distribution_records distribution_records_voucher_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records
    ADD CONSTRAINT distribution_records_voucher_code_key UNIQUE (voucher_code);

--
-- Name: farm_parcels farm_parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels
    ADD CONSTRAINT farm_parcels_pkey PRIMARY KEY (id);

--
-- Name: farmer_requests farmer_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_requests
    ADD CONSTRAINT farmer_requests_pkey PRIMARY KEY (id);

--
-- Name: incentive_distribution_log incentive_distribution_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT incentive_distribution_log_pkey PRIMARY KEY (id);

--
-- Name: land_history land_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_pkey PRIMARY KEY (id);

--
-- Name: land_plots land_plots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_plots
    ADD CONSTRAINT land_plots_pkey PRIMARY KEY (id);

--
-- Name: masterlist masterlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterlist
    ADD CONSTRAINT masterlist_pkey PRIMARY KEY (id);

--
-- Name: ownership_transfers ownership_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_pkey PRIMARY KEY (id);

--
-- Name: priority_configurations priority_configurations_config_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priority_configurations
    ADD CONSTRAINT priority_configurations_config_name_key UNIQUE (config_name);

--
-- Name: priority_configurations priority_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priority_configurations
    ADD CONSTRAINT priority_configurations_pkey PRIMARY KEY (id);

--
-- Name: regional_allocations regional_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regional_allocations
    ADD CONSTRAINT regional_allocations_pkey PRIMARY KEY (id);

--
-- Name: rsbsa_farm_parcels rsbsa_farm_parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT rsbsa_farm_parcels_pkey PRIMARY KEY (id);

--
-- Name: rsbsa_submission rsbsa_submission_FFRS_CODE_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission
    ADD CONSTRAINT "rsbsa_submission_FFRS_CODE_key" UNIQUE ("FFRS_CODE");

--
-- Name: rsbsa_submission rsbsa_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission
    ADD CONSTRAINT rsbsa_submission_pkey PRIMARY KEY (id);

--
-- Name: regional_allocations unique_season; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regional_allocations
    ADD CONSTRAINT unique_season UNIQUE (season);

--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

--
-- Name: idx_allocations_season; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocations_season ON public.regional_allocations USING btree (season);

--
-- Name: idx_distributions_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_distributions_request ON public.distribution_records USING btree (request_id);

--
-- Name: idx_incentive_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_created ON public.incentive_distribution_log USING btree (created_at);

--
-- Name: idx_incentive_encoder; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_encoder ON public.incentive_distribution_log USING btree (encoder_id);

--
-- Name: idx_incentive_event_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_event_date ON public.incentive_distribution_log USING btree (event_date);

--
-- Name: idx_incentive_farmer_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_farmer_date ON public.incentive_distribution_log USING btree (farmer_id, event_date DESC);

--
-- Name: idx_incentive_farmer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_farmer_id ON public.incentive_distribution_log USING btree (farmer_id);

--
-- Name: idx_incentive_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_type ON public.incentive_distribution_log USING btree (incentive_type);

--
-- Name: idx_land_history_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_barangay ON public.land_history USING btree (farm_location_barangay);

--
-- Name: idx_land_history_change_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_change_type ON public.land_history USING btree (change_type);

--
-- Name: idx_land_history_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_created_at ON public.land_history USING btree (created_at);

--
-- Name: idx_land_history_current_records; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_current_records ON public.land_history USING btree (farm_parcel_id, is_current) WHERE (is_current = true);

--
-- Name: idx_land_history_farm_parcel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farm_parcel ON public.land_history USING btree (farm_parcel_id);

--
-- Name: idx_land_history_farmer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farmer_id ON public.land_history USING btree (farmer_id);

--
-- Name: idx_land_history_farmer_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farmer_name ON public.land_history USING btree (farmer_name);

--
-- Name: idx_land_history_is_current; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_is_current ON public.land_history USING btree (is_current);

--
-- Name: idx_land_history_land_owner_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_land_owner_name ON public.land_history USING btree (land_owner_name);

--
-- Name: idx_land_history_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_municipality ON public.land_history USING btree (farm_location_municipality);

--
-- Name: idx_land_history_period_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_period_dates ON public.land_history USING btree (period_start_date, period_end_date);

--
-- Name: idx_land_history_rsbsa_submission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_rsbsa_submission ON public.land_history USING btree (rsbsa_submission_id);

--
-- Name: idx_land_plots_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_barangay ON public.land_plots USING btree (barangay);

--
-- Name: idx_land_plots_geometry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_geometry ON public.land_plots USING gin (geometry);

--
-- Name: idx_land_plots_geometry_postgis; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_geometry_postgis ON public.land_plots USING gist (geometry_postgis);

--
-- Name: idx_land_plots_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_municipality ON public.land_plots USING btree (municipality);

--
-- Name: idx_land_plots_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_status ON public.land_plots USING btree (status);

--
-- Name: idx_land_plots_surname; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_surname ON public.land_plots USING btree (surname);

--
-- Name: idx_ownership_transfers_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_date ON public.ownership_transfers USING btree (transfer_date);

--
-- Name: idx_ownership_transfers_from_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_from_farmer ON public.ownership_transfers USING btree (from_farmer_id);

--
-- Name: idx_ownership_transfers_to_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_to_farmer ON public.ownership_transfers USING btree (to_farmer_id);

--
-- Name: idx_requests_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_farmer ON public.farmer_requests USING btree (farmer_id);

--
-- Name: idx_requests_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_priority ON public.farmer_requests USING btree (priority_score DESC);

--
-- Name: idx_requests_season; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_season ON public.farmer_requests USING btree (season);

--
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_status ON public.farmer_requests USING btree (status);

--
-- Name: idx_rsbsa_farm_parcels_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_area ON public.rsbsa_farm_parcels USING btree (total_farm_area_ha);

--
-- Name: idx_rsbsa_farm_parcels_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_barangay ON public.rsbsa_farm_parcels USING btree (farm_location_barangay);

--
-- Name: idx_rsbsa_farm_parcels_lessee_land_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_lessee_land_owner_id ON public.rsbsa_farm_parcels USING btree (lessee_land_owner_id);

--
-- Name: idx_rsbsa_farm_parcels_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_municipality ON public.rsbsa_farm_parcels USING btree (farm_location_municipality);

--
-- Name: idx_rsbsa_farm_parcels_parcel_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_parcel_number ON public.rsbsa_farm_parcels USING btree (parcel_number);

--
-- Name: idx_rsbsa_farm_parcels_submission_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_submission_id ON public.rsbsa_farm_parcels USING btree (submission_id);

--
-- Name: idx_rsbsa_farm_parcels_tenant_land_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_tenant_land_owner_id ON public.rsbsa_farm_parcels USING btree (tenant_land_owner_id);

--
-- Name: idx_rsbsa_submission_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_barangay ON public.rsbsa_submission USING btree ("BARANGAY");

--
-- Name: idx_rsbsa_submission_birthday; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_birthday ON public.rsbsa_submission USING btree ("BIRTHDATE");

--
-- Name: idx_rsbsa_submission_ext_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_ext_name ON public.rsbsa_submission USING btree ("EXT NAME");

--
-- Name: idx_rsbsa_submission_farm_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farm_location ON public.rsbsa_submission USING btree ("FARM LOCATION");

--
-- Name: idx_rsbsa_submission_farmer_corn; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_corn ON public.rsbsa_submission USING btree ("FARMER_CORN");

--
-- Name: idx_rsbsa_submission_farmer_livestock; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_livestock ON public.rsbsa_submission USING btree ("FARMER_LIVESTOCK");

--
-- Name: idx_rsbsa_submission_farmer_other_crops; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_other_crops ON public.rsbsa_submission USING btree ("FARMER_OTHER_CROPS");

--
-- Name: idx_rsbsa_submission_farmer_poultry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_poultry ON public.rsbsa_submission USING btree ("FARMER_POULTRY");

--
-- Name: idx_rsbsa_submission_farmer_rice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_rice ON public.rsbsa_submission USING btree ("FARMER_RICE");

--
-- Name: idx_rsbsa_submission_ffrs_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_ffrs_code ON public.rsbsa_submission USING btree ("FFRS_CODE");

--
-- Name: idx_rsbsa_submission_first_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_first_name ON public.rsbsa_submission USING btree ("FIRST NAME");

--
-- Name: idx_rsbsa_submission_gender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_gender ON public.rsbsa_submission USING btree ("GENDER");

--
-- Name: idx_rsbsa_submission_last_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_last_name ON public.rsbsa_submission USING btree ("LAST NAME");

--
-- Name: idx_rsbsa_submission_main_livelihood; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_main_livelihood ON public.rsbsa_submission USING btree ("MAIN LIVELIHOOD");

--
-- Name: idx_rsbsa_submission_middle_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_middle_name ON public.rsbsa_submission USING btree ("MIDDLE NAME");

--
-- Name: idx_rsbsa_submission_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_municipality ON public.rsbsa_submission USING btree ("MUNICIPALITY");

--
-- Name: idx_rsbsa_submission_parcel_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_parcel_area ON public.rsbsa_submission USING btree ("PARCEL AREA");

--
-- Name: idx_rsbsa_submission_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_status ON public.rsbsa_submission USING btree (status);

--
-- Name: idx_rsbsa_submission_submitted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_submitted_at ON public.rsbsa_submission USING btree (submitted_at);

--
-- Name: idx_rsbsa_submission_total_farm_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_total_farm_area ON public.rsbsa_submission USING btree ("TOTAL FARM AREA");

--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);

--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);

--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);

--
-- Name: incentive_distribution_log trg_incentive_log_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_incentive_log_updated BEFORE UPDATE ON public.incentive_distribution_log FOR EACH ROW EXECUTE FUNCTION public.update_incentive_log_timestamp();

--
-- Name: users trg_users_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_users_timestamp();

--
-- Name: rsbsa_farm_parcels trigger_create_land_history_on_parcel_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_create_land_history_on_parcel_insert AFTER INSERT ON public.rsbsa_farm_parcels FOR EACH ROW EXECUTE FUNCTION public.create_land_history_from_farm_parcel();

--
-- Name: rsbsa_submission trigger_generate_ffrs_code; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_generate_ffrs_code BEFORE INSERT ON public.rsbsa_submission FOR EACH ROW EXECUTE FUNCTION public.generate_ffrs_code_trigger();

--
-- Name: rsbsa_farm_parcels trigger_update_land_history_on_parcel_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_land_history_on_parcel_update AFTER UPDATE ON public.rsbsa_farm_parcels FOR EACH ROW EXECUTE FUNCTION public.update_land_history_from_farm_parcel();

--
-- Name: land_history trigger_update_land_history_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_land_history_timestamp BEFORE UPDATE ON public.land_history FOR EACH ROW EXECUTE FUNCTION public.update_land_history_timestamp();

--
-- Name: distribution_records distribution_records_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records
    ADD CONSTRAINT distribution_records_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.farmer_requests(id) ON DELETE CASCADE;

--
-- Name: farm_parcels farm_parcels_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels
    ADD CONSTRAINT farm_parcels_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;

--
-- Name: farmer_requests farmer_requests_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_requests
    ADD CONSTRAINT farmer_requests_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;

--
-- Name: incentive_distribution_log fk_encoder; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT fk_encoder FOREIGN KEY (encoder_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: incentive_distribution_log fk_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT fk_farmer FOREIGN KEY (farmer_id) REFERENCES public.masterlist(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: ownership_transfers fk_from_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT fk_from_farmer FOREIGN KEY (from_farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;

--
-- Name: rsbsa_farm_parcels fk_lessee_land_owner; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT fk_lessee_land_owner FOREIGN KEY (lessee_land_owner_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;

--
-- Name: rsbsa_farm_parcels fk_tenant_land_owner; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT fk_tenant_land_owner FOREIGN KEY (tenant_land_owner_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;

--
-- Name: ownership_transfers fk_to_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT fk_to_farmer FOREIGN KEY (to_farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;

--
-- Name: land_history land_history_farm_parcel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_farm_parcel_id_fkey FOREIGN KEY (farm_parcel_id) REFERENCES public.rsbsa_farm_parcels(id) ON DELETE CASCADE;

--
-- Name: land_history land_history_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;

--
-- Name: land_history land_history_previous_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_previous_record_id_fkey FOREIGN KEY (previous_record_id) REFERENCES public.land_history(id) ON DELETE SET NULL;

--
-- Name: land_history land_history_rsbsa_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_rsbsa_submission_id_fkey FOREIGN KEY (rsbsa_submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;

--
-- Name: rsbsa_farm_parcels rsbsa_farm_parcels_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT rsbsa_farm_parcels_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;

--
-- PostgreSQL database dump complete
--



