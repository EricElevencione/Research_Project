import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import "../../components/layout/sidebarStyle.css";
import "../../assets/css/technician css/PickLandStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";
import { getRsbsaSubmissions, getFarmParcels } from "../../api";

interface LandOwner {
  id: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  parcelArea?: string;
  submissionId?: string; // Add submissionId to LandOwner interface
}

interface FarmParcel {
  id: string;
  submissionId: string;
  parcelNumber: string;
  farmLocationBarangay: string;
  farmLocationCityMunicipality: string;
  totalFarmArea: number;
  cropCommodity: string;
  farmSize: string;
  farmType: string;
  organicPractitioner: boolean;
  plotStatus: string;
  geometry?: any;
  ownershipTypeRegisteredOwner: boolean;
  ownershipTypeTenant: boolean;
  ownershipTypeLessee: boolean;
  createdAt: string;
  updatedAt: string;
}

const TechPickLandParcel: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { ownerId } = useParams<{ ownerId: string }>();

  const [landOwner, setLandOwner] = useState<LandOwner | null>(null);
  const [landParcels, setLandParcels] = useState<FarmParcel[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<FarmParcel | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isActive = (path: string) => location.pathname === path;

  // Fetch land owner information
  const fetchLandOwner = async () => {
    try {
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);

      const data = response.data;
      console.log("RSBSA submission API response:", data); // Log the full response
      const owner = data.find(
        (record: any) => String(record.id) === String(ownerId),
      );

      if (owner) {
        const ownerData = {
          id: owner.id,
          farmerName: owner.farmerName,
          farmerAddress: owner.farmerAddress,
          farmLocation: owner.farmLocation,
          parcelArea: owner.parcelArea,
          submissionId: owner.id, // Confirm this is the correct field
        };
        console.log("Land owner data:", ownerData); // Log owner data
        setLandOwner(ownerData);
        return ownerData;
      } else {
        setError("Land owner not found");
        return null;
      }
    } catch (err: any) {
      console.error("Error fetching land owner:", err);
      setError("Failed to load land owner information");
      return null;
    }
  };
  // Fetch land parcels for the specific submission
  const fetchLandParcels = async (submissionId: string) => {
    try {
      console.log("Fetching parcels for submissionId:", submissionId);
      const response = await getFarmParcels(submissionId);
      console.log("Response status:", response.status);

      if (response.error) {
        throw new Error(response.error);
      }

      const data = response.data;
      console.log("Raw parcels data:", data);

      const mappedParcels: FarmParcel[] = data
        .map((parcel: any) => ({
          id: parcel.id,
          submissionId: parcel.submission_id,
          parcelNumber: parcel.parcel_number || "N/A",
          farmLocationBarangay: parcel.farm_location_barangay || "N/A",
          farmLocationCityMunicipality:
            parcel.farm_location_municipality || "N/A",
          totalFarmArea: parseFloat(parcel.total_farm_area_ha) || 0,
          cropCommodity: parcel.crop_commodity || "N/A",
          farmSize: parcel.total_farm_area_ha
            ? `${parcel.total_farm_area_ha} ha`
            : "N/A",
          farmType: parcel.farm_type || "N/A",
          organicPractitioner: parcel.organic_practitioner || false,
          plotStatus: parcel.plot_status || "N/A",
          geometry: parcel.geometry || null,
          ownershipTypeRegisteredOwner:
            parcel.ownership_type_registered_owner === true ||
            parcel.ownership_type_registered_owner === "true" ||
            parcel.ownership_type_registered_owner === 1 ||
            parcel.ownership_type_registered_owner === "1",
          ownershipTypeTenant: parcel.ownership_type_tenant || false,
          ownershipTypeLessee: parcel.ownership_type_lessee || false,
          createdAt: parcel.created_at || new Date().toISOString(),
          updatedAt: parcel.updated_at || new Date().toISOString(),
        }))
        .filter((parcel: FarmParcel) => parcel.ownershipTypeRegisteredOwner);

      console.log("Mapped parcels:", mappedParcels);
      setLandParcels(mappedParcels);
    } catch (err: any) {
      console.error("Error fetching land parcels:", err);
      setError(`Failed to load land parcels: ${err.message}`);
    }
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const owner = await fetchLandOwner();
        console.log("Fetched owner:", owner); // Debug log
        if (owner?.submissionId) {
          await fetchLandParcels(owner.submissionId);
        } else {
          setError("No submission ID found for this land owner");
        }
      } catch (err: any) {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    if (ownerId) {
      loadData();
    }
  }, [ownerId]);

  // Handle parcel selection -> navigate to mapping page
  const handleParcelSelect = (parcel: FarmParcel, parcelIndex: number) => {
    setSelectedParcel(parcel);
    if (ownerId) {
      navigate(
        `/technician-landplotting?recordId=${ownerId}&parcelIndex=${parcelIndex}`,
      );
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const totalParcelArea = useMemo(
    () =>
      landParcels.reduce(
        (sum, parcel) => sum + (Number(parcel.totalFarmArea) || 0),
        0,
      ),
    [landParcels],
  );

  const getOwnershipMeta = (
    parcel: FarmParcel,
  ): { label: string; className: string } => {
    const isOwner = parcel.ownershipTypeRegisteredOwner;
    const isTenant = parcel.ownershipTypeTenant;
    const isLessee = parcel.ownershipTypeLessee;

    if (isOwner && !isTenant && !isLessee) {
      return { label: "Registered Owner", className: "registered-owner" };
    }
    if (isTenant && !isOwner && !isLessee) {
      return { label: "Tenant", className: "tenant" };
    }
    if (isLessee && !isOwner && !isTenant) {
      return { label: "Lessee", className: "lessee" };
    }
    if (isTenant && isLessee && !isOwner) {
      return { label: "Tenant + Lessee", className: "mixed" };
    }
    return { label: "Mixed Ownership", className: "mixed" };
  };

  return (
    <div className="page-container">
      <div className="page">
        {/* Sidebar starts here */}
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive("/technician-dashboard") ? "active" : ""}`}
              onClick={() => navigate("/technician-dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-rsbsapage") ? "active" : ""}`}
              onClick={() => navigate("/technician-rsbsa")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-incentives") ? "active" : ""}`}
              onClick={() => navigate("/technician-incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Subsidy</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-masterlist") ? "active" : ""}`}
              onClick={() => navigate("/technician-masterlist")}
            >
              <span className="nav-icon">
                <img src={ApproveIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/") ? "active" : ""}`}
              onClick={() => navigate("/")}
            >
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </div>
        {/* Sidebar ends here */}

        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Main content starts here */}
        <div className="main-content jo-map-layout">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="tech-incent-mobile-title">Land Parcels</div>
          </div>
          <div className="content-header">
            <div className="content-header-top">
              <div className="content-header-title-group">
                <h2>Land Parcel Selection</h2>
                <p>
                  Choose a parcel below to continue plotting and boundary
                  mapping.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/technician-rsbsa")}
              className="app-back-button"
              aria-label="Back to RSBSA list"
            >
              <span className="app-back-button-arrow" aria-hidden="true">
                ←
              </span>
              <span>Back</span>
            </button>
            {landOwner && (
              <div className="land-owner-info">
                <h3>Land Owner: {landOwner.farmerName}</h3>
                <p>
                  <strong>Address:</strong> {landOwner.farmerAddress}
                </p>
                <p>
                  <strong>Farm Location:</strong> {landOwner.farmLocation}
                </p>
              </div>
            )}
          </div>

          <div className="content-body">
            {loading ? (
              <div className="loading-container">
                <p>Loading land parcels...</p>
              </div>
            ) : error ? (
              <div className="error-container">
                <p>Error: {error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="retry-button"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="parcel-selection-container">
                {/* Parcel List */}
                <div className="parcel-list-section">
                  <div className="parcel-list-header">
                    <div className="parcel-list-heading-block">
                      <h3>Available Land Parcels</h3>
                      <p className="parcel-list-subtitle">
                        Only parcels where this farmer is the registered owner
                        can be plotted.
                      </p>
                    </div>
                    <div className="parcel-list-stats">
                      <div className="parcel-stat-chip">
                        <span className="parcel-stat-label">Parcels</span>
                        <strong className="parcel-stat-value">
                          {landParcels.length}
                        </strong>
                      </div>
                      <div className="parcel-stat-chip">
                        <span className="parcel-stat-label">Total Area</span>
                        <strong className="parcel-stat-value">
                          {totalParcelArea.toFixed(2)} ha
                        </strong>
                      </div>
                    </div>
                  </div>

                  {landParcels.length === 0 ? (
                    <div className="no-parcels">
                      <p>No owner-eligible parcels found for this farmer.</p>
                    </div>
                  ) : (
                    <div className="parcel-grid">
                      {landParcels.map((parcel, idx) => {
                        const ownershipMeta = getOwnershipMeta(parcel);

                        return (
                          <button
                            type="button"
                            key={parcel.id}
                            aria-label={`Select parcel ${parcel.parcelNumber}`}
                            className={`parcel-card ${selectedParcel?.id === parcel.id ? "selected" : ""}`}
                            onClick={() => handleParcelSelect(parcel, idx)}
                          >
                            <div className="parcel-card-top">
                              <span className="parcel-number-pill">
                                Parcel: {parcel.parcelNumber}
                              </span>
                              <span className="parcel-area-pill">
                                {parcel.totalFarmArea.toFixed(2)} ha
                              </span>
                            </div>

                            <div className="parcel-location-row">
                              <span
                                className="parcel-location-icon"
                                aria-hidden="true"
                              >
                                📍
                              </span>
                              <span className="parcel-location-text">
                                {parcel.farmLocationBarangay},{" "}
                                {parcel.farmLocationCityMunicipality}
                              </span>
                            </div>

                            <div className="parcel-meta-grid">
                              <div className="parcel-meta-item">
                                <span className="parcel-meta-label">
                                  Created
                                </span>
                                <strong className="parcel-meta-value">
                                  {formatDate(parcel.createdAt)}
                                </strong>
                              </div>
                              <div className="parcel-meta-item">
                                <span className="parcel-meta-label">
                                  Last Updated
                                </span>
                                <strong className="parcel-meta-value">
                                  {formatDate(parcel.updatedAt)}
                                </strong>
                              </div>
                            </div>

                            <div className="parcel-card-footer">
                              <span
                                className={`parcel-ownership-badge ${ownershipMeta.className}`}
                              >
                                {ownershipMeta.label}
                              </span>
                            </div>

                            <div className="parcel-action-hint">
                              Click to open parcel map
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechPickLandParcel;
