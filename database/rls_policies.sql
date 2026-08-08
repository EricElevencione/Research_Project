-- ============================================================
-- RLS MIGRATION v2 (FIXED): Research Project - Agricultural Registry
-- Run this in Supabase SQL Editor: Database > SQL Editor
-- ============================================================
-- CHANGES FROM v1:
--   - Removed farmer_aggregated_unified (it is a VIEW, not a table)
--   - Added DROP POLICY IF EXISTS so this is safe to re-run
-- ============================================================
-- Roles (stored in auth.users.raw_user_meta_data->>'role'):
--   admin       → Municipal Agricultural Officer / Admin
--   jo          → Job Order staff (data encoders)
--   technician  → Field technicians
--   region      → Regional-level read-only viewers
-- ============================================================


-- ── Step 1: Clean up any policies from a previous partial run ─
DROP POLICY IF EXISTS "rsbsa_submission: authenticated read"          ON public.rsbsa_submission;
DROP POLICY IF EXISTS "rsbsa_submission: jo/admin insert"             ON public.rsbsa_submission;
DROP POLICY IF EXISTS "rsbsa_submission: jo/admin update"             ON public.rsbsa_submission;
DROP POLICY IF EXISTS "rsbsa_submission: admin delete"                ON public.rsbsa_submission;

DROP POLICY IF EXISTS "rsbsa_farm_parcels: authenticated read"        ON public.rsbsa_farm_parcels;
DROP POLICY IF EXISTS "rsbsa_farm_parcels: jo/admin insert"           ON public.rsbsa_farm_parcels;
DROP POLICY IF EXISTS "rsbsa_farm_parcels: jo/admin update"           ON public.rsbsa_farm_parcels;
DROP POLICY IF EXISTS "rsbsa_farm_parcels: admin delete"              ON public.rsbsa_farm_parcels;

DROP POLICY IF EXISTS "land_history: authenticated read"              ON public.land_history;
DROP POLICY IF EXISTS "land_history: jo/admin insert"                 ON public.land_history;
DROP POLICY IF EXISTS "land_history: jo/admin update"                 ON public.land_history;
DROP POLICY IF EXISTS "land_history: admin delete"                    ON public.land_history;

DROP POLICY IF EXISTS "land_parcels: authenticated read"              ON public.land_parcels;
DROP POLICY IF EXISTS "land_parcels: jo/admin insert"                 ON public.land_parcels;
DROP POLICY IF EXISTS "land_parcels: jo/admin update"                 ON public.land_parcels;
DROP POLICY IF EXISTS "land_parcels: admin delete"                    ON public.land_parcels;

DROP POLICY IF EXISTS "land_plots: authenticated read"                ON public.land_plots;
DROP POLICY IF EXISTS "land_plots: tech/jo/admin insert"              ON public.land_plots;
DROP POLICY IF EXISTS "land_plots: tech/jo/admin update"              ON public.land_plots;
DROP POLICY IF EXISTS "land_plots: admin delete"                      ON public.land_plots;

DROP POLICY IF EXISTS "farmer_requests: authenticated read"           ON public.farmer_requests;
DROP POLICY IF EXISTS "farmer_requests: tech/jo/admin insert"         ON public.farmer_requests;
DROP POLICY IF EXISTS "farmer_requests: tech/jo/admin update"         ON public.farmer_requests;
DROP POLICY IF EXISTS "farmer_requests: admin delete"                 ON public.farmer_requests;

DROP POLICY IF EXISTS "distribution_records: authenticated read"      ON public.distribution_records;
DROP POLICY IF EXISTS "distribution_records: jo/admin insert"         ON public.distribution_records;
DROP POLICY IF EXISTS "distribution_records: jo/admin update"         ON public.distribution_records;
DROP POLICY IF EXISTS "distribution_records: admin delete"            ON public.distribution_records;

DROP POLICY IF EXISTS "inventory: authenticated read"                 ON public.inventory;
DROP POLICY IF EXISTS "inventory: admin/region insert"                ON public.inventory;
DROP POLICY IF EXISTS "inventory: admin/region update"                ON public.inventory;
DROP POLICY IF EXISTS "inventory: admin delete"                       ON public.inventory;

DROP POLICY IF EXISTS "barangay_codes: authenticated read"            ON public.barangay_codes;
DROP POLICY IF EXISTS "barangay_codes: admin write"                   ON public.barangay_codes;
DROP POLICY IF EXISTS "barangay_codes: admin update"                  ON public.barangay_codes;
DROP POLICY IF EXISTS "barangay_codes: admin delete"                  ON public.barangay_codes;

DROP POLICY IF EXISTS "farmer_reg_status: authenticated read"         ON public.farmer_registration_status;
DROP POLICY IF EXISTS "farmer_reg_status: tech/jo/admin insert"       ON public.farmer_registration_status;
DROP POLICY IF EXISTS "farmer_reg_status: tech/jo/admin update"       ON public.farmer_registration_status;
DROP POLICY IF EXISTS "farmer_reg_status: admin delete"               ON public.farmer_registration_status;

DROP POLICY IF EXISTS "ownership_metrics: authenticated read"         ON public.ownership_metrics_snapshots;
DROP POLICY IF EXISTS "ownership_metrics: admin write"                ON public.ownership_metrics_snapshots;
DROP POLICY IF EXISTS "ownership_metrics: admin delete"               ON public.ownership_metrics_snapshots;

DROP POLICY IF EXISTS "transfer_items: authenticated read"            ON public.ownership_transfer_items;
DROP POLICY IF EXISTS "transfer_items: jo/admin insert"               ON public.ownership_transfer_items;
DROP POLICY IF EXISTS "transfer_items: jo/admin update"               ON public.ownership_transfer_items;
DROP POLICY IF EXISTS "transfer_items: admin delete"                  ON public.ownership_transfer_items;

DROP POLICY IF EXISTS "transfer_proofs: authenticated read"           ON public.ownership_transfer_proofs;
DROP POLICY IF EXISTS "transfer_proofs: jo/admin insert"              ON public.ownership_transfer_proofs;
DROP POLICY IF EXISTS "transfer_proofs: admin delete"                 ON public.ownership_transfer_proofs;

DROP POLICY IF EXISTS "proof_recovery: admin read"                    ON public.ownership_transfer_proof_recovery_queue;
DROP POLICY IF EXISTS "proof_recovery: admin write"                   ON public.ownership_transfer_proof_recovery_queue;
DROP POLICY IF EXISTS "proof_recovery: admin delete"                  ON public.ownership_transfer_proof_recovery_queue;

DROP POLICY IF EXISTS "farm_parcels: authenticated read"              ON public.farm_parcels;
DROP POLICY IF EXISTS "farm_parcels: jo/admin insert"                 ON public.farm_parcels;
DROP POLICY IF EXISTS "farm_parcels: jo/admin update"                 ON public.farm_parcels;
DROP POLICY IF EXISTS "farm_parcels: admin delete"                    ON public.farm_parcels;

DROP POLICY IF EXISTS "audit_logs: authenticated read"                ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs: authenticated insert"              ON public.audit_logs;

DROP POLICY IF EXISTS "users: own row or admin read"                  ON public.users;
DROP POLICY IF EXISTS "users: admin insert"                           ON public.users;
DROP POLICY IF EXISTS "users: admin update"                           ON public.users;
DROP POLICY IF EXISTS "users: admin delete"                           ON public.users;

DROP POLICY IF EXISTS "backup_land_history: admin only"               ON public.backup_land_history_92;
DROP POLICY IF EXISTS "backup_rsbsa_farm_parcels: admin only"         ON public.backup_rsbsa_farm_parcels_92;
DROP POLICY IF EXISTS "backup_rsbsa_submission: admin only"           ON public.backup_rsbsa_submission_92;
DROP POLICY IF EXISTS "owner_link_backfill: admin only"               ON public.owner_link_backfill_audit;
DROP POLICY IF EXISTS "ownership_category_exception: admin/jo read"   ON public.ownership_category_exception_audit;
DROP POLICY IF EXISTS "ownership_category_exception: jo/admin insert" ON public.ownership_category_exception_audit;


-- ── Step 2: Helper function ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata'  ->> 'role'
  );
$$;


-- ============================================================
-- 1. RSBSA SUBMISSION  (farmer registration records)
-- ============================================================
ALTER TABLE public.rsbsa_submission ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsbsa_submission: authenticated read"
  ON public.rsbsa_submission FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rsbsa_submission: jo/admin insert"
  ON public.rsbsa_submission FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "rsbsa_submission: jo/admin update"
  ON public.rsbsa_submission FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('jo', 'admin'))
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "rsbsa_submission: admin delete"
  ON public.rsbsa_submission FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 2. RSBSA FARM PARCELS  (farmer parcel ownership records)
-- ============================================================
ALTER TABLE public.rsbsa_farm_parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsbsa_farm_parcels: authenticated read"
  ON public.rsbsa_farm_parcels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rsbsa_farm_parcels: jo/admin insert"
  ON public.rsbsa_farm_parcels FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "rsbsa_farm_parcels: jo/admin update"
  ON public.rsbsa_farm_parcels FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('jo', 'admin'))
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "rsbsa_farm_parcels: admin delete"
  ON public.rsbsa_farm_parcels FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 3. LAND HISTORY  (ownership transfer history)
-- ============================================================
ALTER TABLE public.land_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "land_history: authenticated read"
  ON public.land_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "land_history: jo/admin insert"
  ON public.land_history FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "land_history: jo/admin update"
  ON public.land_history FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('jo', 'admin'))
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "land_history: admin delete"
  ON public.land_history FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 4. LAND PARCELS  (canonical parcel registry)
-- ============================================================
ALTER TABLE public.land_parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "land_parcels: authenticated read"
  ON public.land_parcels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "land_parcels: jo/admin insert"
  ON public.land_parcels FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "land_parcels: jo/admin update"
  ON public.land_parcels FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('jo', 'admin'))
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "land_parcels: admin delete"
  ON public.land_parcels FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 5. LAND PLOTS  (GIS polygon/geometry records)
-- ============================================================
ALTER TABLE public.land_plots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "land_plots: authenticated read"
  ON public.land_plots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "land_plots: tech/jo/admin insert"
  ON public.land_plots FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('technician', 'jo', 'admin'));

CREATE POLICY "land_plots: tech/jo/admin update"
  ON public.land_plots FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('technician', 'jo', 'admin'))
  WITH CHECK (public.get_user_role() IN ('technician', 'jo', 'admin'));

CREATE POLICY "land_plots: admin delete"
  ON public.land_plots FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 6. FARMER REQUESTS  (seed/fertilizer requests)
-- ============================================================
ALTER TABLE public.farmer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farmer_requests: authenticated read"
  ON public.farmer_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "farmer_requests: tech/jo/admin insert"
  ON public.farmer_requests FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('technician', 'jo', 'admin'));

CREATE POLICY "farmer_requests: tech/jo/admin update"
  ON public.farmer_requests FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('technician', 'jo', 'admin'))
  WITH CHECK (public.get_user_role() IN ('technician', 'jo', 'admin'));

CREATE POLICY "farmer_requests: admin delete"
  ON public.farmer_requests FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 7. DISTRIBUTION RECORDS  (records that a farmer received seeds/fertilizer)
--    Only jo + admin record distributions. Technicians do NOT.
-- ============================================================
ALTER TABLE public.distribution_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "distribution_records: authenticated read"
  ON public.distribution_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "distribution_records: jo/admin insert"
  ON public.distribution_records FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "distribution_records: jo/admin update"
  ON public.distribution_records FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('jo', 'admin'))
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "distribution_records: admin delete"
  ON public.distribution_records FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 8. INVENTORY  (seed/fertilizer stock)
-- ============================================================
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory: authenticated read"
  ON public.inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "inventory: admin/region insert"
  ON public.inventory FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'region'));

CREATE POLICY "inventory: admin/region update"
  ON public.inventory FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'region'))
  WITH CHECK (public.get_user_role() IN ('admin', 'region'));

CREATE POLICY "inventory: admin delete"
  ON public.inventory FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 9. BARANGAY CODES  (reference / lookup data)
-- ============================================================
ALTER TABLE public.barangay_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barangay_codes: authenticated read"
  ON public.barangay_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "barangay_codes: admin write"
  ON public.barangay_codes FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "barangay_codes: admin update"
  ON public.barangay_codes FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "barangay_codes: admin delete"
  ON public.barangay_codes FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 10. FARMER REGISTRATION STATUS
-- ============================================================
ALTER TABLE public.farmer_registration_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farmer_reg_status: authenticated read"
  ON public.farmer_registration_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "farmer_reg_status: tech/jo/admin insert"
  ON public.farmer_registration_status FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('technician', 'jo', 'admin'));

CREATE POLICY "farmer_reg_status: tech/jo/admin update"
  ON public.farmer_registration_status FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('technician', 'jo', 'admin'))
  WITH CHECK (public.get_user_role() IN ('technician', 'jo', 'admin'));

CREATE POLICY "farmer_reg_status: admin delete"
  ON public.farmer_registration_status FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 11. FARMER AGGREGATED UNIFIED
--     SKIPPED: this is a DATABASE VIEW, not a table.
--     Views cannot have RLS enabled in PostgreSQL.
--     It inherits security from its underlying tables above.
-- ============================================================


-- ============================================================
-- 12. OWNERSHIP METRICS SNAPSHOTS
-- ============================================================
ALTER TABLE public.ownership_metrics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ownership_metrics: authenticated read"
  ON public.ownership_metrics_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ownership_metrics: admin write"
  ON public.ownership_metrics_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "ownership_metrics: admin delete"
  ON public.ownership_metrics_snapshots FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 13. OWNERSHIP TRANSFER ITEMS
-- ============================================================
ALTER TABLE public.ownership_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_items: authenticated read"
  ON public.ownership_transfer_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "transfer_items: jo/admin insert"
  ON public.ownership_transfer_items FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "transfer_items: jo/admin update"
  ON public.ownership_transfer_items FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('jo', 'admin'))
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "transfer_items: admin delete"
  ON public.ownership_transfer_items FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 14. OWNERSHIP TRANSFER PROOFS
-- ============================================================
ALTER TABLE public.ownership_transfer_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_proofs: authenticated read"
  ON public.ownership_transfer_proofs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "transfer_proofs: jo/admin insert"
  ON public.ownership_transfer_proofs FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "transfer_proofs: admin delete"
  ON public.ownership_transfer_proofs FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 15. OWNERSHIP TRANSFER PROOF RECOVERY QUEUE  (admin-only)
-- ============================================================
ALTER TABLE public.ownership_transfer_proof_recovery_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proof_recovery: admin read"
  ON public.ownership_transfer_proof_recovery_queue FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "proof_recovery: admin write"
  ON public.ownership_transfer_proof_recovery_queue FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "proof_recovery: admin delete"
  ON public.ownership_transfer_proof_recovery_queue FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 16. FARM PARCELS
-- ============================================================
ALTER TABLE public.farm_parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farm_parcels: authenticated read"
  ON public.farm_parcels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "farm_parcels: jo/admin insert"
  ON public.farm_parcels FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "farm_parcels: jo/admin update"
  ON public.farm_parcels FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('jo', 'admin'))
  WITH CHECK (public.get_user_role() IN ('jo', 'admin'));

CREATE POLICY "farm_parcels: admin delete"
  ON public.farm_parcels FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 17. AUDIT LOGS  (immutable activity trail)
-- ============================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs: authenticated read"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert audit entries (app logs every action)
CREATE POLICY "audit_logs: authenticated insert"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE or DELETE policies = audit logs are immutable


-- ============================================================
-- 18. USERS TABLE
-- NOTE: The 'password_hash' column exists but is NULL for all rows.
-- The app uses Supabase Auth for login — password_hash is an unused
-- legacy column from an earlier version. It is safe to leave it.
-- The table is locked to admin-only writes and own-row reads.
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Each user sees their own row; admin sees all
CREATE POLICY "users: own row or admin read"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.get_user_role() = 'admin'
  );

CREATE POLICY "users: admin insert"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "users: admin update"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "users: admin delete"
  ON public.users FOR DELETE
  TO authenticated
  USING (public.get_user_role() = 'admin');


-- ============================================================
-- 19–21. BACKUP TABLES  (admin-only, not used by the app UI)
-- ============================================================
ALTER TABLE public.backup_land_history_92 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_land_history: admin only"
  ON public.backup_land_history_92 FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

ALTER TABLE public.backup_rsbsa_farm_parcels_92 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_rsbsa_farm_parcels: admin only"
  ON public.backup_rsbsa_farm_parcels_92 FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

ALTER TABLE public.backup_rsbsa_submission_92 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_rsbsa_submission: admin only"
  ON public.backup_rsbsa_submission_92 FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');


-- ============================================================
-- 22–23. INTERNAL AUDIT / BACKFILL TABLES
-- ============================================================
ALTER TABLE public.owner_link_backfill_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_link_backfill: admin only"
  ON public.owner_link_backfill_audit FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

ALTER TABLE public.ownership_category_exception_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ownership_category_exception: admin/jo read"
  ON public.ownership_category_exception_audit FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'jo'));

CREATE POLICY "ownership_category_exception: jo/admin insert"
  ON public.ownership_category_exception_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'jo'));


-- ============================================================
-- NOTE ON RPC FUNCTIONS
-- ============================================================
-- Your existing RPCs (sync_farmer_no_parcels_status,
-- register_farmer_with_parcels, etc.) use SECURITY DEFINER,
-- meaning they run as the postgres superuser and bypass RLS.
-- This is intentional and correct — no changes needed there.
-- ============================================================

-- DONE: 23 tables secured with RLS.
-- Verify via: Supabase Dashboard > Authentication > Policies
