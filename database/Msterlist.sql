--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-12-07 06:43:30

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
-- TOC entry 6144 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- TOC entry 784 (class 1255 OID 31664)
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
-- TOC entry 6145 (class 0 OID 0)
-- Dependencies: 784
-- Name: FUNCTION create_land_history_from_farm_parcel(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_land_history_from_farm_parcel() IS 'Automatically creates land history record when a new farm parcel is added';


--
-- TOC entry 997 (class 1255 OID 31596)
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
-- TOC entry 538 (class 1255 OID 31598)
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
-- TOC entry 651 (class 1255 OID 31661)
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
-- TOC entry 363 (class 1255 OID 31597)
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
-- TOC entry 731 (class 1255 OID 67159)
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
-- TOC entry 507 (class 1255 OID 31666)
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
-- TOC entry 6146 (class 0 OID 0)
-- Dependencies: 507
-- Name: FUNCTION update_land_history_from_farm_parcel(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_land_history_from_farm_parcel() IS 'Automatically updates land history when farm parcel ownership changes';


--
-- TOC entry 259 (class 1255 OID 31662)
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
-- TOC entry 551 (class 1255 OID 67126)
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
-- TOC entry 6147 (class 0 OID 0)
-- Dependencies: 227
-- Name: barangay_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.barangay_codes_id_seq OWNED BY public.barangay_codes.id;


--
-- TOC entry 248 (class 1259 OID 67294)
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


ALTER TABLE public.distribution_records OWNER TO postgres;

--
-- TOC entry 6148 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE distribution_records; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.distribution_records IS 'Actual distribution records with voucher tracking';


--
-- TOC entry 247 (class 1259 OID 67293)
-- Name: distribution_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.distribution_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.distribution_records_id_seq OWNER TO postgres;

--
-- TOC entry 6149 (class 0 OID 0)
-- Dependencies: 247
-- Name: distribution_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.distribution_records_id_seq OWNED BY public.distribution_records.id;


--
-- TOC entry 234 (class 1259 OID 26289)
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
-- TOC entry 233 (class 1259 OID 26288)
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
-- TOC entry 6150 (class 0 OID 0)
-- Dependencies: 233
-- Name: farm_parcels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.farm_parcels_id_seq OWNED BY public.farm_parcels.id;


--
-- TOC entry 246 (class 1259 OID 67272)
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


ALTER TABLE public.farmer_requests OWNER TO postgres;

--
-- TOC entry 6151 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE farmer_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.farmer_requests IS 'Individual farmer requests for agricultural inputs with priority scoring';


--
-- TOC entry 6152 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN farmer_requests.priority_score; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.farmer_requests.priority_score IS 'Auto-calculated score (0-100) based on priority criteria';


--
-- TOC entry 6153 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN farmer_requests.priority_rank; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.farmer_requests.priority_rank IS 'Rank after sorting all farmers (1=highest priority)';


--
-- TOC entry 6154 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN farmer_requests.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.farmer_requests.status IS 'pending=awaiting review, approved=will receive, distributed=already given, waitlisted=next batch, rejected=denied';


--
-- TOC entry 245 (class 1259 OID 67271)
-- Name: farmer_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.farmer_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.farmer_requests_id_seq OWNER TO postgres;

--
-- TOC entry 6155 (class 0 OID 0)
-- Dependencies: 245
-- Name: farmer_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.farmer_requests_id_seq OWNED BY public.farmer_requests.id;


--
-- TOC entry 240 (class 1259 OID 67129)
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
-- TOC entry 6156 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE incentive_distribution_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.incentive_distribution_log IS 'Records completed physical incentive distributions. NO online requests or approvals.';


--
-- TOC entry 6157 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.farmer_id IS 'Reference to masterlist farmer';


--
-- TOC entry 6158 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.event_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.event_date IS 'Date of physical distribution event';


--
-- TOC entry 6159 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.incentive_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.incentive_type IS 'e.g., "Rice Seeds 20kg", "Fertilizer 50kg"';


--
-- TOC entry 6160 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.qty_requested; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.qty_requested IS 'Amount farmer requested at event';


--
-- TOC entry 6161 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.qty_received; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.qty_received IS 'Actual amount distributed (may be less due to shortage)';


--
-- TOC entry 6162 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.is_signed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.is_signed IS 'Confirms farmer signed paper receipt. MUST be true.';


--
-- TOC entry 6163 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.note; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.note IS 'Optional notes, e.g., "Shortage: only 15kg available"';


--
-- TOC entry 6164 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.encoder_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.encoder_id IS 'Staff who entered this record';


--
-- TOC entry 239 (class 1259 OID 67128)
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
-- TOC entry 6165 (class 0 OID 0)
-- Dependencies: 239
-- Name: incentive_distribution_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.incentive_distribution_log_id_seq OWNED BY public.incentive_distribution_log.id;


--
-- TOC entry 236 (class 1259 OID 31609)
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
-- TOC entry 6166 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE land_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.land_history IS 'Comprehensive land ownership and tenancy history tracking system';


--
-- TOC entry 6167 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.rsbsa_submission_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.rsbsa_submission_id IS 'Link to the RSBSA submission that created or updated this record';


--
-- TOC entry 6168 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.farm_parcel_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farm_parcel_id IS 'Link to the specific farm parcel in rsbsa_farm_parcels';


--
-- TOC entry 6169 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.land_owner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.land_owner_id IS 'ID of the legal land owner (may be different from farmer)';


--
-- TOC entry 6170 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.land_owner_name IS 'Name of the legal land owner';


--
-- TOC entry 6171 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farmer_id IS 'ID of the person farming the land (from rsbsa_submission)';


--
-- TOC entry 6172 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.farmer_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farmer_name IS 'Name of the person actually farming the land';


--
-- TOC entry 6173 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.is_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_tenant IS 'TRUE if farmer is renting from land owner';


--
-- TOC entry 6174 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.is_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_lessee IS 'TRUE if farmer is leasing from land owner';


--
-- TOC entry 6175 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.is_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_registered_owner IS 'TRUE if farmer is the registered owner';


--
-- TOC entry 6176 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.period_start_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.period_start_date IS 'Start date of this ownership/tenancy arrangement';


--
-- TOC entry 6177 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.period_end_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.period_end_date IS 'End date (NULL if currently active)';


--
-- TOC entry 6178 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.is_current; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_current IS 'TRUE if this is the current/active record';


--
-- TOC entry 6179 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.change_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.change_type IS 'Type of change: NEW, OWNERSHIP_CHANGE, TENANT_CHANGE, UPDATE, TERMINATION';


--
-- TOC entry 6180 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.previous_record_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.previous_record_id IS 'Link to previous history record for this parcel';


--
-- TOC entry 235 (class 1259 OID 31608)
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
-- TOC entry 6181 (class 0 OID 0)
-- Dependencies: 235
-- Name: land_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.land_history_id_seq OWNED BY public.land_history.id;


--
-- TOC entry 220 (class 1259 OID 24643)
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
-- TOC entry 226 (class 1259 OID 25800)
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
-- TOC entry 6182 (class 0 OID 0)
-- Dependencies: 226
-- Name: masterlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.masterlist_id_seq OWNED BY public.masterlist.id;


--
-- TOC entry 242 (class 1259 OID 67163)
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
-- TOC entry 6183 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE ownership_transfers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ownership_transfers IS 'Tracks land ownership transfer history between farmers';


--
-- TOC entry 6184 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.from_farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.from_farmer_id IS 'ID of the farmer transferring ownership (original owner)';


--
-- TOC entry 6185 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.to_farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.to_farmer_id IS 'ID of the farmer receiving ownership (new owner)';


--
-- TOC entry 6186 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.transfer_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_date IS 'Date when the ownership transfer occurred';


--
-- TOC entry 6187 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.transfer_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_type IS 'Type of transfer: ownership_change, inheritance, sale, donation, agrarian_reform';


--
-- TOC entry 6188 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.transfer_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_reason IS 'Detailed reason for the transfer (free text)';


--
-- TOC entry 6189 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.processed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.processed_by IS 'ID of the JO user who processed this transfer';


--
-- TOC entry 241 (class 1259 OID 67162)
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
-- TOC entry 6190 (class 0 OID 0)
-- Dependencies: 241
-- Name: ownership_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ownership_transfers_id_seq OWNED BY public.ownership_transfers.id;


--
-- TOC entry 250 (class 1259 OID 67314)
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


ALTER TABLE public.priority_configurations OWNER TO postgres;

--
-- TOC entry 6191 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE priority_configurations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.priority_configurations IS 'Customizable priority weights for research and tuning';


--
-- TOC entry 249 (class 1259 OID 67313)
-- Name: priority_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.priority_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.priority_configurations_id_seq OWNER TO postgres;

--
-- TOC entry 6192 (class 0 OID 0)
-- Dependencies: 249
-- Name: priority_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.priority_configurations_id_seq OWNED BY public.priority_configurations.id;


--
-- TOC entry 244 (class 1259 OID 67245)
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


ALTER TABLE public.regional_allocations OWNER TO postgres;

--
-- TOC entry 6193 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE regional_allocations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.regional_allocations IS 'Tracks fertilizer/seed allocations received from Regional Office per season';


--
-- TOC entry 243 (class 1259 OID 67244)
-- Name: regional_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.regional_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.regional_allocations_id_seq OWNER TO postgres;

--
-- TOC entry 6194 (class 0 OID 0)
-- Dependencies: 243
-- Name: regional_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.regional_allocations_id_seq OWNED BY public.regional_allocations.id;


--
-- TOC entry 232 (class 1259 OID 26239)
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
-- TOC entry 6195 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE rsbsa_farm_parcels; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rsbsa_farm_parcels IS 'Stores individual farm parcels for each RSBSA submission';


--
-- TOC entry 6196 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.submission_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.submission_id IS 'Reference to the main RSBSA submission';


--
-- TOC entry 6197 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.parcel_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.parcel_number IS 'Parcel number (1, 2, 3, etc.)';


--
-- TOC entry 6198 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.farm_location_barangay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.farm_location_barangay IS 'Barangay where the farm parcel is located';


--
-- TOC entry 6199 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.farm_location_municipality; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.farm_location_municipality IS 'Municipality where the farm parcel is located';


--
-- TOC entry 6200 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.total_farm_area_ha; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.total_farm_area_ha IS 'Area of this specific parcel in hectares';


--
-- TOC entry 6201 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.within_ancestral_domain; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.within_ancestral_domain IS 'Whether this parcel is within ancestral domain';


--
-- TOC entry 6202 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_document_no; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_document_no IS 'Document number proving ownership of this parcel';


--
-- TOC entry 6203 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.agrarian_reform_beneficiary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.agrarian_reform_beneficiary IS 'Whether the farmer is an agrarian reform beneficiary for this parcel';


--
-- TOC entry 6204 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_registered_owner IS 'Whether the farmer is the registered owner of this parcel';


--
-- TOC entry 6205 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_tenant IS 'Whether the farmer is a tenant of this parcel';


--
-- TOC entry 6206 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_lessee IS 'Whether the farmer is a lessee of this parcel';


--
-- TOC entry 6207 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_others; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_others IS 'Whether the farmer has other ownership type for this parcel';


--
-- TOC entry 6208 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.tenant_land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.tenant_land_owner_name IS 'Name of land owner if farmer is a tenant';


--
-- TOC entry 6209 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.lessee_land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.lessee_land_owner_name IS 'Name of land owner if farmer is a lessee';


--
-- TOC entry 6210 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_others_specify; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_others_specify IS 'Specification of other ownership type';


--
-- TOC entry 231 (class 1259 OID 26238)
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
-- TOC entry 6211 (class 0 OID 0)
-- Dependencies: 231
-- Name: rsbsa_farm_parcels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rsbsa_farm_parcels_id_seq OWNED BY public.rsbsa_farm_parcels.id;


--
-- TOC entry 230 (class 1259 OID 26209)
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


ALTER TABLE public.rsbsa_submission OWNER TO postgres;

--
-- TOC entry 6212 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE rsbsa_submission; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rsbsa_submission IS 'Structured RSBSA submission table with farming activity tracking';


--
-- TOC entry 6213 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission.id IS 'Unique identifier for the submission';


--
-- TOC entry 6214 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."LAST NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."LAST NAME" IS 'Last name of the farmer';


--
-- TOC entry 6215 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FIRST NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FIRST NAME" IS 'First name of the farmer';


--
-- TOC entry 6216 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."MIDDLE NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MIDDLE NAME" IS 'Middle name of the farmer';


--
-- TOC entry 6217 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."EXT NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."EXT NAME" IS 'Extension name of the farmer';


--
-- TOC entry 6218 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."GENDER"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."GENDER" IS 'Gender of the farmer';


--
-- TOC entry 6219 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."BIRTHDATE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."BIRTHDATE" IS 'Birthdate of the farmer';


--
-- TOC entry 6220 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."BARANGAY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."BARANGAY" IS 'Barangay of the farmer';


--
-- TOC entry 6221 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."MUNICIPALITY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MUNICIPALITY" IS 'Municipality of the farmer';


--
-- TOC entry 6222 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARM LOCATION"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARM LOCATION" IS 'Farm location of the farmer';


--
-- TOC entry 6223 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."PARCEL AREA"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."PARCEL AREA" IS 'Area of the farm parcel';


--
-- TOC entry 6224 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."MAIN LIVELIHOOD"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MAIN LIVELIHOOD" IS 'Main livelihood of the farmer';


--
-- TOC entry 6225 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."TOTAL FARM AREA"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."TOTAL FARM AREA" IS 'Total farm area in hectares (sum of all parcels for this farmer)';


--
-- TOC entry 6226 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FFRS_CODE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FFRS_CODE" IS 'Unique FFRS code in format 06-30-18-XXX-YYYYYY where XXX is barangay code and YYYYYY is person code';


--
-- TOC entry 6227 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_RICE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_RICE" IS 'Indicates if farmer grows rice';


--
-- TOC entry 6228 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_CORN"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_CORN" IS 'Indicates if farmer grows corn';


--
-- TOC entry 6229 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_OTHER_CROPS"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_OTHER_CROPS" IS 'Indicates if farmer grows other crops';


--
-- TOC entry 6230 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_OTHER_CROPS_TEXT"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_OTHER_CROPS_TEXT" IS 'Specific other crops grown';


--
-- TOC entry 6231 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_LIVESTOCK"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_LIVESTOCK" IS 'Indicates if farmer raises livestock';


--
-- TOC entry 6232 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_LIVESTOCK_TEXT"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_LIVESTOCK_TEXT" IS 'Specific livestock types';


--
-- TOC entry 6233 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_POULTRY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_POULTRY" IS 'Indicates if farmer raises poultry';


--
-- TOC entry 6234 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_POULTRY_TEXT"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_POULTRY_TEXT" IS 'Specific poultry types';


--
-- TOC entry 229 (class 1259 OID 26208)
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
-- TOC entry 6235 (class 0 OID 0)
-- Dependencies: 229
-- Name: rsbsa_submission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rsbsa_submission_id_seq OWNED BY public.rsbsa_submission.id;


--
-- TOC entry 238 (class 1259 OID 67108)
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
-- TOC entry 6236 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'System users for authentication and authorization';


--
-- TOC entry 6237 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.id IS 'Unique user identifier';


--
-- TOC entry 6238 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.username; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.username IS 'Unique username for login';


--
-- TOC entry 6239 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.email IS 'Unique email address';


--
-- TOC entry 6240 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.password_hash IS 'Bcrypt hashed password';


--
-- TOC entry 6241 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.role IS 'User role: admin, technician, jo, encoder, farmer, lgu';


--
-- TOC entry 6242 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.created_at IS 'Account creation timestamp';


--
-- TOC entry 6243 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.updated_at IS 'Last update timestamp';


--
-- TOC entry 237 (class 1259 OID 67107)
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
-- TOC entry 6244 (class 0 OID 0)
-- Dependencies: 237
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 5727 (class 2604 OID 26042)
-- Name: barangay_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes ALTER COLUMN id SET DEFAULT nextval('public.barangay_codes_id_seq'::regclass);


--
-- TOC entry 5821 (class 2604 OID 67297)
-- Name: distribution_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records ALTER COLUMN id SET DEFAULT nextval('public.distribution_records_id_seq'::regclass);


--
-- TOC entry 5749 (class 2604 OID 26292)
-- Name: farm_parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels ALTER COLUMN id SET DEFAULT nextval('public.farm_parcels_id_seq'::regclass);


--
-- TOC entry 5800 (class 2604 OID 67275)
-- Name: farmer_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_requests ALTER COLUMN id SET DEFAULT nextval('public.farmer_requests_id_seq'::regclass);


--
-- TOC entry 5771 (class 2604 OID 67132)
-- Name: incentive_distribution_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log ALTER COLUMN id SET DEFAULT nextval('public.incentive_distribution_log_id_seq'::regclass);


--
-- TOC entry 5757 (class 2604 OID 31612)
-- Name: land_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history ALTER COLUMN id SET DEFAULT nextval('public.land_history_id_seq'::regclass);


--
-- TOC entry 5725 (class 2604 OID 25801)
-- Name: masterlist id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterlist ALTER COLUMN id SET DEFAULT nextval('public.masterlist_id_seq'::regclass);


--
-- TOC entry 5775 (class 2604 OID 67166)
-- Name: ownership_transfers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers ALTER COLUMN id SET DEFAULT nextval('public.ownership_transfers_id_seq'::regclass);


--
-- TOC entry 5826 (class 2604 OID 67317)
-- Name: priority_configurations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priority_configurations ALTER COLUMN id SET DEFAULT nextval('public.priority_configurations_id_seq'::regclass);


--
-- TOC entry 5777 (class 2604 OID 67248)
-- Name: regional_allocations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regional_allocations ALTER COLUMN id SET DEFAULT nextval('public.regional_allocations_id_seq'::regclass);


--
-- TOC entry 5742 (class 2604 OID 26242)
-- Name: rsbsa_farm_parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels ALTER COLUMN id SET DEFAULT nextval('public.rsbsa_farm_parcels_id_seq'::regclass);


--
-- TOC entry 5729 (class 2604 OID 26212)
-- Name: rsbsa_submission id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission ALTER COLUMN id SET DEFAULT nextval('public.rsbsa_submission_id_seq'::regclass);


--
-- TOC entry 5768 (class 2604 OID 67111)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 6116 (class 0 OID 26039)
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
-- TOC entry 6136 (class 0 OID 67294)
-- Dependencies: 248
-- Data for Name: distribution_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.distribution_records (id, request_id, distribution_date, fertilizer_type, fertilizer_bags_given, seed_type, seed_kg_given, voucher_code, qr_code_data, claimed, claim_date, farmer_signature, verified_by, verification_notes, created_at) FROM stdin;
6	16	2025-12-01	Urea:50, Complete:50, Ammonium Sulfate:50, Muriate Potash:50	200	Jackpot:50, US88:50, TH82:50, RH9000:50, Lumping143:50, LP296:50	300.00	\N	\N	t	2025-12-01 10:14:53.399327	f	\N	\N	2025-12-01 10:14:53.399327
7	25	2025-12-01	Urea:40.00, Complete:40.00, Ammonium Sulfate:40.00, Muriate Potash:40.00	160	Jackpot:40.00, US88:40.00, TH82:40.00, RH9000:40.00, Lumping143:40.00, LP296:40.00	240.00	\N	\N	t	2025-12-01 10:24:16.805911	f	\N	\N	2025-12-01 10:24:16.805911
9	26	2025-12-02	Urea:10.00, Complete:10.00, Ammonium Sulfate:0.00, Muriate Potash:0.00	20	Jackpot:10.00, US88:0.00, TH82:0.00, RH9000:10.00, Lumping143:0.00, LP296:10.00	30.00	\N	\N	t	2025-12-02 08:14:36.673915	f	\N	\N	2025-12-02 08:14:36.673915
10	29	2025-12-02	Urea:90.00, Complete:0.00, Ammonium Sulfate:0.00, Muriate Potash:0.00	90	Jackpot:0.00, US88:0.00, TH82:0.00, RH9000:0.00, Lumping143:0.00, LP296:0.00	0.00	\N	\N	t	2025-12-02 08:22:37.308686	f	\N	\N	2025-12-02 08:22:37.308686
11	30	2025-12-02	Urea:0.00, Complete:10.00, Ammonium Sulfate:10.00, Muriate Potash:0.00	20	Jackpot:0.00, US88:0.00, TH82:0.00, RH9000:0.00, Lumping143:0.00, LP296:0.00	0.00	\N	\N	t	2025-12-02 09:20:25.67241	f	\N	\N	2025-12-02 09:20:25.67241
12	31	2025-12-02	Urea:0.00, Complete:0.00, Ammonium Sulfate:66.00, Muriate Potash:0.00	66	Jackpot:0.00, US88:29.98, TH82:0.00, RH9000:0.00, Lumping143:0.00, LP296:0.00	29.98	\N	\N	t	2025-12-02 11:49:06.717808	f	\N	\N	2025-12-02 11:49:06.717808
13	32	2025-12-02	Urea:0.00, Complete:0.00, Ammonium Sulfate:0.00, Muriate Potash:0.00	0	Jackpot:0.00, US88:0.00, TH82:0.00, RH9000:0.00, Lumping143:0.00, LP296:0.00	0.00	\N	\N	t	2025-12-02 13:25:38.155012	f	\N	\N	2025-12-02 13:25:38.155012
14	33	2025-12-02	Urea:0.00, Complete:0.03, Ammonium Sulfate:0.00, Muriate Potash:0.00	0	Jackpot:0.00, US88:0.00, TH82:0.00, RH9000:0.00, Lumping143:0.00, LP296:0.00	0.00	\N	\N	t	2025-12-02 13:56:36.317586	f	\N	\N	2025-12-02 13:56:36.317586
15	35	2025-12-02	Urea:50.00, Complete:0.00, Ammonium Sulfate:0.00, Muriate Potash:0.00	50	Jackpot:0.00, US88:0.00, TH82:9.96, RH9000:0.00, Lumping143:0.00, LP296:0.00	9.96	\N	\N	t	2025-12-02 15:42:25.301615	f	\N	\N	2025-12-02 15:42:25.301615
\.


--
-- TOC entry 6122 (class 0 OID 26289)
-- Dependencies: 234
-- Data for Name: farm_parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_city_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 6134 (class 0 OID 67272)
-- Dependencies: 246
-- Data for Name: farmer_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.farmer_requests (id, season, request_date, farmer_id, farmer_name, barangay, farm_area_ha, crop_type, ownership_type, num_parcels, fertilizer_requested, seeds_requested, request_notes, priority_score, priority_rank, assigned_fertilizer_type, assigned_fertilizer_bags, assigned_seed_type, assigned_seed_kg, fertilizer_accepted, seeds_accepted, rejection_reason, status, created_by, created_at, updated_at, requested_urea_bags, requested_complete_14_bags, requested_complete_16_bags, requested_ammonium_sulfate_bags, requested_ammonium_phosphate_bags, requested_muriate_potash_bags, requested_jackpot_kg, requested_us88_kg, requested_th82_kg, requested_rh9000_kg, requested_lumping143_kg, requested_lp296_kg) FROM stdin;
31	dry_2025	2025-12-02	48	Martinez, Rosa	Barasan	0.00	Rice	Owner	1	t	t	[12/2/2025, 11:41:20 AM] SUBSTITUTION APPLIED: Replaced 30 bags Urea with 66 bags Ammonium Sulfate (21-0-0) (95% confidence). Full substitution.	0	\N	\N	\N	\N	\N	\N	\N	\N	approved	\N	2025-12-02 11:40:59.335858	2025-12-02 11:49:06.695285	0.00	0.00	0.00	66.00	0.00	0.00	0.00	29.98	0.00	0.00	0.00	0.00
32	dry_2025	2025-12-02	64	Gomez, Robert	Calao	0.00	Rice	Owner	1	f	f	\N	0	\N	\N	\N	\N	\N	\N	\N	\N	approved	\N	2025-12-02 13:25:21.206909	2025-12-02 13:25:38.120247	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00
34	dry_2025	2025-12-02	2	Fournier, Justine	Balibago Rd.	0.00	Rice	Owner	1	t	t	\N	0	\N	\N	\N	\N	\N	\N	\N	\N	rejected	\N	2025-12-02 13:56:13.694929	2025-12-02 13:56:22.300586	0.00	0.00	0.00	49.97	0.00	0.00	0.00	19.97	0.00	0.00	0.00	0.00
33	dry_2025	2025-12-02	67	Marco, Lupin	Brgy. Maraguit	0.00	Rice	Owner	1	t	f	[12/2/2025, 1:47:31 PM] SUBSTITUTION APPLIED: Replaced 242.99 bags Urea with 800 bags Complete Fertilizer (14-14-14) (70% confidence). Partial: 233.99 bags shortage remains.	0	\N	\N	\N	\N	\N	\N	\N	\N	approved	\N	2025-12-02 13:47:01.779694	2025-12-02 13:56:36.289348	0.00	0.03	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00
35	wet_2026	2025-12-02	68	Solano, Harvey	Calao	0.00	Rice	Owner	1	t	t	\N	0	\N	\N	\N	\N	\N	\N	\N	\N	approved	\N	2025-12-02 15:41:56.429994	2025-12-02 15:42:25.269364	50.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	9.96	0.00	0.00	0.00
25	wet_2026	2025-12-01	11	Sala, Sakari	Old San Roque	0.00	Rice	Owner	1	t	t	\N	0	\N	\N	\N	\N	\N	\N	\N	\N	approved	\N	2025-12-01 10:23:53.202642	2025-12-01 10:24:16.783095	40.00	40.00	0.00	40.00	0.00	40.00	40.00	40.00	40.00	40.00	40.00	40.00
16	wet_2026	2025-11-28	12	Thoms, Thomas	Rm 409 Martinez Building	0.00	Rice	Owner	1	t	t	\N	0	\N	\N	\N	\N	\N	\N	\N	\N	approved	\N	2025-11-28 09:46:45.534623	2025-12-01 10:28:25.903917	50.00	50.00	0.00	50.00	0.00	50.00	50.00	50.00	50.00	50.00	50.00	50.00
26	dry_2025	2025-12-02	4	Ramos, Marja	Del Pilar Corner Zamora	0.00	Rice	Owner	1	t	t	\N	0	\N	\N	\N	\N	\N	\N	\N	\N	approved	\N	2025-12-02 08:07:09.642762	2025-12-02 08:14:36.654493	10.00	10.00	0.00	0.00	0.00	0.00	10.00	0.00	0.00	10.00	0.00	10.00
29	dry_2025	2025-12-02	12	Thoms, Thomas	Rm 409 Martinez Building	0.00	Rice	Owner	1	t	f	[12/2/2025, 8:22:17 AM] SUBSTITUTION APPLIED: Replaced 110 bags Urea with 241 bags Ammonium Sulfate (21-0-0) (76% confidence). Partial: 65 bags shortage remains.	0	\N	\N	\N	\N	\N	\N	\N	\N	approved	\N	2025-12-02 08:21:43.539028	2025-12-02 08:22:37.299279	90.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00
30	dry_2025	2025-12-02	11	Sala, Sakari	Old San Roque	0.00	Rice	Owner	1	t	f		0	\N	\N	\N	\N	\N	\N	\N	\N	approved	\N	2025-12-02 08:42:45.769042	2025-12-02 09:20:25.650692	0.00	10.00	0.00	10.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00
\.


--
-- TOC entry 6128 (class 0 OID 67129)
-- Dependencies: 240
-- Data for Name: incentive_distribution_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incentive_distribution_log (id, farmer_id, event_date, incentive_type, qty_requested, qty_received, is_signed, note, encoder_id, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 6124 (class 0 OID 31609)
-- Dependencies: 236
-- Data for Name: land_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) FROM stdin;
3	2	3	1	Capaliz		2.00	\N	Justine Etta Fournier	06-30-18-000-195225	2	Justine Etta Fournier	06-30-18-000-195225	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-11-13	\N	t	NEW	\N	\N	2025-11-13 09:58:46.161041	2025-11-13 09:58:46.161041	\N	\N	\N
4	4	4	1	Capaliz	Dumangas	2.00	\N	Fournier, Justine Etta	\N	4	Marja Ward Ramos Warden	06-30-18-000-568491	Marja Ward Ramos Warden	06-30-18-000-568491	t	\N	\N	f	f	f	\N	\N		f	f	2025-11-13	\N	t	NEW	\N	\N	2025-11-13 10:42:17.370016	2025-11-13 10:42:17.370016	\N	\N	\N
7	6	7	1	Cali		2.00	\N	Matti Nik Marin Niko	06-30-18-000-578241	6	Matti Nik Marin Niko	06-30-18-000-578241	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-11-13	\N	t	NEW	\N	\N	2025-11-13 19:27:26.149525	2025-11-13 19:27:26.149525	\N	\N	\N
11	9	11	1	Calao		5.00	\N	Ensio Idk Arendt Jr.	06-30-18-000-099241	9	Ensio Idk Arendt Jr.	06-30-18-000-099241	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-11-14	\N	t	NEW	\N	\N	2025-11-14 14:00:30.29604	2025-11-14 14:00:30.29604	\N	\N	\N
12	11	12	1	Burgos-Regidor	Dumangas	2.00	\N	Ramos, Marja Ward Warden	\N	11	Sakari Kit Sala	06-30-18-000-227179	Sakari Kit Sala	06-30-18-000-227179	t	\N	\N	f	f	f	\N	\N		f	f	2025-11-14	\N	t	NEW	\N	\N	2025-11-14 14:48:31.319129	2025-11-14 14:48:31.319129	\N	\N	\N
13	12	13	1	Burgos-Regidor	Dumangas	2.00	\N	Iglesias, Jukka Anika Alex	\N	12	Thomas Klok Thoms Hir	06-30-18-000-535335	\N	\N	f	Thomas Klok Thoms Hir	06-30-18-000-535335	t	f	f	\N	\N		f	f	2025-11-14	\N	t	NEW	\N	\N	2025-11-14 14:56:34.970059	2025-11-14 14:56:34.970059	\N	\N	\N
14	13	14	1	Cali	Dumangas	2.00	\N	Iglesias, Jukka Anika Alex	\N	13	Kieron Kim Hawkv Jr.	06-30-18-000-313533	Kieron Kim Hawkv Jr.	06-30-18-000-313533	t	\N	\N	f	f	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:12:52.617089	2025-12-02 10:12:52.617089	\N	\N	\N
15	46	15	1	Aurora-Del Pilar	Dumangas	2.50	\N	Juan Santos Dela Cruz	06-30-18-001-401813	46	Juan Santos Dela Cruz	06-30-18-001-401813	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2015-0123	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
16	42	16	1	Bacay	Dumangas	1.80	\N	Maria Garcia Reyes	06-30-18-002-201823	42	Maria Garcia Reyes	06-30-18-002-201823	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2018-0456	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
17	29	17	1	Balabag	Dumangas	2.00	\N	Roberto Mendoza Santos	06-30-18-004-352071	29	Roberto Mendoza Santos	06-30-18-004-352071	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2012-0789	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
18	29	18	2	Balabag	Dumangas	1.20	\N	Roberto Mendoza Santos	06-30-18-004-352071	29	Roberto Mendoza Santos	06-30-18-004-352071	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2016-0790	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
19	27	19	1	Bantud	Dumangas	2.10	\N	Elena Flores Garcia	06-30-18-006-223287	27	Elena Flores Garcia	06-30-18-006-223287	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2017-1234	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
20	37	20	1	Baras	Dumangas	3.00	\N	Pedro Aquino Hernandez	06-30-18-000-773814	37	Pedro Aquino Hernandez	06-30-18-000-773814	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2010-5678	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
21	37	21	2	Baras	Dumangas	1.50	\N	Pedro Aquino Hernandez	06-30-18-000-773814	37	Pedro Aquino Hernandez	06-30-18-000-773814	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2014-5679	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
22	48	22	1	Barasan	Dumangas	1.50	\N	Rosa Bautista Martinez	06-30-18-000-495254	48	Rosa Bautista Martinez	06-30-18-000-495254	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2019-9012	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
23	18	23	1	Bolilao	Dumangas	2.80	\N	Antonio Cruz Gonzales	06-30-18-009-870756	18	Antonio Cruz Gonzales	06-30-18-009-870756	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2013-3456	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
24	14	24	1	Calao	Dumangas	1.20	\N	Carmen Ramos Torres	06-30-18-012-303879	14	Carmen Ramos Torres	06-30-18-012-303879	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2020-7890	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
25	24	25	1	Cali	Dumangas	2.50	\N	Ricardo Villanueva Fernandez	06-30-18-000-171910	24	Ricardo Villanueva Fernandez	06-30-18-000-171910	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2008-1122	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
26	24	26	2	Cali	Dumangas	1.20	\N	Ricardo Villanueva Fernandez	06-30-18-000-171910	24	Ricardo Villanueva Fernandez	06-30-18-000-171910	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2011-1123	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
27	39	27	1	Cansilayan	Dumangas	2.30	\N	Lourdes Santiago Lopez	06-30-18-000-678900	39	Lourdes Santiago Lopez	06-30-18-000-678900	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2016-3344	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
28	60	28	1	Capaliz	Dumangas	1.90	\N	Manuel Rivera Castillo	06-30-18-000-621183	60	Manuel Rivera Castillo	06-30-18-000-621183	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2015-5566	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
29	57	29	1	Cayos	Dumangas	2.60	\N	Dela Cruz, Juan	\N	57	Teresa Morales Ramirez	06-30-18-000-892572	Teresa Morales Ramirez	06-30-18-000-892572	t	\N	\N	f	f	f	\N	\N	\N	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
30	15	30	1	Compayan	Dumangas	1.40	\N	Santos, Roberto	\N	15	Jose Diaz Morales	06-30-18-000-389310	Jose Diaz Morales	06-30-18-000-389310	t	\N	\N	f	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
31	63	31	1	Dacutan	Dumangas	3.10	\N	Gloria Gomez Velasco	06-30-18-000-748405	63	Gloria Gomez Velasco	06-30-18-000-748405	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2019-7788	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
32	52	32	1	Ermita	Dumangas	2.40	\N	Hernandez, Pedro	\N	52	Alfredo Perez Mendoza	06-30-18-000-519107	Alfredo Perez Mendoza	06-30-18-000-519107	t	\N	\N	f	f	f	\N	\N	\N	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
33	36	33	1	Ilaya 1st	Dumangas	1.70	\N	Violeta Torres Cruz	06-30-18-000-787423	36	Violeta Torres Cruz	06-30-18-000-787423	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2017-9900	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
34	30	34	1	Ilaya 2nd	Dumangas	3.50	\N	Aquino, Eduardo	\N	30	Fernando Lopez Bautista	06-30-18-000-520866	Fernando Lopez Bautista	06-30-18-000-520866	t	\N	\N	f	f	f	\N	\N	\N	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
35	31	35	1	Ilaya 3rd	Dumangas	2.00	\N	Angelina Castro Flores	06-30-18-000-655380	31	Angelina Castro Flores	06-30-18-000-655380	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2020-1122	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
36	20	36	1	Jardin	Dumangas	4.20	\N	Eduardo Navarro Aquino	06-30-18-000-660501	20	Eduardo Navarro Aquino	06-30-18-000-660501	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2009-3344	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
37	19	37	1	Lacturan	Dumangas	1.60	\N	Torres, Alberto	\N	19	Cristina Fernandez Ramos	06-30-18-016-588052	Cristina Fernandez Ramos	06-30-18-016-588052	t	\N	\N	f	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
38	59	38	1	Lopez Jaena - Rizal	Dumangas	2.90	\N	Gonzales, Antonio	\N	59	Miguel Gonzales Villanueva	06-30-18-000-486330	\N	\N	f	Miguel Gonzales Villanueva	06-30-18-000-486330	t	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
39	22	39	1	Managuit	Dumangas	1.30	\N	Rosario Martinez Santiago	06-30-18-000-098387	22	Rosario Martinez Santiago	06-30-18-000-098387	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2021-5566	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
40	41	40	1	Maquina	Dumangas	3.80	\N	Fernandez, Ricardo	\N	41	Benjamin Hernandez Rivera	06-30-18-000-840583	\N	\N	f	Benjamin Hernandez Rivera	06-30-18-000-840583	t	f	f	\N	\N	\N	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
41	28	41	1	Nanding Lopez	Dumangas	2.20	\N	Luisa Reyes Diaz	06-30-18-000-635174	28	Luisa Reyes Diaz	06-30-18-000-635174	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2018-7788	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
42	16	42	1	Pagdugue	Dumangas	1.90	\N	\N	\N	16	Carlos Santos Gomez	06-30-18-000-758139	Carlos Santos Gomez	06-30-18-000-758139	t	\N	\N	f	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
43	33	43	1	Paloc Bigque	Dumangas	3.40	\N	Estrella Dela Cruz Perez	06-30-18-019-447384	33	Estrella Dela Cruz Perez	06-30-18-019-447384	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2016-9900	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
44	51	44	1	Paloc Sool	Dumangas	2.70	\N	Castillo, Manuel	\N	51	Ramon Garcia Castro	06-30-18-000-475490	\N	\N	f	Ramon Garcia Castro	06-30-18-000-475490	t	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
45	35	45	1	Patlad	Dumangas	1.50	\N	Norma Castillo Navarro	06-30-18-000-937857	35	Norma Castillo Navarro	06-30-18-000-937857	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2020-1122	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
46	45	46	1	Pd Monfort North	Dumangas	4.10	\N	Alberto Ramirez Torres	06-30-18-000-544688	45	Alberto Ramirez Torres	06-30-18-000-544688	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2010-3344	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
47	43	47	1	Pd Monfort South	Dumangas	2.50	\N	\N	\N	43	Beatriz Morales Lopez	06-30-18-000-319395	Beatriz Morales Lopez	06-30-18-000-319395	t	\N	\N	f	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
48	61	48	1	Pulao	Dumangas	1.20	\N	Jerome Velasco Gonzales	06-30-18-020-349178	61	Jerome Velasco Gonzales	06-30-18-020-349178	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2021-5566	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
49	50	49	1	Rosario	Dumangas	1.80	\N	Velasco, Gloria	\N	50	Jennifer Mendoza Martinez	06-30-18-000-775104	Jennifer Mendoza Martinez	06-30-18-000-775104	t	\N	\N	f	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
50	55	50	1	Sapao	Dumangas	2.10	\N	Ryan Cruz Hernandez	06-30-18-021-579453	55	Ryan Cruz Hernandez	06-30-18-021-579453	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2020-7788	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
51	17	51	1	Sulangan	Dumangas	1.40	\N	Perez, Estrella	\N	17	Michelle Bautista Reyes	06-30-18-000-341486	\N	\N	f	Michelle Bautista Reyes	06-30-18-000-341486	t	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
52	25	52	1	Tabucan	Dumangas	2.60	\N	Mark Flores Santos	06-30-18-022-642135	25	Mark Flores Santos	06-30-18-022-642135	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2019-9900	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
53	56	53	1	Talusan	Dumangas	1.60	\N	Flores, Alberto	\N	56	Anna Aquino Garcia	06-30-18-000-919406	Anna Aquino Garcia	06-30-18-000-919406	t	\N	\N	f	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
54	62	54	1	Tambobo	Dumangas	2.90	\N	Joseph Ramos Dela Cruz	06-30-18-000-340724	62	Joseph Ramos Dela Cruz	06-30-18-000-340724	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2021-1122	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
55	44	55	1	Tamboilan	Dumangas	1.70	\N	Cruz, Christian	\N	44	Maria Fe Villanueva Mendoza	06-30-18-000-030015	\N	\N	f	Maria Fe Villanueva Mendoza	06-30-18-000-030015	t	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
56	23	56	1	Victorias	Dumangas	3.20	\N	Christian Santiago Cruz	06-30-18-000-831548	23	Christian Santiago Cruz	06-30-18-000-831548	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2020-3344	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
57	40	57	1	Aurora-Del Pilar	Dumangas	2.00	\N	Dela Cruz, Juan	\N	40	Sheryl Rivera Bautista	06-30-18-001-054409	Sheryl Rivera Bautista	06-30-18-001-054409	t	\N	\N	f	f	f	\N	\N	\N	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
58	26	58	1	Bacay	Dumangas	3.00	\N	Rodrigo Diaz Flores	06-30-18-002-995807	26	Rodrigo Diaz Flores	06-30-18-002-995807	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2005-5566	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
59	26	59	2	Bacay	Dumangas	2.20	\N	Rodrigo Diaz Flores	06-30-18-002-995807	26	Rodrigo Diaz Flores	06-30-18-002-995807	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2007-5567	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
60	53	60	1	Bacong	Dumangas	2.50	\N	Teresita Gomez Aquino	06-30-18-003-978100	53	Teresita Gomez Aquino	06-30-18-003-978100	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2006-7788	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
61	53	61	2	Bacong	Dumangas	1.30	\N	Teresita Gomez Aquino	06-30-18-003-978100	53	Teresita Gomez Aquino	06-30-18-003-978100	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2008-7789	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
62	54	62	1	Balud	Dumangas	3.00	\N	Francisco Perez Ramos	06-30-18-005-578283	54	Francisco Perez Ramos	06-30-18-005-578283	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2007-9900	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
63	54	63	2	Balud	Dumangas	1.60	\N	Francisco Perez Ramos	06-30-18-005-578283	54	Francisco Perez Ramos	06-30-18-005-578283	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2009-9901	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
64	58	64	1	Bantud Fabrica	Dumangas	3.50	\N	Gonzales, Antonio	\N	58	Perpetua Castro Villanueva	06-30-18-007-047362	Perpetua Castro Villanueva	06-30-18-007-047362	t	\N	\N	f	f	f	\N	\N	\N	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
65	21	65	1	Basa-Mabini Bonifacio	Dumangas	3.20	\N	Ernesto Navarro Santiago	06-30-18-000-468430	21	Ernesto Navarro Santiago	06-30-18-000-468430	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2004-1122	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
66	21	66	2	Basa-Mabini Bonifacio	Dumangas	1.70	\N	Ernesto Navarro Santiago	06-30-18-000-468430	21	Ernesto Navarro Santiago	06-30-18-000-468430	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2006-1123	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
67	38	67	1	Buenaflor Embarkadero	Dumangas	2.80	\N	Diaz, Marcelo	\N	38	Felicitas Torres Rivera	06-30-18-000-861298	\N	\N	f	Felicitas Torres Rivera	06-30-18-000-861298	t	f	f	\N	\N	\N	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
68	49	68	1	Burgos-Regidor	Dumangas	3.50	\N	Marcelo Lopez Diaz	06-30-18-000-329720	49	Marcelo Lopez Diaz	06-30-18-000-329720	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2003-3344	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
69	49	69	2	Burgos-Regidor	Dumangas	2.00	\N	Marcelo Lopez Diaz	06-30-18-000-329720	49	Marcelo Lopez Diaz	06-30-18-000-329720	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2005-3345	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
70	32	70	1	Calao	Dumangas	3.10	\N	Perez, Emilio	\N	32	Amparo Gonzales Gomez	06-30-18-012-265066	Amparo Gonzales Gomez	06-30-18-012-265066	t	\N	\N	f	f	f	\N	\N	\N	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
71	47	71	1	Cali	Dumangas	4.00	\N	Emilio Martinez Perez	06-30-18-000-530729	47	Emilio Martinez Perez	06-30-18-000-530729	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2002-5566	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
72	47	72	2	Cali	Dumangas	2.20	\N	Emilio Martinez Perez	06-30-18-000-530729	47	Emilio Martinez Perez	06-30-18-000-530729	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2004-5567	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
73	34	73	1	Cansilayan	Dumangas	2.80	\N	Remedios Hernandez Castro	06-30-18-000-742876	34	Remedios Hernandez Castro	06-30-18-000-742876	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2010-7788	t	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
74	34	74	2	Cansilayan	Dumangas	1.50	\N	Remedios Hernandez Castro	06-30-18-000-742876	34	Remedios Hernandez Castro	06-30-18-000-742876	\N	\N	f	\N	\N	f	t	f	\N	\N	TD-2012-7789	f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	\N	\N	\N
75	64	75	1	Calao		4.00	\N	Robert Magbanua Gomez Jr.	06-30-18-012-171686	64	Robert Magbanua Gomez Jr.	06-30-18-012-171686	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 13:16:02.033714	2025-12-02 13:16:02.033714	\N	\N	\N
76	65	76	1	Calao	Dumangas	4.00	\N	Gomez, Robert Magbanua Jr.	\N	65	Emmar Noelle Robina	06-30-18-012-947155	Emmar Noelle Robina	06-30-18-012-947155	t	\N	\N	f	f	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 13:18:08.457448	2025-12-02 13:18:08.457448	\N	\N	\N
77	66	77	1	Calao	Dumangas	4.00	\N	Gomez, Robert Magbanua Jr.	\N	66	Alexa Lopez Onorio	06-30-18-012-664066	\N	\N	f	Alexa Lopez Onorio	06-30-18-012-664066	t	f	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 13:29:50.732478	2025-12-02 13:29:50.732478	\N	\N	\N
78	67	78	1	Bolilao		3.00	\N	Lupin Servita Marco III	06-30-18-000-502359	67	Lupin Servita Marco III	06-30-18-000-502359	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 13:42:09.544652	2025-12-02 13:42:09.544652	\N	\N	\N
79	67	79	2	Cayos		4.00	\N	Lupin Servita Marco III	06-30-18-000-502359	67	Lupin Servita Marco III	06-30-18-000-502359	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 13:42:09.544652	2025-12-02 13:42:09.544652	\N	\N	\N
80	68	80	1	Calao		1.50	\N	Harvey Kim Solano Jr.	06-30-18-012-335180	68	Harvey Kim Solano Jr.	06-30-18-012-335180	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 15:02:31.201145	2025-12-02 15:02:31.201145	\N	\N	\N
81	68	81	2	Balabag		1.50	\N	Harvey Kim Solano Jr.	06-30-18-012-335180	68	Harvey Kim Solano Jr.	06-30-18-012-335180	\N	\N	f	\N	\N	f	t	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 15:02:31.201145	2025-12-02 15:02:31.201145	\N	\N	\N
82	69	82	1	Calao	Dumangas	1.50	\N	Solano, Harvey Kim Jr.	\N	69	Aj Kim Carlos	06-30-18-012-399131	Aj Kim Carlos	06-30-18-012-399131	t	\N	\N	f	f	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 15:09:23.222207	2025-12-02 15:09:23.222207	\N	\N	\N
83	69	83	2	Balabag	Dumangas	1.50	\N	Solano, Harvey Kim Jr.	\N	69	Aj Kim Carlos	06-30-18-012-399131	Aj Kim Carlos	06-30-18-012-399131	t	\N	\N	f	f	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 15:09:23.222207	2025-12-02 15:09:23.222207	\N	\N	\N
84	70	84	1	Calao	Dumangas	1.50	\N	Carlos, Aj Kim	\N	70	Regin  Cabacas	06-30-18-022-581229	Regin  Cabacas	06-30-18-022-581229	t	\N	\N	f	f	f	\N	\N		f	f	2025-12-02	\N	t	NEW	\N	\N	2025-12-02 15:26:26.3126	2025-12-02 15:26:26.3126	\N	\N	\N
\.


--
-- TOC entry 6113 (class 0 OID 24643)
-- Dependencies: 220
-- Data for Name: masterlist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.masterlist ("FFRS System Generated", "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "FARMER ADDRESS 1", "FARMER ADDRESS 2", "FARMER ADDRESS 3", "PARCEL NO.", "PARCEL ADDRESS", "PARCEL AREA", id, status, "STATUS") FROM stdin;
\.


--
-- TOC entry 6130 (class 0 OID 67163)
-- Dependencies: 242
-- Data for Name: ownership_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ownership_transfers (id, from_farmer_id, to_farmer_id, transfer_date, transfer_type, transfer_reason, documents, processed_by, created_at, notes) FROM stdin;
2	6	8	2025-11-13	ownership_change	Legal Transfer	\N	\N	2025-11-13 20:11:23.591128	Transferred 1 parcel(s): IDs 7
3	9	13	2025-12-02	ownership_change	Legal Transfer	\N	\N	2025-12-02 10:16:48.344073	Transferred 1 parcel(s): IDs 11
4	20	67	2025-12-02	ownership_change	Death	\N	\N	2025-12-02 14:07:51.482321	Transferred 1 parcel(s): IDs 36
5	60	67	2025-12-02	ownership_change	Death	\N	\N	2025-12-02 14:13:35.739055	Transferred 1 parcel(s): IDs 28
6	31	66	2025-12-02	ownership_change	Inheritance	\N	\N	2025-12-02 14:18:12.830399	Transferred 1 parcel(s): IDs 35
7	64	67	2025-12-02	ownership_change	Inheritance	\N	\N	2025-12-02 14:20:17.990825	Transferred 1 parcel(s): IDs 75
8	68	69	2025-12-02	ownership_change	Death	\N	\N	2025-12-02 15:22:01.045388	Transferred 1 parcel(s): IDs 80
\.


--
-- TOC entry 6138 (class 0 OID 67314)
-- Dependencies: 250
-- Data for Name: priority_configurations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.priority_configurations (id, config_name, is_active, farm_area_weight, ownership_weight, history_weight, location_weight, crop_weight, farm_area_rules, ownership_rules, location_rules, description, created_at, updated_at) FROM stdin;
1	default_equity_based	t	30	25	20	15	10	{"<1ha": 30, ">3ha": 5, "1-2ha": 20, "2-3ha": 10}	{"lessee": 20, "tenant": 25, "usufructuary": 15, "registered_owner": 10}	{"remote": 15, "moderate": 10, "accessible": 5}	Default equity-based prioritization: Prioritizes small farmers, tenants, and remote areas	2025-11-16 19:11:59.574126	2025-11-16 19:11:59.574126
\.


--
-- TOC entry 6132 (class 0 OID 67245)
-- Dependencies: 244
-- Data for Name: regional_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.regional_allocations (id, season, allocation_date, season_start_date, season_end_date, urea_46_0_0_bags, complete_14_14_14_bags, complete_16_16_16_bags, ammonium_sulfate_21_0_0_bags, ammonium_phosphate_16_20_0_bags, muriate_potash_0_0_60_bags, rice_seeds_nsic_rc160_kg, rice_seeds_nsic_rc222_kg, rice_seeds_nsic_rc440_kg, corn_seeds_hybrid_kg, corn_seeds_opm_kg, vegetable_seeds_kg, notes, status, created_by, created_at, updated_at, jackpot_kg, us88_kg, th82_kg, rh9000_kg, lumping143_kg, lp296_kg) FROM stdin;
12	wet_2026	2026-05-01	\N	\N	1000	1000	0	1000	0	1000	0.00	0.00	0.00	0.00	0.00	0.00		active	\N	2025-11-28 09:40:25.329234	2025-11-29 09:57:08.046378	1000.00	1000.00	1000.00	1000.00	1000.00	1000.00
15	dry_2025	2025-12-02	\N	\N	57	50	0	53	0	60	0.00	0.00	0.00	0.00	0.00	0.00		active	\N	2025-12-02 08:06:56.090561	2025-12-02 13:25:11.801699	20.00	20.00	20.00	20.00	40.00	59.99
\.


--
-- TOC entry 6120 (class 0 OID 26239)
-- Dependencies: 232
-- Data for Name: rsbsa_farm_parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at) FROM stdin;
14	13	1	Cali	Dumangas	2.00	No		No	f	t	f	f	Iglesias, Jukka Anika Alex			2025-12-02 10:12:52.617089	2025-12-02 10:21:09.04498
11	13	1	Calao		6.00	No		No	t	f	f	f				2025-11-14 14:00:30.29604	2025-12-02 10:21:09.055217
15	46	1	Aurora-Del Pilar	Dumangas	2.50	No	TD-2015-0123	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
16	42	1	Bacay	Dumangas	1.80	No	TD-2018-0456	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
17	29	1	Balabag	Dumangas	2.00	No	TD-2012-0789	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
18	29	2	Balabag	Dumangas	1.20	No	TD-2016-0790	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
19	27	1	Bantud	Dumangas	2.10	No	TD-2017-1234	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
20	37	1	Baras	Dumangas	3.00	No	TD-2010-5678	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
21	37	2	Baras	Dumangas	1.50	No	TD-2014-5679	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
22	48	1	Barasan	Dumangas	1.50	No	TD-2019-9012	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
23	18	1	Bolilao	Dumangas	2.80	No	TD-2013-3456	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
24	14	1	Calao	Dumangas	1.20	No	TD-2020-7890	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
25	24	1	Cali	Dumangas	2.50	No	TD-2008-1122	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
26	24	2	Cali	Dumangas	1.20	No	TD-2011-1123	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
27	39	1	Cansilayan	Dumangas	2.30	No	TD-2016-3344	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
29	57	1	Cayos	Dumangas	2.60	No	\N	Yes	f	t	f	f	Dela Cruz, Juan	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
30	15	1	Compayan	Dumangas	1.40	No	\N	No	f	t	f	f	Santos, Roberto	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
31	63	1	Dacutan	Dumangas	3.10	No	TD-2019-7788	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
32	52	1	Ermita	Dumangas	2.40	No	\N	Yes	f	t	f	f	Hernandez, Pedro	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
33	36	1	Ilaya 1st	Dumangas	1.70	No	TD-2017-9900	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
34	30	1	Ilaya 2nd	Dumangas	3.50	No	\N	Yes	f	t	f	f	Aquino, Eduardo	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
37	19	1	Lacturan	Dumangas	1.60	No	\N	No	f	t	f	f	Torres, Alberto	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
38	59	1	Lopez Jaena - Rizal	Dumangas	2.90	No	\N	No	f	f	t	f	\N	Gonzales, Antonio	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
39	22	1	Managuit	Dumangas	1.30	No	TD-2021-5566	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
40	41	1	Maquina	Dumangas	3.80	No	\N	Yes	f	f	t	f	\N	Fernandez, Ricardo	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
41	28	1	Nanding Lopez	Dumangas	2.20	No	TD-2018-7788	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
42	16	1	Pagdugue	Dumangas	1.90	No	\N	No	f	t	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
43	33	1	Paloc Bigque	Dumangas	3.40	No	TD-2016-9900	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
44	51	1	Paloc Sool	Dumangas	2.70	No	\N	No	f	f	t	f	\N	Castillo, Manuel	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
45	35	1	Patlad	Dumangas	1.50	No	TD-2020-1122	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
46	45	1	Pd Monfort North	Dumangas	4.10	No	TD-2010-3344	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
47	43	1	Pd Monfort South	Dumangas	2.50	No	\N	No	f	t	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
48	61	1	Pulao	Dumangas	1.20	No	TD-2021-5566	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
49	50	1	Rosario	Dumangas	1.80	No	\N	No	f	t	f	f	Velasco, Gloria	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
50	55	1	Sapao	Dumangas	2.10	No	TD-2020-7788	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
51	17	1	Sulangan	Dumangas	1.40	No	\N	No	f	f	t	f	\N	Perez, Estrella	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
52	25	1	Tabucan	Dumangas	2.60	No	TD-2019-9900	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
53	56	1	Talusan	Dumangas	1.60	No	\N	No	f	t	f	f	Flores, Alberto	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
54	62	1	Tambobo	Dumangas	2.90	No	TD-2021-1122	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
55	44	1	Tamboilan	Dumangas	1.70	No	\N	No	f	f	t	f	\N	Cruz, Christian	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
3	2	1	Capaliz		2.00	No		No	t	f	f	f				2025-11-13 09:58:46.161041	2025-11-13 09:58:46.161041
4	4	1	Capaliz	Dumangas	2.00	No		No	f	t	f	f	Fournier, Justine Etta			2025-11-13 10:42:17.370016	2025-11-13 10:42:17.370016
56	23	1	Victorias	Dumangas	3.20	No	TD-2020-3344	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
57	40	1	Aurora-Del Pilar	Dumangas	2.00	No	\N	Yes	f	t	f	f	Dela Cruz, Juan	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
58	26	1	Bacay	Dumangas	3.00	No	TD-2005-5566	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
59	26	2	Bacay	Dumangas	2.20	No	TD-2007-5567	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
60	53	1	Bacong	Dumangas	2.50	No	TD-2006-7788	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
61	53	2	Bacong	Dumangas	1.30	No	TD-2008-7789	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
1	4	1	Burgos-Regidor		2.00	No		No	t	f	f	f				2025-11-13 09:44:49.676976	2025-11-13 09:44:49.676976
2	4	2	Calao		2.00	No		No	t	f	f	f				2025-11-13 09:44:49.676976	2025-11-13 09:44:49.676976
7	8	1	Cali		2.00	No		No	t	f	f	f				2025-11-13 19:27:26.149525	2025-11-13 19:27:26.149525
12	11	1	Burgos-Regidor	Dumangas	2.00	No		No	f	t	f	f	Ramos, Marja Ward Warden			2025-11-14 14:48:31.319129	2025-11-14 14:48:31.319129
13	12	1	Burgos-Regidor	Dumangas	2.00	No		No	f	f	t	f		Iglesias, Jukka Anika Alex		2025-11-14 14:56:34.970059	2025-11-26 08:59:29.726366
62	54	1	Balud	Dumangas	3.00	No	TD-2007-9900	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
63	54	2	Balud	Dumangas	1.60	No	TD-2009-9901	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
64	58	1	Bantud Fabrica	Dumangas	3.50	No	\N	Yes	f	t	f	f	Gonzales, Antonio	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
65	21	1	Basa-Mabini Bonifacio	Dumangas	3.20	No	TD-2004-1122	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
66	21	2	Basa-Mabini Bonifacio	Dumangas	1.70	No	TD-2006-1123	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
67	38	1	Buenaflor Embarkadero	Dumangas	2.80	No	\N	No	f	f	t	f	\N	Diaz, Marcelo	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
68	49	1	Burgos-Regidor	Dumangas	3.50	No	TD-2003-3344	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
69	49	2	Burgos-Regidor	Dumangas	2.00	No	TD-2005-3345	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
70	32	1	Calao	Dumangas	3.10	No	\N	Yes	f	t	f	f	Perez, Emilio	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
36	67	1	Jardin	Dumangas	4.20	No	TD-2009-3344	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
28	67	1	Capaliz	Dumangas	1.90	No	TD-2015-5566	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
35	66	1	Ilaya 3rd	Dumangas	2.00	No	TD-2020-1122	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
71	47	1	Cali	Dumangas	4.00	No	TD-2002-5566	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
72	47	2	Cali	Dumangas	2.20	No	TD-2004-5567	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
73	34	1	Cansilayan	Dumangas	2.80	No	TD-2010-7788	Yes	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
74	34	2	Cansilayan	Dumangas	1.50	No	TD-2012-7789	No	t	f	f	f	\N	\N	\N	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101
76	65	1	Calao	Dumangas	4.00	No		No	f	t	f	f	Gomez, Robert Magbanua Jr.			2025-12-02 13:18:08.457448	2025-12-02 13:18:08.457448
77	66	1	Calao	Dumangas	4.00	No		No	f	f	t	f		Gomez, Robert Magbanua Jr.		2025-12-02 13:29:50.732478	2025-12-02 13:29:50.732478
78	67	1	Bolilao		3.00	No		No	t	f	f	f				2025-12-02 13:42:09.544652	2025-12-02 13:42:09.544652
79	67	2	Cayos		4.00	No		No	t	f	f	f				2025-12-02 13:42:09.544652	2025-12-02 13:42:09.544652
75	67	1	Calao		4.00	No		No	t	f	f	f				2025-12-02 13:16:02.033714	2025-12-02 13:16:02.033714
81	68	2	Balabag		1.50	No		No	t	f	f	f				2025-12-02 15:02:31.201145	2025-12-02 15:02:31.201145
82	69	1	Calao	Dumangas	1.50	No		No	f	t	f	f	Solano, Harvey Kim Jr.			2025-12-02 15:09:23.222207	2025-12-02 15:09:23.222207
83	69	2	Balabag	Dumangas	1.50	No		No	f	t	f	f	Solano, Harvey Kim Jr.			2025-12-02 15:09:23.222207	2025-12-02 15:09:23.222207
80	69	1	Calao		1.50	No		No	t	f	f	f				2025-12-02 15:02:31.201145	2025-12-02 15:02:31.201145
84	70	1	Calao	Dumangas	1.50	No		No	f	t	f	f	Carlos, Aj Kim			2025-12-02 15:26:26.3126	2025-12-02 15:26:26.3126
\.


--
-- TOC entry 6118 (class 0 OID 26209)
-- Dependencies: 230
-- Data for Name: rsbsa_submission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") FROM stdin;
37	Hernandez	Pedro	Aquino	\N	Male	1970-09-14	Baras	Dumangas	Baras	4.50	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 11:34:51.955219	4.50	06-30-18-000-773814	53	f	f	f	\N	f	\N	f	\N
20	Aquino	Eduardo	Navarro	\N	Male	1966-08-12	Jardin	Dumangas	Jardin	4.20	farmer	f	f	f	No Parcels	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:34.333341	4.20	06-30-18-000-660501	57	f	f	f	\N	f	\N	f	\N
31	Flores	Angelina	Castro	\N	Female	1987-01-27	Ilaya 3rd	Dumangas	Ilaya 3rd	2.00	farmer	f	f	f	No Parcels	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:39.189153	2.00	06-30-18-000-655380	36	f	f	f	\N	f	\N	f	\N
66	Onorio	Alexa	Lopez		Female	1996-01-02	Calao	Dumangas	Calao, Dumangas	4	farmer	t	f	f	Active Farmer	2025-12-02 13:29:50.732478	2025-12-02 13:29:50.732478	2025-12-02 13:29:50.732478	4.00	06-30-18-012-664066	29	f	f	f	\N	f	\N	f	\N
64	Gomez	Robert	Magbanua	Jr.	Male	1986-02-28	Calao	Dumangas	Calao,	4	farmer	f	f	f	No Parcels	2025-12-02 13:16:02.033714	2025-12-02 13:16:02.033714	2025-12-02 13:16:02.033714	4.00	06-30-18-012-171686	39	f	f	f	\N	f	\N	f	\N
68	Solano	Harvey	Kim	Jr.	Male	2004-05-03	Calao	Dumangas	Calao,	1.5	farmer	t	f	f	Active Farmer	2025-12-02 15:02:31.201145	2025-12-02 15:02:31.201145	2025-12-02 15:32:17.986239	3.00	06-30-18-012-335180	21	f	f	f	\N	f	\N	f	\N
70	Cabacas	Regin			Male	2025-10-13	Tabucan	Dumangas	Calao, Dumangas	1.5	farmer	f	t	f	Active Farmer	2025-12-02 15:26:26.3126	2025-12-02 15:26:26.3126	2025-12-04 10:18:19.193112	1.50	06-30-18-022-581229	0	f	f	f	\N	f	\N	f	\N
11	Sala	Sakari	Kit		Female	\N	Old San Roque	Pili	Burgos-Regidor, Dumangas	2	farmer	f	t	f	Active Farmer	2025-11-14 14:48:31.319129	2025-11-14 14:48:31.319129	2025-11-14 14:48:31.319129	2.00	06-30-18-000-227179	55	f	f	f	\N	f	\N	f	\N
12	Thoms	Thomas	Click		Male	\N	Rm 409 Martinez Building, Dasmarinas Street,	Metro Manila	Burgos-Regidor, Dumangas	2.00	farmer	f	f	t	Active Farmer	2025-11-14 14:56:34.970059	2025-11-14 14:56:34.970059	2025-11-26 08:59:29.742796	2.00	06-30-18-000-535335	47	f	f	f	\N	f	\N	f	\N
2	Fournier	Justine	Etta		Male	\N	Balibago Rd.	Santa Rosa City	Capaliz,	2	farmer	t	f	f	Active Farmer	2025-11-13 09:58:46.161041	2025-11-13 09:58:46.161041	2025-11-13 18:53:36.881913	2.00	06-30-18-000-195225	45	f	f	f	\N	f	\N	f	\N
4	Ramos	Marja	Ward	Warden	Female	\N	Del Pilar Corner Zamora, Barangay 46	Leyte	Capaliz, Dumangas	2	farmer	t	f	f	Active Farmer	2025-11-13 10:42:17.370016	2025-11-13 10:42:17.370016	2025-11-13 18:53:36.207008	2.00	06-30-18-000-568491	52	f	f	f	\N	f	\N	f	\N
6	Marin	Matti	Nik	Niko	Male	\N	386-388 Q Paredes Binondo	Metro Manila	Cali,	2	farmer	f	f	f	No Parcels	2025-11-13 19:27:26.149525	2025-11-13 19:27:26.149525	2025-11-13 19:27:52.921043	2.00	06-30-18-000-578241	38	f	f	f	\N	f	\N	f	\N
8	Iglesias	Jukka	Anika	Alex	Male	\N	115 Valhalla St.,	Pasay City	Burgos-Regidor, Dumangas	2	farmer	t	f	f	Active Farmer	2025-11-13 19:50:23.343352	2025-11-13 19:50:23.343352	2025-11-13 19:50:23.343352	2.00	06-30-18-000-255768	49	f	f	f	\N	f	\N	f	\N
9	Arendt	Ensio	Idk	Jr.	Male	\N	G/f Interco Building, N. S. Valderrosa Street	Zamboanga del Sur	Calao,	5	farmer	f	f	f	No Parcels	2025-11-14 14:00:30.29604	2025-11-14 14:00:30.29604	2025-11-14 14:00:30.29604	5.00	06-30-18-000-099241	41	f	f	f	\N	f	\N	f	\N
14	Torres	Carmen	Ramos	\N	Female	1988-04-02	Calao	Dumangas	Calao	1.20	farmer	t	f	f	Not Active	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:20.655897	1.20	06-30-18-012-303879	35	f	f	f	\N	f	\N	f	\N
13	Hawkv	Kieron	Kim		Male	2001-02-02	Zayas Street, Carmen	Misamis Occidental	Cali, Dumangas	2.00, 6.00	farmer	t	f	f	Active Farmer	2025-12-02 10:12:52.617089	2025-12-02 10:12:52.617089	2025-12-02 10:21:09.056607	8.00	06-30-18-000-313533	24	f	f	f	\N	f	\N	f	\N
15	Morales	Jose	Diaz	\N	Male	1972-07-16	Compayan	Dumangas	Compayan	1.40	farmer	f	t	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:21.32106	1.40	06-30-18-000-389310	51	f	f	f	\N	f	\N	f	\N
16	Gomez	Carlos	Santos	\N	Male	1968-07-08	Pagdugue	Dumangas	Pagdugue	1.90	farmer	f	t	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:21.964771	1.90	06-30-18-000-758139	55	f	f	f	\N	f	\N	f	\N
30	Bautista	Fernando	Lopez	\N	Male	1974-09-01	Ilaya 2nd	Dumangas	Ilaya 2nd	3.50	farmer	f	t	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:24.05099	3.50	06-30-18-000-520866	49	f	f	f	\N	f	\N	f	\N
29	Santos	Roberto	Mendoza	\N	Male	1968-11-08	Balabag	Dumangas	Balabag	3.20	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:24.358883	3.20	06-30-18-004-352071	55	f	f	f	\N	f	\N	f	\N
28	Diaz	Luisa	Reyes	\N	Female	1985-02-13	Nanding Lopez	Dumangas	Nanding Lopez	2.20	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:24.676219	2.20	06-30-18-000-635174	38	f	f	f	\N	f	\N	f	\N
27	Garcia	Elena	Flores	\N	Female	1979-05-30	Bantud	Dumangas	Bantud	2.10	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:25.068583	2.10	06-30-18-006-223287	44	f	f	f	\N	f	\N	f	\N
26	Flores	Rodrigo	Diaz	\N	Male	1960-05-10	Bacay	Dumangas	Bacay	5.20	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:25.409923	5.20	06-30-18-002-995807	63	f	f	f	\N	f	\N	f	\N
25	Santos	Mark	Flores	\N	Male	1989-10-11	Tabucan	Dumangas	Tabucan	2.60	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:26.138788	2.60	06-30-18-022-642135	34	f	f	f	\N	f	\N	f	\N
24	Fernandez	Ricardo	Villanueva	\N	Male	1965-08-19	Cali	Dumangas	Cali	3.70	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:26.658494	3.70	06-30-18-000-171910	58	f	f	f	\N	f	\N	f	\N
23	Cruz	Christian	Santiago	\N	Male	1988-11-07	Victorias	Dumangas	Victorias	3.20	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:30.202567	3.20	06-30-18-000-831548	35	f	f	f	\N	f	\N	f	\N
22	Santiago	Rosario	Martinez	\N	Female	1989-06-18	Managuit	Dumangas	Managuit	1.30	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:30.628166	1.30	06-30-18-000-098387	34	f	f	f	\N	f	\N	f	\N
21	Santiago	Ernesto	Navarro	\N	Male	1961-11-03	Basa-Mabini Bonifacio	Dumangas	Basa-Mabini Bonifacio	4.90	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:30.930363	4.90	06-30-18-000-468430	62	f	f	f	\N	f	\N	f	\N
18	Gonzales	Antonio	Cruz	\N	Male	1973-12-25	Bolilao	Dumangas	Bolilao	2.80	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:32.242675	2.80	06-30-18-009-870756	50	f	f	f	\N	f	\N	f	\N
19	Ramos	Cristina	Fernandez	\N	Female	1984-12-05	Lacturan	Dumangas	Lacturan	1.60	farmer	f	t	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:33.515494	1.60	06-30-18-016-588052	39	f	f	f	\N	f	\N	f	\N
17	Reyes	Michelle	Bautista	\N	Female	1993-07-28	Sulangan	Dumangas	Sulangan	1.40	farmer	f	f	t	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:35.020253	1.40	06-30-18-000-341486	30	f	f	f	\N	f	\N	f	\N
32	Gomez	Amparo	Gonzales	\N	Female	1966-12-11	Calao	Dumangas	Calao	3.10	farmer	f	t	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:39.604503	3.10	06-30-18-012-265066	57	f	f	f	\N	f	\N	f	\N
33	Perez	Estrella	Dela Cruz	\N	Female	1982-11-26	Paloc Bigque	Dumangas	Paloc Bigque	3.40	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:40.057272	3.40	06-30-18-019-447384	41	f	f	f	\N	f	\N	f	\N
34	Castro	Remedios	Hernandez	\N	Female	1967-10-28	Cansilayan	Dumangas	Cansilayan	4.30	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:40.442778	4.30	06-30-18-000-742876	56	f	f	f	\N	f	\N	f	\N
35	Navarro	Norma	Castillo	\N	Female	1988-09-03	Patlad	Dumangas	Patlad	1.50	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:40.868032	1.50	06-30-18-000-937857	35	f	f	f	\N	f	\N	f	\N
36	Cruz	Violeta	Torres	\N	Female	1981-05-14	Ilaya 1st	Dumangas	Ilaya 1st	1.70	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:41.45046	1.70	06-30-18-000-787423	42	f	f	f	\N	f	\N	f	\N
38	Rivera	Felicitas	Torres	\N	Female	1965-03-25	Buenaflor Embarkadero	Dumangas	Buenaflor Embarkadero	2.80	farmer	f	f	t	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:42.722273	2.80	06-30-18-000-861298	58	f	f	f	\N	f	\N	f	\N
65	Robina	Emmar	Noelle		Male	2000-07-20	Calao	Dumangas	Calao, Dumangas	4	farmer	f	t	f	Active Farmer	2025-12-02 13:18:08.457448	2025-12-02 13:18:08.457448	2025-12-02 13:18:08.457448	4.00	06-30-18-012-947155	25	f	f	f	\N	f	\N	f	\N
60	Castillo	Manuel	Rivera	\N	Male	1977-02-28	Capaliz	Dumangas	Capaliz	1.90	farmer	f	f	f	No Parcels	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:37.450272	1.90	06-30-18-000-621183	46	f	f	f	\N	f	\N	f	\N
67	Marco	Lupin	Servita	III	Male	2000-02-24	Brgy. Maraguit	Cabatuan	Bolilao,	3, 4	farmer	t	f	f	Active Farmer	2025-12-02 13:42:09.544652	2025-12-02 13:42:09.544652	2025-12-02 13:42:09.544652	7.00	06-30-18-000-502359	25	f	f	f	\N	f	\N	f	\N
69	Carlos	Aj	Kim		Male	2004-07-15	Calao	Dumangas	Calao, Dumangas	1.5, 1.5	farmer	t	f	f	Active Farmer	2025-12-02 15:09:23.222207	2025-12-02 15:09:23.222207	2025-12-02 15:09:23.222207	3.00	06-30-18-012-399131	21	f	f	f	\N	f	\N	f	\N
58	Villanueva	Perpetua	Castro	\N	Female	1964-07-29	Bantud Fabrica	Dumangas	Bantud Fabrica	3.50	farmer	f	t	f	Submitted	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	3.50	06-30-18-007-047362	59	f	f	f	\N	f	\N	f	\N
63	Velasco	Gloria	Gomez	\N	Female	1986-03-09	Dacutan	Dumangas	Dacutan	3.10	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:28:52.3417	3.10	06-30-18-000-748405	37	f	f	f	\N	f	\N	f	\N
55	Hernandez	Ryan	Cruz	\N	Male	1991-04-15	Sapao	Dumangas	Sapao	2.10	farmer	t	f	f	Not Active	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:28:54.440564	2.10	06-30-18-021-579453	32	f	f	f	\N	f	\N	f	\N
56	Garcia	Anna	Aquino	\N	Female	1994-02-05	Talusan	Dumangas	Talusan	1.60	farmer	f	t	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:17.016084	1.60	06-30-18-000-919406	29	f	f	f	\N	f	\N	f	\N
57	Ramirez	Teresa	Morales	\N	Female	1983-10-07	Cayos	Dumangas	Cayos	2.60	farmer	f	t	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:17.867512	2.60	06-30-18-000-892572	40	f	f	f	\N	f	\N	f	\N
59	Villanueva	Miguel	Gonzales	\N	Male	1976-04-20	Lopez Jaena - Rizal	Dumangas	Lopez Jaena - Rizal	2.90	farmer	f	f	t	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:18.636068	2.90	06-30-18-000-486330	47	f	f	f	\N	f	\N	f	\N
62	Dela Cruz	Joseph	Ramos	\N	Male	1990-06-19	Tambobo	Dumangas	Tambobo	2.90	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:36.710493	2.90	06-30-18-000-340724	33	f	f	f	\N	f	\N	f	\N
61	Gonzales	Jerome	Velasco	\N	Male	1992-08-09	Pulao	Dumangas	Pulao	1.20	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:37.072948	1.20	06-30-18-020-349178	31	f	f	f	\N	f	\N	f	\N
39	Lopez	Lourdes	Santiago	\N	Female	1980-06-11	Cansilayan	Dumangas	Cansilayan	2.30	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:43.171118	2.30	06-30-18-000-678900	43	f	f	f	\N	f	\N	f	\N
40	Bautista	Sheryl	Rivera	\N	Female	1991-03-14	Aurora-Del Pilar	Dumangas	Aurora-Del Pilar	2.00	farmer	f	t	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:43.652099	2.00	06-30-18-001-054409	32	f	f	f	\N	f	\N	f	\N
41	Rivera	Benjamin	Hernandez	\N	Male	1971-10-31	Maquina	Dumangas	Maquina	3.80	farmer	f	f	t	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:44.354958	3.80	06-30-18-000-840583	52	f	f	f	\N	f	\N	f	\N
42	Reyes	Maria	Garcia	\N	Female	1982-07-22	Bacay	Dumangas	Bacay	1.80	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:44.604718	1.80	06-30-18-002-201823	41	f	f	f	\N	f	\N	f	\N
43	Lopez	Beatriz	Morales	\N	Female	1984-03-17	Pd Monfort South	Dumangas	Pd Monfort South	2.50	farmer	f	t	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:45.179452	2.50	06-30-18-000-319395	39	f	f	f	\N	f	\N	f	\N
44	Mendoza	Maria Fe	Villanueva	\N	Female	1992-09-23	Tamboilan	Dumangas	Tamboilan	1.70	farmer	f	f	t	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:45.668023	1.70	06-30-18-000-030015	31	f	f	f	\N	f	\N	f	\N
45	Torres	Alberto	Ramirez	\N	Male	1967-01-24	Pd Monfort North	Dumangas	Pd Monfort North	4.10	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:46.625331	4.10	06-30-18-000-544688	56	f	f	f	\N	f	\N	f	\N
46	Dela Cruz	Juan	Santos	\N	Male	1975-03-15	Aurora-Del Pilar	Dumangas	Aurora-Del Pilar	2.50	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:47.085836	2.50	06-30-18-001-401813	48	f	f	f	\N	f	\N	f	\N
48	Martinez	Rosa	Bautista	\N	Female	1985-01-18	Barasan	Dumangas	Barasan	1.50	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:47.79416	1.50	06-30-18-000-495254	38	f	f	f	\N	f	\N	f	\N
47	Perez	Emilio	Martinez	\N	Male	1958-04-07	Cali	Dumangas	Cali	6.20	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:48.065029	6.20	06-30-18-000-530729	65	f	f	f	\N	f	\N	f	\N
54	Ramos	Francisco	Perez	\N	Male	1962-01-16	Balud	Dumangas	Balud	4.60	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:49.41933	4.60	06-30-18-005-578283	61	f	f	f	\N	f	\N	f	\N
53	Aquino	Teresita	Gomez	\N	Female	1963-09-22	Bacong	Dumangas	Bacong	3.80	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:49.938886	3.80	06-30-18-003-978100	60	f	f	f	\N	f	\N	f	\N
51	Castro	Ramon	Garcia	\N	Male	1973-05-19	Paloc Sool	Dumangas	Paloc Sool	2.70	farmer	f	f	t	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:51.355891	2.70	06-30-18-000-475490	50	f	f	f	\N	f	\N	f	\N
49	Diaz	Marcelo	Lopez	\N	Male	1959-08-18	Burgos-Regidor	Dumangas	Burgos-Regidor	5.50	farmer	t	f	f	Active Farmer	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:52.083974	5.50	06-30-18-000-329720	64	f	f	f	\N	f	\N	f	\N
50	Martinez	Jennifer	Mendoza	\N	Female	1990-12-21	Rosario	Dumangas	Rosario	1.80	farmer	f	t	f	Not Active	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:52.744574	1.80	06-30-18-000-775104	33	f	f	f	\N	f	\N	f	\N
52	Mendoza	Alfredo	Perez	\N	Male	1969-11-23	Ermita	Dumangas	Ermita	2.40	farmer	f	t	f	Not Active	2025-12-02 10:24:49.373101	2025-12-02 10:24:49.373101	2025-12-02 10:29:53.609148	2.40	06-30-18-000-519107	54	f	f	f	\N	f	\N	f	\N
\.


--
-- TOC entry 5724 (class 0 OID 25007)
-- Dependencies: 222
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- TOC entry 6126 (class 0 OID 67108)
-- Dependencies: 238
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, email, password_hash, role, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 6245 (class 0 OID 0)
-- Dependencies: 227
-- Name: barangay_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.barangay_codes_id_seq', 118, true);


--
-- TOC entry 6246 (class 0 OID 0)
-- Dependencies: 247
-- Name: distribution_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.distribution_records_id_seq', 15, true);


--
-- TOC entry 6247 (class 0 OID 0)
-- Dependencies: 233
-- Name: farm_parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.farm_parcels_id_seq', 1, false);


--
-- TOC entry 6248 (class 0 OID 0)
-- Dependencies: 245
-- Name: farmer_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.farmer_requests_id_seq', 35, true);


--
-- TOC entry 6249 (class 0 OID 0)
-- Dependencies: 239
-- Name: incentive_distribution_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.incentive_distribution_log_id_seq', 1, false);


--
-- TOC entry 6250 (class 0 OID 0)
-- Dependencies: 235
-- Name: land_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.land_history_id_seq', 84, true);


--
-- TOC entry 6251 (class 0 OID 0)
-- Dependencies: 226
-- Name: masterlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.masterlist_id_seq', 1, false);


--
-- TOC entry 6252 (class 0 OID 0)
-- Dependencies: 241
-- Name: ownership_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ownership_transfers_id_seq', 8, true);


--
-- TOC entry 6253 (class 0 OID 0)
-- Dependencies: 249
-- Name: priority_configurations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.priority_configurations_id_seq', 1, true);


--
-- TOC entry 6254 (class 0 OID 0)
-- Dependencies: 243
-- Name: regional_allocations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.regional_allocations_id_seq', 16, true);


--
-- TOC entry 6255 (class 0 OID 0)
-- Dependencies: 231
-- Name: rsbsa_farm_parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsa_farm_parcels_id_seq', 84, true);


--
-- TOC entry 6256 (class 0 OID 0)
-- Dependencies: 229
-- Name: rsbsa_submission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsa_submission_id_seq', 70, true);


--
-- TOC entry 6257 (class 0 OID 0)
-- Dependencies: 237
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- TOC entry 5851 (class 2606 OID 26049)
-- Name: barangay_codes barangay_codes_barangay_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_barangay_code_key UNIQUE (barangay_code);


--
-- TOC entry 5853 (class 2606 OID 26047)
-- Name: barangay_codes barangay_codes_barangay_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_barangay_name_key UNIQUE (barangay_name);


--
-- TOC entry 5855 (class 2606 OID 26045)
-- Name: barangay_codes barangay_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 5937 (class 2606 OID 67305)
-- Name: distribution_records distribution_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records
    ADD CONSTRAINT distribution_records_pkey PRIMARY KEY (id);


--
-- TOC entry 5939 (class 2606 OID 67307)
-- Name: distribution_records distribution_records_voucher_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records
    ADD CONSTRAINT distribution_records_voucher_code_key UNIQUE (voucher_code);


--
-- TOC entry 5888 (class 2606 OID 26304)
-- Name: farm_parcels farm_parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels
    ADD CONSTRAINT farm_parcels_pkey PRIMARY KEY (id);


--
-- TOC entry 5931 (class 2606 OID 67287)
-- Name: farmer_requests farmer_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_requests
    ADD CONSTRAINT farmer_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 5919 (class 2606 OID 67142)
-- Name: incentive_distribution_log incentive_distribution_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT incentive_distribution_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5902 (class 2606 OID 31628)
-- Name: land_history land_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5847 (class 2606 OID 25803)
-- Name: masterlist masterlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterlist
    ADD CONSTRAINT masterlist_pkey PRIMARY KEY (id);


--
-- TOC entry 5924 (class 2606 OID 67171)
-- Name: ownership_transfers ownership_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_pkey PRIMARY KEY (id);


--
-- TOC entry 5942 (class 2606 OID 67331)
-- Name: priority_configurations priority_configurations_config_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priority_configurations
    ADD CONSTRAINT priority_configurations_config_name_key UNIQUE (config_name);


--
-- TOC entry 5944 (class 2606 OID 67329)
-- Name: priority_configurations priority_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priority_configurations
    ADD CONSTRAINT priority_configurations_pkey PRIMARY KEY (id);


--
-- TOC entry 5927 (class 2606 OID 67268)
-- Name: regional_allocations regional_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regional_allocations
    ADD CONSTRAINT regional_allocations_pkey PRIMARY KEY (id);


--
-- TOC entry 5886 (class 2606 OID 26254)
-- Name: rsbsa_farm_parcels rsbsa_farm_parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT rsbsa_farm_parcels_pkey PRIMARY KEY (id);


--
-- TOC entry 5877 (class 2606 OID 31594)
-- Name: rsbsa_submission rsbsa_submission_FFRS_CODE_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission
    ADD CONSTRAINT "rsbsa_submission_FFRS_CODE_key" UNIQUE ("FFRS_CODE");


--
-- TOC entry 5879 (class 2606 OID 26223)
-- Name: rsbsa_submission rsbsa_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission
    ADD CONSTRAINT rsbsa_submission_pkey PRIMARY KEY (id);


--
-- TOC entry 5929 (class 2606 OID 67270)
-- Name: regional_allocations unique_season; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regional_allocations
    ADD CONSTRAINT unique_season UNIQUE (season);


--
-- TOC entry 5907 (class 2606 OID 67122)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5909 (class 2606 OID 67118)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5911 (class 2606 OID 67120)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 5925 (class 1259 OID 67336)
-- Name: idx_allocations_season; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocations_season ON public.regional_allocations USING btree (season);


--
-- TOC entry 5940 (class 1259 OID 67337)
-- Name: idx_distributions_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_distributions_request ON public.distribution_records USING btree (request_id);


--
-- TOC entry 5912 (class 1259 OID 67157)
-- Name: idx_incentive_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_created ON public.incentive_distribution_log USING btree (created_at);


--
-- TOC entry 5913 (class 1259 OID 67156)
-- Name: idx_incentive_encoder; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_encoder ON public.incentive_distribution_log USING btree (encoder_id);


--
-- TOC entry 5914 (class 1259 OID 67154)
-- Name: idx_incentive_event_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_event_date ON public.incentive_distribution_log USING btree (event_date);


--
-- TOC entry 5915 (class 1259 OID 67158)
-- Name: idx_incentive_farmer_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_farmer_date ON public.incentive_distribution_log USING btree (farmer_id, event_date DESC);


--
-- TOC entry 5916 (class 1259 OID 67153)
-- Name: idx_incentive_farmer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_farmer_id ON public.incentive_distribution_log USING btree (farmer_id);


--
-- TOC entry 5917 (class 1259 OID 67155)
-- Name: idx_incentive_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_type ON public.incentive_distribution_log USING btree (incentive_type);


--
-- TOC entry 5889 (class 1259 OID 31654)
-- Name: idx_land_history_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_barangay ON public.land_history USING btree (farm_location_barangay);


--
-- TOC entry 5890 (class 1259 OID 31658)
-- Name: idx_land_history_change_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_change_type ON public.land_history USING btree (change_type);


--
-- TOC entry 5891 (class 1259 OID 31659)
-- Name: idx_land_history_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_created_at ON public.land_history USING btree (created_at);


--
-- TOC entry 5892 (class 1259 OID 31660)
-- Name: idx_land_history_current_records; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_current_records ON public.land_history USING btree (farm_parcel_id, is_current) WHERE (is_current = true);


--
-- TOC entry 5893 (class 1259 OID 31650)
-- Name: idx_land_history_farm_parcel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farm_parcel ON public.land_history USING btree (farm_parcel_id);


--
-- TOC entry 5894 (class 1259 OID 31651)
-- Name: idx_land_history_farmer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farmer_id ON public.land_history USING btree (farmer_id);


--
-- TOC entry 5895 (class 1259 OID 31653)
-- Name: idx_land_history_farmer_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farmer_name ON public.land_history USING btree (farmer_name);


--
-- TOC entry 5896 (class 1259 OID 31656)
-- Name: idx_land_history_is_current; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_is_current ON public.land_history USING btree (is_current);


--
-- TOC entry 5897 (class 1259 OID 31652)
-- Name: idx_land_history_land_owner_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_land_owner_name ON public.land_history USING btree (land_owner_name);


--
-- TOC entry 5898 (class 1259 OID 31655)
-- Name: idx_land_history_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_municipality ON public.land_history USING btree (farm_location_municipality);


--
-- TOC entry 5899 (class 1259 OID 31657)
-- Name: idx_land_history_period_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_period_dates ON public.land_history USING btree (period_start_date, period_end_date);


--
-- TOC entry 5900 (class 1259 OID 31649)
-- Name: idx_land_history_rsbsa_submission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_rsbsa_submission ON public.land_history USING btree (rsbsa_submission_id);


--
-- TOC entry 5920 (class 1259 OID 67184)
-- Name: idx_ownership_transfers_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_date ON public.ownership_transfers USING btree (transfer_date);


--
-- TOC entry 5921 (class 1259 OID 67182)
-- Name: idx_ownership_transfers_from_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_from_farmer ON public.ownership_transfers USING btree (from_farmer_id);


--
-- TOC entry 5922 (class 1259 OID 67183)
-- Name: idx_ownership_transfers_to_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_to_farmer ON public.ownership_transfers USING btree (to_farmer_id);


--
-- TOC entry 5932 (class 1259 OID 67335)
-- Name: idx_requests_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_farmer ON public.farmer_requests USING btree (farmer_id);


--
-- TOC entry 5933 (class 1259 OID 67334)
-- Name: idx_requests_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_priority ON public.farmer_requests USING btree (priority_score DESC);


--
-- TOC entry 5934 (class 1259 OID 67332)
-- Name: idx_requests_season; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_season ON public.farmer_requests USING btree (season);


--
-- TOC entry 5935 (class 1259 OID 67333)
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_status ON public.farmer_requests USING btree (status);


--
-- TOC entry 5880 (class 1259 OID 26264)
-- Name: idx_rsbsa_farm_parcels_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_area ON public.rsbsa_farm_parcels USING btree (total_farm_area_ha);


--
-- TOC entry 5881 (class 1259 OID 26262)
-- Name: idx_rsbsa_farm_parcels_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_barangay ON public.rsbsa_farm_parcels USING btree (farm_location_barangay);


--
-- TOC entry 5882 (class 1259 OID 26263)
-- Name: idx_rsbsa_farm_parcels_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_municipality ON public.rsbsa_farm_parcels USING btree (farm_location_municipality);


--
-- TOC entry 5883 (class 1259 OID 26261)
-- Name: idx_rsbsa_farm_parcels_parcel_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_parcel_number ON public.rsbsa_farm_parcels USING btree (parcel_number);


--
-- TOC entry 5884 (class 1259 OID 26260)
-- Name: idx_rsbsa_farm_parcels_submission_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_submission_id ON public.rsbsa_farm_parcels USING btree (submission_id);


--
-- TOC entry 5856 (class 1259 OID 26230)
-- Name: idx_rsbsa_submission_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_barangay ON public.rsbsa_submission USING btree ("BARANGAY");


--
-- TOC entry 5857 (class 1259 OID 26229)
-- Name: idx_rsbsa_submission_birthday; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_birthday ON public.rsbsa_submission USING btree ("BIRTHDATE");


--
-- TOC entry 5858 (class 1259 OID 26227)
-- Name: idx_rsbsa_submission_ext_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_ext_name ON public.rsbsa_submission USING btree ("EXT NAME");


--
-- TOC entry 5859 (class 1259 OID 26232)
-- Name: idx_rsbsa_submission_farm_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farm_location ON public.rsbsa_submission USING btree ("FARM LOCATION");


--
-- TOC entry 5860 (class 1259 OID 67382)
-- Name: idx_rsbsa_submission_farmer_corn; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_corn ON public.rsbsa_submission USING btree ("FARMER_CORN");


--
-- TOC entry 5861 (class 1259 OID 67384)
-- Name: idx_rsbsa_submission_farmer_livestock; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_livestock ON public.rsbsa_submission USING btree ("FARMER_LIVESTOCK");


--
-- TOC entry 5862 (class 1259 OID 67383)
-- Name: idx_rsbsa_submission_farmer_other_crops; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_other_crops ON public.rsbsa_submission USING btree ("FARMER_OTHER_CROPS");


--
-- TOC entry 5863 (class 1259 OID 67385)
-- Name: idx_rsbsa_submission_farmer_poultry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_poultry ON public.rsbsa_submission USING btree ("FARMER_POULTRY");


--
-- TOC entry 5864 (class 1259 OID 67381)
-- Name: idx_rsbsa_submission_farmer_rice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_rice ON public.rsbsa_submission USING btree ("FARMER_RICE");


--
-- TOC entry 5865 (class 1259 OID 31595)
-- Name: idx_rsbsa_submission_ffrs_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_ffrs_code ON public.rsbsa_submission USING btree ("FFRS_CODE");


--
-- TOC entry 5866 (class 1259 OID 26225)
-- Name: idx_rsbsa_submission_first_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_first_name ON public.rsbsa_submission USING btree ("FIRST NAME");


--
-- TOC entry 5867 (class 1259 OID 26228)
-- Name: idx_rsbsa_submission_gender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_gender ON public.rsbsa_submission USING btree ("GENDER");


--
-- TOC entry 5868 (class 1259 OID 26224)
-- Name: idx_rsbsa_submission_last_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_last_name ON public.rsbsa_submission USING btree ("LAST NAME");


--
-- TOC entry 5869 (class 1259 OID 26234)
-- Name: idx_rsbsa_submission_main_livelihood; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_main_livelihood ON public.rsbsa_submission USING btree ("MAIN LIVELIHOOD");


--
-- TOC entry 5870 (class 1259 OID 26226)
-- Name: idx_rsbsa_submission_middle_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_middle_name ON public.rsbsa_submission USING btree ("MIDDLE NAME");


--
-- TOC entry 5871 (class 1259 OID 26231)
-- Name: idx_rsbsa_submission_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_municipality ON public.rsbsa_submission USING btree ("MUNICIPALITY");


--
-- TOC entry 5872 (class 1259 OID 31668)
-- Name: idx_rsbsa_submission_parcel_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_parcel_area ON public.rsbsa_submission USING btree ("PARCEL AREA");


--
-- TOC entry 5873 (class 1259 OID 26235)
-- Name: idx_rsbsa_submission_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_status ON public.rsbsa_submission USING btree (status);


--
-- TOC entry 5874 (class 1259 OID 26236)
-- Name: idx_rsbsa_submission_submitted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_submitted_at ON public.rsbsa_submission USING btree (submitted_at);


--
-- TOC entry 5875 (class 1259 OID 26237)
-- Name: idx_rsbsa_submission_total_farm_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_total_farm_area ON public.rsbsa_submission USING btree ("TOTAL FARM AREA");


--
-- TOC entry 5903 (class 1259 OID 67124)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 5904 (class 1259 OID 67125)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 5905 (class 1259 OID 67123)
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- TOC entry 5962 (class 2620 OID 67160)
-- Name: incentive_distribution_log trg_incentive_log_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_incentive_log_updated BEFORE UPDATE ON public.incentive_distribution_log FOR EACH ROW EXECUTE FUNCTION public.update_incentive_log_timestamp();


--
-- TOC entry 5961 (class 2620 OID 67127)
-- Name: users trg_users_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_users_timestamp();


--
-- TOC entry 5958 (class 2620 OID 31665)
-- Name: rsbsa_farm_parcels trigger_create_land_history_on_parcel_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_create_land_history_on_parcel_insert AFTER INSERT ON public.rsbsa_farm_parcels FOR EACH ROW EXECUTE FUNCTION public.create_land_history_from_farm_parcel();


--
-- TOC entry 5957 (class 2620 OID 31599)
-- Name: rsbsa_submission trigger_generate_ffrs_code; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_generate_ffrs_code BEFORE INSERT ON public.rsbsa_submission FOR EACH ROW EXECUTE FUNCTION public.generate_ffrs_code_trigger();


--
-- TOC entry 5959 (class 2620 OID 31667)
-- Name: rsbsa_farm_parcels trigger_update_land_history_on_parcel_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_land_history_on_parcel_update AFTER UPDATE ON public.rsbsa_farm_parcels FOR EACH ROW EXECUTE FUNCTION public.update_land_history_from_farm_parcel();


--
-- TOC entry 5960 (class 2620 OID 31663)
-- Name: land_history trigger_update_land_history_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_land_history_timestamp BEFORE UPDATE ON public.land_history FOR EACH ROW EXECUTE FUNCTION public.update_land_history_timestamp();


--
-- TOC entry 5956 (class 2606 OID 67308)
-- Name: distribution_records distribution_records_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records
    ADD CONSTRAINT distribution_records_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.farmer_requests(id) ON DELETE CASCADE;


--
-- TOC entry 5946 (class 2606 OID 26305)
-- Name: farm_parcels farm_parcels_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels
    ADD CONSTRAINT farm_parcels_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5955 (class 2606 OID 67288)
-- Name: farmer_requests farmer_requests_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_requests
    ADD CONSTRAINT farmer_requests_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;


--
-- TOC entry 5951 (class 2606 OID 67148)
-- Name: incentive_distribution_log fk_encoder; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT fk_encoder FOREIGN KEY (encoder_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5952 (class 2606 OID 67143)
-- Name: incentive_distribution_log fk_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT fk_farmer FOREIGN KEY (farmer_id) REFERENCES public.masterlist(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5953 (class 2606 OID 67172)
-- Name: ownership_transfers fk_from_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT fk_from_farmer FOREIGN KEY (from_farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5954 (class 2606 OID 67177)
-- Name: ownership_transfers fk_to_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT fk_to_farmer FOREIGN KEY (to_farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5947 (class 2606 OID 31634)
-- Name: land_history land_history_farm_parcel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_farm_parcel_id_fkey FOREIGN KEY (farm_parcel_id) REFERENCES public.rsbsa_farm_parcels(id) ON DELETE CASCADE;


--
-- TOC entry 5948 (class 2606 OID 31639)
-- Name: land_history land_history_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;


--
-- TOC entry 5949 (class 2606 OID 31644)
-- Name: land_history land_history_previous_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_previous_record_id_fkey FOREIGN KEY (previous_record_id) REFERENCES public.land_history(id) ON DELETE SET NULL;


--
-- TOC entry 5950 (class 2606 OID 31629)
-- Name: land_history land_history_rsbsa_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_rsbsa_submission_id_fkey FOREIGN KEY (rsbsa_submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5945 (class 2606 OID 26255)
-- Name: rsbsa_farm_parcels rsbsa_farm_parcels_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT rsbsa_farm_parcels_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


-- Completed on 2025-12-07 06:43:30

--
-- PostgreSQL database dump complete
--

