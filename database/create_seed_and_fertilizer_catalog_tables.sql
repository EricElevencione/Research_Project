-- Create catalog tables for JO Incentive allocation references
-- Run this once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS fertilizer_catalog (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  n_pk TEXT,
  default_unit TEXT NOT NULL DEFAULT 'bags',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seed_catalog (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  variety_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_unit TEXT NOT NULL DEFAULT 'kg',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO fertilizer_catalog (code, name, n_pk, default_unit, display_order, is_active)
VALUES
  ('urea_46_0_0', 'Urea', '46-0-0', 'bags', 10, TRUE),
  ('complete_14_14_14', 'Complete', '14-14-14', 'bags', 20, TRUE),
  ('ammonium_sulfate_21_0_0', 'Ammonium Sulfate', '21-0-0', 'bags', 30, TRUE),
  ('muriate_potash_0_0_60', 'Muriate of Potash', '0-0-60', 'bags', 40, TRUE)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  n_pk = EXCLUDED.n_pk,
  default_unit = EXCLUDED.default_unit,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO seed_catalog (variety_code, name, default_unit, display_order, is_active)
VALUES
  ('jackpot', 'Jackpot', 'kg', 10, TRUE),
  ('us88', 'US88', 'kg', 20, TRUE),
  ('th82', 'TH82', 'kg', 30, TRUE),
  ('rh9000', 'RH9000', 'kg', 40, TRUE),
  ('lumping143', 'Lumping143', 'kg', 50, TRUE),
  ('lp296', 'LP296', 'kg', 60, TRUE)
ON CONFLICT (variety_code) DO UPDATE
SET
  name = EXCLUDED.name,
  default_unit = EXCLUDED.default_unit,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
