--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-10-13 12:50:27

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
-- TOC entry 5936 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


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
-- TOC entry 5937 (class 0 OID 0)
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
-- TOC entry 5938 (class 0 OID 0)
-- Dependencies: 234
-- Name: farm_parcels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.farm_parcels_id_seq OWNED BY public.farm_parcels.id;


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
-- TOC entry 5939 (class 0 OID 0)
-- Dependencies: 224
-- Name: masterlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.masterlist_id_seq OWNED BY public.masterlist.id;


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
-- TOC entry 5940 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE rsbsa_farm_parcels; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rsbsa_farm_parcels IS 'Stores individual farm parcels for each RSBSA submission';


--
-- TOC entry 5941 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.submission_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.submission_id IS 'Reference to the main RSBSA submission';


--
-- TOC entry 5942 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.parcel_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.parcel_number IS 'Parcel number (1, 2, 3, etc.)';


--
-- TOC entry 5943 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.farm_location_barangay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.farm_location_barangay IS 'Barangay where the farm parcel is located';


--
-- TOC entry 5944 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.farm_location_municipality; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.farm_location_municipality IS 'Municipality where the farm parcel is located';


--
-- TOC entry 5945 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.total_farm_area_ha; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.total_farm_area_ha IS 'Area of this specific parcel in hectares';


--
-- TOC entry 5946 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.within_ancestral_domain; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.within_ancestral_domain IS 'Whether this parcel is within ancestral domain';


--
-- TOC entry 5947 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_document_no; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_document_no IS 'Document number proving ownership of this parcel';


--
-- TOC entry 5948 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.agrarian_reform_beneficiary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.agrarian_reform_beneficiary IS 'Whether the farmer is an agrarian reform beneficiary for this parcel';


--
-- TOC entry 5949 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_registered_owner IS 'Whether the farmer is the registered owner of this parcel';


--
-- TOC entry 5950 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_tenant IS 'Whether the farmer is a tenant of this parcel';


--
-- TOC entry 5951 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_lessee IS 'Whether the farmer is a lessee of this parcel';


--
-- TOC entry 5952 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.ownership_type_others; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.ownership_type_others IS 'Whether the farmer has other ownership type for this parcel';


--
-- TOC entry 5953 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.tenant_land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.tenant_land_owner_name IS 'Name of land owner if farmer is a tenant';


--
-- TOC entry 5954 (class 0 OID 0)
-- Dependencies: 233
-- Name: COLUMN rsbsa_farm_parcels.lessee_land_owner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_farm_parcels.lessee_land_owner_name IS 'Name of land owner if farmer is a lessee';


--
-- TOC entry 5955 (class 0 OID 0)
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
-- TOC entry 5956 (class 0 OID 0)
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
    "PARCEL AREA" numeric(10,2),
    "MAIN LIVELIHOOD" character varying(100),
    "OWNERSHIP_TYPE_REGISTERED_OWNER" boolean DEFAULT false,
    "OWNERSHIP_TYPE_TENANT" boolean DEFAULT false,
    "OWNERSHIP_TYPE_LESSEE" boolean DEFAULT false,
    status character varying(50) DEFAULT 'Submitted'::character varying,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "TOTAL FARM AREA" numeric(10,2)
);


ALTER TABLE public.rsbsa_submission OWNER TO postgres;

--
-- TOC entry 5957 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE rsbsa_submission; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rsbsa_submission IS 'Structured RSBSA submission table with individual columns for each field';


--
-- TOC entry 5958 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission.id IS 'Unique identifier for the submission';


--
-- TOC entry 5959 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."LAST NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."LAST NAME" IS 'Last name of the farmer';


--
-- TOC entry 5960 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."FIRST NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FIRST NAME" IS 'First name of the farmer';


--
-- TOC entry 5961 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."MIDDLE NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MIDDLE NAME" IS 'Middle name of the farmer';


--
-- TOC entry 5962 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."EXT NAME"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."EXT NAME" IS 'Extension name of the farmer';


--
-- TOC entry 5963 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."GENDER"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."GENDER" IS 'Gender of the farmer';


--
-- TOC entry 5964 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."BIRTHDATE"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."BIRTHDATE" IS 'Birthdate of the farmer';


--
-- TOC entry 5965 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."BARANGAY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."BARANGAY" IS 'Barangay of the farmer';


--
-- TOC entry 5966 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."MUNICIPALITY"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MUNICIPALITY" IS 'Municipality of the farmer';


--
-- TOC entry 5967 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."FARM LOCATION"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."FARM LOCATION" IS 'Farm location of the farmer';


--
-- TOC entry 5968 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."PARCEL AREA"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."PARCEL AREA" IS 'Area of the farm parcel';


--
-- TOC entry 5969 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."MAIN LIVELIHOOD"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."MAIN LIVELIHOOD" IS 'Main livelihood of the farmer';


--
-- TOC entry 5970 (class 0 OID 0)
-- Dependencies: 231
-- Name: COLUMN rsbsa_submission."TOTAL FARM AREA"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsa_submission."TOTAL FARM AREA" IS 'Total farm area in hectares (sum of all parcels for this farmer)';


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
-- TOC entry 5971 (class 0 OID 0)
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
-- TOC entry 5972 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_land_description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_land_description IS 'Complete farm land description including location and details';


--
-- TOC entry 5973 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_location_barangay; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_location_barangay IS 'Barangay where the farm is located';


--
-- TOC entry 5974 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_location_city_municipality; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_location_city_municipality IS 'City or municipality where the farm is located';


--
-- TOC entry 5975 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.total_farm_area; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.total_farm_area IS 'Total farm area in hectares';


--
-- TOC entry 5976 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.within_ancestral_domain; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.within_ancestral_domain IS 'Whether the farm is within ancestral domain (Yes/No)';


--
-- TOC entry 5977 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.agrarian_reform_beneficiary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.agrarian_reform_beneficiary IS 'Whether the farmer is an agrarian reform beneficiary (Yes/No)';


--
-- TOC entry 5978 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_document_no; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_document_no IS 'Document number proving ownership';


--
-- TOC entry 5979 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_registered_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_registered_owner IS 'Whether the farmer is a registered owner';


--
-- TOC entry 5980 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_tenant; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_tenant IS 'Whether the farmer is a tenant';


--
-- TOC entry 5981 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_tenant_land_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_tenant_land_owner IS 'Name of land owner if tenant';


--
-- TOC entry 5982 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_lessee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_lessee IS 'Whether the farmer is a lessee';


--
-- TOC entry 5983 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_lessee_land_owner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_lessee_land_owner IS 'Name of land owner if lessee';


--
-- TOC entry 5984 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_others; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_others IS 'Whether the farmer has other ownership type';


--
-- TOC entry 5985 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.ownership_type_others_specify; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.ownership_type_others_specify IS 'Specification of other ownership type';


--
-- TOC entry 5986 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.crop_commodity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.crop_commodity IS 'Type of crop or commodity grown';


--
-- TOC entry 5987 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_size; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_size IS 'Size of the farm parcel';


--
-- TOC entry 5988 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.number_of_head; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.number_of_head IS 'Number of livestock/poultry heads';


--
-- TOC entry 5989 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.farm_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.farm_type IS 'Type of farming (e.g., Irrigated, Rainfed)';


--
-- TOC entry 5990 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN rsbsaform.organic_practitioner; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rsbsaform.organic_practitioner IS 'Whether the farmer is an organic practitioner (Y/N)';


--
-- TOC entry 5991 (class 0 OID 0)
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
-- TOC entry 5992 (class 0 OID 0)
-- Dependencies: 225
-- Name: rsbsaform_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rsbsaform_id_seq OWNED BY public.rsbsaform.id;


--
-- TOC entry 5692 (class 2604 OID 26042)
-- Name: barangay_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes ALTER COLUMN id SET DEFAULT nextval('public.barangay_codes_id_seq'::regclass);


--
-- TOC entry 5711 (class 2604 OID 26292)
-- Name: farm_parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels ALTER COLUMN id SET DEFAULT nextval('public.farm_parcels_id_seq'::regclass);


--
-- TOC entry 5683 (class 2604 OID 25801)
-- Name: masterlist id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterlist ALTER COLUMN id SET DEFAULT nextval('public.masterlist_id_seq'::regclass);


--
-- TOC entry 5704 (class 2604 OID 26242)
-- Name: rsbsa_farm_parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels ALTER COLUMN id SET DEFAULT nextval('public.rsbsa_farm_parcels_id_seq'::regclass);


--
-- TOC entry 5696 (class 2604 OID 26212)
-- Name: rsbsa_submission id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission ALTER COLUMN id SET DEFAULT nextval('public.rsbsa_submission_id_seq'::regclass);


--
-- TOC entry 5685 (class 2604 OID 25856)
-- Name: rsbsaform id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsaform ALTER COLUMN id SET DEFAULT nextval('public.rsbsaform_id_seq'::regclass);


--
-- TOC entry 5923 (class 0 OID 26039)
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
-- TOC entry 5924 (class 0 OID 26050)
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
-- TOC entry 5930 (class 0 OID 26289)
-- Dependencies: 235
-- Data for Name: farm_parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_city_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at) FROM stdin;
1	19	1	Cayos		3.00	f		f	t	f	f				2025-09-27 18:12:09.982237	2025-09-27 18:12:09.982237
2	19	2	Bacay		2.00	f		f	t	f	f				2025-09-27 18:12:09.982237	2025-09-27 18:12:09.982237
3	20	1	Cayos		13.00	f		f	t	f	f				2025-09-27 18:27:07.531383	2025-09-27 18:27:07.531383
4	20	2	Bacay		2.00	f		f	t	f	f				2025-09-27 18:27:07.531383	2025-09-27 18:27:07.531383
5	21	1	Capaliz		2.00	f		f	t	f	f				2025-09-27 19:41:23.762258	2025-09-27 19:41:23.762258
6	21	2	Bantud		2.00	f		f	t	f	f				2025-09-27 19:41:23.762258	2025-09-27 19:41:23.762258
7	22	1	Cayos		12.00	f		f	t	f	f				2025-10-11 14:43:49.635279	2025-10-11 14:43:49.635279
8	23	1	Balabag		2.00	f		f	t	f	f				2025-10-11 21:20:24.185128	2025-10-11 21:20:24.185128
9	24	1	Compayan		1.00	f		f	t	f	f				2025-10-12 16:14:07.734831	2025-10-12 16:14:07.734831
10	25	1	Baras		2323.00	f		f	t	f	f				2025-10-13 08:46:51.516103	2025-10-13 08:46:51.516103
\.


--
-- TOC entry 5918 (class 0 OID 24643)
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
-- TOC entry 5928 (class 0 OID 26239)
-- Dependencies: 233
-- Data for Name: rsbsa_farm_parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rsbsa_farm_parcels (id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, within_ancestral_domain, ownership_document_no, agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, ownership_type_others, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify, created_at, updated_at) FROM stdin;
3	5	1	Capaliz		2.00	Yes		Yes	t	f	f	f				2025-09-21 21:37:32.11059	2025-09-21 21:37:32.11059
4	5	2	Bacong		2.00	Yes		Yes	t	f	f	f				2025-09-21 21:37:32.121211	2025-09-21 21:37:32.121211
5	6	1	Calao		1.00	Yes		Yes	t	f	f	f				2025-09-21 21:41:42.284729	2025-09-21 21:41:42.284729
6	6	2	Bacong		2.00	Yes		Yes	t	f	f	f				2025-09-21 21:41:42.293549	2025-09-21 21:41:42.293549
7	7	1	Tambobo		2.00	Yes		Yes	t	f	f	f				2025-09-21 21:46:10.531235	2025-09-21 21:46:10.531235
8	7	2	Aurora-Del Pilar		3.00	Yes		Yes	t	f	f	f				2025-09-21 21:46:10.543082	2025-09-21 21:46:10.543082
\.


--
-- TOC entry 5926 (class 0 OID 26209)
-- Dependencies: 231
-- Data for Name: rsbsa_submission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rsbsa_submission (id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE", status, submitted_at, created_at, updated_at, "TOTAL FARM AREA") FROM stdin;
24	aad	Ricara	asda	asd	Male	\N	afdsa	asdasd	Compayan,	\N	farmer	f	f	f	Submitted	2025-10-12 16:14:07.734831	2025-10-12 16:14:07.734831	2025-10-12 16:14:07.734831	1.00
15	ASDF	SDF	ASDF	ASDSF	Male	\N	ASDF	ASDF	Cayos	2.00	farmer	t	f	f	Active Farmer	2025-09-27 17:17:09.423627	2025-09-27 17:17:09.423627	2025-09-27 17:17:09.423627	2.00
14	S	Shi	qwe	wqe	Male	\N	qwe	qwe	Bacong	3.00	farmer	t	f	f	Active Farmer	2025-09-27 17:12:24.224597	2025-09-27 17:12:24.224597	2025-09-27 17:12:24.224597	5.00
13	S	Shi	qwe	wqe	Male	\N	qwe	qwe	Capaliz	2.00	farmer	t	f	f	Active Farmer	2025-09-27 17:12:24.210387	2025-09-27 17:12:24.210387	2025-09-27 17:12:24.210387	5.00
12	Lop	Liv	De	Sit	Female	\N	Cabatuan	Iloilo	Cansilayan	2.00	farmer	t	f	f	Active Farmer	2025-09-27 16:20:14.241116	2025-09-27 16:20:14.241116	2025-09-27 16:20:14.241116	2.00
22	ae	fic	a	asd	Male	\N	asdasd	Dumangas	Cayos,	\N	farmer	f	f	f	Active Farmer	2025-10-11 14:43:49.635279	2025-10-11 14:43:49.635279	2025-10-11 15:05:02.282836	12.00
21	men	Car	Elev	hey	Female	\N	sdfasdf	Dumangas		\N	farmer	f	f	f	Active Farmer	2025-09-27 19:41:23.762258	2025-09-27 19:41:23.762258	2025-10-11 14:42:38.661577	4.00
11	Elev	Ric	Ser	Elv	Male	\N	Cabatuan	Iloilo	Capaliz	3.00	farmer	t	f	f	Active Farmer	2025-09-27 16:07:02.767606	2025-09-27 16:07:02.767606	2025-09-27 16:07:02.767606	6.00
20	Pos	Pos	Sed	Sed	Male	\N	Sd	Dumangas		\N	farmer	f	f	f	Active Farmer	2025-09-27 18:27:07.531383	2025-09-27 18:27:07.531383	2025-10-11 14:41:08.62461	15.00
19	adsf	asdf	asdf	asdf	Male	\N	asdf	asdf		\N	farmer	f	f	f	Active Farmer	2025-09-27 18:12:09.982237	2025-09-27 18:12:09.982237	2025-09-27 18:12:09.982237	5.00
18	asdf	sdfas	asdf	asdf	Male	\N	asdf	Dumangas		\N	farmer	f	f	f	Active Farmer	2025-09-27 17:59:46.23521	2025-09-27 17:59:46.23521	2025-10-11 14:42:47.01385	8.00
17	asdf	awe	asd	assdf	Male	\N	adsf	asdf		\N	farmer	f	f	f	Active Farmer	2025-09-27 17:38:41.718279	2025-09-27 17:38:41.718279	2025-09-27 17:38:41.718279	4.00
16	asd	asd	asd	asd	Male	\N	asd	asd		\N	farmer	f	f	f	Active Farmer	2025-09-27 17:32:15.616958	2025-09-27 17:32:15.616958	2025-09-27 17:32:15.616958	5.00
25	Clavess	Arjane 	Daligdig		Female	\N	Waasdfsdf	asdfasdf	Baras,	\N	farmer	t	f	f	Submitted	2025-10-13 08:46:51.516103	2025-10-13 08:46:51.516103	2025-10-13 08:46:51.516103	2323.00
10	Elev	Ric	Ser	Elv	Male	\N	Cabatuan	Iloilo	Balud	3.00	farmer	t	f	f	Active Farmer	2025-09-27 16:07:02.755946	2025-09-27 16:07:02.755946	2025-09-27 16:07:02.755946	6.00
9	SDFASDF	nene	ASDFAS	DASDF	Male	\N	SDFASDF	ASDFASF	Cayos	3.00	farmer	t	f	f	Active Farmer	2025-09-21 21:55:26.055045	2025-09-21 21:55:26.055045	2025-09-21 21:55:26.055045	5.00
8	SDFASDF	nene	ASDFAS	DASDF	Male	\N	SDFASDF	ASDFASF	Cayos	3.00	farmer	t	f	f	Active Farmer	2025-09-21 21:55:23.482227	2025-09-21 21:55:23.482227	2025-09-21 21:55:23.482227	5.00
7	SDFASDF	Friday	ASDF	ASDF	Male	\N	SDF	ASDF	Tambobo	2.00	farmer	t	f	f	Active Farmer	2025-09-21 21:46:10.516709	2025-09-21 21:46:10.516709	2025-09-21 21:46:10.516709	5.00
6	asdf	Eleve	asdf	asdf	Male	\N	asdf	asdfasf	Calao	1.00	farmer	t	f	f	Active Farmer	2025-09-21 21:41:42.271699	2025-09-21 21:41:42.271699	2025-09-21 21:41:42.271699	1.00
5	elev	Ric	asdf	asdf	Male	\N	asdf	asdf	Capaliz	2.00	farmer	t	f	f	Active Farmer	2025-09-21 21:37:32.107945	2025-09-21 21:37:32.107945	2025-09-21 21:37:32.107945	2.00
4	afasdf	Ric	asdf	asdf	Male	\N	asdf	asdf	Cali	12.00	farmer	t	f	f	Active Farmer	2025-09-21 21:36:38.451527	2025-09-21 21:36:38.451527	2025-09-21 21:36:38.451527	24.00
3	afasdf	Ric	asdf	asdf	Male	\N	asdf	asdf	Cali	12.00	farmer	t	f	f	Active Farmer	2025-09-21 21:36:27.350619	2025-09-21 21:36:27.350619	2025-09-21 21:36:27.350619	24.00
2	ASDF	EFAS	ASDF	ASDF	Female	\N	ASDF	ASDF	Aurora-Del Pilar	2.00	farmer	f	t	f	Active Farmer	2025-09-07 16:37:44.179425	2025-09-07 16:37:44.179425	2025-09-07 16:37:44.179425	2.00
1	asdf	asdfasd	asdf	asdf	Male	\N	asdf, asdf, Dumangas	Dumangas	Compayan	4.00	farmer	t	f	f	Active Farmer	2025-09-06 09:59:18.748135	2025-09-06 09:59:18.748135	2025-09-21 16:13:05.626296	4.00
23	ASDF	Ricw	AEADS	ASDF		\N	ASDF	ASDF	Balabag,	\N	farmer	f	f	f	Submitted	2025-10-11 21:20:24.185128	2025-10-11 21:20:24.185128	2025-10-11 21:20:24.185128	2.00
\.


--
-- TOC entry 5921 (class 0 OID 25853)
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
-- TOC entry 5682 (class 0 OID 25007)
-- Dependencies: 220
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- TOC entry 5993 (class 0 OID 0)
-- Dependencies: 227
-- Name: barangay_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.barangay_codes_id_seq', 118, true);


--
-- TOC entry 5994 (class 0 OID 0)
-- Dependencies: 234
-- Name: farm_parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.farm_parcels_id_seq', 10, true);


--
-- TOC entry 5995 (class 0 OID 0)
-- Dependencies: 224
-- Name: masterlist_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.masterlist_id_seq', 19, true);


--
-- TOC entry 5996 (class 0 OID 0)
-- Dependencies: 232
-- Name: rsbsa_farm_parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsa_farm_parcels_id_seq', 8, true);


--
-- TOC entry 5997 (class 0 OID 0)
-- Dependencies: 230
-- Name: rsbsa_submission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsa_submission_id_seq', 25, true);


--
-- TOC entry 5998 (class 0 OID 0)
-- Dependencies: 225
-- Name: rsbsaform_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rsbsaform_id_seq', 28, true);


--
-- TOC entry 5734 (class 2606 OID 26049)
-- Name: barangay_codes barangay_codes_barangay_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_barangay_code_key UNIQUE (barangay_code);


--
-- TOC entry 5736 (class 2606 OID 26047)
-- Name: barangay_codes barangay_codes_barangay_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_barangay_name_key UNIQUE (barangay_name);


--
-- TOC entry 5738 (class 2606 OID 26045)
-- Name: barangay_codes barangay_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_codes
    ADD CONSTRAINT barangay_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 5740 (class 2606 OID 26056)
-- Name: barangay_farmer_counters barangay_farmer_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barangay_farmer_counters
    ADD CONSTRAINT barangay_farmer_counters_pkey PRIMARY KEY (barangay_code);


--
-- TOC entry 5765 (class 2606 OID 26304)
-- Name: farm_parcels farm_parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels
    ADD CONSTRAINT farm_parcels_pkey PRIMARY KEY (id);


--
-- TOC entry 5726 (class 2606 OID 25803)
-- Name: masterlist masterlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.masterlist
    ADD CONSTRAINT masterlist_pkey PRIMARY KEY (id);


--
-- TOC entry 5763 (class 2606 OID 26254)
-- Name: rsbsa_farm_parcels rsbsa_farm_parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT rsbsa_farm_parcels_pkey PRIMARY KEY (id);


--
-- TOC entry 5756 (class 2606 OID 26223)
-- Name: rsbsa_submission rsbsa_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_submission
    ADD CONSTRAINT rsbsa_submission_pkey PRIMARY KEY (id);


--
-- TOC entry 5730 (class 2606 OID 26070)
-- Name: rsbsaform rsbsaform_ffrs_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsaform
    ADD CONSTRAINT rsbsaform_ffrs_id_key UNIQUE (ffrs_id);


--
-- TOC entry 5732 (class 2606 OID 25860)
-- Name: rsbsaform rsbsaform_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsaform
    ADD CONSTRAINT rsbsaform_pkey PRIMARY KEY (id);


--
-- TOC entry 5757 (class 1259 OID 26264)
-- Name: idx_rsbsa_farm_parcels_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_area ON public.rsbsa_farm_parcels USING btree (total_farm_area_ha);


--
-- TOC entry 5758 (class 1259 OID 26262)
-- Name: idx_rsbsa_farm_parcels_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_barangay ON public.rsbsa_farm_parcels USING btree (farm_location_barangay);


--
-- TOC entry 5759 (class 1259 OID 26263)
-- Name: idx_rsbsa_farm_parcels_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_municipality ON public.rsbsa_farm_parcels USING btree (farm_location_municipality);


--
-- TOC entry 5760 (class 1259 OID 26261)
-- Name: idx_rsbsa_farm_parcels_parcel_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_parcel_number ON public.rsbsa_farm_parcels USING btree (parcel_number);


--
-- TOC entry 5761 (class 1259 OID 26260)
-- Name: idx_rsbsa_farm_parcels_submission_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_farm_parcels_submission_id ON public.rsbsa_farm_parcels USING btree (submission_id);


--
-- TOC entry 5741 (class 1259 OID 26230)
-- Name: idx_rsbsa_submission_barangay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_barangay ON public.rsbsa_submission USING btree ("BARANGAY");


--
-- TOC entry 5742 (class 1259 OID 26229)
-- Name: idx_rsbsa_submission_birthday; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_birthday ON public.rsbsa_submission USING btree ("BIRTHDATE");


--
-- TOC entry 5743 (class 1259 OID 26227)
-- Name: idx_rsbsa_submission_ext_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_ext_name ON public.rsbsa_submission USING btree ("EXT NAME");


--
-- TOC entry 5744 (class 1259 OID 26232)
-- Name: idx_rsbsa_submission_farm_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_farm_location ON public.rsbsa_submission USING btree ("FARM LOCATION");


--
-- TOC entry 5745 (class 1259 OID 26225)
-- Name: idx_rsbsa_submission_first_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_first_name ON public.rsbsa_submission USING btree ("FIRST NAME");


--
-- TOC entry 5746 (class 1259 OID 26228)
-- Name: idx_rsbsa_submission_gender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_gender ON public.rsbsa_submission USING btree ("GENDER");


--
-- TOC entry 5747 (class 1259 OID 26224)
-- Name: idx_rsbsa_submission_last_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_last_name ON public.rsbsa_submission USING btree ("LAST NAME");


--
-- TOC entry 5748 (class 1259 OID 26234)
-- Name: idx_rsbsa_submission_main_livelihood; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_main_livelihood ON public.rsbsa_submission USING btree ("MAIN LIVELIHOOD");


--
-- TOC entry 5749 (class 1259 OID 26226)
-- Name: idx_rsbsa_submission_middle_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_middle_name ON public.rsbsa_submission USING btree ("MIDDLE NAME");


--
-- TOC entry 5750 (class 1259 OID 26231)
-- Name: idx_rsbsa_submission_municipality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_municipality ON public.rsbsa_submission USING btree ("MUNICIPALITY");


--
-- TOC entry 5751 (class 1259 OID 26233)
-- Name: idx_rsbsa_submission_parcel_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_parcel_area ON public.rsbsa_submission USING btree ("PARCEL AREA");


--
-- TOC entry 5752 (class 1259 OID 26235)
-- Name: idx_rsbsa_submission_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_status ON public.rsbsa_submission USING btree (status);


--
-- TOC entry 5753 (class 1259 OID 26236)
-- Name: idx_rsbsa_submission_submitted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_submitted_at ON public.rsbsa_submission USING btree (submitted_at);


--
-- TOC entry 5754 (class 1259 OID 26237)
-- Name: idx_rsbsa_submission_total_farm_area; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rsbsa_submission_total_farm_area ON public.rsbsa_submission USING btree ("TOTAL FARM AREA");


--
-- TOC entry 5767 (class 2606 OID 26305)
-- Name: farm_parcels farm_parcels_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.farm_parcels
    ADD CONSTRAINT farm_parcels_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


--
-- TOC entry 5766 (class 2606 OID 26255)
-- Name: rsbsa_farm_parcels rsbsa_farm_parcels_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rsbsa_farm_parcels
    ADD CONSTRAINT rsbsa_farm_parcels_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.rsbsa_submission(id) ON DELETE CASCADE;


-- Completed on 2025-10-13 12:50:28

--
-- PostgreSQL database dump complete
--

