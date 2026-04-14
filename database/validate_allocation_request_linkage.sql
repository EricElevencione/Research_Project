-- Validation script for JO allocation/request linkage.
-- Purpose: verify whether missing Requested values are due to NULL allocation_id
-- or mismatched legacy records that only have season linkage.

-- 1) Overall request linkage health
SELECT
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE allocation_id IS NULL) AS null_allocation_id_requests,
  COUNT(*) FILTER (WHERE allocation_id IS NOT NULL) AS linked_requests
FROM farmer_requests;

-- 2) Linkage by season (helps spot seasons mostly affected by legacy NULL linkage)
SELECT
  season,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE allocation_id IS NULL) AS null_allocation_id_requests,
  COUNT(*) FILTER (WHERE allocation_id IS NOT NULL) AS linked_requests
FROM farmer_requests
GROUP BY season
ORDER BY season;

-- 3) Allocation-level request counts by strict allocation_id linkage
SELECT
  ra.id AS allocation_id,
  ra.season,
  ra.allocation_date,
  COUNT(fr.id) AS linked_request_count
FROM regional_allocations ra
LEFT JOIN farmer_requests fr
  ON fr.allocation_id = ra.id
GROUP BY ra.id, ra.season, ra.allocation_date
ORDER BY ra.season, ra.allocation_date, ra.id;

-- 4) Allocation-level request counts by season fallback (legacy behavior)
-- This shows what JoViewAllocation fallback can include when strict linkage is empty.
SELECT
  ra.id AS allocation_id,
  ra.season,
  ra.allocation_date,
  COUNT(fr.id) AS season_fallback_request_count
FROM regional_allocations ra
LEFT JOIN farmer_requests fr
  ON fr.season = ra.season
GROUP BY ra.id, ra.season, ra.allocation_date
ORDER BY ra.season, ra.allocation_date, ra.id;

-- 5) Allocations at risk: strict linkage has zero, but season fallback has records
-- These are the allocations where the new fallback likely prevents "all zero Requested" UI.
SELECT
  ra.id AS allocation_id,
  ra.season,
  ra.allocation_date,
  COALESCE(strict_counts.linked_request_count, 0) AS strict_count,
  COALESCE(season_counts.season_fallback_request_count, 0) AS fallback_count
FROM regional_allocations ra
LEFT JOIN (
  SELECT allocation_id, COUNT(*) AS linked_request_count
  FROM farmer_requests
  WHERE allocation_id IS NOT NULL
  GROUP BY allocation_id
) strict_counts
  ON strict_counts.allocation_id = ra.id
LEFT JOIN (
  SELECT season, COUNT(*) AS season_fallback_request_count
  FROM farmer_requests
  GROUP BY season
) season_counts
  ON season_counts.season = ra.season
WHERE COALESCE(strict_counts.linked_request_count, 0) = 0
  AND COALESCE(season_counts.season_fallback_request_count, 0) > 0
ORDER BY ra.season, ra.allocation_date, ra.id;

-- 6) Optional deep check: sample legacy rows still missing allocation link
SELECT
  id,
  farmer_name,
  barangay,
  season,
  allocation_id,
  status,
  created_at
FROM farmer_requests
WHERE allocation_id IS NULL
ORDER BY created_at DESC
LIMIT 50;
