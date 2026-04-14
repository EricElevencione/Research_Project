// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION GUIDE: wiring partial-transfer into JoLandRegistry.tsx
//
// Apply these changes to your existing JoLandRegistry.tsx.
// Each section is labelled with the line-number region it targets.
// ─────────────────────────────────────────────────────────────────────────────


// ══════════════════════════════════════════════════════════════════════════════
// A) IMPORTS  (top of file, after existing imports)
// ══════════════════════════════════════════════════════════════════════════════

import { usePartialTransfer, ParcelSplitInput } from "./usePartialTransfer";
import { PartialParcelTransferSection } from "./PartialParcelTransferSection";


// ══════════════════════════════════════════════════════════════════════════════
// B) HOOK INSTANTIATION  (inside JoLandRegistry, after existing useState calls)
// ══════════════════════════════════════════════════════════════════════════════

const {
  parcelScope,
  setParcelScope,
  parcelSplitInputs,
  setParcelTransferArea,
  initSplitInputs,
  resetPartialState,
  validateSplitInputs,
  executePartialTransfers,
  partialSubmitting,
  partialError,
  setPartialError,
  partialSuccess,
} = usePartialTransfer();


// ══════════════════════════════════════════════════════════════════════════════
// C) DERIVED PARCEL INPUTS  (after the effectiveTransferParcels block ~line 413)
//    Maps LandParcel[] → ParcelSplitInput[] expected by the hook + component.
// ══════════════════════════════════════════════════════════════════════════════

const donorSplitParcels: ParcelSplitInput[] = effectiveTransferParcels.map(
  (p) => ({
    farm_parcel_id:        p.land_parcel_id,   // rsbsa_farm_parcels.id
    parcel_number:         p.parcel_number,
    farm_location_barangay: p.farm_location_barangay,
    total_farm_area_ha:    Number(p.total_farm_area_ha) || 0,
    transfer_area_ha:      parcelSplitInputs[p.land_parcel_id] ?? "",
  }),
);

// Compute the "total transfer area" shown in the summary badge
const partialTotalTransferAreaHa: number = donorSplitParcels.reduce(
  (sum, p) => {
    if (parcelScope === "full") return sum + (Number(p.total_farm_area_ha) || 0);
    const val = parcelSplitInputs[p.farm_parcel_id];
    return sum + (typeof val === "number" && val > 0 ? val : 0);
  },
  0,
);

// Scope-aware validation error (used to gate the Confirm button)
const parcelScopeValidationError: string =
  parcelScope === "partial" ? validateSplitInputs(donorSplitParcels) : "";


// ══════════════════════════════════════════════════════════════════════════════
// D) RESET PARTIAL STATE  (inside resetTransferWorkflow, after existing resets)
// ══════════════════════════════════════════════════════════════════════════════

// Add this line inside resetTransferWorkflow():
resetPartialState();


// ══════════════════════════════════════════════════════════════════════════════
// E) INIT SPLIT INPUTS on donor change
//    Add these effects after the existing handleTransferModeChange function.
// ══════════════════════════════════════════════════════════════════════════════

// When the donor selection changes, reinitialise the split-input map
// so stale ha values from a previous donor don't leak through.
useEffect(() => {
  if (parcelScope === "partial") {
    initSplitInputs(donorSplitParcels);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sourceRegisteredOwnerId, beneficairyOwnerId]);


// ══════════════════════════════════════════════════════════════════════════════
// F) BLOCKING REASON UPDATE  (inside the transferBlockingReason IIFE, ~line 432)
//    Add these clauses before the final `return ""`:
// ══════════════════════════════════════════════════════════════════════════════

// EXISTING code ends with:
//   if (transferMode === "voluntary" && !voluntaryAreaSelectionValid) {
//     return "Choose a valid voluntary transfer area.";
//   }
//   if (supportingDocs.length === 0) return "Upload at least one proof image.";
//   return "";

// ADD before return "":
if (parcelScope === "partial" && parcelScopeValidationError) {
  return parcelScopeValidationError;
}


// ══════════════════════════════════════════════════════════════════════════════
// G) handleTransferConfirm UPDATE  (~line 670)
//    Replace the existing supabase.rpc("create_ownership_transfer_no_review")
//    block with the branching logic below.
// ══════════════════════════════════════════════════════════════════════════════

// ── REPLACE the existing RPC call block (lines ~772–816) with: ──────────────

if (parcelScope === "partial") {
  // ── Partial-split path: new RPC per parcel ──────────────────────────────
  try {
    const splitResults = await executePartialTransfers({
      parcels: donorSplitParcels,
      donorFarmerId: fromFarmerId,
      recipientFarmerId: toFarmerId,
      transferMode: transferMode as "voluntary" | "inheritance",
      transferReason: finalReasonPreview || "",
      transferDate: new Date().toISOString().slice(0, 10),
    });

    setTransferSubmitSuccess(
      `Partial transfer complete. ${splitResults.length} parcel(s) split.`,
    );
    await refreshLandParcels();
    closeTransferModal();
    return; // skip the full-transfer RPC below
  } catch (splitErr: any) {
    if (uploadedProofs.length > 0) await cleanupUploadedProofs(uploadedProofs);
    setTransferSubmitError(
      splitErr?.message || "Partial transfer failed. No changes were saved.",
    );
    return;
  }
}

// ── Full-transfer path: existing RPC (unchanged) ────────────────────────────
const { data, error } = await supabase.rpc(
  "create_ownership_transfer_no_review",
  {
    p_transfer_mode: transferMode,
    p_from_farmer_id: fromFarmerId,
    p_to_farmer_id: toFarmerId,
    p_source_role: "registered_owner",
    p_area_mode: areaMode,
    p_area_requested_ha: areaMode === "partial" ? requestedAreaHa : null,
    p_area_available_ha: verifiedAvailableAreaHa,
    p_transfer_reason: finalReasonPreview || null,
    p_transfer_date: new Date().toISOString().slice(0, 10),
    p_is_deceased_confirmed: isInheritance ? confirmBenefaciary : false,
    p_items: itemPayload,
    p_proofs: uploadedProofs,
  },
);
// … rest of existing error handling is unchanged …


// ══════════════════════════════════════════════════════════════════════════════
// H) JSX: replace the existing "Step 2" area-mode block in the modal
//    with <PartialParcelTransferSection>.
//
//    FIND this JSX block (~line 1560–1726) that renders the
//    "take_all / partial" radio + hectare select for both modes,
//    and REPLACE it with:
// ══════════════════════════════════════════════════════════════════════════════

{/* Step 2: Parcel Transfer Scope — NEW component replaces old area-select */}
{(transferMode === "voluntary" || transferMode === "inheritance") &&
  effectiveTransferParcels.length > 0 && (
    <div className="jo-land-registry-transfer-section-card">
      <h4>
        {transferMode === "voluntary"
          ? "Step 2: Parcel & Area Selection"
          : "Step 2: Parcel & Area Selection"}
      </h4>

      <PartialParcelTransferSection
        donorParcels={donorSplitParcels}
        parcelScope={parcelScope}
        onParcelScopeChange={(scope) => {
          setParcelScope(scope);
          // Re-initialise inputs when switching to partial
          if (scope === "partial") initSplitInputs(donorSplitParcels);
        }}
        parcelSplitInputs={parcelSplitInputs}
        onSetParcelTransferArea={setParcelTransferArea}
        validationError={parcelScopeValidationError}
        totalTransferAreaHa={partialTotalTransferAreaHa}
        donorTotalAreaHa={
          donorSplitParcels.reduce(
            (s, p) => s + (Number(p.total_farm_area_ha) || 0),
            0,
          )
        }
      />
    </div>
  )}

{/* Review row: Transfer Area  — update to use new derived value */}
<div className="jo-land-registry-transfer-kv">
  <span>Transfer Area</span>
  <strong>
    {partialTotalTransferAreaHa.toFixed(4)} ha
    {parcelScope === "partial" && (
      <span className="jo-land-registry-transfer-scope-badge">
        {" "}(Partial Split)
      </span>
    )}
  </strong>
</div>


// ══════════════════════════════════════════════════════════════════════════════
// I) CSS additions — append to JoLandRegistryStyle.css
// ══════════════════════════════════════════════════════════════════════════════

/*
.jo-land-registry-transfer-scope-radios {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.jo-land-registry-transfer-radio-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  font-size: 0.93rem;
}

.jo-land-registry-transfer-radio-label input[type="radio"] {
  margin-top: 3px;
  accent-color: #2d6a4f;
  flex-shrink: 0;
}

.jo-land-registry-transfer-parcel-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 14px;
}

.jo-land-registry-transfer-parcel-row {
  background: #f4f6f9;
  border: 1px solid #d8dfe6;
  border-radius: 6px;
  padding: 10px 14px;
}

.jo-land-registry-transfer-parcel-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.jo-land-registry-transfer-parcel-number {
  font-weight: 600;
  font-size: 0.9rem;
}

.jo-land-registry-transfer-parcel-location {
  color: #555;
  font-size: 0.85rem;
}

.jo-land-registry-transfer-parcel-area {
  margin-left: auto;
  font-size: 0.85rem;
  color: #2d6a4f;
  font-weight: 500;
}

.jo-land-registry-transfer-parcel-full-badge {
  font-size: 0.85rem;
  color: #2d6a4f;
  background: #d8f3dc;
  border-radius: 4px;
  padding: 3px 8px;
  display: inline-block;
}

.jo-land-registry-transfer-parcel-split-inputs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.jo-land-registry-transfer-parcel-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.jo-land-registry-transfer-parcel-input-row label {
  font-size: 0.87rem;
  color: #444;
  white-space: nowrap;
}

.jo-land-registry-transfer-ha-input {
  width: 130px;
  padding: 5px 8px;
  border: 1px solid #bcc5cf;
  border-radius: 4px;
  font-size: 0.92rem;
}

.jo-land-registry-transfer-ha-input--error {
  border-color: #e63946;
  background: #fff0f0;
}

.jo-land-registry-transfer-ha-unit {
  font-size: 0.87rem;
  color: #666;
}

.jo-land-registry-transfer-input-error {
  color: #c0392b;
  font-size: 0.82rem;
  margin: 0;
}

.jo-land-registry-transfer-input-error--block {
  background: #fff0f0;
  border: 1px solid #e63946;
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 8px;
}

.jo-land-registry-transfer-remaining-preview {
  font-size: 0.82rem;
  color: #2d6a4f;
  margin: 0;
}

.jo-land-registry-transfer-scope-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  padding: 8px 0 0;
  border-top: 1px solid #d8dfe6;
  flex-wrap: wrap;
}

.jo-land-registry-transfer-scope-pct {
  color: #888;
}

.jo-land-registry-transfer-scope-badge {
  background: #fff3cd;
  color: #856404;
  border-radius: 4px;
  font-size: 0.78rem;
  padding: 1px 6px;
}
*/
