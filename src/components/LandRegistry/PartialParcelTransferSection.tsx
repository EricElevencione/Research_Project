// PartialParcelTransferSection.tsx
// Drop the <PartialParcelTransferSection> component inside the
// existing Transfer Ownership modal, replacing (or wrapping) the
// current "take_all / partial" area-selection block.
//
// Props are wired directly from usePartialTransfer() + existing state.

import React from "react";
import { ParcelSplitInput, ParcelTransferScope } from "./usePartialTransfer";

interface Props {
  // Which donor parcels are eligible (already filtered by selected source)
  donorParcels: ParcelSplitInput[];

  // From usePartialTransfer()
  parcelScope: ParcelTransferScope;
  onParcelScopeChange: (scope: ParcelTransferScope) => void;
  parcelSplitInputs: Record<number, number | "">;
  onSetParcelTransferArea: (farmParcelId: number, value: number | "") => void;

  // Derived summary (computed outside, passed in for display)
  validationError: string;     // "" when all inputs pass
  totalTransferAreaHa: number; // sum of all non-empty inputs (partial) or full donor area
  donorTotalAreaHa: number;    // sum of all donor parcels before transfer
}

export const PartialParcelTransferSection: React.FC<Props> = ({
  donorParcels,
  parcelScope,
  onParcelScopeChange,
  parcelSplitInputs,
  onSetParcelTransferArea,
  validationError,
  totalTransferAreaHa,
  donorTotalAreaHa,
}) => {
  if (donorParcels.length === 0) return null;

  const handleScopeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onParcelScopeChange(e.target.value as ParcelTransferScope);
  };

  return (
    <div className="jo-land-registry-transfer-section-card">
      <h4>Parcel Transfer Scope</h4>

      {/* ── Radio: Full vs Partial ── */}
      <div className="jo-land-registry-transfer-scope-radios">
        <label className="jo-land-registry-transfer-radio-label">
          <input
            type="radio"
            name="parcelScope"
            value="full"
            checked={parcelScope === "full"}
            onChange={handleScopeChange}
          />
          <span>
            <strong>Full Parcel</strong> – transfer the entire parcel to
            recipient
          </span>
        </label>

        <label className="jo-land-registry-transfer-radio-label">
          <input
            type="radio"
            name="parcelScope"
            value="partial"
            checked={parcelScope === "partial"}
            onChange={handleScopeChange}
          />
          <span>
            <strong>Partial Parcel</strong> – split a portion; donor retains
            the remainder
          </span>
        </label>
      </div>

      {/* ── Parcel list ── */}
      <div className="jo-land-registry-transfer-parcel-list">
        {donorParcels.map((parcel) => {
          const inputVal = parcelSplitInputs[parcel.farm_parcel_id];
          const numericInput = typeof inputVal === "number" ? inputVal : null;
          const remaining =
            numericInput !== null
              ? parcel.total_farm_area_ha - numericInput
              : null;
          const isOverLimit =
            numericInput !== null &&
            numericInput >= parcel.total_farm_area_ha;
          const isNegativeOrZero =
            numericInput !== null && numericInput <= 0;

          return (
            <div
              key={parcel.farm_parcel_id}
              className="jo-land-registry-transfer-parcel-row"
            >
              {/* Parcel header */}
              <div className="jo-land-registry-transfer-parcel-meta">
                <span className="jo-land-registry-transfer-parcel-number">
                  {parcel.parcel_number}
                </span>
                <span className="jo-land-registry-transfer-parcel-location">
                  {parcel.farm_location_barangay}
                </span>
                <span className="jo-land-registry-transfer-parcel-area">
                  {parcel.total_farm_area_ha.toFixed(4)} ha total
                </span>
              </div>

              {/* Full mode: read-only area badge */}
              {parcelScope === "full" && (
                <div className="jo-land-registry-transfer-parcel-full-badge">
                  Transferring full {parcel.total_farm_area_ha.toFixed(4)} ha
                </div>
              )}

              {/* Partial mode: hectare input */}
              {parcelScope === "partial" && (
                <div className="jo-land-registry-transfer-parcel-split-inputs">
                  <div className="jo-land-registry-transfer-parcel-input-row">
                    <label>Transfer (ha):</label>
                    <input
                      type="number"
                      min="0.0001"
                      max={parcel.total_farm_area_ha - 0.0001}
                      step="0.0001"
                      placeholder={`Max ${(parcel.total_farm_area_ha - 0.0001).toFixed(4)}`}
                      value={inputVal === "" || inputVal === undefined ? "" : inputVal}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          onSetParcelTransferArea(parcel.farm_parcel_id, "");
                          return;
                        }
                        const parsed = parseFloat(raw);
                        onSetParcelTransferArea(
                          parcel.farm_parcel_id,
                          Number.isFinite(parsed) ? parsed : "",
                        );
                      }}
                      className={[
                        "jo-land-registry-transfer-ha-input",
                        isOverLimit || isNegativeOrZero
                          ? "jo-land-registry-transfer-ha-input--error"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <span className="jo-land-registry-transfer-ha-unit">ha</span>
                  </div>

                  {/* Inline validation hint */}
                  {isOverLimit && (
                    <p className="jo-land-registry-transfer-input-error">
                      Must be less than {parcel.total_farm_area_ha.toFixed(4)}{" "}
                      ha. Use Full Parcel for complete handover.
                    </p>
                  )}
                  {isNegativeOrZero && (
                    <p className="jo-land-registry-transfer-input-error">
                      Must be greater than 0.
                    </p>
                  )}

                  {/* Remaining area preview */}
                  {remaining !== null && !isOverLimit && !isNegativeOrZero && (
                    <p className="jo-land-registry-transfer-remaining-preview">
                      Donor retains:{" "}
                      <strong>{remaining.toFixed(4)} ha</strong>. New parcel
                      number:{" "}
                      <code>
                        {parcel.parcel_number}-SPL-1
                      </code>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Summary row ── */}
      <div className="jo-land-registry-transfer-scope-summary">
        <span>Total transfer area:</span>
        <strong>
          {totalTransferAreaHa.toFixed(4)} ha
        </strong>
        {" of "}
        <strong>{donorTotalAreaHa.toFixed(4)} ha</strong>
        {parcelScope === "partial" && donorTotalAreaHa > 0 && (
          <span className="jo-land-registry-transfer-scope-pct">
            {" "}
            ({((totalTransferAreaHa / donorTotalAreaHa) * 100).toFixed(1)}%)
          </span>
        )}
      </div>

      {/* ── Block-level validation error ── */}
      {validationError && (
        <div className="jo-land-registry-transfer-input-error jo-land-registry-transfer-input-error--block">
          ⚠ {validationError}
        </div>
      )}
    </div>
  );
};
