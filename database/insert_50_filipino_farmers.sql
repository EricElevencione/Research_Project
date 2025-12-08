-- Insert 50 Filipino farmers with realistic names and data
-- This script populates the rsbsa_submission and rsbsa_farm_parcels tables

DO $$
DECLARE
    v_submission_id INTEGER;
    v_counter INTEGER := 1;
BEGIN
    -- Farmer 1: Juan dela Cruz
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Dela Cruz', 'Juan', 'Santos', 'Male', '1975-03-15', 49,
        'Bacay', 'Dumangas', 'Bacay, Dumangas', 2.5,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Bacay', 'Dumangas', 2.5, true);

    -- Farmer 2: Maria Santos
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_POULTRY"
    ) VALUES (
        'Santos', 'Maria', 'Reyes', 'Female', '1982-07-22', 42,
        'Balabag', 'Dumangas', 'Balabag, Dumangas', 1.8,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Balabag', 'Dumangas', 1.8, true);

    -- Farmer 3: Pedro Garcia
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Garcia', 'Pedro', 'Mendoza', 'Male', '1968-11-08', 56,
        'Bantud', 'Dumangas', 'Bantud, Dumangas', 3.2,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Bantud', 'Dumangas', 3.2, true);

    -- Farmer 4: Rosa Villanueva
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT"
    ) VALUES (
        'Villanueva', 'Rosa', 'Torres', 'Female', '1979-05-18', 45,
        'Baras', 'Dumangas', 'Baras, Dumangas', 2.0,
        'farmer', true, 'Active Farmer', true, true, 'Vegetables'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Baras', 'Dumangas', 2.0, true);

    -- Farmer 5: Roberto Fernandez
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT"
    ) VALUES (
        'Fernandez', 'Roberto', 'Aquino', 'Male', '1985-09-12', 39,
        'Bolilao', 'Dumangas', 'Bolilao, Dumangas', 4.5,
        'farmer', true, 'Active Farmer', true, true, 'Carabao'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Bolilao', 'Dumangas', 4.5, true);

    -- Farmer 6: Carmen Lopez
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Lopez', 'Carmen', 'Ramos', 'Female', '1990-02-28', 34,
        'Calao', 'Dumangas', 'Calao, Dumangas', 1.5,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Calao', 'Dumangas', 1.5, true);

    -- Farmer 7: Antonio Bautista
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Bautista', 'Antonio', 'Castro', 'Male', '1972-06-05', 52,
        'Cali', 'Dumangas', 'Cali, Dumangas', 2.8,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Cali', 'Dumangas', 2.8, true);

    -- Farmer 8: Elena Gonzales
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_POULTRY", "FARMER_POULTRY_TEXT"
    ) VALUES (
        'Gonzales', 'Elena', 'Santiago', 'Female', '1987-12-14', 37,
        'Cansilayan', 'Dumangas', 'Cansilayan, Dumangas', 2.2,
        'farmer', true, 'Active Farmer', true, true, 'Chickens'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Cansilayan', 'Dumangas', 2.2, true);

    -- Farmer 9: Ricardo Flores
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN"
    ) VALUES (
        'Flores', 'Ricardo', 'Navarro', 'Male', '1980-04-20', 44,
        'Capaliz', 'Dumangas', 'Capaliz, Dumangas', 3.0,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Capaliz', 'Dumangas', 3.0, true);

    -- Farmer 10: Gloria Diaz
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT"
    ) VALUES (
        'Diaz', 'Gloria', 'Mercado', 'Female', '1976-08-30', 48,
        'Cayos', 'Dumangas', 'Cayos, Dumangas', 1.9,
        'farmer', true, 'Active Farmer', true, true, 'Tomatoes'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Cayos', 'Dumangas', 1.9, true);

    -- Farmer 11: Miguel Soriano
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Soriano', 'Miguel', 'Pascual', 'Male', '1983-01-25', 41,
        'Compayan', 'Dumangas', 'Compayan, Dumangas', 2.7,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Compayan', 'Dumangas', 2.7, true);

    -- Farmer 12: Luz Castillo
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Castillo', 'Luz', 'Valencia', 'Female', '1988-10-10', 36,
        'Dacutan', 'Dumangas', 'Dacutan, Dumangas', 1.6,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Dacutan', 'Dumangas', 1.6, true);

    -- Farmer 13: Jose Hernandez
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT"
    ) VALUES (
        'Hernandez', 'Jose', 'Morales', 'Male', '1970-07-03', 54,
        'Ermita', 'Dumangas', 'Ermita, Dumangas', 3.5,
        'farmer', true, 'Active Farmer', true, true, 'Goats'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Ermita', 'Dumangas', 3.5, true);

    -- Farmer 14: Teresita Valdez
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_POULTRY", "FARMER_POULTRY_TEXT"
    ) VALUES (
        'Valdez', 'Teresita', 'Domingo', 'Female', '1981-03-19', 43,
        'Ilaya 1st', 'Dumangas', 'Ilaya 1st, Dumangas', 2.1,
        'farmer', true, 'Active Farmer', true, true, 'Ducks'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Ilaya 1st', 'Dumangas', 2.1, true);

    -- Farmer 15: Fernando Aguilar
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Aguilar', 'Fernando', 'Cruz', 'Male', '1977-11-27', 47,
        'Ilaya 2nd', 'Dumangas', 'Ilaya 2nd, Dumangas', 2.9,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Ilaya 2nd', 'Dumangas', 2.9, true);

    -- Farmer 16: Angelica Robles
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Robles', 'Angelica', 'Miranda', 'Female', '1992-05-08', 32,
        'Ilaya 3rd', 'Dumangas', 'Ilaya 3rd, Dumangas', 1.4,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Ilaya 3rd', 'Dumangas', 1.4, true);

    -- Farmer 17: Eduardo Santiago
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN"
    ) VALUES (
        'Santiago', 'Eduardo', 'Gutierrez', 'Male', '1974-09-16', 50,
        'Jardin', 'Dumangas', 'Jardin, Dumangas', 3.3,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Jardin', 'Dumangas', 3.3, true);

    -- Farmer 18: Imelda Jimenez
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT"
    ) VALUES (
        'Jimenez', 'Imelda', 'Ocampo', 'Female', '1984-12-02', 40,
        'Lacturan', 'Dumangas', 'Lacturan, Dumangas', 2.3,
        'farmer', true, 'Active Farmer', true, true, 'Eggplant'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Lacturan', 'Dumangas', 2.3, true);

    -- Farmer 19: Ramon Del Rosario
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Del Rosario', 'Ramon', 'Perez', 'Male', '1969-02-11', 55,
        'Managuit', 'Dumangas', 'Managuit, Dumangas', 4.0,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Managuit', 'Dumangas', 4.0, true);

    -- Farmer 20: Nora Salazar
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Salazar', 'Nora', 'Rivera', 'Female', '1986-06-24', 38,
        'Maquina', 'Dumangas', 'Maquina, Dumangas', 1.7,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Maquina', 'Dumangas', 1.7, true);

    -- Farmer 21: Alfredo Romero
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT"
    ) VALUES (
        'Romero', 'Alfredo', 'Silva', 'Male', '1978-08-07', 46,
        'Nanding Lopez', 'Dumangas', 'Nanding Lopez, Dumangas', 3.8,
        'farmer', true, 'Active Farmer', true, true, 'Pigs'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Nanding Lopez', 'Dumangas', 3.8, true);

    -- Farmer 22: Josefina Velasco
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_POULTRY", "FARMER_POULTRY_TEXT"
    ) VALUES (
        'Velasco', 'Josefina', 'Alvarez', 'Female', '1991-04-13', 33,
        'Pagdugue', 'Dumangas', 'Pagdugue, Dumangas', 2.0,
        'farmer', true, 'Active Farmer', true, true, 'Chickens'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Pagdugue', 'Dumangas', 2.0, true);

    -- Farmer 23: Daniel Medina
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Medina', 'Daniel', 'Iglesias', 'Male', '1973-10-29', 51,
        'Paloc Bigque', 'Dumangas', 'Paloc Bigque, Dumangas', 2.6,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Paloc Bigque', 'Dumangas', 2.6, true);

    -- Farmer 24: Corazon Manalo
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Manalo', 'Corazon', 'Tan', 'Female', '1989-01-17', 35,
        'Paloc Sool', 'Dumangas', 'Paloc Sool, Dumangas', 1.8,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Paloc Sool', 'Dumangas', 1.8, true);

    -- Farmer 25: Vicente Paguio
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN"
    ) VALUES (
        'Paguio', 'Vicente', 'Rosales', 'Male', '1971-07-21', 53,
        'Patlad', 'Dumangas', 'Patlad, Dumangas', 3.1,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Patlad', 'Dumangas', 3.1, true);

    -- Farmer 26: Amelita Cordero
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT"
    ) VALUES (
        'Cordero', 'Amelita', 'Gomez', 'Female', '1985-11-09', 39,
        'Pulao', 'Dumangas', 'Pulao, Dumangas', 2.4,
        'farmer', true, 'Active Farmer', true, true, 'Okra'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Pulao', 'Dumangas', 2.4, true);

    -- Farmer 27: Benjamin Padilla
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Padilla', 'Benjamin', 'Laurel', 'Male', '1976-03-26', 48,
        'Rosario', 'Dumangas', 'Rosario, Dumangas', 2.9,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Rosario', 'Dumangas', 2.9, true);

    -- Farmer 28: Lydia Marquez
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Marquez', 'Lydia', 'Cabrera', 'Female', '1993-09-05', 31,
        'Sapao', 'Dumangas', 'Sapao, Dumangas', 1.5,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Sapao', 'Dumangas', 1.5, true);

    -- Farmer 29: Ronaldo Enriquez
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT"
    ) VALUES (
        'Enriquez', 'Ronaldo', 'Abad', 'Male', '1980-12-18', 44,
        'Sulangan', 'Dumangas', 'Sulangan, Dumangas', 4.2,
        'farmer', true, 'Active Farmer', true, true, 'Carabao'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Sulangan', 'Dumangas', 4.2, true);

    -- Farmer 30: Rosario Lim
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_POULTRY", "FARMER_POULTRY_TEXT"
    ) VALUES (
        'Lim', 'Rosario', 'Suarez', 'Female', '1987-05-31', 37,
        'Tabucan', 'Dumangas', 'Tabucan, Dumangas', 2.1,
        'farmer', true, 'Active Farmer', true, true, 'Ducks'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Tabucan', 'Dumangas', 2.1, true);

    -- Farmer 31: Ernesto Magno
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Magno', 'Ernesto', 'Villar', 'Male', '1972-08-14', 52,
        'Talusan', 'Dumangas', 'Talusan, Dumangas', 3.4,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Talusan', 'Dumangas', 3.4, true);

    -- Farmer 32: Divina Ocampo
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Ocampo', 'Divina', 'Pascual', 'Female', '1990-10-22', 34,
        'Tambobo', 'Dumangas', 'Tambobo, Dumangas', 1.6,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Tambobo', 'Dumangas', 1.6, true);

    -- Farmer 33: Rodrigo Prado
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN"
    ) VALUES (
        'Prado', 'Rodrigo', 'Luna', 'Male', '1975-04-06', 49,
        'Tamboilan', 'Dumangas', 'Tamboilan, Dumangas', 3.6,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Tamboilan', 'Dumangas', 3.6, true);

    -- Farmer 34: Estrella Ibarra
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT"
    ) VALUES (
        'Ibarra', 'Estrella', 'Solis', 'Female', '1983-02-15', 41,
        'Victorias', 'Dumangas', 'Victorias, Dumangas', 2.3,
        'farmer', true, 'Active Farmer', true, true, 'Peppers'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Victorias', 'Dumangas', 2.3, true);

    -- Farmer 35: Gregorio Navarro
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Navarro', 'Gregorio', 'Ortega', 'Male', '1969-06-11', 55,
        'Bacong', 'Dumangas', 'Bacong, Dumangas', 3.9,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Bacong', 'Dumangas', 3.9, true);

    -- Farmer 36: Pacita Villareal
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Villareal', 'Pacita', 'Zamora', 'Female', '1988-07-28', 36,
        'Balud', 'Dumangas', 'Balud, Dumangas', 1.7,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Balud', 'Dumangas', 1.7, true);

    -- Farmer 37: Leonido Caballero
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT"
    ) VALUES (
        'Caballero', 'Leonido', 'Delgado', 'Male', '1977-09-03', 47,
        'Bantud Fabrica', 'Dumangas', 'Bantud Fabrica, Dumangas', 4.1,
        'farmer', true, 'Active Farmer', true, true, 'Goats'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Bantud Fabrica', 'Dumangas', 4.1, true);

    -- Farmer 38: Violeta Paredes
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_POULTRY", "FARMER_POULTRY_TEXT"
    ) VALUES (
        'Paredes', 'Violeta', 'Reyes', 'Female', '1991-12-07', 33,
        'Barasan', 'Dumangas', 'Barasan, Dumangas', 1.9,
        'farmer', true, 'Active Farmer', true, true, 'Chickens'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Barasan', 'Dumangas', 1.9, true);

    -- Farmer 39: Ignacio Benitez
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Benitez', 'Ignacio', 'Natividad', 'Male', '1974-01-19', 50,
        'Aurora-Del Pilar', 'Dumangas', 'Aurora-Del Pilar, Dumangas', 2.8,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Aurora-Del Pilar', 'Dumangas', 2.8, true);

    -- Farmer 40: Milagros Arellano
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Arellano', 'Milagros', 'Carreon', 'Female', '1986-11-25', 38,
        'Bacay', 'Dumangas', 'Bacay, Dumangas', 1.8,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Bacay', 'Dumangas', 1.8, true);

    -- Farmer 41: Nestor Palma
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN"
    ) VALUES (
        'Palma', 'Nestor', 'Gallardo', 'Male', '1970-05-14', 54,
        'Balabag', 'Dumangas', 'Balabag, Dumangas', 3.7,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Balabag', 'Dumangas', 3.7, true);

    -- Farmer 42: Felicidad Espinosa
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT"
    ) VALUES (
        'Espinosa', 'Felicidad', 'Cortez', 'Female', '1982-03-09', 42,
        'Bantud', 'Dumangas', 'Bantud, Dumangas', 2.2,
        'farmer', true, 'Active Farmer', true, true, 'Bitter Gourd'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Bantud', 'Dumangas', 2.2, true);

    -- Farmer 43: Arturo Concepcion
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Concepcion', 'Arturo', 'Mendoza', 'Male', '1979-10-01', 45,
        'Baras', 'Dumangas', 'Baras, Dumangas', 3.0,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Baras', 'Dumangas', 3.0, true);

    -- Farmer 44: Esperanza Trinidad
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Trinidad', 'Esperanza', 'Bautista', 'Female', '1992-06-16', 32,
        'Bolilao', 'Dumangas', 'Bolilao, Dumangas', 1.5,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Bolilao', 'Dumangas', 1.5, true);

    -- Farmer 45: Rodolfo Buenaventura
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT"
    ) VALUES (
        'Buenaventura', 'Rodolfo', 'Vitug', 'Male', '1973-08-23', 51,
        'Calao', 'Dumangas', 'Calao, Dumangas', 4.3,
        'farmer', true, 'Active Farmer', true, true, 'Pigs'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Calao', 'Dumangas', 4.3, true);

    -- Farmer 46: Soledad Guerrero
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_POULTRY", "FARMER_POULTRY_TEXT"
    ) VALUES (
        'Guerrero', 'Soledad', 'De Leon', 'Female', '1984-04-30', 40,
        'Cali', 'Dumangas', 'Cali, Dumangas', 2.0,
        'farmer', true, 'Active Farmer', true, true, 'Ducks'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Cali', 'Dumangas', 2.0, true);

    -- Farmer 47: Arsenio Montero
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_CORN"
    ) VALUES (
        'Montero', 'Arsenio', 'Salvador', 'Male', '1971-12-12', 53,
        'Cansilayan', 'Dumangas', 'Cansilayan, Dumangas', 3.2,
        'farmer', true, 'Active Farmer', true, true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Cansilayan', 'Dumangas', 3.2, true);

    -- Farmer 48: Basilisa Navales
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE"
    ) VALUES (
        'Navales', 'Basilisa', 'De Guzman', 'Female', '1989-07-04', 35,
        'Capaliz', 'Dumangas', 'Capaliz, Dumangas', 1.6,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Capaliz', 'Dumangas', 1.6, true);

    -- Farmer 49: Wilfredo Macapagal
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_CORN"
    ) VALUES (
        'Macapagal', 'Wilfredo', 'Aquino', 'Male', '1976-02-20', 48,
        'Cayos', 'Dumangas', 'Cayos, Dumangas', 3.5,
        'farmer', true, 'Active Farmer', true
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Cayos', 'Dumangas', 3.5, true);

    -- Farmer 50: Zenaida Laurente
    INSERT INTO rsbsa_submission (
        "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BIRTHDATE", age,
        "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "TOTAL FARM AREA",
        "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", status,
        "FARMER_RICE", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT"
    ) VALUES (
        'Laurente', 'Zenaida', 'Quinto', 'Female', '1985-09-29', 39,
        'Compayan', 'Dumangas', 'Compayan, Dumangas', 2.5,
        'farmer', true, 'Active Farmer', true, true, 'String Beans'
    ) RETURNING id INTO v_submission_id;
    
    INSERT INTO rsbsa_farm_parcels (submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_registered_owner)
    VALUES (v_submission_id, '1', 'Compayan', 'Dumangas', 2.5, true);

    RAISE NOTICE '✅ Successfully inserted 50 Filipino farmers with unique names!';
END $$;
