--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-11-13 09:12:23

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 24685)
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- TOC entry 6052 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- TOC entry 777 (class 1255 OID 31664)
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


ALTER FUNCTION public.create_land_history_from_farm_parcel() OWNER TO postgres;

--
-- TOC entry 6053 (class 0 OID 0)
-- Dependencies: 777
-- Name: FUNCTION create_land_history_from_farm_parcel(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_land_history_from_farm_parcel() IS 'Automatically creates land history record when a new farm parcel is added';


--
-- TOC entry 990 (class 1255 OID 31596)
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
$$;


ALTER FUNCTION public.generate_ffrs_code(barangay_name character varying) OWNER TO postgres;

--
-- TOC entry 531 (class 1255 OID 31598)
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


ALTER FUNCTION public.generate_ffrs_code_trigger() OWNER TO postgres;

--
-- TOC entry 644 (class 1255 OID 31661)
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


ALTER FUNCTION public.get_farmer_full_name(submission_id bigint) OWNER TO postgres;

--
-- TOC entry 356 (class 1255 OID 31597)
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


ALTER FUNCTION public.update_all_ffrs_codes() OWNER TO postgres;

--
-- TOC entry 724 (class 1255 OID 67159)
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


ALTER FUNCTION public.update_incentive_log_timestamp() OWNER TO postgres;

--
-- TOC entry 500 (class 1255 OID 31666)
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


ALTER FUNCTION public.update_land_history_from_farm_parcel() OWNER TO postgres;

--
-- TOC entry 6054 (class 0 OID 0)
-- Dependencies: 500
-- Name: FUNCTION update_land_history_from_farm_parcel(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_land_history_from_farm_parcel() IS 'Automatically updates land history when farm parcel ownership changes';


--
-- TOC entry 252 (class 1255 OID 31662)
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


ALTER FUNCTION public.update_land_history_timestamp() OWNER TO postgres;

--
-- TOC entry 544 (class 1255 OID 67126)
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


ALTER FUNCTION public.update_users_timestamp() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 228 (class 1259 OID 26039)
-- Name: barangay_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.barangay_codes (
    id integer NOT NULL,
    barangay_name character varying(100) NOT NULL,
    barangay_code character varying(3) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.barangay_codes OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 26038)
-- Name: barangay_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.barangay_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.barangay_codes_id_seq OWNER TO postgres;

--
-- TOC entry 6055 (class 0 OID 0)
-- Dependencies: 227
-- Name: barangay_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.barangay_codes_id_seq OWNED BY public.barangay_codes.id;


--
-- TOC entry 229 (class 1259 OID 26050)
-- Name: barangay_farmer_counters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.barangay_farmer_counters (
    barangay_code character varying(3) NOT NULL,
    current_count integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.barangay_farmer_counters OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 26289)
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


ALTER TABLE public.farm_parcels OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 26288)
-- Name: farm_parcels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.farm_parcels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.farm_parcels_id_seq OWNER TO postgres;

--
-- TOC entry 6056 (class 0 OID 0)
-- Dependencies: 234
-- Name: farm_parcels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.farm_parcels_id_seq OWNED BY public.farm_parcels.id;


--
-- TOC entry 241 (class 1259 OID 67129)
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


ALTER TABLE public.incentive_distribution_log OWNER TO postgres;

--
-- TOC entry 6057 (class 0 OID 0)
-- Dependencies: 241
-- Name: TABLE incentive_distribution_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.incentive_distribution_log IS 'Records completed physical incentive distributions. NO online requests or approvals.';


--
-- TOC entry 6058 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN incentive_distribution_log.farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.farmer_id IS 'Reference to masterlist farmer';


--
-- TOC entry 6059 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN incentive_distribution_log.event_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.event_date IS 'Date of physical distribution event';


--
-- TOC entry 6060 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN incentive_distribution_log.incentive_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.incentive_type IS 'e.g., "Rice Seeds 20kg", "Fertilizer 50kg"';


--
-- TOC entry 6061 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN incentive_distribution_log.qty_requested; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.qty_requested IS 'Amount farmer requested at event';


--
-- TOC entry 6062 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN incentive_distribution_log.qty_received; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.qty_received IS 'Actual amount distributed (may be less due to shortage)';


--
-- TOC entry 6063 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN incentive_distribution_log.is_signed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.is_signed IS 'Confirms farmer signed paper receipt. MUST be true.';


--
-- TOC entry 6064 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN incentive_distribution_log.note; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.note IS 'Optional notes, e.g., "Shortage: only 15kg available"';


--
-- TOC entry 6065 (class 0 OID 0)
-- Dependencies: 241
-- Name: COLUMN incentive_distribution_log.encoder_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.encoder_id IS 'Staff who entered this record';


--
-- TOC entry 240 (class 1259 OID 67128)
-- Name: incentive_distribution_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.incentive_distribution_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.incentive_distribution_log_id_seq OWNER TO postgres;

--
-- TOC entry 6066 (class 0 OID 0)
-- Dependencies: 240
-- Name: incentive_distribution_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.incentive_distribution_log_id_seq OWNED BY public.incentive_distribution_log.id;


--
-- TOC entry 237 (class 1259 OID 31609)
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


ALTER TABLE public.land_history OWNER TO postgres;

--
-- TOC entry 6067 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE land_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.land_history IS 'Comprehensive land ownership and tenancy history tracking system';


--
-- TOC entry 6068 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.rsbsa_submission_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.rsbsa_submission_id IS 'Link to the RSBSA submission that created or updated this record';


--
-- TOC entry 6069 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.farm_parcel_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farm_parcel_id IS 'Link to the specific farm parcel in rsbsa_farm_parcels';


--
-- TOC entry 6070 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.land_owner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.land_owner_id IS 'ID of the legal land owner (may be different from farmer)';


--
-- TOC entry 6071 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.land_owner_name IS 'Name of the legal land owner';


--
-- TOC entry 6072 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farmer_id IS 'ID of the person farming the land (from rsbsa_submission)';


--
-- TOC entry 6073 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.farmer_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farmer_name IS 'Name of the person actually farming the land';


--
-- TOC entry 6074 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.is_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_tenant IS 'TRUE if farmer is renting from land owner';


--
-- TOC entry 6075 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.is_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_lessee IS 'TRUE if farmer is leasing from land owner';


--
-- TOC entry 6076 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.is_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_registered_owner IS 'TRUE if farmer is the registered owner';


--
-- TOC entry 6077 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.period_start_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.period_start_date IS 'Start date of this ownership/tenancy arrangement';


--
-- TOC entry 6078 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.period_end_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.period_end_date IS 'End date (NULL if currently active)';


--
-- TOC entry 6079 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.is_current; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_current IS 'TRUE if this is the current/active record';


--
-- TOC entry 6080 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.change_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.change_type IS 'Type of change: NEW, OWNERSHIP_CHANGE, TENANT_CHANGE, UPDATE, TERMINATION';


--
-- TOC entry 6081 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN land_history.previous_record_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.previous_record_id IS 'Link to previous history record for this parcel';


--
-- TOC entry 236 (class 1259 OID 31608)
-- Name: land_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.land_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.land_history_id_seq OWNER TO postgres;

--
-- TOC entry 6082 (class 0 OID 0)
-- Dependencies: 236
-- Name: land_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.land_history_id_seq OWNED BY public.land_history.id;


--
-- TOC entry 218 (class 1259 OID 24643)
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


ALTER TABLE public.masterlist OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 25800)
-- Name: masterlist_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.masterlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.masterlist_id_seq OWNER TO postgres;

--
-- TOC entry 6083 (class 0 OID 0)
-- Dependencies: 224
-- Name: masterlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.masterlist_id_seq OWNED BY public.masterlist.id;


--
-- TOC entry 243 (class 1259 OID 67163)
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


ALTER TABLE public.ownership_transfers OWNER TO postgres;

--
-- TOC entry 6084 (class 0 OID 0)
-- Dependencies: 243
-- Name: TABLE ownership_transfers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ownership_transfers IS 'Tracks land ownership transfer history between farmers';


--
-- TOC entry 6085 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN ownership_transfers.from_farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.from_farmer_id IS 'ID of the farmer transferring ownership (original owner)';


--
-- TOC entry 6086 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN ownership_transfers.to_farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.to_farmer_id IS 'ID of the farmer receiving ownership (new owner)';


--
-- TOC entry 6087 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN ownership_transfers.transfer_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_date IS 'Date when the ownership transfer occurred';


--
-- TOC entry 6088 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN ownership_transfers.transfer_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_type IS 'Type of transfer: ownership_change, inheritance, sale, donation, agrarian_reform';


--
-- TOC entry 6089 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN ownership_transfers.transfer_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_reason IS 'Detailed reason for the transfer (free text)';


--
-- TOC entry 6090 (class 0 OID 0)
-- Dependencies: 243
-- Name: COLUMN ownership_transfers.processed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.processed_by IS 'ID of the JO user who processed this transfer';


--
-- TOC entry 242 (class 1259 OID 67162)
-- Name: ownership_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ownership_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ownership_transfers_id_seq OWNER TO postgres;

--
-- TOC entry 6091 (class 0 OID 0)
-- Dependencies: 242
-- Name: ownership_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ownership_transfers_id_seq OWNED BY public.ownership_transfers.id;


--
-- TOC entry 233 (class 1259 OID 26239)
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
    CONSTRAINT rsbsa_farm_parcels_agrarian_reform_beneficiary_check CHECK (((agrarian_reform_beneficiary)::text = ANY ((ARRAY['Yes'::character varying, 'No'::character varying])::text[]))),
    CONSTRAINT rsbsa_farm_parcels_within_ancestral_domain_check CHECK (((within_ancestral_domain)::text = ANY ((ARRAY['Yes'::character varying, 'No'::character varying])::text[])))
);


ALTER TABLE public.rsbsa_farm_parcels OWNER TO postgres;

--
-- TOC entry 6092 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE rsbsa_farm_parcels; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rsbsa_farm_parcels IS 'Stores individual farm parcels for each RSBSA submission';


--
-- TOC entry 6093 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.submission_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.submission_id IS 'Reference to the main RSBSA submission';


--
-- TOC entry 6094 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.parcel_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.parcel_number IS 'Parcel number (1, 2, 3, etc.)';


--
-- TOC entry 6095 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.farm_location_barangay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.farm_location_barangay IS 'Barangay where the farm parcel is located';


--
-- TOC entry 6096 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.farm_location_municipality; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.farm_location_municipality IS 'Municipality where the farm parcel is located';


--
-- TOC entry 6097 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.total_farm_area_ha; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.total_farm_area_ha IS 'Area of this specific parcel in hectares';


--
-- TOC entry 6098 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.within_ancestral_domain; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.within_ancestral_domain IS 'Whether this parcel is within ancestral domain';


--
-- TOC entry 6099 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_document_no; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_document_no IS 'Document number proving ownership of this parcel';


--
-- TOC entry 6100 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.agrarian_reform_beneficiary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.agrarian_reform_beneficiary IS 'Whether the farmer is an agrarian reform beneficiary for this parcel';


--
-- TOC entry 6101 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_registered_owner IS 'Whether the farmer is the registered owner of this parcel';


--
-- TOC entry 6102 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_tenant IS 'Whether the farmer is a tenant of this parcel';


--
-- TOC entry 6103 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_lessee IS 'Whether the farmer is a lessee of this parcel';


--
-- TOC entry 6104 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_others; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_others IS 'Whether the farmer has other ownership type for this parcel';


--
-- TOC entry 6105 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.tenant_land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.tenant_land_owner_name IS 'Name of land owner if farmer is a tenant';


--
-- TOC entry 6106 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.lessee_land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.lessee_land_owner_name IS 'Name of land owner if farmer is a lessee';


--
-- TOC entry 6107 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_others_specify; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_others_specify IS 'Specification of other ownership type';


--
-- TOC entry 232 (class 1259 OID 26238)
-- Name: rsbsa_farm_parcels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rsbsa_farm_parcels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rsbsa_farm_parcels_id_seq OWNER TO postgres;

--
-- TOC entry 6108 (class 0 OID 0)
-- Dependencies: 232
-- Name: rsbsa_farm_parcels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rsbsa_farm_parcels_id_seq OWNED BY public.rsbsa_farm_parcels.id;


--
-- TOC entry 231 (class 1259 OID 26209)
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
    "FFRS_CODE" character varying(50)
);


ALTER TABLE public.rsbsa_submission OWNER TO postgres;

--
-- TOC entry 6109 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE rsbsa_submission; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rsbsa_submission IS 'Structured RSBSA submission table with individual columns for each field';


--
-- TOC entry 6110 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission.id IS 'Unique identifier for the submission';


--
-- TOC entry 6111 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."LAST NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."LAST NAME" IS 'Last name of the farmer';


--
-- TOC entry 6112 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."FIRST NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FIRST NAME" IS 'First name of the farmer';


--
-- TOC entry 6113 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."MIDDLE NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MIDDLE NAME" IS 'Middle name of the farmer';


--
-- TOC entry 6114 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."EXT NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."EXT NAME" IS 'Extension name of the farmer';


--
-- TOC entry 6115 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."GENDER"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."GENDER" IS 'Gender of the farmer';


--
-- TOC entry 6116 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."BIRTHDATE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."BIRTHDATE" IS 'Birthdate of the farmer';


--
-- TOC entry 6117 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."BARANGAY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."BARANGAY" IS 'Barangay of the farmer';


--
-- TOC entry 6118 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."MUNICIPALITY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MUNICIPALITY" IS 'Municipality of the farmer';


--
-- TOC entry 6119 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."FARM LOCATION"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARM LOCATION" IS 'Farm location of the farmer';


--
-- TOC entry 6120 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."PARCEL AREA"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."PARCEL AREA" IS 'Area of the farm parcel';


--
-- TOC entry 6121 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."MAIN LIVELIHOOD"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MAIN LIVELIHOOD" IS 'Main livelihood of the farmer';


--
-- TOC entry 6122 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."TOTAL FARM AREA"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."TOTAL FARM AREA" IS 'Total farm area in hectares (sum of all parcels for this farmer)';


--
-- TOC entry 6123 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."FFRS_CODE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FFRS_CODE" IS 'Unique FFRS code in format 06-30-18-XXX-YYYYYY where XXX is barangay code and YYYYYY is person code';


--
-- TOC entry 230 (class 1259 OID 26208)
-- Name: rsbsa_submission_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rsbsa_submission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rsbsa_submission_id_seq OWNER TO postgres;

--
-- TOC entry 6124 (class 0 OID 0)
-- Dependencies: 230
-- Name: rsbsa_submission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rsbsa_submission_id_seq OWNED BY public.rsbsa_submission.id;


--
-- TOC entry 226 (class 1259 OID 25853)
-- Name: rsbsaform; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rsbsaform (
    id integer NOT NULL,
    enrollment_type character varying(20) NOT NULL,
    date_administered date NOT NULL,
    reference_region character varying(20),
    reference_province character varying(50),
    reference_city_muni character varying(50),
    reference_barangay character varying(50),
    profile_picture_url text,
    surname character varying(100) NOT NULL,
    first_name character varying(100) NOT NULL,
    middle_name character varying(100),
    extension_name character varying(20),
    sex character varying(10) NOT NULL,
    address_house_no character varying(50),
    address_street character varying(100),
    address_barangay character varying(50) NOT NULL,
    address_municipality character varying(50) NOT NULL,
    address_province character varying(50) NOT NULL,
    address_region character varying(20),
    mobile_number character varying(20),
    landline_number character varying(20),
    date_of_birth date NOT NULL,
    place_of_birth character varying(100),
    religion character varying(50),
    other_religion character varying(50),
    civil_status character varying(20),
    name_of_spouse character varying(100),
    mother_maiden_name character varying(100),
    household_head character varying(10),
    household_head_name character varying(100),
    household_head_relationship character varying(50),
    male_household_members integer,
    female_household_members integer,
    highest_formal_education character varying(50),
    pwd character varying(10),
    ps_beneficiary character varying(10),
    indigenous_group character varying(10),
    indigenous_group_specify character varying(100),
    government_id character varying(10),
    id_type character varying(50),
    id_number character varying(50),
    farmer_association character varying(10),
    farmer_association_specify character varying(100),
    emergency_contact_name character varying(100),
    emergency_contact_number character varying(20),
    main_livelihood character varying(20) NOT NULL,
    gross_annual_income_farming character varying(50),
    gross_annual_income_nonfarming character varying(50),
    number_of_farm_parcels integer,
    farmers_in_rotation_p1 character varying(100),
    farmers_in_rotation_p2 character varying(100),
    farmers_in_rotation_p3 character varying(100),
    document_url text,
    created_at timestamp without time zone DEFAULT now(),
    farm_land_description text,
    farm_location_barangay character varying(255),
    farm_location_city_municipality character varying(255),
    total_farm_area character varying(50),
    within_ancestral_domain character varying(10),
    agrarian_reform_beneficiary character varying(10),
    ownership_document_no character varying(255),
    ownership_type_registered_owner boolean DEFAULT false,
    ownership_type_tenant boolean DEFAULT false,
    ownership_type_tenant_land_owner character varying(255),
    ownership_type_lessee boolean DEFAULT false,
    ownership_type_lessee_land_owner character varying(255),
    ownership_type_others boolean DEFAULT false,
    ownership_type_others_specify character varying(255),
    crop_commodity character varying(255),
    farm_size character varying(50),
    number_of_head character varying(50),
    farm_type character varying(255),
    organic_practitioner character varying(10),
    farm_remarks text,
    photo_path character varying(255),
    ffrs_id character varying(20),
    status character varying(20) DEFAULT 'Active Farmer'::character varying,
    CONSTRAINT check_status CHECK (((status)::text = ANY ((ARRAY['Active Farmer'::character varying, 'Inactive Farmer'::character varying])::text[])))
);


ALTER TABLE public.rsbsaform OWNER TO postgres;

--
-- TOC entry 6125 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_land_description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_land_description IS 'Complete farm land description including location and details';


--
-- TOC entry 6126 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_location_barangay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_location_barangay IS 'Barangay where the farm is located';


--
-- TOC entry 6127 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_location_city_municipality; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_location_city_municipality IS 'City or municipality where the farm is located';


--
-- TOC entry 6128 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.total_farm_area; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.total_farm_area IS 'Total farm area in hectares';


--
-- TOC entry 6129 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.within_ancestral_domain; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.within_ancestral_domain IS 'Whether the farm is within ancestral domain (Yes/No)';


--
-- TOC entry 6130 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.agrarian_reform_beneficiary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.agrarian_reform_beneficiary IS 'Whether the farmer is an agrarian reform beneficiary (Yes/No)';


--
-- TOC entry 6131 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_document_no; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_document_no IS 'Document number proving ownership';


--
-- TOC entry 6132 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_registered_owner IS 'Whether the farmer is a registered owner';


--
-- TOC entry 6133 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_tenant IS 'Whether the farmer is a tenant';


--
-- TOC entry 6134 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_tenant_land_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_tenant_land_owner IS 'Name of land owner if tenant';


--
-- TOC entry 6135 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_lessee IS 'Whether the farmer is a lessee';


--
-- TOC entry 6136 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_lessee_land_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_lessee_land_owner IS 'Name of land owner if lessee';


--
-- TOC entry 6137 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_others; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_others IS 'Whether the farmer has other ownership type';


--
-- TOC entry 6138 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_others_specify; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_others_specify IS 'Specification of other ownership type';


--
-- TOC entry 6139 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.crop_commodity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.crop_commodity IS 'Type of crop or commodity grown';


--
-- TOC entry 6140 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_size; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_size IS 'Size of the farm parcel';


--
-- TOC entry 6141 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.number_of_head; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.number_of_head IS 'Number of livestock/poultry heads';


--
-- TOC entry 6142 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_type IS 'Type of farming (e.g., Irrigated, Rainfed)';


--
-- TOC entry 6143 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.organic_practitioner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.organic_practitioner IS 'Whether the farmer is an organic practitioner (Y/N)';


--
-- TOC entry 6144 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_remarks; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_remarks IS 'Additional remarks about the farm';


--
-- TOC entry 225 (class 1259 OID 25852)
-- Name: rsbsaform_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rsbsaform_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rsbsaform_id_seq OWNER TO postgres;

--
-- TOC entry 6145 (class 0 OID 0)
-- Dependencies: 225
-- Name: rsbsaform_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rsbsaform_id_seq OWNED BY public.rsbsaform.id;


--
-- TOC entry 239 (class 1259 OID 67108)
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


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 6146 (class 0 OID 0)
-- Dependencies: 239
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'System users for authentication and authorization';


--
-- TOC entry 6147 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.id IS 'Unique user identifier';


--
-- TOC entry 6148 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN users.username; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.username IS 'Unique username for login';


--
-- TOC entry 6149 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.email IS 'Unique email address';


--
-- TOC entry 6150 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.password_hash IS 'Bcrypt hashed password';


--
-- TOC entry 6151 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.role IS 'User role: admin, technician, jo, encoder, farmer, lgu';


--
-- TOC entry 6152 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.created_at IS 'Account creation timestamp';


--
-- TOC entry 6153 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.updated_at IS 'Last update timestamp';


--
-- TOC entry 238 (class 1259 OID 67107)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 6154 (class 0 OID 0)
-- Dependencies: 238
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 5721 (class 2604 OID 26042)
-- Name: barangay_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes ALTER COLUMN id SET DEFAULT nextval('public.barangay_codes_id_seq'::regclass);


--
-- TOC entry 5740 (class 2604 OID 26292)
-- Name: farm_parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels ALTER COLUMN id SET DEFAULT nextval('public.farm_parcels_id_seq'::regclass);


--
-- TOC entry 5762 (class 2604 OID 67132)
-- Name: incentive_distribution_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log ALTER COLUMN id SET DEFAULT nextval('public.incentive_distribution_log_id_seq'::regclass);


--
-- TOC entry 5748 (class 2604 OID 31612)
-- Name: land_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history ALTER COLUMN id SET DEFAULT nextval('public.land_history_id_seq'::regclass);


--
-- TOC entry 5712 (class 2604 OID 25801)
-- Name: masterlist id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterlist ALTER COLUMN id SET DEFAULT nextval('public.masterlist_id_seq'::regclass);


--
-- TOC entry 5766 (class 2604 OID 67166)
-- Name: ownership_transfers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers ALTER COLUMN id SET DEFAULT nextval('public.ownership_transfers_id_seq'::regclass);


--
-- TOC entry 5733 (class 2604 OID 26242)
-- Name: rsbsa_farm_parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels ALTER COLUMN id SET DEFAULT nextval('public.rsbsa_farm_parcels_id_seq'::regclass);


--
-- TOC entry 5725 (class 2604 OID 26212)
-- Name: rsbsa_submission id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission ALTER COLUMN id SET DEFAULT nextval('public.rsbsa_submission_id_seq'::regclass);


--
-- TOC entry 5714 (class 2604 OID 25856)
-- Name: rsbsaform id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsaform ALTER COLUMN id SET DEFAULT nextval('public.rsbsaform_id_seq'::regclass);


--
-- TOC entry 5759 (class 2604 OID 67111)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 6031 (class 0 OID 26039)
-- Dependencies: 228
-- Data for Name: barangay_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.barangay_codes (id, barangay_name, barangay_code, created_at) FROM stdin;
1	Balabag	001	2025-07-31 21:40:17.018376
2	Bantud Fabrica	002	2025-07-31 21:40:17.018376
3	Bantud Ilaud	003	2025-07-31 21:40:17.018376
4	Bantud Ilaya	004	2025-07-31 21:40:17.018376
5	Bilao	005	2025-07-31 21:40:17.018376
6	Bolilao	006	2025-07-31 21:40:17.018376
7	Calao	007	2025-07-31 21:40:17.018376
8	Capaliz	008	2025-07-31 21:40:17.018376
9	Cayos	009	2025-07-31 21:40:17.018376
10	Dacutan	010	2025-07-31 21:40:17.018376
11	Dulangan	011	2025-07-31 21:40:17.018376
12	Dungon	012	2025-07-31 21:40:17.018376
13	Ilaya 1st	013	2025-07-31 21:40:17.018376
14	Ilaya 2nd	014	2025-07-31 21:40:17.018376
15	Jardin	015	2025-07-31 21:40:17.018376
16	Lonoy	016	2025-07-31 21:40:17.018376
17	Manggalag	017	2025-07-31 21:40:17.018376
18	Mauguic	018	2025-07-31 21:40:17.018376
19	Pandan	019	2025-07-31 21:40:17.018376
20	Poblacion	020	2025-07-31 21:40:17.018376
21	Sapao	021	2025-07-31 21:40:17.018376
22	Sua	022	2025-07-31 21:40:17.018376
23	Suguidan	023	2025-07-31 21:40:17.018376
24	Tabucan	024	2025-07-31 21:40:17.018376
25	Talusan	025	2025-07-31 21:40:17.018376
26	Tigbawan	026	2025-07-31 21:40:17.018376
27	Tuburan	027	2025-07-31 21:40:17.018376
28	Tumcon Ilaya	028	2025-07-31 21:40:17.018376
29	Tumcon Ilawod	029	2025-07-31 21:40:17.018376
\.


--
-- TOC entry 6032 (class 0 OID 26050)
-- Dependencies: 229
-- Data for Name: barangay_farmer_counters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.barangay_farmer_counters (barangay_code, current_count, last_updated) FROM stdin;
001	0	2025-07-31 21:40:17.018376
002	0	2025-07-31 21:40:17.018376
003	0	2025-07-31 21:40:17.018376
004	0	2025-07-31 21:40:17.018376
005	0	2025-07-31 21:40:17.018376
006	0	2025-07-31 21:40:17.018376
008	0	2025-07-31 21:40:17.018376
009	0	2025-07-31 21:40:17.018376
010	0	2025-07-31 21:40:17.018376
011	0	2025-07-31 21:40:17.018376
012	0	2025-07-31 21:40:17.018376
013	0	2025-07-31 21:40:17.018376
014	0	2025-07-31 21:40:17.018376
015	0	2025-07-31 21:40:17.018376
016	0	2025-07-31 21:40:17.018376
017	0	2025-07-31 21:40:17.018376
018	0	2025-07-31 21:40:17.018376
019	0	2025-07-31 21:40:17.018376
020	0	2025-07-31 21:40:17.018376
021	0	2025-07-31 21:40:17.018376
022	0	2025-07-31 21:40:17.018376
023	0	2025-07-31 21:40:17.018376
024	0	2025-07-31 21:40:17.018376
025	0	2025-07-31 21:40:17.018376
026	0	2025-07-31 21:40:17.018376
027	0	2025-07-31 21:40:17.018376
028	0	2025-07-31 21:40:17.018376
029	0	2025-07-31 21:40:17.018376
007	10	2025-07-31 21:40:17.018376
\.


--
-- TOC entry 6038 (class 0 OID 26289)
-- Dependencies: 235
-- Data for Name: farm_parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_city_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at) FROM stdin;
1	19	1	Cayos		3.00	f		f	t	f	f				2025-09-27 18:12:09.982237	2025-09-27 18:12:09.982237
2	19	2	Bacay		2.00	f		f	t	f	f				2025-09-27 18:12:09.982237	2025-09-27 18:12:09.982237
3	20	1	Cayos		13.00	f		f	t	f	f				2025-09-27 18:27:07.531383	2025-09-27 18:27:07.531383
4	20	2	Bacay		2.00	f		f	t	f	f				2025-09-27 18:27:07.531383	2025-09-27 18:27:07.531383
7	22	1	Cayos		12.00	f		f	t	f	f				2025-10-11 14:43:49.635279	2025-10-11 14:43:49.635279
8	23	1	Balabag		2.00	f		f	t	f	f				2025-10-11 21:20:24.185128	2025-10-11 21:20:24.185128
9	24	1	Compayan		1.00	f		f	t	f	f				2025-10-12 16:14:07.734831	2025-10-12 16:14:07.734831
11	26	1	Cansilayan		2.00	f		f	f	t	f	adsf, asdf asdf asdf			2025-10-16 22:01:20.258218	2025-10-16 22:01:20.258218
12	27	1	Bacay		1.00	f		f	f	t	f	ASDF, Ricw AEADS ASDF			2025-10-20 09:32:50.392614	2025-10-20 09:32:50.392614
13	28	1	Tabucan		1.00	f		f	t	f	f				2025-10-21 06:14:30.362989	2025-10-21 06:14:30.362989
14	29	1	Compayan		12.00	f		f	f	t	f	SDFASDF, nene ASDFAS DASDF			2025-10-21 06:27:08.878478	2025-10-21 06:27:08.878478
\.


--
-- TOC entry 6044 (class 0 OID 67129)
-- Dependencies: 241
-- Data for Name: incentive_distribution_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incentive_distribution_log (id, farmer_id, event_date, incentive_type, qty_requested, qty_received, is_signed, note, encoder_id, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 6040 (class 0 OID 31609)
-- Dependencies: 237
-- Data for Name: land_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) FROM stdin;
1	5	3	1	Capaliz		2.00	\N	Ric asdf elev asdf	06-30-18-000-564249	5	Ric asdf elev asdf	06-30-18-000-564249	\N	\N	f	\N	\N	f	t	f		\N		t	t	2025-09-21	\N	t	NEW	\N	\N	2025-09-21 21:37:32.11059	2025-10-20 09:22:52.723297	\N	\N	\N
2	5	4	2	Bacong		2.00	\N	Ric asdf elev asdf	06-30-18-000-564249	5	Ric asdf elev asdf	06-30-18-000-564249	\N	\N	f	\N	\N	f	t	f		\N		t	t	2025-09-21	\N	t	NEW	\N	\N	2025-09-21 21:37:32.121211	2025-10-20 09:22:52.723297	\N	\N	\N
3	6	5	1	Calao		1.00	\N	Eleve asdf asdf asdf	06-30-18-000-377874	6	Eleve asdf asdf asdf	06-30-18-000-377874	\N	\N	f	\N	\N	f	t	f		\N		t	t	2025-09-21	\N	t	NEW	\N	\N	2025-09-21 21:41:42.284729	2025-10-20 09:22:52.723297	\N	\N	\N
4	6	6	2	Bacong		2.00	\N	Eleve asdf asdf asdf	06-30-18-000-377874	6	Eleve asdf asdf asdf	06-30-18-000-377874	\N	\N	f	\N	\N	f	t	f		\N		t	t	2025-09-21	\N	t	NEW	\N	\N	2025-09-21 21:41:42.293549	2025-10-20 09:22:52.723297	\N	\N	\N
5	7	7	1	Tambobo		2.00	\N	Friday ASDF SDFASDF ASDF	06-30-18-000-748520	7	Friday ASDF SDFASDF ASDF	06-30-18-000-748520	\N	\N	f	\N	\N	f	t	f		\N		t	t	2025-09-21	\N	t	NEW	\N	\N	2025-09-21 21:46:10.531235	2025-10-20 09:22:52.723297	\N	\N	\N
6	7	8	2	Aurora-Del Pilar		3.00	\N	Friday ASDF SDFASDF ASDF	06-30-18-000-748520	7	Friday ASDF SDFASDF ASDF	06-30-18-000-748520	\N	\N	f	\N	\N	f	t	f		\N		t	t	2025-09-21	\N	t	NEW	\N	\N	2025-09-21 21:46:10.543082	2025-10-20 09:22:52.723297	\N	\N	\N
7	30	9	1	Compayan		3.00	\N	SDFASDF, Friday ASDF ASDF	\N	30	Amelia asdfasdf Martin asdfasdf	06-30-18-000-177506	Amelia asdfasdf Martin asdfasdf	06-30-18-000-177506	t	\N	\N	f	f	f	\N	\N		f	f	2025-10-21	\N	t	NEW	\N	\N	2025-10-21 19:19:22.818361	2025-10-21 19:19:22.818361	\N	\N	\N
8	30	10	2	Bacong		3.00	\N	Amelia asdfasdf Martin asdfasdf	06-30-18-000-177506	30	Amelia asdfasdf Martin asdfasdf	06-30-18-000-177506	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-10-21	\N	t	NEW	\N	\N	2025-10-21 19:19:22.818361	2025-10-21 19:19:22.818361	\N	\N	\N
9	31	11	1	Ermita		2.00	\N	S, Shi qwe wqe	\N	31	Chloe asdfaf Davis asdfasdf	06-30-18-000-911143	Chloe asdfaf Davis asdfasdf	06-30-18-000-911143	t	\N	\N	f	f	f	\N	\N		f	f	2025-10-21	\N	t	NEW	\N	\N	2025-10-21 20:33:23.955369	2025-10-21 20:33:23.955369	\N	\N	\N
10	32	12	1	Cayos		2.00	\N	elev, Ric asdf asdf	\N	32	Elizabeth  adf Thompson sdf	06-30-18-000-097105	\N	\N	f	Elizabeth  adf Thompson sdf	06-30-18-000-097105	t	f	f	\N	\N		f	f	2025-10-21	\N	t	NEW	\N	\N	2025-10-21 21:04:20.01819	2025-10-21 21:04:20.01819	\N	\N	\N
11	33	13	1	Tabucan		2.00	\N	aad, Ricara asda asd	\N	33	Caroline EFASD  Brown ASDFASDF	06-30-18-000-527496	\N	\N	f	Caroline EFASD  Brown ASDFASDF	06-30-18-000-527496	t	f	f	\N	\N		f	f	2025-10-21	\N	t	NEW	\N	\N	2025-10-21 21:12:26.639071	2025-10-21 21:12:26.639071	\N	\N	\N
12	34	14	1	Cansilayan		2.00	\N	Elev, Ric Ser Elv	\N	34	Riley  asd Hernandez asd	06-30-18-000-713674	Riley  asd Hernandez asd	06-30-18-000-713674	t	\N	\N	f	f	f	\N	\N		f	f	2025-10-22	\N	t	NEW	\N	\N	2025-10-22 19:09:47.105784	2025-10-22 19:09:47.105784	\N	\N	\N
13	34	15	2	Calao		2.00	\N	Elev, Ric Ser Elv	\N	34	Riley  asd Hernandez asd	06-30-18-000-713674	\N	\N	f	Riley  asd Hernandez asd	06-30-18-000-713674	t	f	f	\N	\N		f	f	2025-10-22	\N	t	NEW	\N	\N	2025-10-22 19:09:47.105784	2025-10-22 19:09:47.105784	\N	\N	\N
14	35	16	1	Baras		3.00	\N	Eric  Servita Elev Ekoy	06-30-18-000-561830	35	Eric  Servita Elev Ekoy	06-30-18-000-561830	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-11-05	\N	t	NEW	\N	\N	2025-11-05 19:45:56.189442	2025-11-05 19:45:56.189442	\N	\N	\N
15	35	17	2	Cayos		4.00	\N	aad, Ricara asda asd	\N	35	Eric  Servita Elev Ekoy	06-30-18-000-561830	Eric  Servita Elev Ekoy	06-30-18-000-561830	t	\N	\N	f	f	f	\N	\N		f	f	2025-11-05	\N	t	NEW	\N	\N	2025-11-05 19:45:56.189442	2025-11-05 19:45:56.189442	\N	\N	\N
16	36	18	1	Calao		1.00	\N	harv tubo mik jr	06-30-18-000-840761	36	harv tubo mik jr	06-30-18-000-840761	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-11-06	\N	t	NEW	\N	\N	2025-11-06 09:40:38.163268	2025-11-06 09:40:38.163268	\N	\N	\N
17	37	19	1	Calao		1.00	\N	Harv Solano Kim Jr.	06-30-18-012-049657	37	Harv Solano Kim Jr.	06-30-18-012-049657	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-11-06	\N	t	NEW	\N	\N	2025-11-06 09:55:09.672922	2025-11-06 09:55:09.672922	\N	\N	\N
\.


--
-- TOC entry 6026 (class 0 OID 24643)
-- Dependencies: 218
-- Data for Name: masterlist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.masterlist ("FFRS System Generated", "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "FARMER ADDRESS 1", "FARMER ADDRESS 2", "FARMER ADDRESS 3", "PARCEL NO.", "PARCEL ADDRESS", "PARCEL AREA", id, status, "STATUS") FROM stdin;
06-30-18-007-000009	Pabulayan	Jonel	Cabodillo		Male	2025-08-01T00:00:00.000+08:00	Calao	Dumangas	Iloilo	\N	Calao, Dumangas	3	18	Active Farmer	Active Farmer
06-30-18-007-000010	Sustiguer	Philip	Servita		Male	2012-06-20T00:00:00.000+08:00	Calao	Dumangas	Iloilo	\N	Lacturan, Dumangas	2	19	Active Farmer	Active Farmer
06-30-18-999-000018	Teocades	Casimero	Pelares		Male	2025-07-01T00:00:00.000+08:00	Baras	Dumangas	Iloilo	\N	Capaliz, Dumangas	2	16	Active Farmer	Active Farmer
06-30-18-999-000022	Bebic 	Donna	Decipulo		Female	2025-07-23T00:00:00.000+08:00	Bantud	Dumangas	Iloilo	\N	Bolilao, Dumangas	2	15	Active Farmer	Active Farmer
06-30-18-999-000001	Elevencione	Sonia	Kim	Nonoy	Male	2004-03-07T00:00:00.000+08:00	Bantud	Dumangas	Iloilo	\N	Calao, Dumangas	2	17	Active Farmer	Active Farmer
06-30-18-007-000005	Celestial	Ludy	Bustamante		Female	2025-07-17T00:00:00.000+08:00	Calao	Dumangas	Iloilo	\N	Balabag, Dumangas	2	14	Inactive Farmer	Active Farmer
06-30-18-007-000003	Duremdes	Sonia	Chiva		Female	2025-07-13T00:00:00.000+08:00	Calao	Dumangas	Iloilo	\N	Pd Monfort North, Dumangas	2	10	Active Farmer	Active Farmer
06-30-18-007-000002	Dilag	Madoline	Valderrama		Female	2025-07-11T00:00:00.000+08:00	Calao	Dumangas	Iloilo	\N	calao, dumanagas	2	11	Active Farmer	Active Farmer
06-30-18-007-000004	Dequit	June june	Gange		Male	2025-07-16T00:00:00.000+08:00	Calao	Dumangas	Iloilo	\N	Basa-Mabini Bonifacio, Dumangas	2	12	Active Farmer	Active Farmer
06-30-18-007-000001	Aldep	Rhia	Sobrevega		Male	2025-07-11T00:00:00.000+08:00	Calao	Dumangas	Iloilo	\N	calao, dumanagas	2	13	Active Farmer	Active Farmer
\.


--
-- TOC entry 6046 (class 0 OID 67163)
-- Dependencies: 243
-- Data for Name: ownership_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ownership_transfers (id, from_farmer_id, to_farmer_id, transfer_date, transfer_type, transfer_reason, documents, processed_by, created_at, notes) FROM stdin;
1	3	37	2025-11-11	ownership_change	Legal Transfer	\N	\N	2025-11-11 18:31:51.468558	\N
2	4	36	2025-11-11	ownership_change	Legal Transfer	\N	\N	2025-11-11 18:33:01.50309	\N
3	6	31	2025-11-11	ownership_change	Legal Transfer	\N	\N	2025-11-11 20:01:09.43612	Transferred 2 parcel(s): IDs 5, 6
4	31	32	2025-11-11	ownership_change	Legal Transfer	\N	\N	2025-11-11 20:15:59.400795	Transferred 3 parcel(s): IDs 11, 5, 6
5	5	30	2025-11-11	ownership_change	Legal transfer	\N	\N	2025-11-11 21:19:52.409277	Transferred 2 parcel(s): IDs 3, 4
6	7	38	2025-11-11	ownership_change	Legal Transfer	\N	\N	2025-11-12 07:04:40.672321	Transferred 2 parcel(s): IDs 7, 8
\.


--
-- TOC entry 6036 (class 0 OID 26239)
-- Dependencies: 233
-- Data for Name: rsbsa_farm_parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at) FROM stdin;
9	30	1	Compayan		2.00	No		No	f	t	f	f	SDFASDF, Friday ASDF ASDF			2025-10-21 19:19:22.818361	2025-10-21 19:40:37.802703
10	30	2	Bacong		2.00	No		No	t	f	f	f				2025-10-21 19:19:22.818361	2025-10-21 19:40:37.826855
12	32	1	Cayos		2.00	No		No	f	f	t	f		elev, Ric asdf asdf		2025-10-21 21:04:20.01819	2025-10-21 21:04:20.01819
13	33	1	Tabucan		2.00	No		No	f	f	t	f		aad, Ricara asda asd		2025-10-21 21:12:26.639071	2025-10-21 21:12:26.639071
14	34	1	Cansilayan		2.00	No		No	f	t	f	f	Elev, Ric Ser Elv			2025-10-22 19:09:47.105784	2025-10-22 19:09:47.105784
15	34	2	Calao		2.00	No		No	f	f	t	f		Elev, Ric Ser Elv		2025-10-22 19:09:47.105784	2025-10-22 19:09:47.105784
16	35	1	Baras		3.00	No		No	t	f	f	f				2025-11-05 19:45:56.189442	2025-11-05 19:45:56.189442
17	35	2	Cayos		4.00	No		No	f	t	f	f	aad, Ricara asda asd			2025-11-05 19:45:56.189442	2025-11-05 19:45:56.189442
18	36	1	Calao		1.00	No		No	t	f	f	f				2025-11-06 09:40:38.163268	2025-11-06 09:40:38.163268
19	37	1	Calao		1.00	No		No	t	f	f	f				2025-11-06 09:55:09.672922	2025-11-06 09:55:09.672922
11	32	1	Ermita		2.00	No		No	f	t	f	f	S, Shi qwe wqe			2025-10-21 20:33:23.955369	2025-10-21 20:33:23.955369
5	32	1	Calao		1.00	Yes		Yes	t	f	f	f				2025-09-21 21:41:42.284729	2025-09-21 21:41:42.284729
6	32	2	Bacong		2.00	Yes		Yes	t	f	f	f				2025-09-21 21:41:42.293549	2025-09-21 21:41:42.293549
3	30	1	Capaliz		2.00	Yes		Yes	t	f	f	f				2025-09-21 21:37:32.11059	2025-09-21 21:37:32.11059
4	30	2	Bacong		2.00	Yes		Yes	t	f	f	f				2025-09-21 21:37:32.121211	2025-09-21 21:37:32.121211
7	38	1	Tambobo		2.00	Yes		Yes	t	f	f	f				2025-09-21 21:46:10.531235	2025-09-21 21:46:10.531235
8	38	2	Aurora-Del Pilar		3.00	Yes		Yes	t	f	f	f				2025-09-21 21:46:10.543082	2025-09-21 21:46:10.543082
\.


--
-- TOC entry 6034 (class 0 OID 26209)
-- Dependencies: 231
-- Data for Name: rsbsa_submission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE") FROM stdin;
13	S	Shi	qwe	wqe	Male	\N	qwe	qwe	Capaliz	2.00	farmer	t	f	f	Active Farmer	2025-09-27 17:12:24.210387	2025-09-27 17:12:24.210387	2025-09-27 17:12:24.210387	5.00	06-30-18-000-716466
12	Lop	Liv	De	Sit	Female	\N	Cabatuan	Iloilo	Cansilayan	2.00	farmer	t	f	f	Active Farmer	2025-09-27 16:20:14.241116	2025-09-27 16:20:14.241116	2025-09-27 16:20:14.241116	2.00	06-30-18-000-454027
22	ae	fic	a	asd	Male	\N	asdasd	Dumangas	Cayos,	\N	farmer	f	f	f	Active Farmer	2025-10-11 14:43:49.635279	2025-10-11 14:43:49.635279	2025-10-11 15:05:02.282836	12.00	06-30-18-000-128928
11	Elev	Ric	Ser	Elv	Male	\N	Cabatuan	Iloilo	Capaliz	3.00	farmer	t	f	f	Active Farmer	2025-09-27 16:07:02.767606	2025-09-27 16:07:02.767606	2025-09-27 16:07:02.767606	6.00	06-30-18-000-104916
20	Pos	Pos	Sed	Sed	Male	\N	Sd	Dumangas		\N	farmer	f	f	f	Active Farmer	2025-09-27 18:27:07.531383	2025-09-27 18:27:07.531383	2025-10-11 14:41:08.62461	15.00	06-30-18-000-409797
18	asdf	sdfas	asdf	asdf	Male	\N	asdf	Dumangas		\N	farmer	f	f	f	Active Farmer	2025-09-27 17:59:46.23521	2025-09-27 17:59:46.23521	2025-10-11 14:42:47.01385	8.00	06-30-18-000-002136
17	asdf	awe	asd	assdf	Male	\N	adsf	asdf		\N	farmer	f	f	f	Active Farmer	2025-09-27 17:38:41.718279	2025-09-27 17:38:41.718279	2025-09-27 17:38:41.718279	4.00	06-30-18-000-935778
10	Elev	Ric	Ser	Elv	Male	\N	Cabatuan	Iloilo	Balud	3.00	farmer	t	f	f	Active Farmer	2025-09-27 16:07:02.755946	2025-09-27 16:07:02.755946	2025-09-27 16:07:02.755946	6.00	06-30-18-000-996300
9	SDFASDF	nene	ASDFAS	DASDF	Male	\N	SDFASDF	ASDFASF	Cayos	3.00	farmer	t	f	f	Active Farmer	2025-09-21 21:55:26.055045	2025-09-21 21:55:26.055045	2025-09-21 21:55:26.055045	5.00	06-30-18-000-891870
8	SDFASDF	nene	ASDFAS	DASDF	Male	\N	SDFASDF	ASDFASF	Cayos	3.00	farmer	t	f	f	Active Farmer	2025-09-21 21:55:23.482227	2025-09-21 21:55:23.482227	2025-09-21 21:55:23.482227	5.00	06-30-18-000-704072
26	Eric	asd	asd asd		Male	\N	asd	asd	Cansilayan,	2.50	farmer	f	t	f	Active Farmer	2025-10-16 22:01:20.258218	2025-10-16 22:01:20.258218	2025-10-19 04:23:05.937788	2.00	06-30-18-000-033971
2	ASDF	EFAS	ASDF	ASDF	Female	\N	ASDF	ASDF	Aurora-Del Pilar	2.00	farmer	f	t	f	Active Farmer	2025-09-07 16:37:44.179425	2025-09-07 16:37:44.179425	2025-09-07 16:37:44.179425	2.00	06-30-18-000-299135
23	ASDF	Ricw	AEADS	ASDF		\N	ASDF	ASDF	Balabag,	\N	farmer	f	f	f	Active Farmer	2025-10-11 21:20:24.185128	2025-10-11 21:20:24.185128	2025-10-11 21:20:24.185128	2.00	06-30-18-000-327106
15	ASDF	SDF	ASDF	hehe	Male	\N	ASDF	ASDF	Cali	2.00	farmer	t	f	f	Active Farmer	2025-09-27 17:17:09.423627	2025-09-27 17:17:09.423627	2025-10-16 14:29:26.401107	2.00	06-30-18-000-239974
24	aad	Ricara	asda	asd	Male	\N	afdsa	asdasd	Compayan,	\N	farmer	f	f	f	Not Active	2025-10-12 16:14:07.734831	2025-10-12 16:14:07.734831	2025-10-16 15:35:33.015133	1.00	06-30-18-000-042548
34	Hernandez	Riley 	asd	asd	Male	\N	asdasd	asdasd	Cansilayan,	2, 2	fisherfolk	f	t	f	Active Farmer	2025-10-22 19:09:47.105784	2025-10-22 19:09:47.105784	2025-11-05 09:05:19.957665	4.00	06-30-18-000-713674
33	 Brown	Caroline	EFASD	ASDFASDF	Female	\N	asdf	asdf	Tabucan,	2, 2	farmworker	f	f	t	Active Farmer	2025-10-21 21:12:26.639071	2025-10-21 21:12:26.639071	2025-11-05 09:05:21.80833	4.00	06-30-18-000-527496
29	wer	sf	sdf	wer		\N	wer	wer	Compayan,	\N	farmworker	f	t	f	Active Farmer	2025-10-21 06:27:08.878478	2025-10-21 06:27:08.878478	2025-11-05 09:05:23.623289	12.00	06-30-18-000-923520
28	asd	asd123134	esra	earzc	Male	\N	aawe	asawe	Tabucan,	\N	farmer	t	f	f	Active Farmer	2025-10-21 06:14:30.362989	2025-10-21 06:14:30.362989	2025-11-05 09:05:23.981681	1.00	06-30-18-000-162833
27	Elevencione	Eric	Servita		Male	\N	Brgy. Maraguit	Iloilo	Bacay,	1.00	farmworker	f	t	f	Active Farmer	2025-10-20 09:32:50.392614	2025-10-20 09:32:50.392614	2025-11-05 09:05:24.388367	1.00	06-30-18-000-913673
19	adsf	asdf	asdf	asdf	Male	\N	asdf	asdf		\N	farmer	f	f	f	Not Active	2025-09-27 18:12:09.982237	2025-09-27 18:12:09.982237	2025-11-05 09:05:30.002771	5.00	06-30-18-000-543076
14	S	Shi	qwe	wqe	Male	\N	qwe	qwe	Bacong	3.00	farmer	t	f	f	Not Active	2025-09-27 17:12:24.224597	2025-09-27 17:12:24.224597	2025-11-05 09:05:31.394067	5.00	06-30-18-000-885746
35	Elev	Eric 	Servita	Ekoy	Male	\N	adasfd	sADFASDF	Baras,	3, 4	farmer	t	f	f	Active Farmer	2025-11-05 19:45:56.189442	2025-11-05 19:45:56.189442	2025-11-05 19:48:54.564033	7.00	06-30-18-000-561830
3	afasdf	Ric	asdf	asdf	Male	\N	asdf	asdf	Cali	12.00	farmer	f	f	f	Transferred Ownership	2025-09-21 21:36:27.350619	2025-09-21 21:36:27.350619	2025-09-21 21:36:27.350619	24.00	06-30-18-000-855529
37	Kim	Harv	Solano	Jr.	Male	\N	Calao	Dumangas	Calao,	1	farmer	t	f	f	Active Farmer	2025-11-06 09:55:09.672922	2025-11-06 09:55:09.672922	2025-11-10 09:23:43.786211	1.00	06-30-18-012-049657
4	afasdf	Ric	asdf	asdf	Male	\N	asdf	asdf	Cali	12.00	farmer	f	f	f	Transferred Ownership	2025-09-21 21:36:38.451527	2025-09-21 21:36:38.451527	2025-09-21 21:36:38.451527	24.00	06-30-18-000-024270
36	mik	harv	tubo	jr	Male	\N	calao	dumangas	Calao,	1	farmer	t	f	f	Active Farmer	2025-11-06 09:40:38.163268	2025-11-06 09:40:38.163268	2025-11-07 21:49:52.598199	1.00	06-30-18-000-840761
31	Davis	Chloe	asdfaf	asdfasdf	Male	\N	asdfasdf	asdf	Ermita,	2	farmworker	f	f	f	Transferred Ownership	2025-10-21 20:33:23.955369	2025-10-21 20:33:23.955369	2025-11-05 09:05:22.614517	2.00	06-30-18-000-911143
32	Thompson	Elizabeth 	adf	sdf	Male	\N	qewq	eaf	Cayos,	2	farmer	t	f	f	Active Farmer	2025-10-21 21:04:20.01819	2025-10-21 21:04:20.01819	2025-11-05 09:05:22.194939	2.00	06-30-18-000-097105
5	elev	Ric	asdf	asdf	Male	\N	asdf	asdf	Capaliz	2.00	farmer	f	f	f	Transferred Ownership	2025-09-21 21:37:32.107945	2025-09-21 21:37:32.107945	2025-09-21 21:37:32.107945	2.00	06-30-18-000-564249
6	asdf	Eleve	asdf	asdf	Male	\N	asdf	asdfasf	Calao	1.00	farmer	f	f	f	Transferred Ownership	2025-09-21 21:41:42.271699	2025-09-21 21:41:42.271699	2025-09-21 21:41:42.271699	1.00	06-30-18-000-377874
38	Amelia	Anna	Shsef	\N	Female	2025-11-06	Brgy. Maraguit	Dumangas	\N	\N	\N	t	f	f	Active Farmer	2025-11-12 07:04:40.672321	2025-11-12 07:04:40.672321	2025-11-12 07:04:40.672321	\N	06-30-18-007-009975
30	Martin	Amelia	asdfasdf		Male	\N	asdfadf	asdfasdf	Compayan,	2.00, 2.00	farmworker	t	f	f	Active Farmer	2025-10-21 19:19:22.818361	2025-10-21 19:19:22.818361	2025-11-05 09:05:22.991941	4.00	06-30-18-000-177506
7	SDFASDF	Friday	ASDF	ASDF	Male	\N	SDF	ASDF	Tambobo	2.00	farmer	f	f	f	Transferred Ownership	2025-09-21 21:46:10.516709	2025-09-21 21:46:10.516709	2025-09-21 21:46:10.516709	5.00	06-30-18-000-748520
\.


--
-- TOC entry 6029 (class 0 OID 25853)
-- Dependencies: 226
-- Data for Name: rsbsaform; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rsbsaform (id, enrollment_type, date_administered, reference_region, reference_province, reference_city_muni, reference_barangay, profile_picture_url, surname, first_name, middle_name, extension_name, sex, address_house_no, address_street, address_barangay, address_municipality, address_province, address_region, mobile_number, landline_number, date_of_birth, place_of_birth, religion, other_religion, civil_status, name_of_spouse, mother_maiden_name, household_head, household_head_name, household_head_relationship, male_household_members, female_household_members, highest_formal_education, pwd, ps_beneficiary, indigenous_group, indigenous_group_specify, government_id, id_type, id_number, farmer_association, farmer_association_specify, emergency_contact_name, emergency_contact_number, main_livelihood, gross_annual_income_farming, gross_annual_income_nonfarming, number_of_farm_parcels, farmers_in_rotation_p1, farmers_in_rotation_p2, farmers_in_rotation_p3, document_url, created_at, farm_land_description, farm_location_barangay, farm_location_city_municipality, total_farm_area, within_ancestral_domain, agrarian_reform_beneficiary, ownership_document_no, ownership_type_registered_owner, ownership_type_tenant, ownership_type_tenant_land_owner, ownership_type_lessee, ownership_type_lessee_land_owner, ownership_type_others, ownership_type_others_specify, crop_commodity, farm_size, number_of_head, farm_type, organic_practitioner, farm_remarks, photo_path, ffrs_id, status) FROM stdin;
7	updating	2025-07-13	6	Iloilo	Dumangas	Calao	\N	Duremdes	Sonia	Chiva	\N	Female	\N	\N	Calao	Dumangas	Iloilo	VI	09212123123	\N	2025-07-13	\N	Christianity	\N	Single	\N	\N	No	\N	\N	\N	\N	College	No	No	No	\N	\N	\N	\N	\N	\N	\N	\N	Farmer	\N	\N	\N	\N	\N	\N	\N	2025-07-13 16:27:37.624228	Farm Location: Pd Monfort North, Dumangas. Total Farm Area: 2 ha. Within Ancestral Domain: Yes. Agrarian Reform Beneficiary: No. Ownership Document No: . Crop/Commodity: . Size:  ha. Farm Type: . Organic Practitioner: . Remarks: 	Pd Monfort North	Dumangas	2	Yes	No	\N	f	t	\N	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	06-30-18-007-000003	Active Farmer
5	new	2025-07-11	6	Iloilo	Dumangas	Calao	\N	Dilag	Madoline	Valderrama		Female			Calao	Dumangas	Iloilo	VI	0923423423		2025-07-11		Christianity	\N	Single			No	\N	\N	\N	\N	Senior High School (non K-12)	No	No	No	\N	No	\N	\N	No	\N			Farmer	100000		2				\N	2025-07-11 19:23:25.270807	Farm Location: calao, dumanagas. Total Farm Area: 2 ha. Within Ancestral Domain: . Agrarian Reform Beneficiary: . Ownership Document No: . Crop/Commodity: . Size:  ha. Farm Type: . Organic Practitioner: . Remarks: 	calao	dumanagas	2	\N	\N	\N	f	t	\N	f	\N	f	\N	\N	\N	\N	\N	\N	\N	/uploads/380ce115328b5fca113f16c6acb29e12	06-30-18-007-000002	Active Farmer
13	New	2025-07-31	VI	Iloilo	Dumangas	Calao	\N	Dequit	June june	Gange	\N	Male	Calao	Calao	Calao	Dumangas	Iloilo	VI	09234789831	\N	2025-07-16	Iloilo, Mission Hospital	Roman Catholic	\N	Single	\N	\N	No	\N	\N	\N	\N	Senior High School (non K-12)	No	No	\N	\N	No	\N	\N	No	\N	\N	\N	Farmer	P 300000	\N	\N	\N	\N	\N	\N	2025-07-31 09:14:56.316885	Farm Location: Basa-Mabini Bonifacio, Dumangas. Total Farm Area: 2 ha. Within Ancestral Domain: No. Agrarian Reform Beneficiary: No. Ownership Document No: . Crop/Commodity: Rice. Size:  ha. Farm Type: . Organic Practitioner: . Remarks: 	Basa-Mabini Bonifacio	Dumangas	2	No	No	\N	t	f	\N	f	\N	f	\N	Rice	\N	\N	\N	\N	\N	\N	06-30-18-007-000004	Active Farmer
4	new	2025-07-11	6	Iloilo	Dumangas	Calao	\N	Aldep	Rhia	Sobrevega		Male			Calao	Dumangas	Iloilo	VI	0923424234		2025-07-11		Christianity	\N	Single			No	\N	\N	\N	\N	Senior High School (non K-12)	No	No	No	\N	No	\N	\N		\N			Farmer			1				\N	2025-07-11 10:05:33.65053	Farm Location: calao, dumanagas. Total Farm Area: 2 ha. Within Ancestral Domain: Yes. Agrarian Reform Beneficiary: No. Ownership Document No: . Crop/Commodity: . Size:  ha. Farm Type: . Organic Practitioner: . Remarks: 	calao	dumanagas	2	Yes	No	\N	t	f	\N	f	\N	f	\N	\N	\N	\N	\N	\N	\N	/uploads/b9e65f320ce419b5d019b9e2a1168be6	06-30-18-007-000001	Active Farmer
17	New	2025-07-31	VI	Iloilo	Dumangas	Calao	\N	Celestial	Ludy	Bustamante	\N	Female	Calao	Calao	Calao	Dumangas	Iloilo	VI	09398383471	\N	2025-07-17	\N	Roman Catholic	\N	Single	\N	\N	No	\N	\N	\N	\N	Senior High School (non K-12)	No	No	No	\N	No	\N	\N	No	\N	\N	\N	Farmer	\N	\N	\N	\N	\N	\N	\N	2025-07-31 09:45:10.798147	Farm Location: Balabag, Dumangas. Total Farm Area: 2 ha. Within Ancestral Domain: No. Agrarian Reform Beneficiary: No. Ownership Document No: . Crop/Commodity: Rice. Size:  ha. Farm Type: . Organic Practitioner: . Remarks: 	Balabag	Dumangas	2	No	No	\N	t	f	\N	f	\N	f	\N	Rice	\N	\N	\N	\N	\N	\N	06-30-18-007-000005	Active Farmer
27	New	2025-08-01	6	Iloilo	Dumangas	Calao	\N	Pabulayan	Jonel	Cabodillo	\N	Male	Calao	Calao	Calao	Dumangas	Iloilo	VI	09567543890	1231-324134-4128	2025-08-01	Iloilo, Mission Hospital	Roman Catholic	\N	Single	\N	Belly lebron	Yes	\N	\N	\N	\N	College	No	No	No	\N	No	\N	\N	No	\N	Lenny pectors	09123456780	Farmer	2000000	100000	\N	\N	\N	\N	\N	2025-08-01 12:47:35.018364	Farm Location: Calao, Dumangas. Total Farm Area: 3 ha. Within Ancestral Domain: No. Agrarian Reform Beneficiary: No. Ownership Document No: 3241414. Crop/Commodity: Rice. Size: 2 ha. Farm Type: irrigation. Organic Practitioner: Y. Remarks: none	Calao	Dumangas	3	No	No	3241414	f	t	\N	f	\N	f	\N	Rice	2	6	irrigation	Y	none	/uploads/32aefe9ff369ee00d0e1c14ae9fc2cb6	06-30-18-007-000009	Active Farmer
28	New	2025-08-01	VI	Iloilo	Dumangas	Calao	\N	Sustiguer	Philip	Servita	\N	Male	15	Calao	Calao	Dumangas	Iloilo	VI	09724839124	\N	2012-06-20	Iloilo, Mission Hospital	Roman Catholic	\N	Single	\N	Belly lebron	No	Belly lebron	Married	\N	\N	College	No	No	No	\N	No	\N	\N	No	\N	Merlinda lebron	09123456789	Farmer	100000	60000	\N	\N	\N	\N	\N	2025-08-01 13:46:18.278777	Farm Location: Lacturan, Dumangas. Total Farm Area: 2 ha. Within Ancestral Domain: No. Agrarian Reform Beneficiary: No. Ownership Document No: 8920980. Crop/Commodity: Rice. Size: 2 ha. Farm Type: irrigation. Organic Practitioner: N. Remarks: none	Lacturan	Dumangas	2	No	No	8920980	t	f	\N	f	\N	f	\N	Rice	2	\N	irrigation	N	none	/uploads/934581b59cb6e738122b310d542fa4e3	06-30-18-007-000010	Active Farmer
18	New	2025-07-29	VI	Iloilo	Dumangas	Baras	\N	Teocades	Casimero	Pelares	\N	Male	baras	baras	Baras	Dumangas	Iloilo	VI	09724839124	\N	2025-07-01	\N	Roman Catholic	\N	Married	Rica	Shish	Yes	\N	\N	\N	\N	Senior High School (non K-12)	Yes	Yes	No	\N	Yes	\N	\N	No	\N	Merlinda	0923423423	Farmer	\N	\N	\N	\N	\N	\N	\N	2025-07-31 10:05:12.268844	Farm Location: Capaliz, Dumangas. Total Farm Area: 2.00 ha. Within Ancestral Domain: . Agrarian Reform Beneficiary: . Ownership Document No: . Crop/Commodity: Rice. Size:  ha. Farm Type: Unspecified. Organic Practitioner: . Remarks: 	Capaliz	Dumangas	2.00	\N	\N	\N	t	f	\N	f	\N	f	\N	Rice	\N	\N	Unspecified	\N	\N	\N	06-30-18-999-000018	Active Farmer
22	New	2025-07-31	6	Iloilo	Dumangas	Bantud	\N	Bebic 	Donna	Decipulo	\N	Female	Bantud	Bantud	Bantud	Dumangas	Iloilo	VI	09378324234	\N	2025-07-23	\N	Roman Catholic	\N	Married	Lenny pector	\N	No	Lenny pector	Married	\N	\N	Senior High School (non K-12)	No	No	No	\N	No	\N	\N	No	\N	Lenny pector	\N	Farmer	P 	\N	\N	\N	\N	\N	\N	2025-07-31 19:59:30.773204	Farm Location: Bolilao, Dumangas. Total Farm Area: 2 ha. Within Ancestral Domain: No. Agrarian Reform Beneficiary: Yes. Ownership Document No: 3241413. Crop/Commodity: . Size:  ha. Farm Type: . Organic Practitioner: . Remarks: 	Bolilao	Dumangas	2	No	Yes	3241413	f	f	\N	t	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	06-30-18-999-000022	Active Farmer
26	New	2025-08-07	6	Iloilo	Dumangas	Calao	\N	Elevencione	Sonia	Kim	Nonoy	Male	Bantud	Bantud	Bantud	Dumangas	Iloilo	VI	09052427898	1231-324134-4124	2004-03-07	Iloilo, Mission Hospital	Roman Catholic	\N	Single	\N	\N	Yes	\N	\N	\N	\N	College	No	No	No	\N	No	\N	\N	No	\N	Merlinda lebron	0923423423	Farmer	100000	60000	2	Olivo	Bolivar	\N	\N	2025-08-01 12:23:09.030133	Farm Location: Calao, Dumangas. Total Farm Area: 2 ha. Within Ancestral Domain: No. Agrarian Reform Beneficiary: No. Ownership Document No: 3241413. Crop/Commodity: Rice. Size: 1.5 ha. Farm Type: irrigation. Organic Practitioner: Y. Remarks: 	Calao	Dumangas	2	No	No	3241413	f	t	\N	f	\N	f	\N	Rice	1.5	\N	irrigation	Y	\N	\N	06-30-18-999-000001	Active Farmer
\.


--
-- TOC entry 5711 (class 0 OID 25007)
-- Dependencies: 220
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- TOC entry 6042 (class 0 OID 67108)
-- Dependencies: 239
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, email, password_hash, role, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 6155 (class 0 OID 0)
-- Dependencies: 227
-- Name: barangay_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.barangay_codes_id_seq', 118, true);


--
-- TOC entry 6156 (class 0 OID 0)
-- Dependencies: 234
-- Name: farm_parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.farm_parcels_id_seq', 14, true);


--
-- TOC entry 6157 (class 0 OID 0)
-- Dependencies: 240
-- Name: incentive_distribution_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.incentive_distribution_log_id_seq', 1, false);


--
-- TOC entry 6158 (class 0 OID 0)
-- Dependencies: 236
-- Name: land_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.land_history_id_seq', 17, true);


--
-- TOC entry 6159 (class 0 OID 0)
-- Dependencies: 224
-- Name: masterlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.masterlist_id_seq', 19, true);


--
-- TOC entry 6160 (class 0 OID 0)
-- Dependencies: 242
-- Name: ownership_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ownership_transfers_id_seq', 6, true);


--
-- TOC entry 6161 (class 0 OID 0)
-- Dependencies: 232
-- Name: rsbsa_farm_parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsa_farm_parcels_id_seq', 19, true);


--
-- TOC entry 6162 (class 0 OID 0)
-- Dependencies: 230
-- Name: rsbsa_submission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsa_submission_id_seq', 38, true);


--
-- TOC entry 6163 (class 0 OID 0)
-- Dependencies: 225
-- Name: rsbsaform_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsaform_id_seq', 28, true);


--
-- TOC entry 6164 (class 0 OID 0)
-- Dependencies: 238
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- TOC entry 5789 (class 2606 OID 26049)
-- Name: barangay_codes barangay_codes_barangay_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_barangay_code_key UNIQUE (barangay_code);


--
-- TOC entry 5791 (class 2606 OID 26047)
-- Name: barangay_codes barangay_codes_barangay_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_barangay_name_key UNIQUE (barangay_name);


--
-- TOC entry 5793 (class 2606 OID 26045)
-- Name: barangay_codes barangay_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 5795 (class 2606 OID 26056)
-- Name: barangay_farmer_counters barangay_farmer_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_farmer_counters
    ADD CONSTRAINT barangay_farmer_counters_pkey PRIMARY KEY (barangay_code);


--
-- TOC entry 5823 (class 2606 OID 26304)
-- Name: farm_parcels farm_parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels
    ADD CONSTRAINT farm_parcels_pkey PRIMARY KEY (id);


--
-- TOC entry 5854 (class 2606 OID 67142)
-- Name: incentive_distribution_log incentive_distribution_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT incentive_distribution_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5837 (class 2606 OID 31628)
-- Name: land_history land_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5781 (class 2606 OID 25803)
-- Name: masterlist masterlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterlist
    ADD CONSTRAINT masterlist_pkey PRIMARY KEY (id);


--
-- TOC entry 5859 (class 2606 OID 67171)
-- Name: ownership_transfers ownership_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_pkey PRIMARY KEY (id);


--
-- TOC entry 5821 (class 2606 OID 26254)
-- Name: rsbsa_farm_parcels rsbsa_farm_parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT rsbsa_farm_parcels_pkey PRIMARY KEY (id);


--
-- TOC entry 5812 (class 2606 OID 31594)
-- Name: rsbsa_submission rsbsa_submission_FFRS_CODE_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission
    ADD CONSTRAINT "rsbsa_submission_FFRS_CODE_key" UNIQUE ("FFRS_CODE");


--
-- TOC entry 5814 (class 2606 OID 26223)
-- Name: rsbsa_submission rsbsa_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission
    ADD CONSTRAINT rsbsa_submission_pkey PRIMARY KEY (id);


--
-- TOC entry 5785 (class 2606 OID 26070)
-- Name: rsbsaform rsbsaform_ffrs_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsaform
    ADD CONSTRAINT rsbsaform_ffrs_id_key UNIQUE (ffrs_id);


--
-- TOC entry 5787 (class 2606 OID 25860)
-- Name: rsbsaform rsbsaform_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsaform
    ADD CONSTRAINT rsbsaform_pkey PRIMARY KEY (id);


--
-- TOC entry 5842 (class 2606 OID 67122)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5844 (class 2606 OID 67118)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5846 (class 2606 OID 67120)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 5847 (class 1259 OID 67157)
-- Name: idx_incentive_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_created ON public.incentive_distribution_log USING btree (created_at);


--
-- TOC entry 5848 (class 1259 OID 67156)
-- Name: idx_incentive_encoder; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_encoder ON public.incentive_distribution_log USING btree (encoder_id);


--
-- TOC entry 5849 (class 1259 OID 67154)
-- Name: idx_incentive_event_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_event_date ON public.incentive_distribution_log USING btree (event_date);


--
-- TOC entry 5850 (class 1259 OID 67158)
-- Name: idx_incentive_farmer_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_farmer_date ON public.incentive_distribution_log USING btree (farmer_id, event_date DESC);


--
-- TOC entry 5851 (class 1259 OID 67153)
-- Name: idx_incentive_farmer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_farmer_id ON public.incentive_distribution_log USING btree (farmer_id);


--
-- TOC entry 5852 (class 1259 OID 67155)
-- Name: idx_incentive_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_type ON public.incentive_distribution_log USING btree (incentive_type);


--
-- TOC entry 5824 (class 1259 OID 31654)
-- Name: idx_land_history_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_barangay ON public.land_history USING btree (farm_location_barangay);


--
-- TOC entry 5825 (class 1259 OID 31658)
-- Name: idx_land_history_change_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_change_type ON public.land_history USING btree (change_type);


--
-- TOC entry 5826 (class 1259 OID 31659)
-- Name: idx_land_history_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_created_at ON public.land_history USING btree (created_at);


--
-- TOC entry 5827 (class 1259 OID 31660)
-- Name: idx_land_history_current_records; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_current_records ON public.land_history USING btree (farm_parcel_id, is_current) WHERE (is_current = true);


--
-- TOC entry 5828 (class 1259 OID 31650)
-- Name: idx_land_history_farm_parcel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farm_parcel ON public.land_history USING btree (farm_parcel_id);


--
-- TOC entry 5829 (class 1259 OID 31651)
-- Name: idx_land_history_farmer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farmer_id ON public.land_history USING btree (farmer_id);


--
-- TOC entry 5830 (class 1259 OID 31653)
-- Name: idx_land_history_farmer_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farmer_name ON public.land_history USING btree (farmer_name);


--
-- TOC entry 5831 (class 1259 OID 31656)
-- Name: idx_land_history_is_current; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_is_current ON public.land_history USING btree (is_current);


--
-- TOC entry 5832 (class 1259 OID 31652)
-- Name: idx_land_history_land_owner_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_land_owner_name ON public.land_history USING btree (land_owner_name);


--
-- TOC entry 5833 (class 1259 OID 31655)
-- Name: idx_land_history_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_municipality ON public.land_history USING btree (farm_location_municipality);


--
-- TOC entry 5834 (class 1259 OID 31657)
-- Name: idx_land_history_period_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_period_dates ON public.land_history USING btree (period_start_date, period_end_date);


--
-- TOC entry 5835 (class 1259 OID 31649)
-- Name: idx_land_history_rsbsa_submission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_rsbsa_submission ON public.land_history USING btree (rsbsa_submission_id);


--
-- TOC entry 5855 (class 1259 OID 67184)
-- Name: idx_ownership_transfers_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_date ON public.ownership_transfers USING btree (transfer_date);


--
-- TOC entry 5856 (class 1259 OID 67182)
-- Name: idx_ownership_transfers_from_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_from_farmer ON public.ownership_transfers USING btree (from_farmer_id);


--
-- TOC entry 5857 (class 1259 OID 67183)
-- Name: idx_ownership_transfers_to_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_to_farmer ON public.ownership_transfers USING btree (to_farmer_id);


--
-- TOC entry 5815 (class 1259 OID 26264)
-- Name: idx_rsbsa_farm_parcels_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_area ON public.rsbsa_farm_parcels USING btree (total_farm_area_ha);


--
-- TOC entry 5816 (class 1259 OID 26262)
-- Name: idx_rsbsa_farm_parcels_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_barangay ON public.rsbsa_farm_parcels USING btree (farm_location_barangay);


--
-- TOC entry 5817 (class 1259 OID 26263)
-- Name: idx_rsbsa_farm_parcels_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_municipality ON public.rsbsa_farm_parcels USING btree (farm_location_municipality);


--
-- TOC entry 5818 (class 1259 OID 26261)
-- Name: idx_rsbsa_farm_parcels_parcel_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_parcel_number ON public.rsbsa_farm_parcels USING btree (parcel_number);


--
-- TOC entry 5819 (class 1259 OID 26260)
-- Name: idx_rsbsa_farm_parcels_submission_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_submission_id ON public.rsbsa_farm_parcels USING btree (submission_id);


--
-- TOC entry 5796 (class 1259 OID 26230)
-- Name: idx_rsbsa_submission_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_barangay ON public.rsbsa_submission USING btree ("BARANGAY");


--
-- TOC entry 5797 (class 1259 OID 26229)
-- Name: idx_rsbsa_submission_birthday; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_birthday ON public.rsbsa_submission USING btree ("BIRTHDATE");


--
-- TOC entry 5798 (class 1259 OID 26227)
-- Name: idx_rsbsa_submission_ext_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_ext_name ON public.rsbsa_submission USING btree ("EXT NAME");


--
-- TOC entry 5799 (class 1259 OID 26232)
-- Name: idx_rsbsa_submission_farm_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farm_location ON public.rsbsa_submission USING btree ("FARM LOCATION");


--
-- TOC entry 5800 (class 1259 OID 31595)
-- Name: idx_rsbsa_submission_ffrs_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_ffrs_code ON public.rsbsa_submission USING btree ("FFRS_CODE");


--
-- TOC entry 5801 (class 1259 OID 26225)
-- Name: idx_rsbsa_submission_first_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_first_name ON public.rsbsa_submission USING btree ("FIRST NAME");


--
-- TOC entry 5802 (class 1259 OID 26228)
-- Name: idx_rsbsa_submission_gender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_gender ON public.rsbsa_submission USING btree ("GENDER");


--
-- TOC entry 5803 (class 1259 OID 26224)
-- Name: idx_rsbsa_submission_last_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_last_name ON public.rsbsa_submission USING btree ("LAST NAME");


--
-- TOC entry 5804 (class 1259 OID 26234)
-- Name: idx_rsbsa_submission_main_livelihood; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_main_livelihood ON public.rsbsa_submission USING btree ("MAIN LIVELIHOOD");


--
-- TOC entry 5805 (class 1259 OID 26226)
-- Name: idx_rsbsa_submission_middle_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_middle_name ON public.rsbsa_submission USING btree ("MIDDLE NAME");


--
-- TOC entry 5806 (class 1259 OID 26231)
-- Name: idx_rsbsa_submission_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_municipality ON public.rsbsa_submission USING btree ("MUNICIPALITY");


--
-- TOC entry 5807 (class 1259 OID 31668)
-- Name: idx_rsbsa_submission_parcel_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_parcel_area ON public.rsbsa_submission USING btree ("PARCEL AREA");


--
-- TOC entry 5808 (class 1259 OID 26235)
-- Name: idx_rsbsa_submission_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_status ON public.rsbsa_submission USING btree (status);


--
-- TOC entry 5809 (class 1259 OID 26236)
-- Name: idx_rsbsa_submission_submitted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_submitted_at ON public.rsbsa_submission USING btree (submitted_at);


--
-- TOC entry 5810 (class 1259 OID 26237)
-- Name: idx_rsbsa_submission_total_farm_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_total_farm_area ON public.rsbsa_submission USING btree ("TOTAL FARM AREA");


--
-- TOC entry 5838 (class 1259 OID 67124)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 5839 (class 1259 OID 67125)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 5840 (class 1259 OID 67123)
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- TOC entry 5875 (class 2620 OID 67160)
-- Name: incentive_distribution_log trg_incentive_log_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_incentive_log_updated BEFORE UPDATE ON public.incentive_distribution_log FOR EACH ROW EXECUTE FUNCTION public.update_incentive_log_timestamp();


--
-- TOC entry 5874 (class 2620 OID 67127)
-- Name: users trg_users_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_users_timestamp();


--
-- TOC entry 5871 (class 2620 OID 31665)
-- Name: rsbsa_farm_parcels trigger_create_land_history_on_parcel_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_create_land_history_on_parcel_insert AFTER INSERT ON public.rsbsa_farm_parcels FOR EACH ROW EXECUTE FUNCTION public.create_land_history_from_farm_parcel();


--
-- TOC entry 5870 (class 2620 OID 31599)
-- Name: rsbsa_submission trigger_generate_ffrs_code; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_generate_ffrs_code BEFORE INSERT ON public.rsbsa_submission FOR EACH ROW EXECUTE FUNCTION public.generate_ffrs_code_trigger();


--
-- TOC entry 5872 (class 2620 OID 31667)
-- Name: rsbsa_farm_parcels trigger_update_land_history_on_parcel_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_land_history_on_parcel_update AFTER UPDATE ON public.rsbsa_farm_parcels FOR EACH ROW EXECUTE FUNCTION public.update_land_history_from_farm_parcel();


--
-- TOC entry 5873 (class 2620 OID 31663)
-- Name: land_history trigger_update_land_history_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_land_history_timestamp BEFORE UPDATE ON public.land_history FOR EACH ROW EXECUTE FUNCTION public.update_land_history_timestamp();


--
-- TOC entry 5861 (class 2606 OID 26305)
-- Name: farm_parcels farm_parcels_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels
    ADD CONSTRAINT farm_parcels_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5866 (class 2606 OID 67148)
-- Name: incentive_distribution_log fk_encoder; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT fk_encoder FOREIGN KEY (encoder_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5867 (class 2606 OID 67143)
-- Name: incentive_distribution_log fk_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT fk_farmer FOREIGN KEY (farmer_id) REFERENCES public.masterlist(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5868 (class 2606 OID 67172)
-- Name: ownership_transfers fk_from_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT fk_from_farmer FOREIGN KEY (from_farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5869 (class 2606 OID 67177)
-- Name: ownership_transfers fk_to_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT fk_to_farmer FOREIGN KEY (to_farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5862 (class 2606 OID 31634)
-- Name: land_history land_history_farm_parcel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_farm_parcel_id_fkey FOREIGN KEY (farm_parcel_id) REFERENCES public.rsbsa_farm_parcels(id) ON DELETE CASCADE;


--
-- TOC entry 5863 (class 2606 OID 31639)
-- Name: land_history land_history_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;


--
-- TOC entry 5864 (class 2606 OID 31644)
-- Name: land_history land_history_previous_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_previous_record_id_fkey FOREIGN KEY (previous_record_id) REFERENCES public.land_history(id) ON DELETE SET NULL;


--
-- TOC entry 5865 (class 2606 OID 31629)
-- Name: land_history land_history_rsbsa_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_rsbsa_submission_id_fkey FOREIGN KEY (rsbsa_submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5860 (class 2606 OID 26255)
-- Name: rsbsa_farm_parcels rsbsa_farm_parcels_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT rsbsa_farm_parcels_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


-- Completed on 2025-11-13 09:12:24

--
-- PostgreSQL database dump complete
--

