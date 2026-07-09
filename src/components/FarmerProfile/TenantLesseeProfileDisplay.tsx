import React from "react";
import "../../components/FarmerProfile/farmerProfileModal.css";

export interface FarmerProfileParcel {
  id?: string;
  parcelNumber?: string;
  farmLocationBarangay?: string;
  farmLocationMunicipality?: string;
  totalFarmAreaHa?: number;
  ownershipTypeRegisteredOwner?: boolean;
  ownershipTypeTenant?: boolean;
  ownershipTypeLessee?: boolean;
  tenantLandOwnerName?: string;
  lesseeLandOwnerName?: string;
  withinAncestralDomain?: string;
  ownershipDocumentNo?: string;
  agrarianReformBeneficiary?: string;
  ownershipOthersSpecify?: string;
  contractEndDate?: string | null;
  isFarming?: boolean | null;
  isCultivating?: boolean | null;
  farmingStatusReason?: string | null;
  cultivationStatusReason?: string | null;
}

export interface FarmerProfileData {
  id?: string;
  referenceNumber?: string;
  dateSubmitted?: string;
  recordStatus?: string;
  birthdate?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  farmerName?: string;
  farmerAddress?: string;
  age?: number | string;
  gender?: string;
  mainLivelihood?: string;
  farmingActivities?: string[];
  parcels?: FarmerProfileParcel[];
  statusChangeReason?: string | null;
}

interface TenantLesseeProfileDisplayProps {
  farmer: FarmerProfileData;
  onClose?: () => void;
}

export const TenantLesseeProfileDisplay: React.FC<
  TenantLesseeProfileDisplayProps
> = ({ farmer, onClose }) => {
  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
  };

  const getParcelOwnershipLabel = (parcel: FarmerProfileParcel) => {
    if (parcel.ownershipTypeRegisteredOwner) return "Owner-Farming"; // Islan lang karun
    if (parcel.ownershipTypeTenant && parcel.ownershipTypeLessee)
      return "Tenant + Lessee";
    if (parcel.ownershipTypeTenant) return "Tenant";
    if (parcel.ownershipTypeLessee) return "Lessee";
    return "—";
  };

  const isParcelFarming = (parcel: FarmerProfileParcel) => {
    if (typeof parcel.isFarming === "boolean") return parcel.isFarming;
    if (typeof parcel.isCultivating === "boolean") return parcel.isCultivating;
    return null;
  };

  const getParcelFarmingReason = (parcel: FarmerProfileParcel) => {
    return parcel.farmingStatusReason || parcel.cultivationStatusReason || null;
  };

  return (
    <div className="farmer-modal-wrapper">
      {/* ── Sticky Top Header with Close Button ── */}
      <div className="farmer-modal-top-header">
        <div>
          <span className="farmer-modal-title">Farmer Profile</span>
          <span className="farmer-modal-title-sub">
            Tenant / Lessee Information
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
                {farmer.referenceNumber || "—"}
              </span>
            </div>
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Date Submitted:</span>
              <span className="farmer-modal-value">
                {farmer.dateSubmitted || "—"}
              </span>
            </div>
            <div className="farmer-modal-info-item farmer-modal-full-width">
              <span className="farmer-modal-label">Status:</span>
              <span className="farmer-modal-value">
                {farmer.recordStatus || "—"}
              </span>
            </div>
            {farmer.recordStatus === "Not Active" &&
              farmer.statusChangeReason && (
                <div
                  className="farmer-modal-info-item farmer-modal-full-width"
                  style={{ marginTop: "8px" }}
                >
                  <span
                    className="farmer-modal-label"
                    style={{ color: "#d32f2f" }}
                  >
                    Reason for Inactivity:
                  </span>
                  <span className="farmer-modal-value">
                    {farmer.statusChangeReason}
                  </span>
                </div>
              )}
            {farmer.archivedAt && (
              <>
                <div className="farmer-modal-info-item">
                  <span className="farmer-modal-label">Archived On:</span>
                  <span
                    className="farmer-modal-value"
                    style={{ color: "var(--color-text-danger, #c0392b)" }}
                  >
                    {formatDateTime(farmer.archivedAt)}
                  </span>
                </div>
                <div className="farmer-modal-info-item">
                  <span className="farmer-modal-label">Archive Reason:</span>
                  <span className="farmer-modal-value">
                    {farmer.archiveReason || "Not specified"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Personal Information */}
        <div className="farmer-modal-section">
          <h3 className="farmer-modal-section-title">
            👤 Personal Information
          </h3>
          <div className="farmer-modal-info-grid">
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Farmer Name:</span>
              <span className="farmer-modal-value">
                {farmer.farmerName || "—"}
              </span>
            </div>
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Farmer Address:</span>
              <span className="farmer-modal-value">
                {farmer.farmerAddress || "—"}
              </span>
            </div>
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Age:</span>
              <span className="farmer-modal-value">
                {typeof farmer.age === "number"
                  ? `${farmer.age} years old`
                  : farmer.age || "—"}
                {farmer.birthdate && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: "0.85em",
                      color: "var(--color-text-secondary, #666)",
                    }}
                  >
                    (Born: {farmer.birthdate})
                  </span>
                )}
              </span>
            </div>
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Gender:</span>
              <span className="farmer-modal-value">{farmer.gender || "—"}</span>
            </div>
            <div className="farmer-modal-info-item farmer-modal-full-width">
              <span className="farmer-modal-label">Main Livelihood:</span>
              <span className="farmer-modal-value">
                {farmer.farmingActivities && farmer.farmingActivities.length > 0
                  ? farmer.farmingActivities.join(", ")
                  : farmer.mainLivelihood || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Farm Information */}
        <div className="farmer-modal-section">
          <h3 className="farmer-modal-section-title">🌾 Farm Information</h3>
          {!farmer.parcels || farmer.parcels.length === 0 ? (
            <p className="farmer-modal-no-data">No parcels found</p>
          ) : (
            <div className="farmer-modal-parcels-container">
              {farmer.parcels.map((parcel, index) => {
                const isValidParcelNumber =
                  parcel.parcelNumber &&
                  parcel.parcelNumber !== "N/A" &&
                  !parcel.parcelNumber.includes("-") &&
                  /^\d+$/.test(parcel.parcelNumber);

                const displayParcelNumber = isValidParcelNumber
                  ? parcel.parcelNumber
                  : index + 1;

                const ownerName =
                  parcel.tenantLandOwnerName || parcel.lesseeLandOwnerName;
                const farmingVal = isParcelFarming(parcel);
                const reasonVal = getParcelFarmingReason(parcel);

                return (
                  <div
                    key={parcel.id || index}
                    className="farmer-modal-parcel-card"
                  >
                    <div className="farmer-modal-parcel-header">
                      <h4>Parcel #{displayParcelNumber}</h4>
                    </div>
                    <div className="farmer-modal-parcel-details">
                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">
                          Land Ownership:
                        </span>
                        <span className="farmer-modal-value">
                          {getParcelOwnershipLabel(parcel)}
                          {ownerName && (
                            <span className="farmer-modal-owner-name">
                              {" "}
                              (Owner: {ownerName})
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">
                          Parcel Location:
                        </span>
                        <span className="farmer-modal-value">
                          {parcel.farmLocationBarangay || "—"}
                          {parcel.farmLocationMunicipality &&
                            `, ${parcel.farmLocationMunicipality}`}
                        </span>
                      </div>

                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">Parcel Size:</span>
                        <span className="farmer-modal-value">
                          {typeof parcel.totalFarmAreaHa === "number"
                            ? parcel.totalFarmAreaHa.toFixed(4)
                            : parseFloat(
                                String(parcel.totalFarmAreaHa || 0),
                              ).toFixed(4)}{" "}
                          hectares
                        </span>
                      </div>

                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">
                          Cultivation Status:
                        </span>
                        <span className="farmer-modal-value">
                          {farmingVal === true ? (
                            <span style={{ color: "#2e7d32", fontWeight: 600 }}>
                              Actively farming
                            </span>
                          ) : farmingVal === false ? (
                            <span style={{ color: "#c62828", fontWeight: 600 }}>
                              Not farming{reasonVal && ` (${reasonVal})`}
                            </span>
                          ) : (
                            "Not specified"
                          )}
                        </span>
                      </div>

                      {parcel.withinAncestralDomain && (
                        <div className="farmer-modal-parcel-item">
                          <span className="farmer-modal-label">
                            Within Ancestral Domain:
                          </span>
                          <span className="farmer-modal-value">
                            {parcel.withinAncestralDomain}
                          </span>
                        </div>
                      )}

                      {parcel.ownershipDocumentNo && (
                        <div className="farmer-modal-parcel-item">
                          <span className="farmer-modal-label">
                            Document Number:
                          </span>
                          <span className="farmer-modal-value">
                            {parcel.ownershipDocumentNo}
                          </span>
                        </div>
                      )}

                      {parcel.agrarianReformBeneficiary && (
                        <div className="farmer-modal-parcel-item">
                          <span className="farmer-modal-label">
                            ARB Beneficiary:
                          </span>
                          <span className="farmer-modal-value">
                            {parcel.agrarianReformBeneficiary}
                          </span>
                        </div>
                      )}
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
export default TenantLesseeProfileDisplay;
