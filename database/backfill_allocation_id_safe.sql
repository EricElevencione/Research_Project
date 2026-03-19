-- ============================================================================
-- SAFE ONE-TIME BACKFILL: farmer_requests.allocation_id
-- ============================================================================
-- Goal:
-- 1) Auto-fill allocation_id only when the season has exactly one allocation.
-- 2) Leave ambiguous seasons (multiple allocations in same season) unchanged.
-- 3) Output unresolved rows for manual review.
--
-- Why safe:
-- - Avoids mis-assigning old requests when there are multiple allocations
--   for the same season (example: dry_2026 with allocation 28 and 29).
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- A) BEFORE CHECKS
-- --------------------------------------------------------------------------

-- Overall NULL linkage count before update
SELECT
  COUNT(*) AS null_before
FROM farmer_requests
WHERE allocation_id IS NULL;

-- Seasons that are unambiguous vs ambiguous
SELECT
  season,
  COUNT(*) AS allocation_count
FROM regional_allocations
GROUP BY season
ORDER BY season;

-- --------------------------------------------------------------------------
-- B) SAFE BACKFILL (ONLY UNAMBIGUOUS SEASONS)
-- --------------------------------------------------------------------------

WITH single_allocation_season AS (
  SELECT
    season,
    MIN(id) AS allocation_id
  FROM regional_allocations
  GROUP BY season
  HAVING COUNT(*) = 1
)
UPDATE farmer_requests fr
SET allocation_id = sas.allocation_id
FROM single_allocation_season sas
WHERE fr.allocation_id IS NULL
  AND fr.season = sas.season;

-- --------------------------------------------------------------------------
-- C) AFTER CHECKS
-- --------------------------------------------------------------------------

-- Remaining NULL linkage count after safe update
SELECT
  COUNT(*) AS null_after
FROM farmer_requests
WHERE allocation_id IS NULL;

-- Requests still unresolved (expected: records from ambiguous seasons)
SELECT
  fr.id,
  fr.farmer_name,
  fr.season,
  fr.request_date,
  fr.created_at,
  fr.status,
  fr.allocation_id
FROM farmer_requests fr
WHERE fr.allocation_id IS NULL
ORDER BY fr.season, fr.request_date NULLS LAST, fr.created_at NULLS LAST, fr.id;

-- --------------------------------------------------------------------------
-- D) AMBIGUOUS SEASON REVIEW REPORT
-- --------------------------------------------------------------------------

-- Shows unresolved requests together with candidate allocations in same season.
-- Use this to decide manual assignment policy for each ambiguous season.
SELECT
  fr.id AS request_id,
  fr.farmer_name,
  fr.season,
  fr.request_date,
  fr.created_at,
  ra.id AS candidate_allocation_id,
  ra.allocation_date,
  ra.notes
FROM farmer_requests fr
JOIN regional_allocations ra
  ON ra.season = fr.season
WHERE fr.allocation_id IS NULL
ORDER BY fr.season, fr.id, ra.allocation_date, ra.id;

-- --------------------------------------------------------------------------
-- E) OPTIONAL: DATE-BASED SUGGESTION REPORT (NO UPDATE)
-- --------------------------------------------------------------------------

-- Suggest nearest allocation by request_date (or created_at::date fallback).
-- This is only a report; it does not write any data.
WITH unresolved AS (
  SELECT
    fr.id,
    fr.farmer_name,
    fr.season,
    COALESCE(fr.request_date, fr.created_at::date) AS event_date
  FROM farmer_requests fr
  WHERE fr.allocation_id IS NULL
),
candidates AS (
  SELECT
    u.id AS request_id,
    u.farmer_name,
    u.season,
    u.event_date,
    ra.id AS candidate_allocation_id,
    ra.allocation_date,
    ABS((u.event_date - ra.allocation_date)) AS day_distance
  FROM unresolved u
  JOIN regional_allocations ra
    ON ra.season = u.season
),
ranked AS (
  SELECT
    c.*,
    ROW_NUMBER() OVER (
      PARTITION BY c.request_id
      ORDER BY c.day_distance, c.allocation_date, c.candidate_allocation_id
    ) AS rn,
    MIN(c.day_distance) OVER (PARTITION BY c.request_id) AS min_day_distance
  FROM candidates c
),
ranked_with_ties AS (
  SELECT
    r.*,
    COUNT(*) FILTER (WHERE r.day_distance = r.min_day_distance) OVER (
      PARTITION BY r.request_id
    ) AS tie_count
  FROM ranked r
)
SELECT
  request_id,
  farmer_name,
  season,
  event_date,
  candidate_allocation_id,
  allocation_date,
  day_distance,
  tie_count,
  CASE WHEN tie_count > 1 THEN 'REVIEW_REQUIRED' ELSE 'LIKELY_MATCH' END AS suggestion_quality
FROM ranked_with_ties
WHERE rn = 1
ORDER BY season, request_id;

COMMIT;

-- ============================================================================
-- MANUAL UPDATE TEMPLATE (RUN ONLY AFTER REVIEW)
-- ============================================================================
-- Example:
-- UPDATE farmer_requests
-- SET allocation_id = 28
-- WHERE allocation_id IS NULL
--   AND season = 'dry_2026'
--   AND id IN (/* reviewed request IDs */);
-- ============================================================================
