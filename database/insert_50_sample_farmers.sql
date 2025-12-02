-- Insert 50 Sample Farmers into RSBSA Submission System
-- This script creates realistic farmer profiles with Filipino names and Dumangas barangay addresses
-- Mix of registered owners, tenants, and lessees with varied farm sizes

-- IMPORTANT: This script will NOT insert duplicate farmers
-- It will only add new farmers if they don't already exist in the database
-- IDs are auto-generated to avoid conflicts with existing records

-- First, let's insert farmers with their basic information
-- Then we'll add their farm parcels

-- Farmers 1-50 (Mix of Male and Female, Various Ages)
-- NOTE: No ID specified - database will auto-generate sequential IDs
INSERT INTO rsbsa_submission (
    "LAST NAME", 
    "FIRST NAME", 
    "MIDDLE NAME", 
    "EXT NAME",
    "GENDER", 
    "BIRTHDATE", 
    "BARANGAY", 
    "MUNICIPALITY",
    "FARM_LOCATION",
    "PARCEL_AREA",
    "MAIN LIVELIHOOD",
    "OWNERSHIP_TYPE_REGISTERED_OWNER",
    "OWNERSHIP_TYPE_TENANT",
    "OWNERSHIP_TYPE_LESSEE",
    status
) VALUES
-- 1-10: Registered Owners from various barangays
('Dela Cruz', 'Juan', 'Santos', NULL, 'Male', '1975-03-15', 'Aurora-Del Pilar', 'Dumangas', 'Aurora-Del Pilar', 2.5, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Reyes', 'Maria', 'Garcia', NULL, 'Female', '1982-07-22', 'Bacay', 'Dumangas', 'Bacay', 1.8, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Santos', 'Roberto', 'Mendoza', NULL, 'Male', '1968-11-08', 'Balabag', 'Dumangas', 'Balabag', 3.2, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Garcia', 'Elena', 'Flores', NULL, 'Female', '1979-05-30', 'Bantud', 'Dumangas', 'Bantud', 2.1, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Hernandez', 'Pedro', 'Aquino', NULL, 'Male', '1970-09-14', 'Baras', 'Dumangas', 'Baras', 4.5, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Martinez', 'Rosa', 'Bautista', NULL, 'Female', '1985-01-18', 'Barasan', 'Dumangas', 'Barasan', 1.5, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Gonzales', 'Antonio', 'Cruz', NULL, 'Male', '1973-12-25', 'Bolilao', 'Dumangas', 'Bolilao', 2.8, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Torres', 'Carmen', 'Ramos', NULL, 'Female', '1988-04-02', 'Calao', 'Dumangas', 'Calao', 1.2, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Fernandez', 'Ricardo', 'Villanueva', NULL, 'Male', '1965-08-19', 'Cali', 'Dumangas', 'Cali', 3.7, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Lopez', 'Lourdes', 'Santiago', NULL, 'Female', '1980-06-11', 'Cansilayan', 'Dumangas', 'Cansilayan', 2.3, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),

-- 11-20: Mix of Registered Owners and Tenants
('Castillo', 'Manuel', 'Rivera', NULL, 'Male', '1977-02-28', 'Capaliz', 'Dumangas', 'Capaliz', 1.9, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Ramirez', 'Teresa', 'Morales', NULL, 'Female', '1983-10-07', 'Cayos', 'Dumangas', 'Cayos', 2.6, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),
('Morales', 'Jose', 'Diaz', NULL, 'Male', '1972-07-16', 'Compayan', 'Dumangas', 'Compayan', 1.4, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),
('Velasco', 'Gloria', 'Gomez', NULL, 'Female', '1986-03-09', 'Dacutan', 'Dumangas', 'Dacutan', 3.1, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Mendoza', 'Alfredo', 'Perez', NULL, 'Male', '1969-11-23', 'Ermita', 'Dumangas', 'Ermita', 2.4, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),
('Cruz', 'Violeta', 'Torres', NULL, 'Female', '1981-05-14', 'Ilaya 1st', 'Dumangas', 'Ilaya 1st', 1.7, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Bautista', 'Fernando', 'Lopez', NULL, 'Male', '1974-09-01', 'Ilaya 2nd', 'Dumangas', 'Ilaya 2nd', 3.5, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),
('Flores', 'Angelina', 'Castro', NULL, 'Female', '1987-01-27', 'Ilaya 3rd', 'Dumangas', 'Ilaya 3rd', 2.0, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Aquino', 'Eduardo', 'Navarro', NULL, 'Male', '1966-08-12', 'Jardin', 'Dumangas', 'Jardin', 4.2, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Ramos', 'Cristina', 'Fernandez', NULL, 'Female', '1984-12-05', 'Lacturan', 'Dumangas', 'Lacturan', 1.6, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),

-- 21-30: More variety including lessees
('Villanueva', 'Miguel', 'Gonzales', NULL, 'Male', '1976-04-20', 'Lopez Jaena - Rizal', 'Dumangas', 'Lopez Jaena - Rizal', 2.9, 'farmer', FALSE, FALSE, TRUE, 'Submitted'),
('Santiago', 'Rosario', 'Martinez', NULL, 'Female', '1989-06-18', 'Managuit', 'Dumangas', 'Managuit', 1.3, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Rivera', 'Benjamin', 'Hernandez', NULL, 'Male', '1971-10-31', 'Maquina', 'Dumangas', 'Maquina', 3.8, 'farmer', FALSE, FALSE, TRUE, 'Submitted'),
('Diaz', 'Luisa', 'Reyes', NULL, 'Female', '1985-02-13', 'Nanding Lopez', 'Dumangas', 'Nanding Lopez', 2.2, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Gomez', 'Carlos', 'Santos', NULL, 'Male', '1968-07-08', 'Pagdugue', 'Dumangas', 'Pagdugue', 1.9, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),
('Perez', 'Estrella', 'Dela Cruz', NULL, 'Female', '1982-11-26', 'Paloc Bigque', 'Dumangas', 'Paloc Bigque', 3.4, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Castro', 'Ramon', 'Garcia', NULL, 'Male', '1973-05-19', 'Paloc Sool', 'Dumangas', 'Paloc Sool', 2.7, 'farmer', FALSE, FALSE, TRUE, 'Submitted'),
('Navarro', 'Norma', 'Castillo', NULL, 'Female', '1988-09-03', 'Patlad', 'Dumangas', 'Patlad', 1.5, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Torres', 'Alberto', 'Ramirez', NULL, 'Male', '1967-01-24', 'Pd Monfort North', 'Dumangas', 'Pd Monfort North', 4.1, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Lopez', 'Beatriz', 'Morales', NULL, 'Female', '1984-03-17', 'Pd Monfort South', 'Dumangas', 'Pd Monfort South', 2.5, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),

-- 31-40: Younger farmers with smaller farms
('Gonzales', 'Jerome', 'Velasco', NULL, 'Male', '1992-08-09', 'Pulao', 'Dumangas', 'Pulao', 1.2, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Martinez', 'Jennifer', 'Mendoza', NULL, 'Female', '1990-12-21', 'Rosario', 'Dumangas', 'Rosario', 1.8, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),
('Hernandez', 'Ryan', 'Cruz', NULL, 'Male', '1991-04-15', 'Sapao', 'Dumangas', 'Sapao', 2.1, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Reyes', 'Michelle', 'Bautista', NULL, 'Female', '1993-07-28', 'Sulangan', 'Dumangas', 'Sulangan', 1.4, 'farmer', FALSE, FALSE, TRUE, 'Submitted'),
('Santos', 'Mark', 'Flores', NULL, 'Male', '1989-10-11', 'Tabucan', 'Dumangas', 'Tabucan', 2.6, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Garcia', 'Anna', 'Aquino', NULL, 'Female', '1994-02-05', 'Talusan', 'Dumangas', 'Talusan', 1.6, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),
('Dela Cruz', 'Joseph', 'Ramos', NULL, 'Male', '1990-06-19', 'Tambobo', 'Dumangas', 'Tambobo', 2.9, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Mendoza', 'Maria Fe', 'Villanueva', NULL, 'Female', '1992-09-23', 'Tamboilan', 'Dumangas', 'Tamboilan', 1.7, 'farmer', FALSE, FALSE, TRUE, 'Submitted'),
('Cruz', 'Christian', 'Santiago', NULL, 'Male', '1988-11-07', 'Victorias', 'Dumangas', 'Victorias', 3.2, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Bautista', 'Sheryl', 'Rivera', NULL, 'Female', '1991-03-14', 'Aurora-Del Pilar', 'Dumangas', 'Aurora-Del Pilar', 2.0, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),

-- 41-50: Older experienced farmers with larger farms
('Flores', 'Rodrigo', 'Diaz', NULL, 'Male', '1960-05-10', 'Bacay', 'Dumangas', 'Bacay', 5.2, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Aquino', 'Teresita', 'Gomez', NULL, 'Female', '1963-09-22', 'Bacong', 'Dumangas', 'Bacong', 3.8, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Ramos', 'Francisco', 'Perez', NULL, 'Male', '1962-01-16', 'Balud', 'Dumangas', 'Balud', 4.6, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Villanueva', 'Perpetua', 'Castro', NULL, 'Female', '1964-07-29', 'Bantud Fabrica', 'Dumangas', 'Bantud Fabrica', 3.5, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),
('Santiago', 'Ernesto', 'Navarro', NULL, 'Male', '1961-11-03', 'Basa-Mabini Bonifacio', 'Dumangas', 'Basa-Mabini Bonifacio', 4.9, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Rivera', 'Felicitas', 'Torres', NULL, 'Female', '1965-03-25', 'Buenaflor Embarkadero', 'Dumangas', 'Buenaflor Embarkadero', 2.8, 'farmer', FALSE, FALSE, TRUE, 'Submitted'),
('Diaz', 'Marcelo', 'Lopez', NULL, 'Male', '1959-08-18', 'Burgos-Regidor', 'Dumangas', 'Burgos-Regidor', 5.5, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Gomez', 'Amparo', 'Gonzales', NULL, 'Female', '1966-12-11', 'Calao', 'Dumangas', 'Calao', 3.1, 'farmer', FALSE, TRUE, FALSE, 'Submitted'),
('Perez', 'Emilio', 'Martinez', NULL, 'Male', '1958-04-07', 'Cali', 'Dumangas', 'Cali', 6.2, 'farmer', TRUE, FALSE, FALSE, 'Submitted'),
('Castro', 'Remedios', 'Hernandez', NULL, 'Female', '1967-10-28', 'Cansilayan', 'Dumangas', 'Cansilayan', 4.3, 'farmer', TRUE, FALSE, FALSE, 'Submitted');

-- ============================================================================
-- FARM PARCELS INSERTION
-- ============================================================================
-- Now insert farm parcels for each farmer
-- We'll use farmer names to match submission_id since IDs are auto-generated
-- For simplicity, most farmers will have 1 parcel, but some will have 2-3 parcels

-- Parcels for Farmers 1-10 (All Registered Owners)
-- Use subquery to get submission_id based on farmer name
INSERT INTO rsbsa_farm_parcels (
    submission_id,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    within_ancestral_domain,
    ownership_document_no,
    agrarian_reform_beneficiary,
    ownership_type_registered_owner,
    ownership_type_tenant,
    ownership_type_lessee
) VALUES
((SELECT id FROM rsbsa_submission WHERE "FIRST NAME" = 'Juan' AND "LAST NAME" = 'Dela Cruz' LIMIT 1), '1', 'Aurora-Del Pilar', 'Dumangas', 2.5, 'No', 'TD-2015-0123', 'Yes', TRUE, FALSE, FALSE),
(2, '1', 'Bacay', 'Dumangas', 1.8, 'No', 'TD-2018-0456', 'No', TRUE, FALSE, FALSE),
(3, '1', 'Balabag', 'Dumangas', 2.0, 'No', 'TD-2012-0789', 'Yes', TRUE, FALSE, FALSE),
(3, '2', 'Balabag', 'Dumangas', 1.2, 'No', 'TD-2016-0790', 'Yes', TRUE, FALSE, FALSE),
(4, '1', 'Bantud', 'Dumangas', 2.1, 'No', 'TD-2017-1234', 'No', TRUE, FALSE, FALSE),
(5, '1', 'Baras', 'Dumangas', 3.0, 'No', 'TD-2010-5678', 'Yes', TRUE, FALSE, FALSE),
(5, '2', 'Baras', 'Dumangas', 1.5, 'No', 'TD-2014-5679', 'Yes', TRUE, FALSE, FALSE),
(6, '1', 'Barasan', 'Dumangas', 1.5, 'No', 'TD-2019-9012', 'No', TRUE, FALSE, FALSE),
(7, '1', 'Bolilao', 'Dumangas', 2.8, 'No', 'TD-2013-3456', 'Yes', TRUE, FALSE, FALSE),
(8, '1', 'Calao', 'Dumangas', 1.2, 'No', 'TD-2020-7890', 'No', TRUE, FALSE, FALSE),
(9, '1', 'Cali', 'Dumangas', 2.5, 'No', 'TD-2008-1122', 'Yes', TRUE, FALSE, FALSE),
(9, '2', 'Cali', 'Dumangas', 1.2, 'No', 'TD-2011-1123', 'No', TRUE, FALSE, FALSE),
(10, '1', 'Cansilayan', 'Dumangas', 2.3, 'No', 'TD-2016-3344', 'Yes', TRUE, FALSE, FALSE);

-- Parcels for Farmers 11-20 (Mix of Owners and Tenants)
INSERT INTO rsbsa_farm_parcels (
    submission_id,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    within_ancestral_domain,
    ownership_document_no,
    agrarian_reform_beneficiary,
    ownership_type_registered_owner,
    ownership_type_tenant,
    ownership_type_lessee,
    tenant_land_owner_name
) VALUES
(11, '1', 'Capaliz', 'Dumangas', 1.9, 'No', 'TD-2015-5566', 'No', TRUE, FALSE, FALSE, NULL),
(12, '1', 'Cayos', 'Dumangas', 2.6, 'No', NULL, 'Yes', FALSE, TRUE, FALSE, 'Dela Cruz, Juan'),
(13, '1', 'Compayan', 'Dumangas', 1.4, 'No', NULL, 'No', FALSE, TRUE, FALSE, 'Santos, Roberto'),
(14, '1', 'Dacutan', 'Dumangas', 3.1, 'No', 'TD-2019-7788', 'Yes', TRUE, FALSE, FALSE, NULL),
(15, '1', 'Ermita', 'Dumangas', 2.4, 'No', NULL, 'Yes', FALSE, TRUE, FALSE, 'Hernandez, Pedro'),
(16, '1', 'Ilaya 1st', 'Dumangas', 1.7, 'No', 'TD-2017-9900', 'No', TRUE, FALSE, FALSE, NULL),
(17, '1', 'Ilaya 2nd', 'Dumangas', 3.5, 'No', NULL, 'Yes', FALSE, TRUE, FALSE, 'Aquino, Eduardo'),
(18, '1', 'Ilaya 3rd', 'Dumangas', 2.0, 'No', 'TD-2020-1122', 'No', TRUE, FALSE, FALSE, NULL),
(19, '1', 'Jardin', 'Dumangas', 4.2, 'No', 'TD-2009-3344', 'Yes', TRUE, FALSE, FALSE, NULL),
(20, '1', 'Lacturan', 'Dumangas', 1.6, 'No', NULL, 'No', FALSE, TRUE, FALSE, 'Torres, Alberto');

-- Parcels for Farmers 21-30 (Including Lessees)
INSERT INTO rsbsa_farm_parcels (
    submission_id,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    within_ancestral_domain,
    ownership_document_no,
    agrarian_reform_beneficiary,
    ownership_type_registered_owner,
    ownership_type_tenant,
    ownership_type_lessee,
    lessee_land_owner_name
) VALUES
(21, '1', 'Lopez Jaena - Rizal', 'Dumangas', 2.9, 'No', NULL, 'No', FALSE, FALSE, TRUE, 'Gonzales, Antonio'),
(22, '1', 'Managuit', 'Dumangas', 1.3, 'No', 'TD-2021-5566', 'No', TRUE, FALSE, FALSE, NULL),
(23, '1', 'Maquina', 'Dumangas', 3.8, 'No', NULL, 'Yes', FALSE, FALSE, TRUE, 'Fernandez, Ricardo'),
(24, '1', 'Nanding Lopez', 'Dumangas', 2.2, 'No', 'TD-2018-7788', 'Yes', TRUE, FALSE, FALSE, NULL),
(25, '1', 'Pagdugue', 'Dumangas', 1.9, 'No', NULL, 'No', FALSE, TRUE, FALSE, NULL),
(26, '1', 'Paloc Bigque', 'Dumangas', 3.4, 'No', 'TD-2016-9900', 'Yes', TRUE, FALSE, FALSE, NULL),
(27, '1', 'Paloc Sool', 'Dumangas', 2.7, 'No', NULL, 'No', FALSE, FALSE, TRUE, 'Castillo, Manuel'),
(28, '1', 'Patlad', 'Dumangas', 1.5, 'No', 'TD-2020-1122', 'No', TRUE, FALSE, FALSE, NULL),
(29, '1', 'Pd Monfort North', 'Dumangas', 4.1, 'No', 'TD-2010-3344', 'Yes', TRUE, FALSE, FALSE, NULL),
(30, '1', 'Pd Monfort South', 'Dumangas', 2.5, 'No', NULL, 'No', FALSE, TRUE, FALSE, NULL);

-- Parcels for Farmers 31-40 (Younger Farmers)
INSERT INTO rsbsa_farm_parcels (
    submission_id,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    within_ancestral_domain,
    ownership_document_no,
    agrarian_reform_beneficiary,
    ownership_type_registered_owner,
    ownership_type_tenant,
    ownership_type_lessee,
    tenant_land_owner_name,
    lessee_land_owner_name
) VALUES
(31, '1', 'Pulao', 'Dumangas', 1.2, 'No', 'TD-2021-5566', 'No', TRUE, FALSE, FALSE, NULL, NULL),
(32, '1', 'Rosario', 'Dumangas', 1.8, 'No', NULL, 'No', FALSE, TRUE, FALSE, 'Velasco, Gloria', NULL),
(33, '1', 'Sapao', 'Dumangas', 2.1, 'No', 'TD-2020-7788', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(34, '1', 'Sulangan', 'Dumangas', 1.4, 'No', NULL, 'No', FALSE, FALSE, TRUE, NULL, 'Perez, Estrella'),
(35, '1', 'Tabucan', 'Dumangas', 2.6, 'No', 'TD-2019-9900', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(36, '1', 'Talusan', 'Dumangas', 1.6, 'No', NULL, 'No', FALSE, TRUE, FALSE, 'Flores, Alberto', NULL),
(37, '1', 'Tambobo', 'Dumangas', 2.9, 'No', 'TD-2021-1122', 'No', TRUE, FALSE, FALSE, NULL, NULL),
(38, '1', 'Tamboilan', 'Dumangas', 1.7, 'No', NULL, 'No', FALSE, FALSE, TRUE, NULL, 'Cruz, Christian'),
(39, '1', 'Victorias', 'Dumangas', 3.2, 'No', 'TD-2020-3344', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(40, '1', 'Aurora-Del Pilar', 'Dumangas', 2.0, 'No', NULL, 'Yes', FALSE, TRUE, FALSE, 'Dela Cruz, Juan', NULL);

-- Parcels for Farmers 41-50 (Older Experienced Farmers with Larger Farms)
INSERT INTO rsbsa_farm_parcels (
    submission_id,
    parcel_number,
    farm_location_barangay,
    farm_location_municipality,
    total_farm_area_ha,
    within_ancestral_domain,
    ownership_document_no,
    agrarian_reform_beneficiary,
    ownership_type_registered_owner,
    ownership_type_tenant,
    ownership_type_lessee,
    tenant_land_owner_name,
    lessee_land_owner_name
) VALUES
(41, '1', 'Bacay', 'Dumangas', 3.0, 'No', 'TD-2005-5566', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(41, '2', 'Bacay', 'Dumangas', 2.2, 'No', 'TD-2007-5567', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(42, '1', 'Bacong', 'Dumangas', 2.5, 'No', 'TD-2006-7788', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(42, '2', 'Bacong', 'Dumangas', 1.3, 'No', 'TD-2008-7789', 'No', TRUE, FALSE, FALSE, NULL, NULL),
(43, '1', 'Balud', 'Dumangas', 3.0, 'No', 'TD-2007-9900', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(43, '2', 'Balud', 'Dumangas', 1.6, 'No', 'TD-2009-9901', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(44, '1', 'Bantud Fabrica', 'Dumangas', 3.5, 'No', NULL, 'Yes', FALSE, TRUE, FALSE, 'Gonzales, Antonio', NULL),
(45, '1', 'Basa-Mabini Bonifacio', 'Dumangas', 3.2, 'No', 'TD-2004-1122', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(45, '2', 'Basa-Mabini Bonifacio', 'Dumangas', 1.7, 'No', 'TD-2006-1123', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(46, '1', 'Buenaflor Embarkadero', 'Dumangas', 2.8, 'No', NULL, 'No', FALSE, FALSE, TRUE, NULL, 'Diaz, Marcelo'),
(47, '1', 'Burgos-Regidor', 'Dumangas', 3.5, 'No', 'TD-2003-3344', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(47, '2', 'Burgos-Regidor', 'Dumangas', 2.0, 'No', 'TD-2005-3345', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(48, '1', 'Calao', 'Dumangas', 3.1, 'No', NULL, 'Yes', FALSE, TRUE, FALSE, 'Perez, Emilio', NULL),
(49, '1', 'Cali', 'Dumangas', 4.0, 'No', 'TD-2002-5566', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(49, '2', 'Cali', 'Dumangas', 2.2, 'No', 'TD-2004-5567', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(50, '1', 'Cansilayan', 'Dumangas', 2.8, 'No', 'TD-2010-7788', 'Yes', TRUE, FALSE, FALSE, NULL, NULL),
(50, '2', 'Cansilayan', 'Dumangas', 1.5, 'No', 'TD-2012-7789', 'No', TRUE, FALSE, FALSE, NULL, NULL);

-- Verification Query to check the data
-- SELECT 
--     r."LAST NAME",
--     r."FIRST NAME",
--     r."BARANGAY",
--     r."PARCEL_AREA",
--     r."OWNERSHIP_TYPE_REGISTERED_OWNER" as is_owner,
--     r."OWNERSHIP_TYPE_TENANT" as is_tenant,
--     r."OWNERSHIP_TYPE_LESSEE" as is_lessee
-- FROM rsbsa_submission r
-- ORDER BY r.id;

-- Count total farmers
-- SELECT COUNT(*) as total_farmers FROM rsbsa_submission;

-- Count farmers by ownership type
-- SELECT 
--     SUM(CASE WHEN "OWNERSHIP_TYPE_REGISTERED_OWNER" = TRUE THEN 1 ELSE 0 END) as registered_owners,
--     SUM(CASE WHEN "OWNERSHIP_TYPE_TENANT" = TRUE THEN 1 ELSE 0 END) as tenants,
--     SUM(CASE WHEN "OWNERSHIP_TYPE_LESSEE" = TRUE THEN 1 ELSE 0 END) as lessees
-- FROM rsbsa_submission;
