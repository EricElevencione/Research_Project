// PartialParcelTransferSection.tsx
// Drop the <PartialParcelTransferSection> component inside the
// existing Transfer Ownership modal. Lets the user pick which
// donor parcel(s) to transfer (full parcels only — no partial
// split option).
//
// Props are wired directly from existing state in JoLandRegistry.tsx.

import React from "react";
import { ParcelSplitInput } from "./usePartialTransfer";

interface Props {
  // Which donor parcels are eligible (already filtered by selected source)
  donorParcels: ParcelSplitInput[];

  // Derived summary (computed outside, passed in for display)
  totalTransferAreaHa: number; // sum of area for selected parcels
  donorTotalAreaHa: number; // sum of all donor parcels before transfer

  // Selected parcels
  selectedFullParcelIds?: number[];
  onToggleFullParcel?: (farmParcelId: number) => void;
}

export const PartialParcelTransferSection: React.FC<Props> = ({
  donorParcels,
  totalTransferAreaHa,
  donorTotalAreaHa,
  selectedFullParcelIds = [],
  onToggleFullParcel,
}) => {
  if (donorParcels.length === 0) return null;

  return (
    <div className="jo-land-registry-transfer-section-card">
      <h4>Select Parcel(s) to Transfer</h4>

      {/* ── Parcel list ── */}
      <div className="jo-land-registry-transfer-parcel-list">
        {donorParcels.map((parcel) => {
          const isSelected = selectedFullParcelIds.includes(
            parcel.farm_parcel_id,
          );

          return (
            <div
              key={parcel.farm_parcel_id}
              className={[
                "jo-land-registry-transfer-parcel-row",
                isSelected
                  ? "jo-land-registry-transfer-parcel-row--selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleFullParcel?.(parcel.farm_parcel_id)}
                  style={{
                    width: "18px",
                    height: "18px",
                    cursor: "pointer",
                    accentColor: "#10b981",
                    flexShrink: 0,
                  }}
                />

                <div style={{ flexGrow: 1 }}>
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

                  {/* Selection state badge */}
                  <div
                    className="jo-land-registry-transfer-parcel-full-badge"
                    style={{
                      background: isSelected ? "#dcfce7" : "#f1f5f9",
                      borderColor: isSelected ? "#86efac" : "#cbd5e1",
                      color: isSelected ? "#15803d" : "#475569",
                    }}
                  >
                    {isSelected
                      ? `Selected to Transfer: full ${parcel.total_farm_area_ha.toFixed(4)} ha`
                      : "Click checkbox to select this parcel"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Summary row ── */}
      <div className="jo-land-registry-transfer-scope-summary">
        <span>Total transfer area:</span>
        <strong>{totalTransferAreaHa.toFixed(4)} ha</strong>
        {" of "}
        <strong>{donorTotalAreaHa.toFixed(4)} ha</strong>
        {donorTotalAreaHa > 0 && (
          <span className="jo-land-registry-transfer-scope-pct">
            {" "}
            ({((totalTransferAreaHa / donorTotalAreaHa) * 100).toFixed(1)}%)
          </span>
        )}
      </div>
    </div>
  );
};
