-- ============================================================================
-- Supabase Shortages RPC (Seeds + Fertilizers + Resolvers)
-- ============================================================================
-- Run this in Supabase SQL Editor.
-- This migration creates:
-- 1) Catalog tables for shortages logic
-- 2) Public read policies
-- 3) RPCs consumed by frontend API wrappers:
--    - list_shortages_seeds()
--    - list_shortages_fertilizers()
--    - resolve_fertilizer_shortage(seed_id, shortage_fert_id, unavailable_ids)
--    - resolve_seed_shortage(seed_id, unavailable_ids)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shortages_fertilizers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  tier INTEGER NOT NULL,
  nutrient_role TEXT,
  nutrient_type TEXT,
  application_timing TEXT,
  form TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shortages_seeds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  nsic_code TEXT,
  yield_display TEXT,
  yield_min_tha NUMERIC,
  yield_max_tha NUMERIC,
  maturity_days INTEGER,
  environment TEXT,
  status TEXT,
  fertilizer_responsiveness_rank INTEGER,
  compatibility_source TEXT,
  fertilizer_compatibility JSONB NOT NULL DEFAULT '[]'::JSONB,
  sort_order INTEGER NOT NULL DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shortages_fertilizer_role_fallback (
  nutrient_role TEXT NOT NULL,
  fallback_fertilizer_id TEXT NOT NULL REFERENCES public.shortages_fertilizers(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (nutrient_role, fallback_fertilizer_id)
);

CREATE TABLE IF NOT EXISTS public.shortages_role_bridge (
  from_role TEXT NOT NULL,
  to_role TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_role, to_role)
);

CREATE INDEX IF NOT EXISTS idx_shortages_fertilizers_role_tier
  ON public.shortages_fertilizers (nutrient_role, tier, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_shortages_seeds_category_env
  ON public.shortages_seeds (category, environment, is_active, sort_order);

-- ----------------------------------------------------------------------------
-- RLS + Policies
-- ----------------------------------------------------------------------------

ALTER TABLE public.shortages_fertilizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortages_seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortages_fertilizer_role_fallback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortages_role_bridge ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shortages_fertilizers' AND policyname = 'shortages_fertilizers_read_all'
  ) THEN
    CREATE POLICY shortages_fertilizers_read_all
      ON public.shortages_fertilizers FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shortages_seeds' AND policyname = 'shortages_seeds_read_all'
  ) THEN
    CREATE POLICY shortages_seeds_read_all
      ON public.shortages_seeds FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shortages_fertilizer_role_fallback' AND policyname = 'shortages_role_fallback_read_all'
  ) THEN
    CREATE POLICY shortages_role_fallback_read_all
      ON public.shortages_fertilizer_role_fallback FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shortages_role_bridge' AND policyname = 'shortages_role_bridge_read_all'
  ) THEN
    CREATE POLICY shortages_role_bridge_read_all
      ON public.shortages_role_bridge FOR SELECT
      USING (true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Helper Functions
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.shortages_top3_fertilizer_ids(
  p_compat JSONB
)
RETURNS TEXT[]
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT fert_id
      FROM (
        SELECT
          (entry->>'fertilizer_id')::TEXT AS fert_id,
          COALESCE(NULLIF(entry->>'rank', '')::INT, 999999) AS rank_value,
          ord
        FROM jsonb_array_elements(COALESCE(p_compat, '[]'::JSONB)) WITH ORDINALITY AS e(entry, ord)
      ) ranked
      WHERE fert_id IS NOT NULL AND fert_id <> ''
      ORDER BY rank_value, ord
      LIMIT 3
    ),
    ARRAY[]::TEXT[]
  );
$$;

CREATE OR REPLACE FUNCTION public.shortages_array_except(
  p_left TEXT[],
  p_right TEXT[]
)
RETURNS TEXT[]
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT item
      FROM unnest(COALESCE(p_left, ARRAY[]::TEXT[])) AS item
      WHERE NOT (item = ANY(COALESCE(p_right, ARRAY[]::TEXT[])))
    ),
    ARRAY[]::TEXT[]
  );
$$;

-- ----------------------------------------------------------------------------
-- List RPCs
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_shortages_seeds()
RETURNS TABLE (
  id TEXT,
  name TEXT,
  category TEXT,
  environment TEXT,
  maturity_days INTEGER,
  yield_display TEXT,
  status TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.category,
    s.environment,
    s.maturity_days,
    s.yield_display,
    s.status
  FROM public.shortages_seeds s
  WHERE s.is_active = TRUE
  ORDER BY s.sort_order, s.name;
$$;

CREATE OR REPLACE FUNCTION public.list_shortages_fertilizers()
RETURNS TABLE (
  id TEXT,
  name TEXT,
  category TEXT,
  tier INTEGER,
  nutrient_role TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.name,
    f.category,
    f.tier,
    f.nutrient_role
  FROM public.shortages_fertilizers f
  WHERE f.is_active = TRUE
  ORDER BY f.tier, f.sort_order, f.name;
$$;

-- ----------------------------------------------------------------------------
-- Fertilizer Resolver RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_fertilizer_shortage(
  seed_id TEXT DEFAULT NULL,
  shortage_fert_id TEXT DEFAULT NULL,
  unavailable_ids TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seed RECORD;
  v_seed_json JSONB := NULL;
  v_shortage RECORD;
  v_has_seed_context BOOLEAN := COALESCE(NULLIF(TRIM(seed_id), ''), '') <> '';
  v_unavailable TEXT[] := COALESCE(unavailable_ids, ARRAY[]::TEXT[]);
  v_candidate RECORD;
  v_entry RECORD;
  v_role TEXT;
BEGIN
  IF COALESCE(NULLIF(TRIM(shortage_fert_id), ''), '') = '' THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'seed', NULL,
      'shortage', NULL,
      'suggestion', NULL,
      'message', 'shortageFertId is required.'
    );
  END IF;

  SELECT * INTO v_shortage
  FROM public.shortages_fertilizers
  WHERE id = shortage_fert_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'seed', NULL,
      'shortage', NULL,
      'suggestion', NULL,
      'message', 'The requested seed or fertilizer could not be found.'
    );
  END IF;

  IF v_has_seed_context THEN
    SELECT * INTO v_seed
    FROM public.shortages_seeds
    WHERE id = seed_id AND is_active = TRUE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'status', 'error',
        'seed', NULL,
        'shortage', jsonb_build_object(
          'id', v_shortage.id,
          'name', v_shortage.name,
          'nutrient_role', v_shortage.nutrient_role
        ),
        'suggestion', NULL,
        'message', 'The requested seed or fertilizer could not be found.'
      );
    END IF;

    v_seed_json := jsonb_build_object('id', v_seed.id, 'name', v_seed.name);
  END IF;

  v_unavailable := array_append(v_unavailable, shortage_fert_id);

  -- STEP 1: Seed compatibility Tier 1
  IF v_has_seed_context THEN
    FOR v_entry IN
      SELECT
        (entry->>'fertilizer_id')::TEXT AS fertilizer_id,
        COALESCE(NULLIF(entry->>'rank', '')::INT, 999999) AS rank_on_seed,
        (entry->>'reason')::TEXT AS reason,
        ord
      FROM jsonb_array_elements(COALESCE(v_seed.fertilizer_compatibility, '[]'::JSONB)) WITH ORDINALITY AS e(entry, ord)
      ORDER BY rank_on_seed, ord
    LOOP
      SELECT * INTO v_candidate
      FROM public.shortages_fertilizers f
      WHERE f.id = v_entry.fertilizer_id
        AND f.is_active = TRUE
        AND f.tier = 1
        AND NOT (f.id = ANY(v_unavailable));

      IF FOUND THEN
        RETURN jsonb_build_object(
          'status', 'resolved',
          'seed', v_seed_json,
          'shortage', jsonb_build_object(
            'id', v_shortage.id,
            'name', v_shortage.name,
            'nutrient_role', v_shortage.nutrient_role
          ),
          'suggestion', jsonb_build_object(
            'id', v_candidate.id,
            'name', v_candidate.name,
            'tier', v_candidate.tier,
            'nutrient_role', v_candidate.nutrient_role,
            'rank_on_seed', v_entry.rank_on_seed,
            'reason', COALESCE(v_entry.reason, 'Seed-ranked compatible substitute.')
          ),
          'message', format('%s is the best available Tier 1 substitute for %s.', v_candidate.name, v_seed.name)
        );
      END IF;
    END LOOP;
  END IF;

  -- STEP 2: Nutrient-role fallback (same role, mapped role fallback, bridged roles)
  v_role := v_shortage.nutrient_role;

  SELECT c.* INTO v_candidate
  FROM (
    SELECT DISTINCT ON (f.id)
      f.id,
      f.name,
      f.tier,
      f.nutrient_role,
      f.sort_order,
      src_priority
    FROM (
      -- a) tier2 in same nutrient role
      SELECT f.id, f.name, f.tier, f.nutrient_role, f.sort_order, 1 AS src_priority
      FROM public.shortages_fertilizers f
      WHERE f.is_active = TRUE
        AND f.tier = 2
        AND f.nutrient_role = v_role

      UNION ALL

      -- b) explicit fallback map for same role
      SELECT f.id, f.name, f.tier, f.nutrient_role, COALESCE(m.sort_order, f.sort_order) AS sort_order, 2 AS src_priority
      FROM public.shortages_fertilizer_role_fallback m
      JOIN public.shortages_fertilizers f ON f.id = m.fallback_fertilizer_id
      WHERE m.is_active = TRUE
        AND f.is_active = TRUE
        AND m.nutrient_role = v_role

      UNION ALL

      -- c) tier2 on bridged role(s)
      SELECT f.id, f.name, f.tier, f.nutrient_role, f.sort_order, 3 AS src_priority
      FROM public.shortages_role_bridge rb
      JOIN public.shortages_fertilizers f
        ON f.nutrient_role = rb.to_role
       AND f.tier = 2
       AND f.is_active = TRUE
      WHERE rb.is_active = TRUE
        AND rb.from_role = v_role

      UNION ALL

      -- d) fallback map on bridged role(s)
      SELECT f.id, f.name, f.tier, f.nutrient_role, COALESCE(m.sort_order, f.sort_order) AS sort_order, 4 AS src_priority
      FROM public.shortages_role_bridge rb
      JOIN public.shortages_fertilizer_role_fallback m
        ON m.nutrient_role = rb.to_role
       AND m.is_active = TRUE
      JOIN public.shortages_fertilizers f
        ON f.id = m.fallback_fertilizer_id
       AND f.is_active = TRUE
      WHERE rb.is_active = TRUE
        AND rb.from_role = v_role
    ) f
    WHERE NOT (f.id = ANY(v_unavailable))
    ORDER BY f.id, src_priority, f.sort_order, f.id
  ) c
  ORDER BY c.src_priority, c.sort_order, c.id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'tier2_fallback',
      'seed', v_seed_json,
      'shortage', jsonb_build_object(
        'id', v_shortage.id,
        'name', v_shortage.name,
        'nutrient_role', v_shortage.nutrient_role
      ),
      'suggestion', jsonb_build_object(
        'id', v_candidate.id,
        'name', v_candidate.name,
        'tier', v_candidate.tier,
        'nutrient_role', v_candidate.nutrient_role,
        'rank_on_seed', NULL,
        'reason', format('Last-resort fallback in the same nutrient role (%s).', v_role)
      ),
      'message', CASE
        WHEN v_has_seed_context
          THEN format('%s is a Tier 2 last-resort fallback for the current shortage.', v_candidate.name)
        ELSE format('%s is a nutrient-role fallback for the current fertilizer shortage.', v_candidate.name)
      END
    );
  END IF;

  -- STEP 3: Unresolvable
  RETURN jsonb_build_object(
    'status', 'unresolvable',
    'seed', v_seed_json,
    'shortage', jsonb_build_object(
      'id', v_shortage.id,
      'name', v_shortage.name,
      'nutrient_role', v_shortage.nutrient_role
    ),
    'suggestion', NULL,
    'message', 'No suitable fertilizer substitute is available. Please alert the operator.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'seed', NULL,
      'shortage', NULL,
      'suggestion', NULL,
      'message', format('Unable to resolve fertilizer shortage: %s', SQLERRM)
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- Seed Resolver RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_seed_shortage(
  seed_id TEXT,
  unavailable_ids TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original RECORD;
  v_unavailable TEXT[] := COALESCE(unavailable_ids, ARRAY[]::TEXT[]);
  v_original_top3 TEXT[];
  v_candidate RECORD;
  v_candidate_top3 TEXT[];
  v_added TEXT[];
  v_removed TEXT[];
  v_has_shift BOOLEAN;
  v_substitutes JSONB := '[]'::JSONB;
  v_maturity_diff INTEGER;
  v_yield_diff NUMERIC;
  v_original_yield NUMERIC;
BEGIN
  SELECT * INTO v_original
  FROM public.shortages_seeds
  WHERE id = seed_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'original', NULL,
      'substitutes', jsonb_build_array(),
      'message', 'The requested seed could not be found.'
    );
  END IF;

  v_unavailable := array_append(v_unavailable, seed_id);
  v_original_top3 := public.shortages_top3_fertilizer_ids(v_original.fertilizer_compatibility);
  v_original_yield := v_original.yield_max_tha;

  FOR v_candidate IN
    SELECT s.*
    FROM public.shortages_seeds s
    WHERE s.is_active = TRUE
      AND NOT (s.id = ANY(v_unavailable))
      AND s.category = v_original.category
      AND s.environment = v_original.environment
      AND (
        v_original.maturity_days IS NULL
        OR (
          s.maturity_days IS NOT NULL
          AND ABS(s.maturity_days - v_original.maturity_days) <= 10
        )
      )
    ORDER BY
      CASE
        WHEN v_original_yield IS NULL OR s.yield_max_tha IS NULL THEN 1
        ELSE 0
      END,
      CASE
        WHEN v_original_yield IS NULL OR s.yield_max_tha IS NULL THEN NULL
        ELSE ABS(s.yield_max_tha - v_original_yield)
      END,
      s.sort_order,
      s.id
  LOOP
    v_candidate_top3 := public.shortages_top3_fertilizer_ids(v_candidate.fertilizer_compatibility);
    v_added := public.shortages_array_except(v_candidate_top3, v_original_top3);
    v_removed := public.shortages_array_except(v_original_top3, v_candidate_top3);
    v_has_shift := COALESCE(array_length(v_added, 1), 0) > 0 OR COALESCE(array_length(v_removed, 1), 0) > 0;

    IF v_original.maturity_days IS NULL OR v_candidate.maturity_days IS NULL THEN
      v_maturity_diff := NULL;
    ELSE
      v_maturity_diff := v_candidate.maturity_days - v_original.maturity_days;
    END IF;

    IF v_original.yield_max_tha IS NULL OR v_candidate.yield_max_tha IS NULL THEN
      v_yield_diff := NULL;
    ELSE
      v_yield_diff := ROUND((v_candidate.yield_max_tha - v_original.yield_max_tha)::NUMERIC, 2);
    END IF;

    v_substitutes := v_substitutes || jsonb_build_array(
      jsonb_build_object(
        'id', v_candidate.id,
        'name', v_candidate.name,
        'category', v_candidate.category,
        'environment', v_candidate.environment,
        'maturity_days', v_candidate.maturity_days,
        'yield_display', v_candidate.yield_display,
        'yield_max_tha', v_candidate.yield_max_tha,
        'top_3_fertilizers', to_jsonb(v_candidate_top3),
        'maturity_diff_days', v_maturity_diff,
        'yield_diff_tha', v_yield_diff,
        'fertilizer_shift', jsonb_build_object(
          'has_shift', v_has_shift,
          'message', CASE
            WHEN v_has_shift THEN format('%s has different top fertilizer priorities. Review added and removed fertilizers before recommending this seed.', v_candidate.name)
            ELSE 'Top 3 fertilizer priorities are aligned with the original seed.'
          END,
          'added', to_jsonb(v_added),
          'removed', to_jsonb(v_removed)
        )
      )
    );
  END LOOP;

  IF jsonb_array_length(v_substitutes) = 0 THEN
    RETURN jsonb_build_object(
      'status', 'unresolvable',
      'original', jsonb_build_object(
        'id', v_original.id,
        'name', v_original.name,
        'category', v_original.category,
        'environment', v_original.environment,
        'maturity_days', v_original.maturity_days,
        'yield_display', v_original.yield_display,
        'yield_max_tha', v_original.yield_max_tha,
        'top_3_fertilizers', to_jsonb(v_original_top3)
      ),
      'substitutes', jsonb_build_array(),
      'message', 'No substitute seed passed all required filters for this shortage.'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'resolved',
    'original', jsonb_build_object(
      'id', v_original.id,
      'name', v_original.name,
      'category', v_original.category,
      'environment', v_original.environment,
      'maturity_days', v_original.maturity_days,
      'yield_display', v_original.yield_display,
      'yield_max_tha', v_original.yield_max_tha,
      'top_3_fertilizers', to_jsonb(v_original_top3)
    ),
    'substitutes', v_substitutes,
    'message', format('Found %s compatible substitute seed option(s) for %s.', jsonb_array_length(v_substitutes), v_original.name)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'original', NULL,
      'substitutes', jsonb_build_array(),
      'message', format('Unable to resolve seed shortage: %s', SQLERRM)
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- Default bridge mapping aligned with current Node resolver behavior
-- ----------------------------------------------------------------------------

INSERT INTO public.shortages_role_bridge (from_role, to_role, sort_order, is_active)
VALUES ('bio_nitrogen_fixer', 'nitrogen_source', 10, TRUE)
ON CONFLICT (from_role, to_role) DO UPDATE
SET sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.list_shortages_seeds() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_shortages_fertilizers() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_fertilizer_shortage(TEXT, TEXT, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_seed_shortage(TEXT, TEXT[]) TO anon, authenticated;

COMMIT;
