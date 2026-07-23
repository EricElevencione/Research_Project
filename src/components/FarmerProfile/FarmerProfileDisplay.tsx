import React, { useState, useEffect } from "react";
import "../../components/FarmerProfile/farmerProfileModal.css";
import ParcelGeometryPreview from "../FarmerProfile/ParcelGeometryPreview";
import { supabase } from "../../supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Unified Farmer Profile Display
// Replaces both LandownerProfileDisplay and TenantLesseeProfileDisplay with
// a single component that adapts Occupant Details based on the person's role.
// ─────────────────────────────────────────────────────────────────────────────

export interface OccupantInfo {
  submissionId: string;
  name: string;
  ffrsCode?: string;
  role: "tenant" | "lessee" | "tenant+lessee" | "land-owner";
  isLinked?: boolean;
}

export interface UnifiedParcel {
  id: string;
  parcelNumber: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: number;

  /** The profile person's role on this parcel */
  role:
    | "owner-farmed"
    | "land-owner"
    | "tenant"
    | "lessee"
    | "tenant+lessee";

  /** Detailed occupant list — for owners: tenants/lessees; for tenants: the land owner */
  occupants: OccupantInfo[];

  /** GIS geometry for map preview (null → shows placeholder) */
  geometry?: any | null;

  // Optional extras
  withinAncestralDomain?: string;
  ownershipDocumentNo?: string;
  agrarianReformBeneficiary?: string;
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
  statusChangeReason?: string | null;

  name?: string;
  address?: string;
  age?: number | string;
  gender?: string;
  mainLivelihood?: string;
  farmingActivities?: string[];

  parcels: UnifiedParcel[];
  profilePicture?: string | null;
  profile_picture?: string | null;
}

interface FarmerProfileDisplayProps {
  farmer: FarmerProfileData;
  onClose?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const getRoleLabel = (role: string) => {
  switch (role) {
    case "owner-farmed":
    case "land-owner":
      return "Land-owner";
    case "tenant":
      return "Tenant";
    case "lessee":
      return "Lessee";
    case "tenant+lessee":
      return "Tenant + Lessee";
    default:
      return role || "—";
  }
};

const isParcelFarming = (parcel: UnifiedParcel) => {
  if (typeof parcel.isFarming === "boolean") return parcel.isFarming;
  if (typeof parcel.isCultivating === "boolean") return parcel.isCultivating;
  return null;
};

const getParcelFarmingReason = (parcel: UnifiedParcel) => {
  return parcel.farmingStatusReason || parcel.cultivationStatusReason || null;
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
};

// ── Component ────────────────────────────────────────────────────────────────

export const FarmerProfileDisplay: React.FC<FarmerProfileDisplayProps> = ({
  farmer,
  onClose,
}) => {
  const parcels = farmer.parcels || [];
  
  // Local state for profile picture
  const [profilePic, setProfilePic] = useState<string | null>(
    farmer.profilePicture || farmer.profile_picture || null
  );
  const [isUpdatingPic, setIsUpdatingPic] = useState(false);

  useEffect(() => {
    setProfilePic(farmer.profilePicture || farmer.profile_picture || null);
  }, [farmer.id, farmer.profilePicture, farmer.profile_picture]);

  const handleAvatarClick = () => {
    document.getElementById("farmer-profile-pic-input")?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !farmer.id) return;

    setIsUpdatingPic(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        
        // Target ID safely whether string, UUID, or integer
        const targetId =
          typeof farmer.id === "string" && !isNaN(Number(farmer.id)) && !farmer.id.includes("-")
            ? Number(farmer.id)
            : farmer.id;

        // Update in Supabase
        const { error } = await supabase
          .from("rsbsa_submission")
          .update({ profile_picture: base64Data })
          .eq("id", targetId);

        if (error) {
          console.error("Error updating profile picture:", error.message);
          alert("Failed to update profile picture. Please try again.");
        } else {
          setProfilePic(base64Data);
          // Update prop reference for parent lists
          farmer.profilePicture = base64Data;
          farmer.profile_picture = base64Data;
        }
        setIsUpdatingPic(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error uploading picture:", err);
      setIsUpdatingPic(false);
    }
  };

  // Summary stats
  const totalArea = parcels.reduce(
    (s, p) =>
      s +
      (typeof p.totalFarmAreaHa === "number"
        ? p.totalFarmAreaHa
        : parseFloat(String(p.totalFarmAreaHa || 0))),
    0,
  );

  const ownerFarmedCount = parcels.filter(
    (p) => p.role === "owner-farmed",
  ).length;
  const landOwnerOnlyCount = parcels.filter(
    (p) => p.role === "land-owner",
  ).length;
  const occupiedCount = parcels.filter(
    (p) =>
      p.role === "tenant" ||
      p.role === "lessee" ||
      p.role === "tenant+lessee",
  ).length;

  // Determine header subtitle based on predominant role
  const headerSubtitle = (() => {
    const hasOwnerParcels = ownerFarmedCount > 0 || landOwnerOnlyCount > 0;
    const hasTenantParcels = parcels.some(
      (p) =>
        p.role === "tenant" ||
        p.role === "lessee" ||
        p.role === "tenant+lessee",
    );
    if (hasOwnerParcels && hasTenantParcels) return "Farmer Profile";
    if (hasOwnerParcels) return "Land Ownership Information";
    if (hasTenantParcels) return "Tenant / Lessee Information";
    return "Farmer Profile";
  })();

  return (
    <div className="farmer-modal-wrapper">
      {/* ── Sticky Top Header ── */}
      <div className="farmer-modal-top-header">
        <div>
          <span className="farmer-modal-title">Farmer Profile</span>
          <span className="farmer-modal-title-sub">{headerSubtitle}</span>
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
        {/* ── Hero Banner ── */}
        <div className="farmer-profile-hero">
          <div className="farmer-profile-avatar-wrapper" onClick={handleAvatarClick} title="Click to upload/change photo">
            {profilePic ? (
              <img
                src={profilePic}
                alt="Farmer Avatar"
                className="farmer-profile-avatar"
              />
            ) : (
              <div className="farmer-profile-avatar-placeholder">
                {farmer.name ? farmer.name.split(" ").map((n: string) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() : "F"}
              </div>
            )}
            <div className="farmer-profile-avatar-overlay">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>{profilePic ? "Change Photo" : "Add Photo"}</span>
            </div>
          </div>
          <input
            id="farmer-profile-pic-input"
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
            disabled={isUpdatingPic}
          />
          
          <div className="farmer-profile-hero-details">
            <h2 className="farmer-profile-hero-name">{farmer.name || "Unnamed Farmer"}</h2>
            <span className="farmer-profile-hero-role">{headerSubtitle}</span>
            <span className="farmer-profile-hero-address">📍 {farmer.address || "No address provided"}</span>
          </div>
        </div>

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
              <span className="farmer-modal-label">Full Name:</span>
              <span className="farmer-modal-value">
                {farmer.name || "—"}
              </span>
            </div>
            <div className="farmer-modal-info-item">
              <span className="farmer-modal-label">Address:</span>
              <span className="farmer-modal-value">
                {farmer.address || "—"}
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
              <span className="farmer-modal-value">
                {farmer.gender || "—"}
              </span>
            </div>
            {((farmer.farmingActivities ?? []).length > 0 ||
              farmer.mainLivelihood) && (
              <div className="farmer-modal-info-item farmer-modal-full-width">
                <span className="farmer-modal-label">Main Livelihood:</span>
                <span className="farmer-modal-value">
                  {farmer.farmingActivities &&
                  farmer.farmingActivities.length > 0
                    ? farmer.farmingActivities.join(", ")
                    : farmer.mainLivelihood || "—"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Land Overview */}
        <div className="farmer-modal-section">
          <h3 className="farmer-modal-section-title">🏡 Land Overview</h3>

          {/* Summary banner */}
          {parcels.length > 0 && (
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
                Parcels: <strong>{parcels.length}</strong>
              </div>
              {ownerFarmedCount > 0 && (
                <div>
                  Self-farmed: <strong>{ownerFarmedCount}</strong>
                </div>
              )}
              {landOwnerOnlyCount > 0 && (
                <div>
                  Land-owner: <strong>{landOwnerOnlyCount}</strong>
                </div>
              )}
              {occupiedCount > 0 && (
                <div>
                  Occupied: <strong>{occupiedCount}</strong>
                </div>
              )}
            </div>
          )}

          {parcels.length === 0 ? (
            <div className="farmer-modal-no-data">No parcels found.</div>
          ) : (
            <div className="farmer-modal-parcels-container">
              {parcels.map((parcel, index) => {
                const farmingVal = isParcelFarming(parcel);
                const reasonVal = getParcelFarmingReason(parcel);

                return (
                  <div key={parcel.id || index} className="farmer-modal-parcel-card">
                    <div className="farmer-modal-parcel-header">
                      <h4>
                        Parcel Number {index + 1} – #
                        {parcel.parcelNumber !== "N/A"
                          ? parcel.parcelNumber
                          : `ID-${parcel.id}`}
                      </h4>
                    </div>
                    <div className="farmer-modal-parcel-details">
                      {/* Location */}
                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">Location:</span>
                        <span className="farmer-modal-value">
                          {parcel.farmLocationBarangay || "—"}
                          {parcel.farmLocationMunicipality &&
                            `, ${parcel.farmLocationMunicipality}`}
                        </span>
                      </div>

                      {/* Size */}
                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">Size:</span>
                        <span className="farmer-modal-value">
                          {typeof parcel.totalFarmAreaHa === "number"
                            ? parcel.totalFarmAreaHa.toFixed(4)
                            : parseFloat(
                                String(parcel.totalFarmAreaHa || 0),
                              ).toFixed(4)}{" "}
                          ha
                        </span>
                      </div>

                      {/* Role */}
                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">Role:</span>
                        <span className="farmer-modal-value">
                          {getRoleLabel(parcel.role)}
                        </span>
                      </div>

                      {/* Occupant Details — adapts based on role */}
                      <div className="farmer-modal-parcel-item">
                        <span className="farmer-modal-label">
                          Occupant Details:
                        </span>
                        <span className="farmer-modal-value">
                          {(parcel.occupants || []).length > 0 ? (
                            <span
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              {(parcel.occupants || []).map((occ, occIdx) => {
                                const roleText = getRoleLabel(occ.role);
                                return (
                                  <span
                                    key={occ.submissionId || occIdx}
                                    style={{
                                      display: "block",
                                      fontSize: "0.9em",
                                    }}
                                  >
                                    • {occ.name} ({roleText})
                                  </span>
                                );
                              })}
                            </span>
                          ) : parcel.role === "owner-farmed" || farmingVal === true ? (
                            <span style={{ color: "#2e7d32", fontWeight: 500 }}>
                              Self-farmed
                            </span>
                          ) : (
                            <span style={{ color: "#b91c1c", fontWeight: 500 }}>
                              Unoccupied (No Farmer)
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Cultivation Status */}
                      {farmingVal !== null && (
                        <div className="farmer-modal-parcel-item">
                          <span className="farmer-modal-label">
                            Cultivation:
                          </span>
                          <span className="farmer-modal-value">
                            {farmingVal === true ? (
                              <span
                                style={{ color: "#2e7d32", fontWeight: 600 }}
                              >
                                Actively farming
                              </span>
                            ) : (
                              <span
                                style={{ color: "#c62828", fontWeight: 600 }}
                              >
                                Not farming
                                {reasonVal && ` (${reasonVal})`}
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      {/* Optional extras — shown only if they exist */}
                      {parcel.withinAncestralDomain && (
                        <div className="farmer-modal-parcel-item">
                          <span className="farmer-modal-label">
                            Ancestral Domain:
                          </span>
                          <span className="farmer-modal-value">
                            {parcel.withinAncestralDomain}
                          </span>
                        </div>
                      )}
                      {parcel.ownershipDocumentNo && (
                        <div className="farmer-modal-parcel-item">
                          <span className="farmer-modal-label">
                            Document No:
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

                    {/* Map Preview */}
                    <div style={{ padding: "0 16px 16px" }}>
                      <ParcelGeometryPreview
                        geometry={parcel.geometry ?? null}
                        parcelLabel={parcel.parcelNumber}
                      />
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

export default FarmerProfileDisplay;
