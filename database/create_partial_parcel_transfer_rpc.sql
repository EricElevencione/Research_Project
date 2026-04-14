-- ============================================================================
-- Supabase RPC: execute_partial_parcel_transfer
-- ============================================================================
-- Run this in Supabase SQL Editor to create/replace the function.
-- Called by usePartialTransfer.ts one parcel at a time.
--
-- This RPC handles a SINGLE parcel split:
--   1. Validates the parcel belongs to donor and area is valid.
--   2. Reduces the donor parcel area.
--   3. Creates a new parcel for the recipient with all inherited fields.
--   4. Inserts land_history rows for both donor (reduced) and recipient (new).
--   5. Recomputes total farm areas on rsbsa_submission.
--   6. Sets parent_parcel_id, split_origin_area_ha on the new parcel.
--   7. Sets transferred_area_ha, remaining_area_ha on land_history rows.
-- ============================================================================

DROP FUNCTION IF EXISTS public.execute_partial_parcel_transfer(
  INTEGER,
  INTEGER,
  INTEGER,
  NUMERIC,
  TEXT,
  TEXT,
  DATE,
  BOOLEAN,
  BOOLEAN,
  TEXT
);

DROP FUNCTION IF EXISTS public.execute_partial_parcel_transfer(
  INTEGER,
  INTEGER,
  INTEGER,
  NUMERIC,
  TEXT,
  TEXT,
  DATE
);

DROP FUNCTION IF EXISTS public.execute_partial_parcel_transfer(
  BIGINT,
  BIGINT,
  BIGINT,
  NUMERIC,
  TEXT,
  TEXT,
  DATE
);

CREATE OR REPLACE FUNCTION public.execute_partial_parcel_transfer(
  p_farm_parcel_id   BIGINT,
  p_donor_farmer_id  BIGINT,
  p_recipient_farmer_id BIGINT,
  p_transfer_area_ha NUMERIC,
  p_transfer_mode    TEXT    DEFAULT 'voluntary',
  p_transfer_reason  TEXT    DEFAULT NULL,
  p_transfer_date    DATE    DEFAULT CURRENT_DATE,
  p_proofs           JSONB   DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  new_parcel_id       BIGINT,
  new_parcel_number   TEXT,
  donor_remaining_ha  NUMERIC,
  recipient_area_ha   NUMERIC,
  transfer_id         BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now               DATE    := COALESCE(p_transfer_date, CURRENT_DATE);
  v_reason            TEXT    := COALESCE(NULLIF(TRIM(p_transfer_reason), ''),
                                   CASE WHEN LOWER(COALESCE(p_transfer_mode, '')) = 'inheritance'
                                        THEN 'Inheritance'
                                        ELSE 'Voluntary Transfer' END);

  -- Donor parcel snapshot
  v_parcel_area       NUMERIC(10,2);
  v_remaining_area    NUMERIC(10,2);
  v_barangay          TEXT;
  v_municipality      TEXT;
  v_within_domain     TEXT;
  v_ownership_doc     TEXT;
  v_arb               TEXT;

  -- Farmer names / ffrs
  v_donor_name        TEXT;
  v_donor_ffrs        TEXT;
  v_recip_name        TEXT;
  v_recip_ffrs        TEXT;

  -- New parcel
  v_new_parcel_id     BIGINT;
  v_next_parcel_no    INTEGER;

  -- Totals
  v_donor_total       NUMERIC(10,2);
  v_recip_total       NUMERIC(10,2);

  -- Audit
  v_transfer_id       BIGINT;
BEGIN
  -- ── Validation ────────────────────────────────────────────────────────────
  IF p_transfer_area_ha IS NULL OR p_transfer_area_ha <= 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Transfer area must be a positive number.';
  END IF;

  IF p_farm_parcel_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Farm parcel ID is required.';
  END IF;

  IF p_donor_farmer_id = p_recipient_farmer_id THEN
    RAISE EXCEPTION 'Donor and recipient must be different farmers.';
  END IF;

  -- ── Lock & read donor parcel ──────────────────────────────────────────────
  SELECT
    ROUND(COALESCE(total_farm_area_ha, 0)::NUMERIC, 2),
    farm_location_barangay,
    farm_location_municipality,
    within_ancestral_domain,
    ownership_document_no,
    agrarian_reform_beneficiary
  INTO
    v_parcel_area,
    v_barangay,
    v_municipality,
    v_within_domain,
    v_ownership_doc,
    v_arb
  FROM rsbsa_farm_parcels
  WHERE id = p_farm_parcel_id
  FOR UPDATE;

  IF v_parcel_area IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = format('Parcel %s not found.', p_farm_parcel_id);
  END IF;

  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM rsbsa_farm_parcels
    WHERE id = p_farm_parcel_id AND submission_id = p_donor_farmer_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0003',
      MESSAGE = format('Parcel %s does not belong to farmer %s.', p_farm_parcel_id, p_donor_farmer_id);
  END IF;

  -- Partial must be strictly less than the full parcel
  IF p_transfer_area_ha >= (v_parcel_area - 0.0001) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0004',
      MESSAGE = format(
        'Transfer area %s must be less than parcel area %s for a partial split.',
        TO_CHAR(ROUND(p_transfer_area_ha::NUMERIC, 2), 'FM999999999999990.00'),
        TO_CHAR(ROUND(v_parcel_area::NUMERIC, 2), 'FM999999999999990.00')
      );
  END IF;

  v_remaining_area := ROUND((v_parcel_area - p_transfer_area_ha)::NUMERIC, 2);

  -- ── Resolve farmer names ─────────────────────────────────────────────────
  SELECT
    CONCAT_WS(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", NULLIF("EXT NAME", '')),
    "FFRS_CODE"
  INTO v_donor_name, v_donor_ffrs
  FROM rsbsa_submission
  WHERE id = p_donor_farmer_id;

  SELECT
    CONCAT_WS(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME", NULLIF("EXT NAME", '')),
    "FFRS_CODE"
  INTO v_recip_name, v_recip_ffrs
  FROM rsbsa_submission
  WHERE id = p_recipient_farmer_id;

  -- ── 1. Reduce donor parcel area ──────────────────────────────────────────
  UPDATE rsbsa_farm_parcels
  SET
    total_farm_area_ha = v_remaining_area,
    updated_at = NOW()
  WHERE id = p_farm_parcel_id;

  -- ── 2. Update / insert donor land_history ────────────────────────────────
  UPDATE land_history
  SET
    total_farm_area_ha   = v_remaining_area,
    transferred_area_ha  = p_transfer_area_ha,
    remaining_area_ha    = v_remaining_area,
    change_type          = 'TRANSFER_PARTIAL',
    change_reason        = v_reason,
    notes                = FORMAT(
      'Partial split %s ha to farmer %s',
      TO_CHAR(ROUND(p_transfer_area_ha::NUMERIC, 2), 'FM999999999999990.00'),
      p_recipient_farmer_id
    ),
    updated_at           = NOW()
  WHERE farm_parcel_id = p_farm_parcel_id
    AND is_current = TRUE;

  IF NOT FOUND THEN
    INSERT INTO land_history (
      rsbsa_submission_id, farm_parcel_id, parcel_number,
      farm_location_barangay, farm_location_municipality,
      total_farm_area_ha, transferred_area_ha, remaining_area_ha,
      land_owner_id, land_owner_name, land_owner_ffrs_code,
      farmer_id, farmer_name, farmer_ffrs_code,
      is_tenant, is_lessee, is_registered_owner,
      ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain,
      period_start_date, is_current,
      change_type, change_reason, notes,
      created_at, updated_at
    )
    SELECT
      p_donor_farmer_id, fp.id, fp.parcel_number,
      fp.farm_location_barangay, fp.farm_location_municipality,
      v_remaining_area, p_transfer_area_ha, v_remaining_area,
      p_donor_farmer_id, v_donor_name, v_donor_ffrs,
      p_donor_farmer_id, v_donor_name, v_donor_ffrs,
      FALSE, FALSE, TRUE,
      fp.ownership_document_no,
      CASE WHEN COALESCE(fp.agrarian_reform_beneficiary, 'No') = 'Yes' THEN TRUE ELSE FALSE END,
      CASE WHEN COALESCE(fp.within_ancestral_domain,  'No') = 'Yes' THEN TRUE ELSE FALSE END,
      v_now, TRUE,
      'TRANSFER_PARTIAL', v_reason,
      FORMAT(
        'Partial split %s ha to farmer %s',
        TO_CHAR(ROUND(p_transfer_area_ha::NUMERIC, 2), 'FM999999999999990.00'),
        p_recipient_farmer_id
      ),
      NOW(), NOW()
    FROM rsbsa_farm_parcels fp
    WHERE fp.id = p_farm_parcel_id;
  END IF;

  -- ── 3. Create recipient parcel with inherited fields ─────────────────────
  SELECT
    COALESCE(MAX(CASE WHEN parcel_number ~ '^[0-9]+$' THEN parcel_number::INT ELSE NULL END), 0) + 1
  INTO v_next_parcel_no
  FROM rsbsa_farm_parcels
  WHERE submission_id = p_recipient_farmer_id;

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
    ownership_type_others,
    tenant_land_owner_name,
    lessee_land_owner_name,
    tenant_land_owner_id,
    lessee_land_owner_id,
    is_current_owner,
    parent_parcel_id,
    split_origin_area_ha,
    created_at,
    updated_at
  )
  VALUES (
    p_recipient_farmer_id,
    v_next_parcel_no::TEXT,
    v_barangay,
    v_municipality,
    p_transfer_area_ha,
    v_within_domain,
    v_ownership_doc,
    v_arb,
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    NULL,
    NULL,
    NULL,
    NULL,
    TRUE,
    p_farm_parcel_id,          -- parent_parcel_id: references donor parcel
    v_parcel_area,             -- split_origin_area_ha: donor area BEFORE split
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_parcel_id;

  -- ── 4. Insert recipient land_history ─────────────────────────────────────
  INSERT INTO land_history (
    rsbsa_submission_id, farm_parcel_id, parcel_number,
    farm_location_barangay, farm_location_municipality,
    total_farm_area_ha, transferred_area_ha, remaining_area_ha,
    land_owner_id, land_owner_name, land_owner_ffrs_code,
    farmer_id, farmer_name, farmer_ffrs_code,
    is_tenant, is_lessee, is_registered_owner,
    ownership_document_no, agrarian_reform_beneficiary, within_ancestral_domain,
    period_start_date, is_current,
    change_type, change_reason, notes,
    created_at, updated_at
  )
  VALUES (
    p_recipient_farmer_id, v_new_parcel_id, v_next_parcel_no::TEXT,
    v_barangay, v_municipality,
    p_transfer_area_ha, p_transfer_area_ha, v_remaining_area,
    p_recipient_farmer_id, v_recip_name, v_recip_ffrs,
    p_recipient_farmer_id, v_recip_name, v_recip_ffrs,
    FALSE, FALSE, TRUE,
    v_ownership_doc,
    CASE WHEN COALESCE(v_arb, 'No') = 'Yes' THEN TRUE ELSE FALSE END,
    CASE WHEN COALESCE(v_within_domain, 'No') = 'Yes' THEN TRUE ELSE FALSE END,
    v_now, TRUE,
    'TRANSFER_PARTIAL', v_reason,
    FORMAT(
      'Partial split %s ha from farmer %s',
      TO_CHAR(ROUND(p_transfer_area_ha::NUMERIC, 2), 'FM999999999999990.00'),
      p_donor_farmer_id
    ),
    NOW(), NOW()
  );

  -- ── 5. Recompute farmer totals ──────────────────────────────────────────
  SELECT ROUND(COALESCE(SUM(total_farm_area_ha), 0)::NUMERIC, 2)
  INTO v_donor_total
  FROM rsbsa_farm_parcels
  WHERE submission_id = p_donor_farmer_id;

  SELECT ROUND(COALESCE(SUM(total_farm_area_ha), 0)::NUMERIC, 2)
  INTO v_recip_total
  FROM rsbsa_farm_parcels
  WHERE submission_id = p_recipient_farmer_id;

  UPDATE rsbsa_submission
  SET
    "TOTAL FARM AREA" = v_donor_total,
    status = CASE WHEN v_donor_total > 0 THEN 'Active Farmer' ELSE 'No Parcels' END,
    updated_at = NOW()
  WHERE id = p_donor_farmer_id;

  UPDATE rsbsa_submission
  SET
    "TOTAL FARM AREA" = v_recip_total,
    "OWNERSHIP_TYPE_REGISTERED_OWNER" = TRUE,
    status = 'Active Farmer',
    updated_at = NOW()
  WHERE id = p_recipient_farmer_id;

  -- ── 6. Audit row ─────────────────────────────────────────────────────────
  INSERT INTO ownership_transfers (
    from_farmer_id,
    to_farmer_id,
    transfer_date,
    transfer_type,
    transfer_reason,
    documents,
    notes,
    created_at
  )
  VALUES (
    p_donor_farmer_id,
    p_recipient_farmer_id,
    v_now,
    LOWER(COALESCE(p_transfer_mode, 'voluntary')),
    v_reason,
    COALESCE(p_proofs, '[]'::jsonb),
    FORMAT(
      'Partial split: %s ha of parcel %s',
      TO_CHAR(ROUND(p_transfer_area_ha::NUMERIC, 2), 'FM999999999999990.00'),
      p_farm_parcel_id
    ),
    NOW()
  )
  RETURNING id INTO v_transfer_id;

  -- ── Return result ─────────────────────────────────────────────────────────
  RETURN QUERY SELECT
    v_new_parcel_id      AS new_parcel_id,
    v_next_parcel_no::TEXT AS new_parcel_number,
    v_remaining_area     AS donor_remaining_ha,
    p_transfer_area_ha   AS recipient_area_ha,
    v_transfer_id        AS transfer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_partial_parcel_transfer(
  BIGINT, BIGINT, BIGINT, NUMERIC, TEXT, TEXT, DATE, JSONB
) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
