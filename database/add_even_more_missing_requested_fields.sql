-- Add more missing requested item columns for farmer_requests
-- Supporting items found in regional_allocations but missing in farmer_requests

ALTER TABLE public.farmer_requests
  ADD COLUMN IF NOT EXISTS requested_complete_16_bags numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_np_16_20_0_bags numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_rice_seeds_nsic_rc440_kg numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_corn_seeds_hybrid_kg numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_corn_seeds_opm_kg numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_vegetable_seeds_kg numeric(10,2) DEFAULT 0;
