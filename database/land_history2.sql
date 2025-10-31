--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-10-20 09:13:01

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 237 (class 1259 OID 31601)
-- Name: land_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.land_history (
    id integer NOT NULL,
    "Land_Owner_Name" character varying(100),
    "Tenant_Name" character varying(100),
    "Lessee_Name" character varying(100),
    "Is_LandOwner" boolean,
    "Is_Tenant" boolean,
    "Is_Lessee" boolean,
    "Date_Created" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.land_history OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 31600)
-- Name: land_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.land_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.land_history_id_seq OWNER TO postgres;

--
-- TOC entry 5843 (class 0 OID 0)
-- Dependencies: 236
-- Name: land_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.land_history_id_seq OWNED BY public.land_history.id;


--
-- TOC entry 5682 (class 2604 OID 31604)
-- Name: land_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history ALTER COLUMN id SET DEFAULT nextval('public.land_history_id_seq'::regclass);


--
-- TOC entry 5837 (class 0 OID 31601)
-- Dependencies: 237
-- Data for Name: land_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.land_history (id, "Land_Owner_Name", "Tenant_Name", "Lessee_Name", "Is_LandOwner", "Is_Tenant", "Is_Lessee", "Date_Created") FROM stdin;
\.


--
-- TOC entry 5844 (class 0 OID 0)
-- Dependencies: 236
-- Name: land_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.land_history_id_seq', 1, false);


--
-- TOC entry 5685 (class 2606 OID 31607)
-- Name: land_history land_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.land_history
    ADD CONSTRAINT land_history_pkey PRIMARY KEY (id);


-- Completed on 2025-10-20 09:13:01

--
-- PostgreSQL database dump complete
--

