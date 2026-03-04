-- ============================================================
-- REPLACE BARANGAY_CODES TABLE DATA
-- Clears all existing rows and re-inserts exactly the 45
-- barangays from Dumangas_map.json, codes 001-045.
-- ============================================================

-- STEP 1: Clear existing data
-- CASCADE will also remove any dependent rows (e.g. barangay_farmer_counters)
TRUNCATE TABLE barangay_codes RESTART IDENTITY CASCADE;

-- STEP 2: Insert all 45 correct barangays
INSERT INTO barangay_codes (barangay_name, barangay_code) VALUES
  ('Aurora-Del Pilar',      '001'),
  ('Bacay',                 '002'),
  ('Bacong',                '003'),
  ('Balabag',               '004'),
  ('Balud',                 '005'),
  ('Bantud',                '006'),
  ('Bantud Fabrica',        '007'),
  ('Baras',                 '008'),
  ('Barasan',               '009'),
  ('Basa-Mabini Bonifacio', '010'),
  ('Bolilao',               '011'),
  ('Buenaflor Embarkadero', '012'),
  ('Burgos-Regidor',        '013'),
  ('Calao',                 '014'),
  ('Cali',                  '015'),
  ('Cansilayan',            '016'),
  ('Capaliz',               '017'),
  ('Cayos',                 '018'),
  ('Compayan',              '019'),
  ('Dacutan',               '020'),
  ('Ermita',                '021'),
  ('Ilaya 1st',             '022'),
  ('Ilaya 2nd',             '023'),
  ('Ilaya 3rd',             '024'),
  ('Jardin',                '025'),
  ('Lacturan',              '026'),
  ('Lopez Jaena - Rizal',   '027'),
  ('Managuit',              '028'),
  ('Maquina',               '029'),
  ('Nanding Lopez',         '030'),
  ('Pagdugue',              '031'),
  ('Paloc Bigque',          '032'),
  ('Paloc Sool',            '033'),
  ('Patlad',                '034'),
  ('Pd Monfort North',      '035'),
  ('Pd Monfort South',      '036'),
  ('Pulao',                 '037'),
  ('Rosario',               '038'),
  ('Sapao',                 '039'),
  ('Sulangan',              '040'),
  ('Tabucan',               '041'),
  ('Talusan',               '042'),
  ('Tambobo',               '043'),
  ('Tamboilan',             '044'),
  ('Victorias',             '045');

-- STEP 3: Verify - should return exactly 45
SELECT COUNT(*) AS total_barangays FROM barangay_codes;

-- List all
SELECT barangay_code, barangay_name
FROM barangay_codes
ORDER BY barangay_code;
