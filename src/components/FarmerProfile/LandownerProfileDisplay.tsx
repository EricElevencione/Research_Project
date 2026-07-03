import React from "react";
import "../../components/FarmerProfile/farmerProfileModal.css";

export interface LandownerOccupant {
  submissionId: string;
  name: string;
  ffrsCode: string;
  role: "tenant" | "lessee" | "tenant+lessee";
  isLinked: boolean;
}

export interface LandownerProfileParcel {
  id: string;
  parcelNumber: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: number;
  occupationType: "owner-farmed" | "tenant" | "lessee" | "tenant+lessee";
  occupants: LandownerOccupant[];
  agrarianReformBeneficiary: string;
  withinAncestralDomain: string;
  ownershipDocumentNo: string;
  isFarming?: boolean | null;
  isCultivating?: boolean | null;
  farmingStatusReason?: string | null;
  cultivationStatusReason?: string | null;
}

export interface LandownerProfileData {
  id?: string;
  referenceNumber?: string;
  dateSubmitted?: string;
  recordStatus?: string;
  birthdate?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  landownerName?: string;
  landownerAddress?: string;
  age?: number | string;
  gender?: string;
  parcels: LandownerProfileParcel[];
}

interface LandownerProfileDisplayProps {
  landowner: LandownerProfileData;
  onClose?: () => void;
}

export const LandownerProfileDisplay: React.FC<
  LandownerProfileDisplayProps
> = ({ landowner, onClose }) => {
  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
  };

  const getParcelOccupationLabel = (type: string) => {
    if (type === "owner-farmed") return "Owner-farmed";
    if (type === "tenant") return "Has Tenant";
    if (type === "lessee") return "Has Lessee";
    if (type === "tenant+lessee") return "Tenant + Lessee";
    return type || "Mixed";
  };

  const isParcelFarming = (parcel: LandownerProfileParcel) => {
    if (typeof parcel.isFarming === "boolean") return parcel.isFarming;
    if (typeof parcel.isCultivating === "boolean") return parcel.isCultivating;
    return null;
  };

  const getParcelFarmingReason = (parcel: LandownerProfileParcel) => {
    return parcel.farmingStatusReason || parcel.cultivationStatusReason || null;
  };

  const totalArea = (landowner.parcels || []).reduce(
    (s, p) =>
      s +
      (typeof p.totalFarmAreaHa === "number"
        ? p.totalFarmAreaHa
        : parseFloat(String(p.totalFarmAreaHa || 0))),
    0,
  );
  const ownerCult = (landowner.parcels || []).filter(
    (p) => p.occupationType === "owner-farmed",
  ).length;
  const occupied = (landowner.parcels || []).filter(
    (p) => p.occupationType !== "owner-farmed",
  ).length;
  const totalTenants = new Set(
    (landowner.parcels || [])
      .flatMap((p) => p.occupants || [])
      .filter((o) => o.role === "tenant" || o.role === "tenant+lessee")
      .map((o) => o.submissionId),
  ).size;
  const totalLessees = new Set(
    (landowner.parcels || [])
      .flatMap((p) => p.occupants || [])
      .filter((o) => o.role === "lessee" || o.role === "tenant+lessee")
      .map((o) => o.submissionId),
  ).size;

  return (
    <div className="farmer-modal-wrapper">
      {/* ── Sticky Top Header with Close Button ── */}
      <div className="farmer-modal-top-header">
        <div>
          <span className="farmer-modal-title">Landowner Profile</span>
          <span className="farmer-modal-title-sub">
            Land Ownership Information
          </span>
        </div>
        {onClose && (
          <button
            className="farmer-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Scrollable Content ── */}
      <div className="farmer-modal-scroll-content">
        {/* Record Overview */}
        <div className="farmer-modal-section">
          <h3 className="farmer-modal-section-title">Record Overview</h3>
          <div className="farmer-modal-info-grid">
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">FFRS ID:</span>
              <span className="farmer-modal-value">
                {landowner.referenceNumber || "—"}
              </span>
            </div>
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Date Submitted:</span>
              <span className="farmer-modal-value">
                {landowner.dateSubmitted || "—"}
              </span>
            </div>
            <div className="farmer-modal-info-item farmer-modal-full-width">
              <span className="farmer-modal-label">Status:</span>
              <span className="farmer-modal-value">
                {landowner.recordStatus || "—"} (
                {landowner.archiveReason || "Not specified"})
              </span>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="farmer-modal-section">
          <h3 className="farmer-modal-section-title">
            👤 Personal Information
          </h3>
          <div className="farmer-modal-info-grid">
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Full Name:</span>
              <span className="farmer-modal-value">
                {landowner.landownerName || "—"}
              </span>
            </div>
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Address:</span>
              <span className="farmer-modal-value">
                {landowner.landownerAddress || "—"}
              </span>
            </div>
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Age:</span>
              <span className="farmer-modal-value">
                {typeof landowner.age === "number"
                  ? `${landowner.age} years old`
                  : landowner.age || "—"}
                {landowner.birthdate && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: "0.85em",
                      color: "var(--color-text-secondary, #666)",
                    }}
                  >
                    (Born: {landowner.birthdate})
                  </span>
                )}
              </span>
            </div>
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Gender:</span>
              <span className="farmer-modal-value">
                {landowner.gender || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Land Overview */}
        <div className="farmer-modal-section">
          <h3 className="farmer-modal-section-title">🏡 Land Overview</h3>

          {/* Summary banner */}
          {(landowner.parcels || []).length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 20,
                padding: "8px 12px",
                marginBottom: 12,
                background: "var(--color-background-secondary, #f5f5f5)",
                borderRadius: 6,
                fontSize: "0.9em",
                fontWeight: 500,
                color: "var(--color-text-secondary, #666)",
                border: "1px solid var(--color-border, #e0e0e0)",
              }}
            >
              <div>
                Total Area:{" "}
                <strong style={{ color: "#2e7d32" }}>
                  {totalArea.toFixed(4)} ha
                </strong>
              </div>
              <div>
                Parcels: <strong>{(landowner.parcels || []).length}</strong>
              </div>
              {ownerCult > 0 && (
                <div>
                  Owner-farmed: <strong>{ownerCult}</strong>
                </div>
              )}
              {occupied > 0 && (
                <div>
                  Occupied: <strong>{occupied}</strong>
                </div>
              )}
              {totalTenants > 0 && (
                <div>
                  Tenants: <strong>{totalTenants}</strong>
                </div>
              )}
              {totalLessees > 0 && (
                <div>
                  Lessees: <strong>{totalLessees}</strong>
                </div>
              )}
            </div>
          )}

          {(landowner.parcels || []).length === 0 ? (
            <div className="farmer-modal-no-data">No land parcels owned.</div>
          ) : (
            <div className="farmer-modal-parcels-container">
              {(landowner.parcels || []).map((parcel, index) => {
                const farmingVal = isParcelFarming(parcel);
                const reasonVal = getParcelFarmingReason(parcel);

                return (
                  <div key={parcel.id} className="farmer-modal-parcel-card">
                    <div className="farmer-modal-parcel-header">
                      <h4>
                        Parcel #
                        {parcel.parcelNumber !== "N/A"
                          ? parcel.parcelNumber
                          : index + 1}
                      </h4>
                    </div>
                    <div className="farmer-modal-parcel-details">
                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">Location:</span>
                        <span className="farmer-modal-value">
                          {parcel.farmLocationBarangay},{" "}
                          {parcel.farmLocationMunicipality}
                        </span>
                      </div>

                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">Size:</span>
                        <span className="farmer-modal-value">
                          {typeof parcel.totalFarmAreaHa === "number"
                            ? parcel.totalFarmAreaHa.toFixed(4)
                            : parseFloat(
                                String(parcel.totalFarmAreaHa),
                              ).toFixed(4)}{" "}
                          ha
                        </span>
                      </div>

                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">Occupation:</span>
                        <span className="farmer-modal-value">
                          {getParcelOccupationLabel(parcel.occupationType)}
                        </span>
                      </div>

                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">
                          Occupant details:
                        </span>
                        <span className="farmer-modal-value">
                          {(parcel.occupants || []).length === 0 ? (
                            <span style={{ color: "#888" }}>
                              No other occupants registered.
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              {(parcel.occupants || []).map((occ) => {
                                const roleText =
                                  occ.role === "tenant"
                                    ? "Tenant"
                                    : occ.role === "lessee"
                                      ? "Lessee"
                                      : "Tenant + Lessee";
                                return (
                                  <span
                                    key={occ.submissionId}
                                    style={{
                                      display: "block",
                                      fontSize: "0.9em",
                                    }}
                                  >
                                    • {occ.name} ({roleText})
                                    {!occ.isLinked && (
                                      <span
                                        style={{
                                          color: "#d32f2f",
                                          marginLeft: 6,
                                          fontSize: "0.85em",
                                          fontWeight: 600,
                                        }}
                                      >
                                        ⚠️ Unlinked
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
