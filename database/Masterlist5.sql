--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2026-01-30 20:28:29

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
-- TOC entry 6168 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- TOC entry 786 (class 1255 OID 31664)
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
-- TOC entry 6169 (class 0 OID 0)
-- Dependencies: 786
-- Name: FUNCTION create_land_history_from_farm_parcel(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_land_history_from_farm_parcel() IS 'Automatically creates land history record when a new farm parcel is added';


--
-- TOC entry 999 (class 1255 OID 31596)
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
-- TOC entry 540 (class 1255 OID 31598)
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
-- TOC entry 653 (class 1255 OID 31661)
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
-- TOC entry 365 (class 1255 OID 31597)
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
-- TOC entry 733 (class 1255 OID 67159)
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
-- TOC entry 509 (class 1255 OID 31666)
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
-- TOC entry 6170 (class 0 OID 0)
-- Dependencies: 509
-- Name: FUNCTION update_land_history_from_farm_parcel(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_land_history_from_farm_parcel() IS 'Automatically updates land history when farm parcel ownership changes';


--
-- TOC entry 261 (class 1255 OID 31662)
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
-- TOC entry 553 (class 1255 OID 67126)
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
-- TOC entry 6171 (class 0 OID 0)
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
-- TOC entry 6172 (class 0 OID 0)
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
-- TOC entry 6173 (class 0 OID 0)
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
-- TOC entry 6174 (class 0 OID 0)
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
-- TOC entry 6175 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE farmer_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.farmer_requests IS 'Individual farmer requests for agricultural inputs with priority scoring';


--
-- TOC entry 6176 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN farmer_requests.priority_score; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.farmer_requests.priority_score IS 'Auto-calculated score (0-100) based on priority criteria';


--
-- TOC entry 6177 (class 0 OID 0)
-- Dependencies: 246
-- Name: COLUMN farmer_requests.priority_rank; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.farmer_requests.priority_rank IS 'Rank after sorting all farmers (1=highest priority)';


--
-- TOC entry 6178 (class 0 OID 0)
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
-- TOC entry 6179 (class 0 OID 0)
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
-- TOC entry 6180 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE incentive_distribution_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.incentive_distribution_log IS 'Records completed physical incentive distributions. NO online requests or approvals.';


--
-- TOC entry 6181 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.farmer_id IS 'Reference to masterlist farmer';


--
-- TOC entry 6182 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.event_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.event_date IS 'Date of physical distribution event';


--
-- TOC entry 6183 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.incentive_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.incentive_type IS 'e.g., "Rice Seeds 20kg", "Fertilizer 50kg"';


--
-- TOC entry 6184 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.qty_requested; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.qty_requested IS 'Amount farmer requested at event';


--
-- TOC entry 6185 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.qty_received; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.qty_received IS 'Actual amount distributed (may be less due to shortage)';


--
-- TOC entry 6186 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.is_signed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.is_signed IS 'Confirms farmer signed paper receipt. MUST be true.';


--
-- TOC entry 6187 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN incentive_distribution_log.note; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.incentive_distribution_log.note IS 'Optional notes, e.g., "Shortage: only 15kg available"';


--
-- TOC entry 6188 (class 0 OID 0)
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
-- TOC entry 6189 (class 0 OID 0)
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
-- TOC entry 6190 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE land_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.land_history IS 'Comprehensive land ownership and tenancy history tracking system';


--
-- TOC entry 6191 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.rsbsa_submission_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.rsbsa_submission_id IS 'Link to the RSBSA submission that created or updated this record';


--
-- TOC entry 6192 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.farm_parcel_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farm_parcel_id IS 'Link to the specific farm parcel in rsbsa_farm_parcels';


--
-- TOC entry 6193 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.land_owner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.land_owner_id IS 'ID of the legal land owner (may be different from farmer)';


--
-- TOC entry 6194 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.land_owner_name IS 'Name of the legal land owner';


--
-- TOC entry 6195 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farmer_id IS 'ID of the person farming the land (from rsbsa_submission)';


--
-- TOC entry 6196 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.farmer_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.farmer_name IS 'Name of the person actually farming the land';


--
-- TOC entry 6197 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.is_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_tenant IS 'TRUE if farmer is renting from land owner';


--
-- TOC entry 6198 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.is_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_lessee IS 'TRUE if farmer is leasing from land owner';


--
-- TOC entry 6199 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.is_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_registered_owner IS 'TRUE if farmer is the registered owner';


--
-- TOC entry 6200 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.period_start_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.period_start_date IS 'Start date of this ownership/tenancy arrangement';


--
-- TOC entry 6201 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.period_end_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.period_end_date IS 'End date (NULL if currently active)';


--
-- TOC entry 6202 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.is_current; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.is_current IS 'TRUE if this is the current/active record';


--
-- TOC entry 6203 (class 0 OID 0)
-- Dependencies: 236
-- Name: COLUMN land_history.change_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_history.change_type IS 'Type of change: NEW, OWNERSHIP_CHANGE, TENANT_CHANGE, UPDATE, TERMINATION';


--
-- TOC entry 6204 (class 0 OID 0)
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
-- TOC entry 6205 (class 0 OID 0)
-- Dependencies: 235
-- Name: land_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.land_history_id_seq OWNED BY public.land_history.id;


--
-- TOC entry 251 (class 1259 OID 67386)
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


ALTER TABLE public.land_plots OWNER TO postgres;

--
-- TOC entry 6206 (class 0 OID 0)
-- Dependencies: 251
-- Name: TABLE land_plots; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.land_plots IS 'Stores land plot/farm parcel geographic and ownership data';


--
-- TOC entry 6207 (class 0 OID 0)
-- Dependencies: 251
-- Name: COLUMN land_plots.geometry_postgis; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.land_plots.geometry_postgis IS 'PostGIS geometry column storing spatial data. Enables spatial queries like area calculation, overlap detection, and proximity analysis.';


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
-- TOC entry 6208 (class 0 OID 0)
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
-- TOC entry 6209 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE ownership_transfers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ownership_transfers IS 'Tracks land ownership transfer history between farmers';


--
-- TOC entry 6210 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.from_farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.from_farmer_id IS 'ID of the farmer transferring ownership (original owner)';


--
-- TOC entry 6211 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.to_farmer_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.to_farmer_id IS 'ID of the farmer receiving ownership (new owner)';


--
-- TOC entry 6212 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.transfer_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_date IS 'Date when the ownership transfer occurred';


--
-- TOC entry 6213 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.transfer_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_type IS 'Type of transfer: ownership_change, inheritance, sale, donation, agrarian_reform';


--
-- TOC entry 6214 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN ownership_transfers.transfer_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ownership_transfers.transfer_reason IS 'Detailed reason for the transfer (free text)';


--
-- TOC entry 6215 (class 0 OID 0)
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
-- TOC entry 6216 (class 0 OID 0)
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
-- TOC entry 6217 (class 0 OID 0)
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
-- TOC entry 6218 (class 0 OID 0)
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
-- TOC entry 6219 (class 0 OID 0)
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
-- TOC entry 6220 (class 0 OID 0)
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
    tenant_land_owner_id bigint,
    lessee_land_owner_id bigint,
    CONSTRAINT rsbsa_farm_parcels_agrarian_reform_beneficiary_check CHECK (((agrarian_reform_beneficiary)::text = ANY ((ARRAY['Yes'::character varying, 'No'::character varying])::text[]))),
    CONSTRAINT rsbsa_farm_parcels_within_ancestral_domain_check CHECK (((within_ancestral_domain)::text = ANY ((ARRAY['Yes'::character varying, 'No'::character varying])::text[])))
);


ALTER TABLE public.rsbsa_farm_parcels OWNER TO postgres;

--
-- TOC entry 6221 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE rsbsa_farm_parcels; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rsbsa_farm_parcels IS 'Stores individual farm parcels for each RSBSA submission';


--
-- TOC entry 6222 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.submission_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.submission_id IS 'Reference to the main RSBSA submission';


--
-- TOC entry 6223 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.parcel_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.parcel_number IS 'Parcel number (1, 2, 3, etc.)';


--
-- TOC entry 6224 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.farm_location_barangay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.farm_location_barangay IS 'Barangay where the farm parcel is located';


--
-- TOC entry 6225 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.farm_location_municipality; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.farm_location_municipality IS 'Municipality where the farm parcel is located';


--
-- TOC entry 6226 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.total_farm_area_ha; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.total_farm_area_ha IS 'Area of this specific parcel in hectares';


--
-- TOC entry 6227 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.within_ancestral_domain; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.within_ancestral_domain IS 'Whether this parcel is within ancestral domain';


--
-- TOC entry 6228 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_document_no; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_document_no IS 'Document number proving ownership of this parcel';


--
-- TOC entry 6229 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.agrarian_reform_beneficiary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.agrarian_reform_beneficiary IS 'Whether the farmer is an agrarian reform beneficiary for this parcel';


--
-- TOC entry 6230 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_registered_owner IS 'Whether the farmer is the registered owner of this parcel';


--
-- TOC entry 6231 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_tenant IS 'Whether the farmer is a tenant of this parcel';


--
-- TOC entry 6232 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_lessee IS 'Whether the farmer is a lessee of this parcel';


--
-- TOC entry 6233 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_others; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_others IS 'Whether the farmer has other ownership type for this parcel';


--
-- TOC entry 6234 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.tenant_land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.tenant_land_owner_name IS 'Name of land owner if farmer is a tenant';


--
-- TOC entry 6235 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.lessee_land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.lessee_land_owner_name IS 'Name of land owner if farmer is a lessee';


--
-- TOC entry 6236 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.ownership_others_specify; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_others_specify IS 'Specification of other ownership type';


--
-- TOC entry 6237 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.tenant_land_owner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.tenant_land_owner_id IS 'Foreign key reference to the land owner (rsbsa_submission.id) if farmer is a tenant. Automatically set to NULL when land owner is deleted.';


--
-- TOC entry 6238 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN rsbsa_farm_parcels.lessee_land_owner_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.lessee_land_owner_id IS 'Foreign key reference to the land owner (rsbsa_submission.id) if farmer is a lessee. Automatically set to NULL when land owner is deleted.';


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
-- TOC entry 6239 (class 0 OID 0)
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
-- TOC entry 6240 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE rsbsa_submission; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rsbsa_submission IS 'Structured RSBSA submission table with farming activity tracking';


--
-- TOC entry 6241 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission.id IS 'Unique identifier for the submission';


--
-- TOC entry 6242 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."LAST NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."LAST NAME" IS 'Last name of the farmer';


--
-- TOC entry 6243 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FIRST NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FIRST NAME" IS 'First name of the farmer';


--
-- TOC entry 6244 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."MIDDLE NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MIDDLE NAME" IS 'Middle name of the farmer';


--
-- TOC entry 6245 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."EXT NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."EXT NAME" IS 'Extension name of the farmer';


--
-- TOC entry 6246 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."GENDER"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."GENDER" IS 'Gender of the farmer';


--
-- TOC entry 6247 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."BIRTHDATE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."BIRTHDATE" IS 'Birthdate of the farmer';


--
-- TOC entry 6248 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."BARANGAY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."BARANGAY" IS 'Barangay of the farmer';


--
-- TOC entry 6249 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."MUNICIPALITY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MUNICIPALITY" IS 'Municipality of the farmer';


--
-- TOC entry 6250 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARM LOCATION"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARM LOCATION" IS 'Farm location of the farmer';


--
-- TOC entry 6251 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."PARCEL AREA"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."PARCEL AREA" IS 'Area of the farm parcel';


--
-- TOC entry 6252 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."MAIN LIVELIHOOD"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MAIN LIVELIHOOD" IS 'Main livelihood of the farmer';


--
-- TOC entry 6253 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."TOTAL FARM AREA"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."TOTAL FARM AREA" IS 'Total farm area in hectares (sum of all parcels for this farmer)';


--
-- TOC entry 6254 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FFRS_CODE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FFRS_CODE" IS 'Unique FFRS code in format 06-30-18-XXX-YYYYYY where XXX is barangay code and YYYYYY is person code';


--
-- TOC entry 6255 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_RICE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_RICE" IS 'Indicates if farmer grows rice';


--
-- TOC entry 6256 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_CORN"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_CORN" IS 'Indicates if farmer grows corn';


--
-- TOC entry 6257 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_OTHER_CROPS"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_OTHER_CROPS" IS 'Indicates if farmer grows other crops';


--
-- TOC entry 6258 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_OTHER_CROPS_TEXT"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_OTHER_CROPS_TEXT" IS 'Specific other crops grown';


--
-- TOC entry 6259 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_LIVESTOCK"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_LIVESTOCK" IS 'Indicates if farmer raises livestock';


--
-- TOC entry 6260 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_LIVESTOCK_TEXT"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_LIVESTOCK_TEXT" IS 'Specific livestock types';


--
-- TOC entry 6261 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN rsbsa_submission."FARMER_POULTRY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARMER_POULTRY" IS 'Indicates if farmer raises poultry';


--
-- TOC entry 6262 (class 0 OID 0)
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
-- TOC entry 6263 (class 0 OID 0)
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
-- TOC entry 6264 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'System users for authentication and authorization';


--
-- TOC entry 6265 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.id IS 'Unique user identifier';


--
-- TOC entry 6266 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.username; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.username IS 'Unique username for login';


--
-- TOC entry 6267 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.email IS 'Unique email address';


--
-- TOC entry 6268 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.password_hash IS 'Bcrypt hashed password';


--
-- TOC entry 6269 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.role IS 'User role: admin, technician, jo, encoder, farmer, lgu';


--
-- TOC entry 6270 (class 0 OID 0)
-- Dependencies: 238
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.created_at IS 'Account creation timestamp';


--
-- TOC entry 6271 (class 0 OID 0)
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
-- TOC entry 6272 (class 0 OID 0)
-- Dependencies: 237
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 252 (class 1259 OID 67414)
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


ALTER VIEW public.v_tenant_lessee_relationships OWNER TO postgres;

--
-- TOC entry 5735 (class 2604 OID 26042)
-- Name: barangay_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes ALTER COLUMN id SET DEFAULT nextval('public.barangay_codes_id_seq'::regclass);


--
-- TOC entry 5829 (class 2604 OID 67297)
-- Name: distribution_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records ALTER COLUMN id SET DEFAULT nextval('public.distribution_records_id_seq'::regclass);


--
-- TOC entry 5757 (class 2604 OID 26292)
-- Name: farm_parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels ALTER COLUMN id SET DEFAULT nextval('public.farm_parcels_id_seq'::regclass);


--
-- TOC entry 5808 (class 2604 OID 67275)
-- Name: farmer_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_requests ALTER COLUMN id SET DEFAULT nextval('public.farmer_requests_id_seq'::regclass);


--
-- TOC entry 5779 (class 2604 OID 67132)
-- Name: incentive_distribution_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log ALTER COLUMN id SET DEFAULT nextval('public.incentive_distribution_log_id_seq'::regclass);


--
-- TOC entry 5765 (class 2604 OID 31612)
-- Name: land_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history ALTER COLUMN id SET DEFAULT nextval('public.land_history_id_seq'::regclass);


--
-- TOC entry 5733 (class 2604 OID 25801)
-- Name: masterlist id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterlist ALTER COLUMN id SET DEFAULT nextval('public.masterlist_id_seq'::regclass);


--
-- TOC entry 5783 (class 2604 OID 67166)
-- Name: ownership_transfers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers ALTER COLUMN id SET DEFAULT nextval('public.ownership_transfers_id_seq'::regclass);


--
-- TOC entry 5834 (class 2604 OID 67317)
-- Name: priority_configurations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priority_configurations ALTER COLUMN id SET DEFAULT nextval('public.priority_configurations_id_seq'::regclass);


--
-- TOC entry 5785 (class 2604 OID 67248)
-- Name: regional_allocations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regional_allocations ALTER COLUMN id SET DEFAULT nextval('public.regional_allocations_id_seq'::regclass);


--
-- TOC entry 5750 (class 2604 OID 26242)
-- Name: rsbsa_farm_parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels ALTER COLUMN id SET DEFAULT nextval('public.rsbsa_farm_parcels_id_seq'::regclass);


--
-- TOC entry 5737 (class 2604 OID 26212)
-- Name: rsbsa_submission id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission ALTER COLUMN id SET DEFAULT nextval('public.rsbsa_submission_id_seq'::regclass);


--
-- TOC entry 5776 (class 2604 OID 67111)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 6139 (class 0 OID 26039)
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
-- TOC entry 6159 (class 0 OID 67294)
-- Dependencies: 248
-- Data for Name: distribution_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.distribution_records (id, request_id, distribution_date, fertilizer_type, fertilizer_bags_given, seed_type, seed_kg_given, voucher_code, qr_code_data, claimed, claim_date, farmer_signature, verified_by, verification_notes, created_at) FROM stdin;
\.


--
-- TOC entry 6145 (class 0 OID 26289)
-- Dependencies: 234
-- Data for Name: farm_parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_city_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 6157 (class 0 OID 67272)
-- Dependencies: 246
-- Data for Name: farmer_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.farmer_requests (id, season, request_date, farmer_id, farmer_name, barangay, farm_area_ha, crop_type, ownership_type, num_parcels, fertilizer_requested, seeds_requested, request_notes, priority_score, priority_rank, assigned_fertilizer_type, assigned_fertilizer_bags, assigned_seed_type, assigned_seed_kg, fertilizer_accepted, seeds_accepted, rejection_reason, status, created_by, created_at, updated_at, requested_urea_bags, requested_complete_14_bags, requested_complete_16_bags, requested_ammonium_sulfate_bags, requested_ammonium_phosphate_bags, requested_muriate_potash_bags, requested_jackpot_kg, requested_us88_kg, requested_th82_kg, requested_rh9000_kg, requested_lumping143_kg, requested_lp296_kg) FROM stdin;
37	dry_2026	2026-01-22	74	Villanueva, Rosa	Baras	0.00	Rice	Owner	1	t	t	\N	0	\N	\N	\N	\N	\N	\N	\N	\N	pending	\N	2026-01-22 09:45:39.978769	2026-01-22 09:45:39.978769	4.00	4.00	0.00	0.00	0.00	0.00	0.00	4.00	4.00	0.00	0.00	4.00
\.


--
-- TOC entry 6151 (class 0 OID 67129)
-- Dependencies: 240
-- Data for Name: incentive_distribution_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incentive_distribution_log (id, farmer_id, event_date, incentive_type, qty_requested, qty_received, is_signed, note, encoder_id, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 6147 (class 0 OID 31609)
-- Dependencies: 236
-- Data for Name: land_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.land_history (id, rsbsa_submission_id, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, land_owner_id, land_owner_name, land_owner_ffrs_code, farmer_id, farmer_name, farmer_ffrs_code, tenant_name, tenant_ffrs_code, is_tenant, lessee_name, lessee_ffrs_code, is_lessee, is_registered_owner, is_other_ownership, ownership_type_details, ownership_document_type, ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain, period_start_date, period_end_date, is_current, change_type, change_reason, previous_record_id, created_at, updated_at, created_by, updated_by, notes) FROM stdin;
88	74	88	1	Baras	Dumangas	2.00	\N	Rosa Torres Villanueva	06-30-18-000-580447	74	Rosa Torres Villanueva	06-30-18-000-580447	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
89	75	89	1	Bolilao	Dumangas	4.50	\N	Roberto Aquino Fernandez	06-30-18-009-913582	75	Roberto Aquino Fernandez	06-30-18-009-913582	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
90	76	90	1	Calao	Dumangas	1.50	\N	Carmen Ramos Lopez	06-30-18-012-959123	76	Carmen Ramos Lopez	06-30-18-012-959123	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
91	77	91	1	Cali	Dumangas	2.80	\N	Antonio Castro Bautista	06-30-18-000-688797	77	Antonio Castro Bautista	06-30-18-000-688797	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
92	78	92	1	Cansilayan	Dumangas	2.20	\N	Elena Santiago Gonzales	06-30-18-000-560415	78	Elena Santiago Gonzales	06-30-18-000-560415	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
93	79	93	1	Capaliz	Dumangas	3.00	\N	Ricardo Navarro Flores	06-30-18-000-309460	79	Ricardo Navarro Flores	06-30-18-000-309460	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
94	80	94	1	Cayos	Dumangas	1.90	\N	Gloria Mercado Diaz	06-30-18-000-462796	80	Gloria Mercado Diaz	06-30-18-000-462796	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
95	81	95	1	Compayan	Dumangas	2.70	\N	Miguel Pascual Soriano	06-30-18-000-130691	81	Miguel Pascual Soriano	06-30-18-000-130691	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
96	82	96	1	Dacutan	Dumangas	1.60	\N	Luz Valencia Castillo	06-30-18-000-354801	82	Luz Valencia Castillo	06-30-18-000-354801	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
97	83	97	1	Ermita	Dumangas	3.50	\N	Jose Morales Hernandez	06-30-18-000-942303	83	Jose Morales Hernandez	06-30-18-000-942303	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
98	84	98	1	Ilaya 1st	Dumangas	2.10	\N	Teresita Domingo Valdez	06-30-18-000-597170	84	Teresita Domingo Valdez	06-30-18-000-597170	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
99	85	99	1	Ilaya 2nd	Dumangas	2.90	\N	Fernando Cruz Aguilar	06-30-18-000-945966	85	Fernando Cruz Aguilar	06-30-18-000-945966	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
100	86	100	1	Ilaya 3rd	Dumangas	1.40	\N	Angelica Miranda Robles	06-30-18-000-399760	86	Angelica Miranda Robles	06-30-18-000-399760	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
101	87	101	1	Jardin	Dumangas	3.30	\N	Eduardo Gutierrez Santiago	06-30-18-000-446719	87	Eduardo Gutierrez Santiago	06-30-18-000-446719	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
102	88	102	1	Lacturan	Dumangas	2.30	\N	Imelda Ocampo Jimenez	06-30-18-016-660893	88	Imelda Ocampo Jimenez	06-30-18-016-660893	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
103	89	103	1	Managuit	Dumangas	4.00	\N	Ramon Perez Del Rosario	06-30-18-000-090304	89	Ramon Perez Del Rosario	06-30-18-000-090304	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
104	90	104	1	Maquina	Dumangas	1.70	\N	Nora Rivera Salazar	06-30-18-000-026948	90	Nora Rivera Salazar	06-30-18-000-026948	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
105	91	105	1	Nanding Lopez	Dumangas	3.80	\N	Alfredo Silva Romero	06-30-18-000-634038	91	Alfredo Silva Romero	06-30-18-000-634038	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
106	92	106	1	Pagdugue	Dumangas	2.00	\N	Josefina Alvarez Velasco	06-30-18-000-822424	92	Josefina Alvarez Velasco	06-30-18-000-822424	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
107	93	107	1	Paloc Bigque	Dumangas	2.60	\N	Daniel Iglesias Medina	06-30-18-019-495378	93	Daniel Iglesias Medina	06-30-18-019-495378	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
108	94	108	1	Paloc Sool	Dumangas	1.80	\N	Corazon Tan Manalo	06-30-18-000-971461	94	Corazon Tan Manalo	06-30-18-000-971461	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
109	95	109	1	Patlad	Dumangas	3.10	\N	Vicente Rosales Paguio	06-30-18-000-463111	95	Vicente Rosales Paguio	06-30-18-000-463111	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
110	96	110	1	Pulao	Dumangas	2.40	\N	Amelita Gomez Cordero	06-30-18-020-919404	96	Amelita Gomez Cordero	06-30-18-020-919404	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
111	97	111	1	Rosario	Dumangas	2.90	\N	Benjamin Laurel Padilla	06-30-18-000-128144	97	Benjamin Laurel Padilla	06-30-18-000-128144	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
112	98	112	1	Sapao	Dumangas	1.50	\N	Lydia Cabrera Marquez	06-30-18-021-832580	98	Lydia Cabrera Marquez	06-30-18-021-832580	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
113	99	113	1	Sulangan	Dumangas	4.20	\N	Ronaldo Abad Enriquez	06-30-18-000-182702	99	Ronaldo Abad Enriquez	06-30-18-000-182702	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
114	100	114	1	Tabucan	Dumangas	2.10	\N	Rosario Suarez Lim	06-30-18-022-450982	100	Rosario Suarez Lim	06-30-18-022-450982	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
115	101	115	1	Talusan	Dumangas	3.40	\N	Ernesto Villar Magno	06-30-18-000-510376	101	Ernesto Villar Magno	06-30-18-000-510376	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
116	102	116	1	Tambobo	Dumangas	1.60	\N	Divina Pascual Ocampo	06-30-18-000-233008	102	Divina Pascual Ocampo	06-30-18-000-233008	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
117	103	117	1	Tamboilan	Dumangas	3.60	\N	Rodrigo Luna Prado	06-30-18-000-713431	103	Rodrigo Luna Prado	06-30-18-000-713431	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
118	104	118	1	Victorias	Dumangas	2.30	\N	Estrella Solis Ibarra	06-30-18-000-443727	104	Estrella Solis Ibarra	06-30-18-000-443727	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
119	105	119	1	Bacong	Dumangas	3.90	\N	Gregorio Ortega Navarro	06-30-18-003-174339	105	Gregorio Ortega Navarro	06-30-18-003-174339	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
120	106	120	1	Balud	Dumangas	1.70	\N	Pacita Zamora Villareal	06-30-18-005-801864	106	Pacita Zamora Villareal	06-30-18-005-801864	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
121	107	121	1	Bantud Fabrica	Dumangas	4.10	\N	Leonido Delgado Caballero	06-30-18-007-879578	107	Leonido Delgado Caballero	06-30-18-007-879578	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
122	108	122	1	Barasan	Dumangas	1.90	\N	Violeta Reyes Paredes	06-30-18-000-397732	108	Violeta Reyes Paredes	06-30-18-000-397732	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
123	109	123	1	Aurora-Del Pilar	Dumangas	2.80	\N	Ignacio Natividad Benitez	06-30-18-001-108771	109	Ignacio Natividad Benitez	06-30-18-001-108771	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
124	110	124	1	Bacay	Dumangas	1.80	\N	Milagros Carreon Arellano	06-30-18-002-262330	110	Milagros Carreon Arellano	06-30-18-002-262330	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
125	111	125	1	Balabag	Dumangas	3.70	\N	Nestor Gallardo Palma	06-30-18-004-080485	111	Nestor Gallardo Palma	06-30-18-004-080485	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
126	112	126	1	Bantud	Dumangas	2.20	\N	Felicidad Cortez Espinosa	06-30-18-006-016134	112	Felicidad Cortez Espinosa	06-30-18-006-016134	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
127	113	127	1	Baras	Dumangas	3.00	\N	Arturo Mendoza Concepcion	06-30-18-000-568536	113	Arturo Mendoza Concepcion	06-30-18-000-568536	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
128	114	128	1	Bolilao	Dumangas	1.50	\N	Esperanza Bautista Trinidad	06-30-18-009-570924	114	Esperanza Bautista Trinidad	06-30-18-009-570924	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
129	115	129	1	Calao	Dumangas	4.30	\N	Rodolfo Vitug Buenaventura	06-30-18-012-451231	115	Rodolfo Vitug Buenaventura	06-30-18-012-451231	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
130	116	130	1	Cali	Dumangas	2.00	\N	Soledad De Leon Guerrero	06-30-18-000-621945	116	Soledad De Leon Guerrero	06-30-18-000-621945	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
131	117	131	1	Cansilayan	Dumangas	3.20	\N	Arsenio Salvador Montero	06-30-18-000-705489	117	Arsenio Salvador Montero	06-30-18-000-705489	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
132	118	132	1	Capaliz	Dumangas	1.60	\N	Basilisa De Guzman Navales	06-30-18-000-810863	118	Basilisa De Guzman Navales	06-30-18-000-810863	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
133	119	133	1	Cayos	Dumangas	3.50	\N	Wilfredo Aquino Macapagal	06-30-18-000-172443	119	Wilfredo Aquino Macapagal	06-30-18-000-172443	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
134	120	134	1	Compayan	Dumangas	2.50	\N	Zenaida Quinto Laurente	06-30-18-000-542838	120	Zenaida Quinto Laurente	06-30-18-000-542838	\N	\N	f	\N	\N	f	t	f	\N	\N	\N	f	f	2025-12-07	\N	t	NEW	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N	\N
202	188	202	1	Baras	Dumangas	2.00	\N	Villanueva, Rosa Torres	\N	188	Mary Jane Serc Blanco	06-30-18-000-857480	Mary Jane Serc Blanco	06-30-18-000-857480	t	\N	\N	f	f	f	\N	\N		f	f	2026-01-29	\N	t	NEW	\N	\N	2026-01-29 05:23:01.47861	2026-01-29 05:23:01.47861	\N	\N	\N
\.


--
-- TOC entry 6162 (class 0 OID 67386)
-- Dependencies: 251
-- Data for Name: land_plots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.land_plots (id, name, ffrs_id, area, coordinate_accuracy, barangay, first_name, middle_name, surname, ext_name, gender, municipality, province, parcel_address, status, street, farm_type, plot_source, parcel_number, geometry, created_at, updated_at, geometry_postgis) FROM stdin;
shape-1769548305315-89a79077eaa7c			4.50	approximate	Bolilao	Roberto	Aquino	Fernandez		Male	Dumangas	Iloilo	Bolilao, Dumangas	Tenant		Irrigated	manual	1	{"type": "Polygon", "coordinates": [[[122.755294, 10.86901], [122.755788, 10.868704], [122.755562, 10.868114], [122.75552, 10.867609], [122.755219, 10.867187], [122.754285, 10.867788], [122.755294, 10.86901]]]}	2026-01-27 21:11:46.14	2026-01-27 21:11:46.14	0103000020E610000001000000070000005D37A5BC56B05E403ECBF3E0EEBC254064ADA1D45EB05E400BCF4BC5C6BC25406C06B8205BB05E4045662E7079BC254055DE8E705AB05E40376E313F37BC25405794128255B05E405F0839EFFFBB254041B7973446B05E40F5B86FB54EBC25405D37A5BC56B05E403ECBF3E0EEBC2540
shape-1769547200571-1cc6f91aea93c8			0.00	approximate	Baras	Rosa	Torres	Villanueva		Male	Dumangas	Iloilo	Baras, Dumangas	Tenant		Irrigated	manual	1	{"type": "Polygon", "coordinates": [[[122.708346, 10.828867], [122.708486, 10.828782], [122.708464, 10.828514], [122.708754, 10.828466], [122.708942, 10.829014], [122.708545, 10.829293], [122.708346, 10.828867]]]}	2026-01-27 20:53:21.638	2026-01-28 05:24:01.750859	0103000020E610000001000000070000002810768A55AD5E409F77634161A8254020EBA9D557AD5E40E606431D56A825402D99637957AD5E40698EACFC32A8254030BABC395CAD5E4025B20FB22CA82540B130444E5FAD5E4030DAE38574A82540A3AF20CD58AD5E407C9A931799A825402810768A55AD5E409F77634161A82540
shape-1768425620851-4fc9876656d5c			2.80	approximate	Cali	Antonio	Castro	Bautista		Male	Dumangas	Iloilo	Cali, Dumangas	Tenant		Irrigated	manual	1	{"type": "Polygon", "coordinates": [[[122.70504, 10.836841], [122.704053, 10.836135], [122.704332, 10.835629], [122.705212, 10.836293], [122.705319, 10.836472], [122.70504, 10.836841]]]}	2026-01-14 21:20:21.635	2026-01-14 21:20:21.635	0103000020E61000000100000006000000CC9717601FAD5E4064E76D6C76AC2540A56950340FAD5E40F91400E319AC2540AE6186C613AD5E40AA2D7590D7AB2540CB2F833122AD5E4059BF99982EAC2540D68F4DF223AD5E40180AD80E46AC2540CC9717601FAD5E4064E76D6C76AC2540
\.


--
-- TOC entry 6136 (class 0 OID 24643)
-- Dependencies: 220
-- Data for Name: masterlist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.masterlist ("FFRS System Generated", "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "FARMER ADDRESS 1", "FARMER ADDRESS 2", "FARMER ADDRESS 3", "PARCEL NO.", "PARCEL ADDRESS", "PARCEL AREA", id, status, "STATUS") FROM stdin;
\.


--
-- TOC entry 6153 (class 0 OID 67163)
-- Dependencies: 242
-- Data for Name: ownership_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ownership_transfers (id, from_farmer_id, to_farmer_id, transfer_date, transfer_type, transfer_reason, documents, processed_by, created_at, notes) FROM stdin;
\.


--
-- TOC entry 6161 (class 0 OID 67314)
-- Dependencies: 250
-- Data for Name: priority_configurations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.priority_configurations (id, config_name, is_active, farm_area_weight, ownership_weight, history_weight, location_weight, crop_weight, farm_area_rules, ownership_rules, location_rules, description, created_at, updated_at) FROM stdin;
1	default_equity_based	t	30	25	20	15	10	{"<1ha": 30, ">3ha": 5, "1-2ha": 20, "2-3ha": 10}	{"lessee": 20, "tenant": 25, "usufructuary": 15, "registered_owner": 10}	{"remote": 15, "moderate": 10, "accessible": 5}	Default equity-based prioritization: Prioritizes small farmers, tenants, and remote areas	2025-11-16 19:11:59.574126	2025-11-16 19:11:59.574126
\.


--
-- TOC entry 6155 (class 0 OID 67245)
-- Dependencies: 244
-- Data for Name: regional_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.regional_allocations (id, season, allocation_date, season_start_date, season_end_date, urea_46_0_0_bags, complete_14_14_14_bags, complete_16_16_16_bags, ammonium_sulfate_21_0_0_bags, ammonium_phosphate_16_20_0_bags, muriate_potash_0_0_60_bags, rice_seeds_nsic_rc160_kg, rice_seeds_nsic_rc222_kg, rice_seeds_nsic_rc440_kg, corn_seeds_hybrid_kg, corn_seeds_opm_kg, vegetable_seeds_kg, notes, status, created_by, created_at, updated_at, jackpot_kg, us88_kg, th82_kg, rh9000_kg, lumping143_kg, lp296_kg) FROM stdin;
19	dry_2026	2026-01-17	\N	\N	400	400	0	400	0	40	0.00	0.00	0.00	0.00	0.00	0.00		active	\N	2026-01-18 05:23:13.251534	2026-01-18 05:23:13.251534	40.00	40.00	40.00	40.00	40.00	39.98
\.


--
-- TOC entry 6143 (class 0 OID 26239)
-- Dependencies: 232
-- Data for Name: rsbsa_farm_parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at, tenant_land_owner_id, lessee_land_owner_id) FROM stdin;
88	74	1	Baras	Dumangas	2.00	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
89	75	1	Bolilao	Dumangas	4.50	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
90	76	1	Calao	Dumangas	1.50	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
91	77	1	Cali	Dumangas	2.80	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
92	78	1	Cansilayan	Dumangas	2.20	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
93	79	1	Capaliz	Dumangas	3.00	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
94	80	1	Cayos	Dumangas	1.90	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
95	81	1	Compayan	Dumangas	2.70	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
96	82	1	Dacutan	Dumangas	1.60	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
97	83	1	Ermita	Dumangas	3.50	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
98	84	1	Ilaya 1st	Dumangas	2.10	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
99	85	1	Ilaya 2nd	Dumangas	2.90	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
100	86	1	Ilaya 3rd	Dumangas	1.40	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
101	87	1	Jardin	Dumangas	3.30	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
102	88	1	Lacturan	Dumangas	2.30	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
103	89	1	Managuit	Dumangas	4.00	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
104	90	1	Maquina	Dumangas	1.70	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
105	91	1	Nanding Lopez	Dumangas	3.80	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
106	92	1	Pagdugue	Dumangas	2.00	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
107	93	1	Paloc Bigque	Dumangas	2.60	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
108	94	1	Paloc Sool	Dumangas	1.80	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
109	95	1	Patlad	Dumangas	3.10	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
110	96	1	Pulao	Dumangas	2.40	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
111	97	1	Rosario	Dumangas	2.90	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
112	98	1	Sapao	Dumangas	1.50	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
113	99	1	Sulangan	Dumangas	4.20	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
114	100	1	Tabucan	Dumangas	2.10	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
115	101	1	Talusan	Dumangas	3.40	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
116	102	1	Tambobo	Dumangas	1.60	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
117	103	1	Tamboilan	Dumangas	3.60	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
118	104	1	Victorias	Dumangas	2.30	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
119	105	1	Bacong	Dumangas	3.90	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
120	106	1	Balud	Dumangas	1.70	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
121	107	1	Bantud Fabrica	Dumangas	4.10	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
122	108	1	Barasan	Dumangas	1.90	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
123	109	1	Aurora-Del Pilar	Dumangas	2.80	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
124	110	1	Bacay	Dumangas	1.80	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
125	111	1	Balabag	Dumangas	3.70	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
126	112	1	Bantud	Dumangas	2.20	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
127	113	1	Baras	Dumangas	3.00	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
128	114	1	Bolilao	Dumangas	1.50	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
129	115	1	Calao	Dumangas	4.30	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
130	116	1	Cali	Dumangas	2.00	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
131	117	1	Cansilayan	Dumangas	3.20	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
132	118	1	Capaliz	Dumangas	1.60	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
133	119	1	Cayos	Dumangas	3.50	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
134	120	1	Compayan	Dumangas	2.50	\N	\N	\N	t	f	f	f	\N	\N	\N	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	\N	\N
202	188	1	Baras	Dumangas	2.00	No		No	f	t	f	f	Villanueva, Rosa Torres			2026-01-29 05:23:01.47861	2026-01-29 05:23:01.47861	\N	\N
\.


--
-- TOC entry 6141 (class 0 OID 26209)
-- Dependencies: 230
-- Data for Name: rsbsa_submission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA", "FFRS_CODE", age, "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT") FROM stdin;
74	Villanueva	Rosa	Torres	\N	Female	1979-05-18	Baras	Dumangas	Baras, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.00	06-30-18-000-580447	45	t	f	t	Vegetables	f	\N	f	\N
75	Fernandez	Roberto	Aquino	\N	Male	1985-09-12	Bolilao	Dumangas	Bolilao, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	4.50	06-30-18-009-913582	39	f	t	f	\N	t	Carabao	f	\N
76	Lopez	Carmen	Ramos	\N	Female	1990-02-28	Calao	Dumangas	Calao, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.50	06-30-18-012-959123	34	t	f	f	\N	f	\N	f	\N
77	Bautista	Antonio	Castro	\N	Male	1972-06-05	Cali	Dumangas	Cali, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.80	06-30-18-000-688797	52	t	t	f	\N	f	\N	f	\N
78	Gonzales	Elena	Santiago	\N	Female	1987-12-14	Cansilayan	Dumangas	Cansilayan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.20	06-30-18-000-560415	37	t	f	f	\N	f	\N	t	Chickens
79	Flores	Ricardo	Navarro	\N	Male	1980-04-20	Capaliz	Dumangas	Capaliz, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.00	06-30-18-000-309460	44	f	t	f	\N	f	\N	f	\N
80	Diaz	Gloria	Mercado	\N	Female	1976-08-30	Cayos	Dumangas	Cayos, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.90	06-30-18-000-462796	48	t	f	t	Tomatoes	f	\N	f	\N
82	Castillo	Luz	Valencia	\N	Female	1988-10-10	Dacutan	Dumangas	Dacutan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.60	06-30-18-000-354801	36	t	f	f	\N	f	\N	f	\N
83	Hernandez	Jose	Morales	\N	Male	1970-07-03	Ermita	Dumangas	Ermita, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.50	06-30-18-000-942303	54	f	t	f	\N	t	Goats	f	\N
84	Valdez	Teresita	Domingo	\N	Female	1981-03-19	Ilaya 1st	Dumangas	Ilaya 1st, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.10	06-30-18-000-597170	43	t	f	f	\N	f	\N	t	Ducks
85	Aguilar	Fernando	Cruz	\N	Male	1977-11-27	Ilaya 2nd	Dumangas	Ilaya 2nd, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.90	06-30-18-000-945966	47	t	t	f	\N	f	\N	f	\N
86	Robles	Angelica	Miranda	\N	Female	1992-05-08	Ilaya 3rd	Dumangas	Ilaya 3rd, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.40	06-30-18-000-399760	32	t	f	f	\N	f	\N	f	\N
87	Santiago	Eduardo	Gutierrez	\N	Male	1974-09-16	Jardin	Dumangas	Jardin, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.30	06-30-18-000-446719	50	f	t	f	\N	f	\N	f	\N
88	Jimenez	Imelda	Ocampo	\N	Female	1984-12-02	Lacturan	Dumangas	Lacturan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.30	06-30-18-016-660893	40	t	f	t	Eggplant	f	\N	f	\N
89	Del Rosario	Ramon	Perez	\N	Male	1969-02-11	Managuit	Dumangas	Managuit, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	4.00	06-30-18-000-090304	55	t	t	f	\N	f	\N	f	\N
90	Salazar	Nora	Rivera	\N	Female	1986-06-24	Maquina	Dumangas	Maquina, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.70	06-30-18-000-026948	38	t	f	f	\N	f	\N	f	\N
91	Romero	Alfredo	Silva	\N	Male	1978-08-07	Nanding Lopez	Dumangas	Nanding Lopez, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.80	06-30-18-000-634038	46	f	t	f	\N	t	Pigs	f	\N
92	Velasco	Josefina	Alvarez	\N	Female	1991-04-13	Pagdugue	Dumangas	Pagdugue, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.00	06-30-18-000-822424	33	t	f	f	\N	f	\N	t	Chickens
93	Medina	Daniel	Iglesias	\N	Male	1973-10-29	Paloc Bigque	Dumangas	Paloc Bigque, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.60	06-30-18-019-495378	51	t	t	f	\N	f	\N	f	\N
94	Manalo	Corazon	Tan	\N	Female	1989-01-17	Paloc Sool	Dumangas	Paloc Sool, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.80	06-30-18-000-971461	35	t	f	f	\N	f	\N	f	\N
95	Paguio	Vicente	Rosales	\N	Male	1971-07-21	Patlad	Dumangas	Patlad, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.10	06-30-18-000-463111	53	f	t	f	\N	f	\N	f	\N
96	Cordero	Amelita	Gomez	\N	Female	1985-11-09	Pulao	Dumangas	Pulao, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.40	06-30-18-020-919404	39	t	f	t	Okra	f	\N	f	\N
97	Padilla	Benjamin	Laurel	\N	Male	1976-03-26	Rosario	Dumangas	Rosario, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.90	06-30-18-000-128144	48	t	t	f	\N	f	\N	f	\N
98	Marquez	Lydia	Cabrera	\N	Female	1993-09-05	Sapao	Dumangas	Sapao, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.50	06-30-18-021-832580	31	t	f	f	\N	f	\N	f	\N
99	Enriquez	Ronaldo	Abad	\N	Male	1980-12-18	Sulangan	Dumangas	Sulangan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	4.20	06-30-18-000-182702	44	f	t	f	\N	t	Carabao	f	\N
100	Lim	Rosario	Suarez	\N	Female	1987-05-31	Tabucan	Dumangas	Tabucan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.10	06-30-18-022-450982	37	t	f	f	\N	f	\N	t	Ducks
101	Magno	Ernesto	Villar	\N	Male	1972-08-14	Talusan	Dumangas	Talusan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.40	06-30-18-000-510376	52	t	t	f	\N	f	\N	f	\N
102	Ocampo	Divina	Pascual	\N	Female	1990-10-22	Tambobo	Dumangas	Tambobo, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.60	06-30-18-000-233008	34	t	f	f	\N	f	\N	f	\N
103	Prado	Rodrigo	Luna	\N	Male	1975-04-06	Tamboilan	Dumangas	Tamboilan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.60	06-30-18-000-713431	49	f	t	f	\N	f	\N	f	\N
104	Ibarra	Estrella	Solis	\N	Female	1983-02-15	Victorias	Dumangas	Victorias, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.30	06-30-18-000-443727	41	t	f	t	Peppers	f	\N	f	\N
105	Navarro	Gregorio	Ortega	\N	Male	1969-06-11	Bacong	Dumangas	Bacong, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.90	06-30-18-003-174339	55	t	t	f	\N	f	\N	f	\N
106	Villareal	Pacita	Zamora	\N	Female	1988-07-28	Balud	Dumangas	Balud, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.70	06-30-18-005-801864	36	t	f	f	\N	f	\N	f	\N
107	Caballero	Leonido	Delgado	\N	Male	1977-09-03	Bantud Fabrica	Dumangas	Bantud Fabrica, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	4.10	06-30-18-007-879578	47	f	t	f	\N	t	Goats	f	\N
108	Paredes	Violeta	Reyes	\N	Female	1991-12-07	Barasan	Dumangas	Barasan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.90	06-30-18-000-397732	33	t	f	f	\N	f	\N	t	Chickens
81	Soriano	Miguel	Pascual	\N	Male	1983-01-25	Compayan	Dumangas	Compayan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2026-01-05 18:54:29.980864	2.70	06-30-18-000-130691	41	t	t	f	\N	f	\N	f	\N
188	Blanco	Mary Jane	Serc		Female	2026-01-06	Baras	Dumangas	Baras, Dumangas	2	farmer	f	t	f	Active Farmer	2026-01-29 05:23:01.47861	2026-01-29 05:23:01.47861	2026-01-29 05:23:01.47861	2.00	06-30-18-000-857480	0	t	t	f		f		f	
109	Benitez	Ignacio	Natividad	\N	Male	1974-01-19	Aurora-Del Pilar	Dumangas	Aurora-Del Pilar, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.80	06-30-18-001-108771	50	t	t	f	\N	f	\N	f	\N
110	Arellano	Milagros	Carreon	\N	Female	1986-11-25	Bacay	Dumangas	Bacay, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.80	06-30-18-002-262330	38	t	f	f	\N	f	\N	f	\N
111	Palma	Nestor	Gallardo	\N	Male	1970-05-14	Balabag	Dumangas	Balabag, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.70	06-30-18-004-080485	54	f	t	f	\N	f	\N	f	\N
112	Espinosa	Felicidad	Cortez	\N	Female	1982-03-09	Bantud	Dumangas	Bantud, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.20	06-30-18-006-016134	42	t	f	t	Bitter Gourd	f	\N	f	\N
113	Concepcion	Arturo	Mendoza	\N	Male	1979-10-01	Baras	Dumangas	Baras, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.00	06-30-18-000-568536	45	t	t	f	\N	f	\N	f	\N
114	Trinidad	Esperanza	Bautista	\N	Female	1992-06-16	Bolilao	Dumangas	Bolilao, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.50	06-30-18-009-570924	32	t	f	f	\N	f	\N	f	\N
115	Buenaventura	Rodolfo	Vitug	\N	Male	1973-08-23	Calao	Dumangas	Calao, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	4.30	06-30-18-012-451231	51	f	t	f	\N	t	Pigs	f	\N
116	Guerrero	Soledad	De Leon	\N	Female	1984-04-30	Cali	Dumangas	Cali, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.00	06-30-18-000-621945	40	t	f	f	\N	f	\N	t	Ducks
117	Montero	Arsenio	Salvador	\N	Male	1971-12-12	Cansilayan	Dumangas	Cansilayan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	3.20	06-30-18-000-705489	53	t	t	f	\N	f	\N	f	\N
118	Navales	Basilisa	De Guzman	\N	Female	1989-07-04	Capaliz	Dumangas	Capaliz, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	1.60	06-30-18-000-810863	35	t	f	f	\N	f	\N	f	\N
120	Laurente	Zenaida	Quinto	\N	Female	1985-09-29	Compayan	Dumangas	Compayan, Dumangas	\N	farmer	t	f	f	Active Farmer	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2.50	06-30-18-000-542838	39	t	f	t	String Beans	f	\N	f	\N
119	Macapagal	Wilfredo	Aquino	\N	Male	1976-02-20	Cayos	Dumangas	Cayos, Dumangas	\N	farmer	t	f	f	Not Active	2025-12-07 08:51:49.733464	2025-12-07 08:51:49.733464	2026-01-05 21:19:26.691854	3.50	06-30-18-000-172443	48	f	t	f	\N	f	\N	f	\N
\.


--
-- TOC entry 5732 (class 0 OID 25007)
-- Dependencies: 222
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- TOC entry 6149 (class 0 OID 67108)
-- Dependencies: 238
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, email, password_hash, role, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 6273 (class 0 OID 0)
-- Dependencies: 227
-- Name: barangay_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.barangay_codes_id_seq', 118, true);


--
-- TOC entry 6274 (class 0 OID 0)
-- Dependencies: 247
-- Name: distribution_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.distribution_records_id_seq', 15, true);


--
-- TOC entry 6275 (class 0 OID 0)
-- Dependencies: 233
-- Name: farm_parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.farm_parcels_id_seq', 1, false);


--
-- TOC entry 6276 (class 0 OID 0)
-- Dependencies: 245
-- Name: farmer_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.farmer_requests_id_seq', 37, true);


--
-- TOC entry 6277 (class 0 OID 0)
-- Dependencies: 239
-- Name: incentive_distribution_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.incentive_distribution_log_id_seq', 1, false);


--
-- TOC entry 6278 (class 0 OID 0)
-- Dependencies: 235
-- Name: land_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.land_history_id_seq', 202, true);


--
-- TOC entry 6279 (class 0 OID 0)
-- Dependencies: 226
-- Name: masterlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.masterlist_id_seq', 1, false);


--
-- TOC entry 6280 (class 0 OID 0)
-- Dependencies: 241
-- Name: ownership_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ownership_transfers_id_seq', 8, true);


--
-- TOC entry 6281 (class 0 OID 0)
-- Dependencies: 249
-- Name: priority_configurations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.priority_configurations_id_seq', 1, true);


--
-- TOC entry 6282 (class 0 OID 0)
-- Dependencies: 243
-- Name: regional_allocations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.regional_allocations_id_seq', 19, true);


--
-- TOC entry 6283 (class 0 OID 0)
-- Dependencies: 231
-- Name: rsbsa_farm_parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsa_farm_parcels_id_seq', 202, true);


--
-- TOC entry 6284 (class 0 OID 0)
-- Dependencies: 229
-- Name: rsbsa_submission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsa_submission_id_seq', 188, true);


--
-- TOC entry 6285 (class 0 OID 0)
-- Dependencies: 237
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- TOC entry 5861 (class 2606 OID 26049)
-- Name: barangay_codes barangay_codes_barangay_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_barangay_code_key UNIQUE (barangay_code);


--
-- TOC entry 5863 (class 2606 OID 26047)
-- Name: barangay_codes barangay_codes_barangay_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_barangay_name_key UNIQUE (barangay_name);


--
-- TOC entry 5865 (class 2606 OID 26045)
-- Name: barangay_codes barangay_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 5949 (class 2606 OID 67305)
-- Name: distribution_records distribution_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records
    ADD CONSTRAINT distribution_records_pkey PRIMARY KEY (id);


--
-- TOC entry 5951 (class 2606 OID 67307)
-- Name: distribution_records distribution_records_voucher_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records
    ADD CONSTRAINT distribution_records_voucher_code_key UNIQUE (voucher_code);


--
-- TOC entry 5900 (class 2606 OID 26304)
-- Name: farm_parcels farm_parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels
    ADD CONSTRAINT farm_parcels_pkey PRIMARY KEY (id);


--
-- TOC entry 5943 (class 2606 OID 67287)
-- Name: farmer_requests farmer_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_requests
    ADD CONSTRAINT farmer_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 5931 (class 2606 OID 67142)
-- Name: incentive_distribution_log incentive_distribution_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT incentive_distribution_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5914 (class 2606 OID 31628)
-- Name: land_history land_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5964 (class 2606 OID 67394)
-- Name: land_plots land_plots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_plots
    ADD CONSTRAINT land_plots_pkey PRIMARY KEY (id);


--
-- TOC entry 5857 (class 2606 OID 25803)
-- Name: masterlist masterlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterlist
    ADD CONSTRAINT masterlist_pkey PRIMARY KEY (id);


--
-- TOC entry 5936 (class 2606 OID 67171)
-- Name: ownership_transfers ownership_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_pkey PRIMARY KEY (id);


--
-- TOC entry 5954 (class 2606 OID 67331)
-- Name: priority_configurations priority_configurations_config_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priority_configurations
    ADD CONSTRAINT priority_configurations_config_name_key UNIQUE (config_name);


--
-- TOC entry 5956 (class 2606 OID 67329)
-- Name: priority_configurations priority_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.priority_configurations
    ADD CONSTRAINT priority_configurations_pkey PRIMARY KEY (id);


--
-- TOC entry 5939 (class 2606 OID 67268)
-- Name: regional_allocations regional_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regional_allocations
    ADD CONSTRAINT regional_allocations_pkey PRIMARY KEY (id);


--
-- TOC entry 5898 (class 2606 OID 26254)
-- Name: rsbsa_farm_parcels rsbsa_farm_parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT rsbsa_farm_parcels_pkey PRIMARY KEY (id);


--
-- TOC entry 5887 (class 2606 OID 31594)
-- Name: rsbsa_submission rsbsa_submission_FFRS_CODE_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission
    ADD CONSTRAINT "rsbsa_submission_FFRS_CODE_key" UNIQUE ("FFRS_CODE");


--
-- TOC entry 5889 (class 2606 OID 26223)
-- Name: rsbsa_submission rsbsa_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission
    ADD CONSTRAINT rsbsa_submission_pkey PRIMARY KEY (id);


--
-- TOC entry 5941 (class 2606 OID 67270)
-- Name: regional_allocations unique_season; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.regional_allocations
    ADD CONSTRAINT unique_season UNIQUE (season);


--
-- TOC entry 5919 (class 2606 OID 67122)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5921 (class 2606 OID 67118)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5923 (class 2606 OID 67120)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 5937 (class 1259 OID 67336)
-- Name: idx_allocations_season; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocations_season ON public.regional_allocations USING btree (season);


--
-- TOC entry 5952 (class 1259 OID 67337)
-- Name: idx_distributions_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_distributions_request ON public.distribution_records USING btree (request_id);


--
-- TOC entry 5924 (class 1259 OID 67157)
-- Name: idx_incentive_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_created ON public.incentive_distribution_log USING btree (created_at);


--
-- TOC entry 5925 (class 1259 OID 67156)
-- Name: idx_incentive_encoder; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_encoder ON public.incentive_distribution_log USING btree (encoder_id);


--
-- TOC entry 5926 (class 1259 OID 67154)
-- Name: idx_incentive_event_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_event_date ON public.incentive_distribution_log USING btree (event_date);


--
-- TOC entry 5927 (class 1259 OID 67158)
-- Name: idx_incentive_farmer_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_farmer_date ON public.incentive_distribution_log USING btree (farmer_id, event_date DESC);


--
-- TOC entry 5928 (class 1259 OID 67153)
-- Name: idx_incentive_farmer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_farmer_id ON public.incentive_distribution_log USING btree (farmer_id);


--
-- TOC entry 5929 (class 1259 OID 67155)
-- Name: idx_incentive_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_incentive_type ON public.incentive_distribution_log USING btree (incentive_type);


--
-- TOC entry 5901 (class 1259 OID 31654)
-- Name: idx_land_history_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_barangay ON public.land_history USING btree (farm_location_barangay);


--
-- TOC entry 5902 (class 1259 OID 31658)
-- Name: idx_land_history_change_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_change_type ON public.land_history USING btree (change_type);


--
-- TOC entry 5903 (class 1259 OID 31659)
-- Name: idx_land_history_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_created_at ON public.land_history USING btree (created_at);


--
-- TOC entry 5904 (class 1259 OID 31660)
-- Name: idx_land_history_current_records; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_current_records ON public.land_history USING btree (farm_parcel_id, is_current) WHERE (is_current = true);


--
-- TOC entry 5905 (class 1259 OID 31650)
-- Name: idx_land_history_farm_parcel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farm_parcel ON public.land_history USING btree (farm_parcel_id);


--
-- TOC entry 5906 (class 1259 OID 31651)
-- Name: idx_land_history_farmer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farmer_id ON public.land_history USING btree (farmer_id);


--
-- TOC entry 5907 (class 1259 OID 31653)
-- Name: idx_land_history_farmer_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_farmer_name ON public.land_history USING btree (farmer_name);


--
-- TOC entry 5908 (class 1259 OID 31656)
-- Name: idx_land_history_is_current; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_is_current ON public.land_history USING btree (is_current);


--
-- TOC entry 5909 (class 1259 OID 31652)
-- Name: idx_land_history_land_owner_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_land_owner_name ON public.land_history USING btree (land_owner_name);


--
-- TOC entry 5910 (class 1259 OID 31655)
-- Name: idx_land_history_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_municipality ON public.land_history USING btree (farm_location_municipality);


--
-- TOC entry 5911 (class 1259 OID 31657)
-- Name: idx_land_history_period_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_period_dates ON public.land_history USING btree (period_start_date, period_end_date);


--
-- TOC entry 5912 (class 1259 OID 31649)
-- Name: idx_land_history_rsbsa_submission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_history_rsbsa_submission ON public.land_history USING btree (rsbsa_submission_id);


--
-- TOC entry 5957 (class 1259 OID 67395)
-- Name: idx_land_plots_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_barangay ON public.land_plots USING btree (barangay);


--
-- TOC entry 5958 (class 1259 OID 67399)
-- Name: idx_land_plots_geometry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_geometry ON public.land_plots USING gin (geometry);


--
-- TOC entry 5959 (class 1259 OID 67401)
-- Name: idx_land_plots_geometry_postgis; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_geometry_postgis ON public.land_plots USING gist (geometry_postgis);


--
-- TOC entry 5960 (class 1259 OID 67396)
-- Name: idx_land_plots_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_municipality ON public.land_plots USING btree (municipality);


--
-- TOC entry 5961 (class 1259 OID 67397)
-- Name: idx_land_plots_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_status ON public.land_plots USING btree (status);


--
-- TOC entry 5962 (class 1259 OID 67398)
-- Name: idx_land_plots_surname; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_land_plots_surname ON public.land_plots USING btree (surname);


--
-- TOC entry 5932 (class 1259 OID 67184)
-- Name: idx_ownership_transfers_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_date ON public.ownership_transfers USING btree (transfer_date);


--
-- TOC entry 5933 (class 1259 OID 67182)
-- Name: idx_ownership_transfers_from_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_from_farmer ON public.ownership_transfers USING btree (from_farmer_id);


--
-- TOC entry 5934 (class 1259 OID 67183)
-- Name: idx_ownership_transfers_to_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ownership_transfers_to_farmer ON public.ownership_transfers USING btree (to_farmer_id);


--
-- TOC entry 5944 (class 1259 OID 67335)
-- Name: idx_requests_farmer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_farmer ON public.farmer_requests USING btree (farmer_id);


--
-- TOC entry 5945 (class 1259 OID 67334)
-- Name: idx_requests_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_priority ON public.farmer_requests USING btree (priority_score DESC);


--
-- TOC entry 5946 (class 1259 OID 67332)
-- Name: idx_requests_season; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_season ON public.farmer_requests USING btree (season);


--
-- TOC entry 5947 (class 1259 OID 67333)
-- Name: idx_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requests_status ON public.farmer_requests USING btree (status);


--
-- TOC entry 5890 (class 1259 OID 26264)
-- Name: idx_rsbsa_farm_parcels_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_area ON public.rsbsa_farm_parcels USING btree (total_farm_area_ha);


--
-- TOC entry 5891 (class 1259 OID 26262)
-- Name: idx_rsbsa_farm_parcels_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_barangay ON public.rsbsa_farm_parcels USING btree (farm_location_barangay);


--
-- TOC entry 5892 (class 1259 OID 67413)
-- Name: idx_rsbsa_farm_parcels_lessee_land_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_lessee_land_owner_id ON public.rsbsa_farm_parcels USING btree (lessee_land_owner_id);


--
-- TOC entry 5893 (class 1259 OID 26263)
-- Name: idx_rsbsa_farm_parcels_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_municipality ON public.rsbsa_farm_parcels USING btree (farm_location_municipality);


--
-- TOC entry 5894 (class 1259 OID 26261)
-- Name: idx_rsbsa_farm_parcels_parcel_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_parcel_number ON public.rsbsa_farm_parcels USING btree (parcel_number);


--
-- TOC entry 5895 (class 1259 OID 26260)
-- Name: idx_rsbsa_farm_parcels_submission_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_submission_id ON public.rsbsa_farm_parcels USING btree (submission_id);


--
-- TOC entry 5896 (class 1259 OID 67412)
-- Name: idx_rsbsa_farm_parcels_tenant_land_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_tenant_land_owner_id ON public.rsbsa_farm_parcels USING btree (tenant_land_owner_id);


--
-- TOC entry 5866 (class 1259 OID 26230)
-- Name: idx_rsbsa_submission_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_barangay ON public.rsbsa_submission USING btree ("BARANGAY");


--
-- TOC entry 5867 (class 1259 OID 26229)
-- Name: idx_rsbsa_submission_birthday; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_birthday ON public.rsbsa_submission USING btree ("BIRTHDATE");


--
-- TOC entry 5868 (class 1259 OID 26227)
-- Name: idx_rsbsa_submission_ext_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_ext_name ON public.rsbsa_submission USING btree ("EXT NAME");


--
-- TOC entry 5869 (class 1259 OID 26232)
-- Name: idx_rsbsa_submission_farm_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farm_location ON public.rsbsa_submission USING btree ("FARM LOCATION");


--
-- TOC entry 5870 (class 1259 OID 67382)
-- Name: idx_rsbsa_submission_farmer_corn; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_corn ON public.rsbsa_submission USING btree ("FARMER_CORN");


--
-- TOC entry 5871 (class 1259 OID 67384)
-- Name: idx_rsbsa_submission_farmer_livestock; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_livestock ON public.rsbsa_submission USING btree ("FARMER_LIVESTOCK");


--
-- TOC entry 5872 (class 1259 OID 67383)
-- Name: idx_rsbsa_submission_farmer_other_crops; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_other_crops ON public.rsbsa_submission USING btree ("FARMER_OTHER_CROPS");


--
-- TOC entry 5873 (class 1259 OID 67385)
-- Name: idx_rsbsa_submission_farmer_poultry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_poultry ON public.rsbsa_submission USING btree ("FARMER_POULTRY");


--
-- TOC entry 5874 (class 1259 OID 67381)
-- Name: idx_rsbsa_submission_farmer_rice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farmer_rice ON public.rsbsa_submission USING btree ("FARMER_RICE");


--
-- TOC entry 5875 (class 1259 OID 31595)
-- Name: idx_rsbsa_submission_ffrs_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_ffrs_code ON public.rsbsa_submission USING btree ("FFRS_CODE");


--
-- TOC entry 5876 (class 1259 OID 26225)
-- Name: idx_rsbsa_submission_first_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_first_name ON public.rsbsa_submission USING btree ("FIRST NAME");


--
-- TOC entry 5877 (class 1259 OID 26228)
-- Name: idx_rsbsa_submission_gender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_gender ON public.rsbsa_submission USING btree ("GENDER");


--
-- TOC entry 5878 (class 1259 OID 26224)
-- Name: idx_rsbsa_submission_last_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_last_name ON public.rsbsa_submission USING btree ("LAST NAME");


--
-- TOC entry 5879 (class 1259 OID 26234)
-- Name: idx_rsbsa_submission_main_livelihood; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_main_livelihood ON public.rsbsa_submission USING btree ("MAIN LIVELIHOOD");


--
-- TOC entry 5880 (class 1259 OID 26226)
-- Name: idx_rsbsa_submission_middle_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_middle_name ON public.rsbsa_submission USING btree ("MIDDLE NAME");


--
-- TOC entry 5881 (class 1259 OID 26231)
-- Name: idx_rsbsa_submission_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_municipality ON public.rsbsa_submission USING btree ("MUNICIPALITY");


--
-- TOC entry 5882 (class 1259 OID 31668)
-- Name: idx_rsbsa_submission_parcel_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_parcel_area ON public.rsbsa_submission USING btree ("PARCEL AREA");


--
-- TOC entry 5883 (class 1259 OID 26235)
-- Name: idx_rsbsa_submission_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_status ON public.rsbsa_submission USING btree (status);


--
-- TOC entry 5884 (class 1259 OID 26236)
-- Name: idx_rsbsa_submission_submitted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_submitted_at ON public.rsbsa_submission USING btree (submitted_at);


--
-- TOC entry 5885 (class 1259 OID 26237)
-- Name: idx_rsbsa_submission_total_farm_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_total_farm_area ON public.rsbsa_submission USING btree ("TOTAL FARM AREA");


--
-- TOC entry 5915 (class 1259 OID 67124)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 5916 (class 1259 OID 67125)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 5917 (class 1259 OID 67123)
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- TOC entry 5984 (class 2620 OID 67160)
-- Name: incentive_distribution_log trg_incentive_log_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_incentive_log_updated BEFORE UPDATE ON public.incentive_distribution_log FOR EACH ROW EXECUTE FUNCTION public.update_incentive_log_timestamp();


--
-- TOC entry 5983 (class 2620 OID 67127)
-- Name: users trg_users_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_users_timestamp();


--
-- TOC entry 5980 (class 2620 OID 31665)
-- Name: rsbsa_farm_parcels trigger_create_land_history_on_parcel_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_create_land_history_on_parcel_insert AFTER INSERT ON public.rsbsa_farm_parcels FOR EACH ROW EXECUTE FUNCTION public.create_land_history_from_farm_parcel();


--
-- TOC entry 5979 (class 2620 OID 31599)
-- Name: rsbsa_submission trigger_generate_ffrs_code; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_generate_ffrs_code BEFORE INSERT ON public.rsbsa_submission FOR EACH ROW EXECUTE FUNCTION public.generate_ffrs_code_trigger();


--
-- TOC entry 5981 (class 2620 OID 31667)
-- Name: rsbsa_farm_parcels trigger_update_land_history_on_parcel_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_land_history_on_parcel_update AFTER UPDATE ON public.rsbsa_farm_parcels FOR EACH ROW EXECUTE FUNCTION public.update_land_history_from_farm_parcel();


--
-- TOC entry 5982 (class 2620 OID 31663)
-- Name: land_history trigger_update_land_history_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_land_history_timestamp BEFORE UPDATE ON public.land_history FOR EACH ROW EXECUTE FUNCTION public.update_land_history_timestamp();


--
-- TOC entry 5978 (class 2606 OID 67308)
-- Name: distribution_records distribution_records_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.distribution_records
    ADD CONSTRAINT distribution_records_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.farmer_requests(id) ON DELETE CASCADE;


--
-- TOC entry 5968 (class 2606 OID 26305)
-- Name: farm_parcels farm_parcels_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels
    ADD CONSTRAINT farm_parcels_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5977 (class 2606 OID 67288)
-- Name: farmer_requests farmer_requests_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farmer_requests
    ADD CONSTRAINT farmer_requests_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;


--
-- TOC entry 5973 (class 2606 OID 67148)
-- Name: incentive_distribution_log fk_encoder; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT fk_encoder FOREIGN KEY (encoder_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5974 (class 2606 OID 67143)
-- Name: incentive_distribution_log fk_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_distribution_log
    ADD CONSTRAINT fk_farmer FOREIGN KEY (farmer_id) REFERENCES public.masterlist(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5975 (class 2606 OID 67172)
-- Name: ownership_transfers fk_from_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT fk_from_farmer FOREIGN KEY (from_farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5965 (class 2606 OID 67407)
-- Name: rsbsa_farm_parcels fk_lessee_land_owner; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT fk_lessee_land_owner FOREIGN KEY (lessee_land_owner_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;


--
-- TOC entry 5966 (class 2606 OID 67402)
-- Name: rsbsa_farm_parcels fk_tenant_land_owner; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT fk_tenant_land_owner FOREIGN KEY (tenant_land_owner_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;


--
-- TOC entry 5976 (class 2606 OID 67177)
-- Name: ownership_transfers fk_to_farmer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT fk_to_farmer FOREIGN KEY (to_farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5969 (class 2606 OID 31634)
-- Name: land_history land_history_farm_parcel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_farm_parcel_id_fkey FOREIGN KEY (farm_parcel_id) REFERENCES public.rsbsa_farm_parcels(id) ON DELETE CASCADE;


--
-- TOC entry 5970 (class 2606 OID 31639)
-- Name: land_history land_history_farmer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.rsbsa_submission(id) ON DELETE SET NULL;


--
-- TOC entry 5971 (class 2606 OID 31644)
-- Name: land_history land_history_previous_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_previous_record_id_fkey FOREIGN KEY (previous_record_id) REFERENCES public.land_history(id) ON DELETE SET NULL;


--
-- TOC entry 5972 (class 2606 OID 31629)
-- Name: land_history land_history_rsbsa_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_rsbsa_submission_id_fkey FOREIGN KEY (rsbsa_submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5967 (class 2606 OID 26255)
-- Name: rsbsa_farm_parcels rsbsa_farm_parcels_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT rsbsa_farm_parcels_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


-- Completed on 2026-01-30 20:28:29

--
-- PostgreSQL database dump complete
--

