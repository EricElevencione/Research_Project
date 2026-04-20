# Ownership Rollout Checklist

Apply this in order to make ownership/association behavior fully live.

## 0) Capture baseline metrics (before rollout)

Run:

- capture_ownership_baseline_metrics.sql

Goal:

- Persist a before-state snapshot for:
  - mixed-role count
  - owner-only count
  - tenant/lessee count
  - transfer-history distribution

This gives a measurable baseline to compare post-migration behavior.

## 1) Update registration RPC behavior

Run:

- create_register_farmer_function.sql

Goal:

- Association registrations do not close legal ownership.
- True ownership transfers close prior owner and update current-owner flags.

## 2) Reconcile existing owner flags

Run:

- backfill_current_owner_flags_from_land_history.sql
- backfill_ownership_category_with_exception_audit.sql

Goal:

- rsbsa_farm_parcels.is_current_owner matches current owner history.
- Tenant/lessee rows are never treated as legal current owners.
- Submission-level owner flags are aligned.
- Contradictory legacy ownership flags are routed to
  ownership_category_exception_audit for manual review.

## 3) Validate consistency (read-only)

Run:

- verify_current_ownership_consistency.sql

Expected outcomes:

- Query 0 summary: use as before/after comparison snapshot for q1-q6
- Query 1: 0 rows (tenant/lessee marked as current owner)
- Query 2: 0 rows or known legacy exceptions to manually inspect
- Query 3: 0 rows or known legacy exceptions to manually inspect
- Query 4: 0 rows (multiple current owners for same parcel identity)
- Query 5: 0 rows (submission owner-flag mismatch)
- Query 6: Review and reconcile statuses where needed
- Query 7 and 8: person-focused validation (default filter targets Aaron Benitez; adjust filter as needed)

## 4) Recommended remediation order

Run:

- backfill_current_owner_flags_from_land_history.sql
- fix_current_ownership_mismatches.sql

Then re-run:

- verify_current_ownership_consistency.sql

Goal:

- Apply conservative owner-flag and submission-owner sync fixes.
- Confirm mismatch checks return expected counts after remediation.

## 5) Application smoke checks

Precondition for UI checks:

- Complete step 4 globally before validating owner-first single-row behavior in app.

1. Register a tenant under an existing owner parcel:

- Ownership timeline should not show a legal transfer.
- Association timeline should show tenant/lessee association.

2. Transfer 1 of 2 owner parcels:

- Previous owner current parcel count becomes 1.
- Owner picker and plotting show 1 current parcel for that owner.

3. Verify mixed-role farmer display under owner-first table view:

- Farmer appears once in Land Registry table (owner-first row).
- Ownership type shows Registered Owner and a secondary note (also lessee) when applicable.
- Action menu shows role-capable actions on the same row:
  - Transfer Ownership (owner-capable)

4. Verify Aaron-specific expected outcome:

- If Aaron is truly owner-only after cleanup, Aaron appears as one row with Transfer Ownership only.
- If Aaron is truly mixed-role, Aaron still appears as one row with mixed-role note only.

## 6) Rollback notes

If needed, restore from DB backup/snapshot before script execution.
Do not rollback by deleting history rows; preserve audit timeline and re-run targeted fixes instead.
