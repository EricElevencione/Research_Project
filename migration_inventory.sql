-- ============================================================
-- STEP 1: Add `unit` column to the existing variety catalog tables
--         (shortages_seeds and shortages_fertilizers are the source
--          of truth for unit of measurement)
-- ============================================================
ALTER TABLE public.shortages_seeds
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'kg';

ALTER TABLE public.shortages_fertilizers
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'bags';

-- ============================================================
-- STEP 2: Create the master inventory table
--
-- product_id   → the `id` value from shortages_seeds
--                OR shortages_fertilizers
-- product_type → 'seed' | 'fertilizer'
--                discriminator so the app knows which catalog
--                table to look up for name/unit/category details
--
-- NOTE: A single SQL FOREIGN KEY cannot point to two different
--       tables, so we use product_type as the discriminator
--       instead of two separate FK columns.
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS inventory_id_seq;

CREATE TABLE public.inventory (
  id           integer   NOT NULL DEFAULT nextval('inventory_id_seq'::regclass),
  product_id   text      NOT NULL,
  product_type text      NOT NULL CHECK (product_type IN ('seed', 'fertilizer')),
  category     text,
  stock_qty    numeric   DEFAULT 0,
  used_qty     numeric   DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_product_id_unique UNIQUE (product_id)
);

-- ============================================================
-- STEP 3: Pre-populate inventory with all active products
--         from both variety catalog tables (stock starts at 0)
--
-- Seeds → from shortages_seeds (is_active = true)
-- Fertilizers → from shortages_fertilizers (is_active = true)
--
-- ON CONFLICT DO NOTHING means it is safe to re-run this
-- script without duplicating rows.
-- ============================================================

INSERT INTO public.inventory (product_id, product_type, category, stock_qty, used_qty, last_updated)
SELECT
  id           AS product_id,
  'seed'       AS product_type,
  category     AS category,
  0            AS stock_qty,
  0            AS used_qty,
  now()        AS last_updated
FROM public.shortages_seeds
WHERE is_active = true
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.inventory (product_id, product_type, category, stock_qty, used_qty, last_updated)
SELECT
  id              AS product_id,
  'fertilizer'    AS product_type,
  category        AS category,
  0               AS stock_qty,
  0               AS used_qty,
  now()           AS last_updated
FROM public.shortages_fertilizers
WHERE is_active = true
ON CONFLICT (product_id) DO NOTHING;
