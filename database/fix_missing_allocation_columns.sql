-- ============================================================================
-- FIX MISSING ALLOCATION COLUMNS
-- This script ensures all Philrice catalog items are present in the database.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- 1. Update regional_allocations table (Admin side)
ALTER TABLE public.regional_allocations
  -- Missing Fertilizer Columns
  ADD COLUMN IF NOT EXISTS np_16_20_0_bags INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ammonium_phosphate_16_20_0_bags INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complete_16_16_16_bags INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zinc_sulfate_bags INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vermicompost_bags INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chicken_manure_bags INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rice_straw_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carbonized_rice_hull_bags INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS biofertilizer_liters DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nanobiofertilizer_liters DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS organic_root_exudate_mix_liters DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS azolla_microphylla_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS foliar_liquid_fertilizer_npk_liters DECIMAL(10,2) DEFAULT 0,

  -- Missing Seed Columns (Mestiso series)
  ADD COLUMN IF NOT EXISTS mestiso_1_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mestiso_20_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mestiso_29_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mestiso_55_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mestiso_73_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mestiso_99_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mestiso_103_kg DECIMAL(10,2) DEFAULT 0,

  -- Missing Seed Columns (NSIC series)
  ADD COLUMN IF NOT EXISTS nsic_rc402_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nsic_rc480_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nsic_rc216_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nsic_rc218_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nsic_rc506_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nsic_rc508_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nsic_rc512_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nsic_rc534_kg DECIMAL(10,2) DEFAULT 0,

  -- Missing Seed Columns (Environment specific)
  ADD COLUMN IF NOT EXISTS tubigan_28_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tubigan_30_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tubigan_22_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sahod_ulan_2_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sahod_ulan_10_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salinas_6_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salinas_7_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salinas_8_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS malagkit_5_kg DECIMAL(10,2) DEFAULT 0;

-- 2. Update farmer_requests table (JO side)
-- Ensures JO can request these items even if not specifically listed before
ALTER TABLE public.farmer_requests
  ADD COLUMN IF NOT EXISTS requested_np_16_20_0_bags DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_ammonium_phosphate_bags DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_complete_16_bags DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_zinc_sulfate_bags DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_vermicompost_bags DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_chicken_manure_bags DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_rice_straw_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_carbonized_rice_hull_bags DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_biofertilizer_liters DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_nanobiofertilizer_liters DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_organic_root_exudate_mix_liters DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_azolla_microphylla_kg DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_foliar_liquid_fertilizer_npk_liters DECIMAL(10,2) DEFAULT 0;
