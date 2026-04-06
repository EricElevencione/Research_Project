import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  getRsbsaSubmissionById,
  getFarmParcels,
  getFarmerRequests,
} from "../../api";
import "../../assets/css/technician css/FarmerProf.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import FarmerIcon from "../../assets/images/farmer (1).png";

interface FarmerData {
  id: string;
  referenceNumber: string;
  farmerName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  extName: string;
  gender: string;
  birthdate: string;
  farmerAddress: string;
  farmLocation: string;
  parcelArea: string;
  status: string;
  dateSubmitted: string;
  ownershipType?: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
    tenantLessee?: boolean;
    category?: "registeredOwner" | "tenantLessee" | "unknown";
  };
}

interface Parcel {
  id: string;
  parcel_number: string;
  farm_location_barangay: string;
  farm_location_municipality: string;
  total_farm_area_ha: number;
  within_ancestral_domain: string;
  ownership_document_no: string;
  agrarian_reform_beneficiary: string;
  ownership_type_registered_owner: boolean;
  ownership_type_tenant: boolean;
  ownership_type_lessee: boolean;
  tenant_land_owner_name: string;
  lessee_land_owner_name: string;
  ownership_others_specify: string;
}

const TechFarmerProf: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  const [farmer, setFarmer] = useState<FarmerData | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [requestHistory, setRequestHistory] = useState<any[]>([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [allocationComparison, setAllocationComparison] = useState<{
    season: string;
    farmerFertilizerPerHa: number;
    avgFertilizerPerHa: number;
    farmerSeedPerHa: number;
    avgSeedPerHa: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedParcel, setExpandedParcel] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/technician-farmerprofile") {
      return location.pathname.startsWith("/technician-farmerprofile");
    }
    return location.pathname === path;
  };

  useEffect(() => {
    if (id) {
      setLoading(true);
      setError(null);
      fetchFarmerData(id);
      fetchParcels(id);
    }
  }, [id]);

  useEffect(() => {
    if (farmer?.id) {
      fetchRequestHistory(farmer.id);
    }
  }, [farmer?.id]);

  const fetchFarmerData = async (farmerId: string) => {
    if (!farmerId) {
      setError("Invalid farmer ID");
      setLoading(false);
      return;
    }

    try {
      const response = await getRsbsaSubmissionById(farmerId);
      if (response.error || !response.data) {
        throw new Error(response.error || "Farmer not found");
      }

      console.log("Fetched farmer data:", response.data); // Debug log
      setFarmer(response.data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Error loading farmer data");
      setLoading(false);
    }
  };

  const fetchParcels = async (farmerId: string) => {
    if (!farmerId) return;

    try {
      const response = await getFarmParcels(farmerId);
      if (response.error) {
        throw new Error(response.error);
      }
      setParcels(response.data || []);
    } catch (err: any) {
      console.error("Error fetching parcels:", err);
    }
  };

  const fetchRequestHistory = async (farmerId: string) => {
    setRequestLoading(true);
    setRequestError(null);
    try {
      const response = await getFarmerRequests();
      if (response.error) throw new Error(response.error);

      const allRequests = Array.isArray(response.data) ? response.data : [];
      const history = allRequests.filter(
        (request: any) => String(request.farmer_id) === String(farmerId),
      );
      setRequestHistory(history);

      if (history.length > 0) {
        // Use latest request date to determine current season (fallback to latest season string)
        const sortedByDate = [...history].sort((a: any, b: any) => {
          const ad = new Date(a.request_date || a.created_at || 0).getTime();
          const bd = new Date(b.request_date || b.created_at || 0).getTime();
          return bd - ad;
        });
        const currentSeason = sortedByDate[0].season || "";

        // Compute per-ha allocation for this farmer for current season
        const currentRequests = history.filter(
          (r: any) => r.season === currentSeason,
        );
        const farmArea = currentRequests[0]?.farm_area_ha || 0;
        const farmerFertilizer =
          currentRequests[0]?.assigned_fertilizer_bags || 0 || 0;
        const farmerSeed = currentRequests[0]?.assigned_seed_kg || 0 || 0;
        const farmerFertilizerPerHa =
          farmArea > 0 ? farmerFertilizer / farmArea : 0;
        const farmerSeedPerHa = farmArea > 0 ? farmerSeed / farmArea : 0;

        // Compare against season averages
        const seasonResponse = await getFarmerRequests(currentSeason);
        if (
          !seasonResponse.error &&
          Array.isArray(seasonResponse.data) &&
          seasonResponse.data.length > 0
        ) {
          const seasonData: any[] = seasonResponse.data;
          const validEntries = seasonData.filter(
            (r: any) => r.farm_area_ha > 0,
          );
          const totalFertilizer = validEntries.reduce(
            (sum, r) => sum + (r.assigned_fertilizer_bags || 0),
            0,
          );
          const totalSeed = validEntries.reduce(
            (sum, r) => sum + (r.assigned_seed_kg || 0),
            0,
          );
          const totalArea = validEntries.reduce(
            (sum, r) => sum + (r.farm_area_ha || 0),
            0,
          );
          const avgFertilizerPerHa =
            totalArea > 0 ? totalFertilizer / totalArea : 0;
          const avgSeedPerHa = totalArea > 0 ? totalSeed / totalArea : 0;

          setAllocationComparison({
            season: currentSeason,
            farmerFertilizerPerHa,
            avgFertilizerPerHa,
            farmerSeedPerHa,
            avgSeedPerHa,
          });
        } else {
          setAllocationComparison({
            season: currentSeason,
            farmerFertilizerPerHa,
            avgFertilizerPerHa: 0,
            farmerSeedPerHa,
            avgSeedPerHa: 0,
          });
        }
      }
    } catch (err: any) {
      console.error("Error fetching request history:", err);
      setRequestError(err.message || "Failed to load request history");
      setRequestHistory([]);
      setAllocationComparison(null);
    } finally {
      setRequestLoading(false);
    }
  };

  const handlePrint = () => {
    if (window.electron?.printToPDF) {
      window.electron
        .printToPDF({})
        .then(() => {
          // nothing to do; print dialog from Electron
        })
        .catch((e) => {
          console.error("Electron print error:", e);
          window.print();
        });
    } else {
      window.print();
    }
  };

  const toggleParcel = (parcelId: string) => {
    setExpandedParcel(expandedParcel === parcelId ? null : parcelId);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const calculateAge = (birthdate: string) => {
    if (!birthdate) return "N/A";
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  };

  const formatNumber = (value: number | null | undefined, digits = 2) => {
    if (value === null || value === undefined || Number.isNaN(value))
      return "N/A";
    return Number(value).toFixed(digits);
  };

  const getTotalArea = () => {
    if (!parcels || parcels.length === 0) return "0.00";
    const total = parcels.reduce((sum, parcel) => {
      const area = Number(parcel.total_farm_area_ha) || 0;
      return sum + area;
    }, 0);
    return total.toFixed(2);
  };

  const getOwnershipType = () => {
    if (!farmer?.ownershipType) return "N/A";

    const hasTenant = farmer.ownershipType.tenant === true;
    const hasLessee = farmer.ownershipType.lessee === true;
    const hasTenantLessee =
      farmer.ownershipType.tenantLessee === true || hasTenant || hasLessee;

    if (
      farmer.ownershipType.category === "registeredOwner" ||
      farmer.ownershipType.registeredOwner
    ) {
      return "Registered Owner";
    }

    if (hasTenant && hasLessee) {
      return "Tenant + Lessee";
    }

    if (hasTenant) {
      return "Tenant";
    }

    if (hasLessee) {
      return "Lessee";
    }

    if (farmer.ownershipType.category === "tenantLessee" || hasTenantLessee) {
      return "Tenant or Lessee";
    }

    return "N/A";
  };

  const getParcelOwnershipLabel = (parcel: Parcel) => {
    if (parcel.ownership_type_registered_owner) return "Registered Owner";
    if (parcel.ownership_type_tenant && parcel.ownership_type_lessee) {
      return "Tenant + Lessee";
    }
    if (parcel.ownership_type_tenant) {
      return "Tenant";
    }
    if (parcel.ownership_type_lessee) {
      return "Lessee";
    }
    return "N/A";
  };

  const getProfileCompleteness = () => {
    if (!farmer) return 0;
    let completed = 0;
    let total = 10;

    if (farmer.farmerName) completed++;
    if (farmer.gender) completed++;
    if (farmer.birthdate) completed++;
    if (farmer.farmerAddress) completed++;
    if (farmer.farmLocation) completed++;
    if (farmer.referenceNumber) completed++;
    if (farmer.status) completed++;
    if (parcels && parcels.length > 0) completed++;
    if (farmer.ownershipType) completed++;
    if (farmer.dateSubmitted) completed++;

    return Math.round((completed / total) * 100);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page">
          <div className="sidebar">
            <nav className="sidebar-nav">
              <div className="sidebar-logo">
                <img src={LogoImage} alt="Logo" />
              </div>
            </nav>
          </div>
          <div className="tech-prof-main-content">
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">Loading farmer profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !farmer) {
    return (
      <div className="page-container">
        <div className="page">
          <div className="sidebar">
            <nav className="sidebar-nav">
              <div className="sidebar-logo">
                <img src={LogoImage} alt="Logo" />
              </div>
            </nav>
          </div>
          <div className="tech-prof-main-content">
            <div className="error-container">
              <p className="error-message">{error || "Farmer not found"}</p>
              <div className="error-actions">
                <button
                  onClick={() => navigate("/technician-masterlist")}
                  className="app-back-button"
                >
                  ← Back to List
                </button>
                <button
                  onClick={() => {
                    if (!id) return;
                    setLoading(true);
                    setError(null);
                    fetchFarmerData(id);
                    fetchParcels(id);
                  }}
                  className="btn-back"
                >
                  ⟳ Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar ends here */}

        {/* Main content starts here */}
        <div className="tech-prof-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">Farmer Profile</div>
          </div>
          {/* Print-only layout (form-inspired, not a copy) */}
          <div className="print-profile">
            <div className="print-header">
              <div className="print-header-left">
                <div className="print-title">Farmer Profile</div>
                <div className="print-subtitle">
                  RSBSA Land Management System
                </div>
              </div>
              <div className="print-header-right">
                <div className="print-photo-box">Photo</div>
              </div>
            </div>

            <div className="print-meta">
              <div>
                <strong>FFRS ID:</strong> {farmer.referenceNumber || "—"}
              </div>
              <div>
                <strong>Status:</strong> {farmer.status || "—"}
              </div>
              <div>
                <strong>Printed:</strong> {new Date().toLocaleString()}
              </div>
            </div>

            <div className="print-section">
              <div className="print-section-title">Personal Information</div>
              <div className="print-grid">
                <div className="print-field">
                  <div className="print-label">Full Name</div>
                  <div className="print-value">{farmer.farmerName || "—"}</div>
                </div>
                <div className="print-field">
                  <div className="print-label">Sex</div>
                  <div className="print-value">{farmer.gender || "—"}</div>
                </div>
                <div className="print-field">
                  <div className="print-label">Date of Birth</div>
                  <div className="print-value">
                    {formatDate(farmer.birthdate)}
                  </div>
                </div>
                <div className="print-field">
                  <div className="print-label">Age</div>
                  <div className="print-value">
                    {calculateAge(farmer.birthdate)} years old
                  </div>
                </div>
              </div>
            </div>

            <div className="print-section">
              <div className="print-section-title">Address</div>
              <div className="print-grid">
                <div className="print-field span-2">
                  <div className="print-label">Home Address</div>
                  <div className="print-value">
                    {farmer.farmerAddress || "—"}
                  </div>
                </div>
                <div className="print-field span-2">
                  <div className="print-label">Primary Farm Location</div>
                  <div className="print-value">
                    {farmer.farmLocation || "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="print-section">
              <div className="print-section-title">Farm Summary</div>
              <div className="print-grid">
                <div className="print-field">
                  <div className="print-label">Total Parcels</div>
                  <div className="print-value">{parcels.length}</div>
                </div>
                <div className="print-field">
                  <div className="print-label">Total Farm Area (ha)</div>
                  <div className="print-value">{getTotalArea()}</div>
                </div>
                <div className="print-field span-2">
                  <div className="print-label">Primary Ownership Type</div>
                  <div className="print-value">{getOwnershipType()}</div>
                </div>
              </div>
            </div>

            <div className="print-section">
              <div className="print-section-title">Land Parcels</div>
              {parcels.length === 0 ? (
                <div className="print-empty">No land parcels registered.</div>
              ) : (
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Parcel No.</th>
                      <th>Location</th>
                      <th>Area (ha)</th>
                      <th>Ownership</th>
                      <th>Doc No.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcels.map((p, idx) => (
                      <tr key={p.id}>
                        <td>{idx + 1}</td>
                        <td>{p.parcel_number || "—"}</td>
                        <td>
                          {[
                            p.farm_location_barangay,
                            p.farm_location_municipality,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </td>
                        <td>{formatNumber(p.total_farm_area_ha, 2)}</td>
                        <td>{getParcelOwnershipLabel(p)}</td>
                        <td>{p.ownership_document_no || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="print-section">
              <div className="print-section-title">Allocation Comparison</div>
              {allocationComparison ? (
                <div className="print-grid">
                  <div className="print-field">
                    <div className="print-label">Season</div>
                    <div className="print-value">
                      {allocationComparison.season || "—"}
                    </div>
                  </div>
                  <div className="print-field">
                    <div className="print-label">Fertilizer / ha (You)</div>
                    <div className="print-value">
                      {formatNumber(allocationComparison.farmerFertilizerPerHa)}{" "}
                      bags/ha
                    </div>
                  </div>
                  <div className="print-field">
                    <div className="print-label">Fertilizer / ha (Avg)</div>
                    <div className="print-value">
                      {formatNumber(allocationComparison.avgFertilizerPerHa)}{" "}
                      bags/ha
                    </div>
                  </div>
                  <div className="print-field">
                    <div className="print-label">Seeds / ha (You)</div>
                    <div className="print-value">
                      {formatNumber(allocationComparison.farmerSeedPerHa)} kg/ha
                    </div>
                  </div>
                  <div className="print-field">
                    <div className="print-label">Seeds / ha (Avg)</div>
                    <div className="print-value">
                      {formatNumber(allocationComparison.avgSeedPerHa)} kg/ha
                    </div>
                  </div>
                </div>
              ) : (
                <div className="print-empty">
                  No allocation comparison data available.
                </div>
              )}
            </div>

            <div className="print-section">
              <div className="print-section-title">Request History</div>
              {requestHistory.length === 0 ? (
                <div className="print-empty">No request history found.</div>
              ) : (
                <table className="print-table print-table-compact">
                  <thead>
                    <tr>
                      <th>Season</th>
                      <th>Status</th>
                      <th>Request Date</th>
                      <th>Farm Area (ha)</th>
                      <th>Fertilizer (bags)</th>
                      <th>Seeds (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestHistory.map((req, idx) => (
                      <tr key={idx}>
                        <td>{req.season || "—"}</td>
                        <td>{req.status || "—"}</td>
                        <td>
                          {formatDate(req.request_date || req.created_at)}
                        </td>
                        <td>{formatNumber(req.farm_area_ha)}</td>
                        <td>{formatNumber(req.assigned_fertilizer_bags)}</td>
                        <td>{formatNumber(req.assigned_seed_kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="print-section">
              <div className="print-section-title">Activity Timeline</div>
              <div className="print-timeline">
                <div className="print-timeline-item">
                  <div className="print-timeline-dot" />
                  <div className="print-timeline-content">
                    <div className="print-timeline-title">Profile Created</div>
                    <div className="print-timeline-date">
                      {formatDate(farmer.dateSubmitted)}
                    </div>
                  </div>
                </div>
                {parcels.length > 0 && (
                  <div className="print-timeline-item">
                    <div className="print-timeline-dot" />
                    <div className="print-timeline-content">
                      <div className="print-timeline-title">
                        {parcels.length} Land Parcel(s) Registered
                      </div>
                      <div className="print-timeline-date">
                        {formatDate(farmer.dateSubmitted)}
                      </div>
                    </div>
                  </div>
                )}
                <div className="print-timeline-item">
                  <div className="print-timeline-dot active" />
                  <div className="print-timeline-content">
                    <div className="print-timeline-title">
                      Current Status: {farmer.status || "—"}
                    </div>
                    <div className="print-timeline-date">Active</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Header Section */}
          <div className="profile-header">
            <div className="header-top">
              <div className="header-actions">
                <button
                  onClick={() => navigate("/technician-masterlist")}
                  className="app-back-button"
                >
                  ← Back to List
                </button>
                <button onClick={handlePrint} className="btn-print">
                  🖨️ Print Profile
                </button>
              </div>
            </div>

            <div className="profile-hero">
              <div className="profile-avatar">
                <div className="avatar-placeholder">
                  {farmer?.farmerName?.charAt(0) || "F"}
                </div>
              </div>
              <div className="profile-hero-info">
                <h1 className="farmer-name">{farmer.farmerName || "N/A"}</h1>
                <div className="ffrs-id-display">
                  FFRS ID: <span>{farmer.referenceNumber || "N/A"}</span>
                </div>
                <div className="status-badge-container">
                  <span
                    className={`status-badge ${farmer.status === "Active Farmer" ? "active" : "inactive"}`}
                  >
                    {farmer.status || "Not Active"}
                  </span>
                </div>
                <div className="completion-label">
                  Profile completeness: {getProfileCompleteness()}%
                </div>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="profile-content-grid">
            {/* Left Column */}
            <div className="profile-left-column">
              {/* Personal Information Card */}
              <div className="profile-card">
                <h3 className="card-title">👤 Personal Information</h3>
                <div className="card-content">
                  <div className="info-row">
                    <span className="info-label">FFRS ID:</span>
                    <span className="info-value">
                      {farmer.referenceNumber || "N/A"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Full Name:</span>
                    <span className="info-value">{farmer.farmerName}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">First Name:</span>
                    <span className="info-value">
                      {farmer.firstName || "N/A"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Middle Name:</span>
                    <span className="info-value">
                      {farmer.middleName || "N/A"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Last Name:</span>
                    <span className="info-value">
                      {farmer.lastName || "N/A"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Extension Name:</span>
                    <span className="info-value">
                      {farmer.extName || "N/A"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Gender:</span>
                    <span className="info-value">{farmer.gender || "N/A"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Date of Birth:</span>
                    <span className="info-value">
                      {formatDate(farmer.birthdate)}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Age:</span>
                    <span className="info-value">
                      {calculateAge(farmer.birthdate)} years old
                    </span>
                  </div>
                </div>
              </div>

              {/* Address Information Card */}
              <div className="profile-card">
                <h3 className="card-title">📍 Address Information</h3>
                <div className="card-content">
                  <div className="info-row">
                    <span className="info-label">Home Address:</span>
                    <span className="info-value">
                      {farmer.farmerAddress || "N/A"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Primary Farm Location:</span>
                    <span className="info-value">
                      {farmer.farmLocation || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Farm Ownership Summary Card */}
              <div className="profile-card">
                <h3 className="card-title">🌾 Farm Ownership Summary</h3>
                <div className="card-content">
                  <div className="info-row">
                    <span className="info-label">Total Number of Parcels:</span>
                    <span className="info-value highlight">
                      {parcels.length}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Total Farm Area:</span>
                    <span className="info-value highlight">
                      {getTotalArea()} hectares
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Primary Ownership Type:</span>
                    <span className="info-value">{getOwnershipType()}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Farmer Type:</span>
                    <span
                      className={`info-value ${farmer.status === "Active Farmer" ? "text-success" : "text-danger"}`}
                    >
                      {farmer.status || "Not Active"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="profile-right-column">
              {/* Land Parcels Section */}
              <div className="profile-card">
                <h3 className="card-title">
                  🏞️ Land Parcels ({parcels.length})
                </h3>
                <div className="card-content">
                  {parcels.length === 0 ? (
                    <p className="no-data">No land parcels registered</p>
                  ) : (
                    <div className="parcels-list">
                      {parcels.map((parcel, index) => (
                        <div key={parcel.id} className="parcel-item">
                          <div
                            className="parcel-header"
                            onClick={() => toggleParcel(parcel.id)}
                          >
                            <div className="parcel-title">
                              <span className="parcel-number">
                                Parcel #{index + 1}
                              </span>
                              <span className="parcel-area">
                                {parcel.total_farm_area_ha} ha
                              </span>
                            </div>
                            <span
                              className={`expand-icon ${expandedParcel === parcel.id ? "expanded" : ""}`}
                            >
                              ▼
                            </span>
                          </div>

                          <div
                            className={`parcel-details ${expandedParcel === parcel.id ? "expanded" : "collapsed"}`}
                          >
                            <div className="info-row">
                              <span className="info-label">Parcel Number:</span>
                              <span className="info-value">
                                {parcel.parcel_number || "N/A"}
                              </span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">Farm Location:</span>
                              <span className="info-value">
                                {parcel.farm_location_barangay},{" "}
                                {parcel.farm_location_municipality}
                              </span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">Parcel Area:</span>
                              <span className="info-value">
                                {parcel.total_farm_area_ha} hectares
                              </span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">
                                Ownership Type:
                              </span>
                              <span className="info-value">
                                {getParcelOwnershipLabel(parcel)}
                              </span>
                            </div>
                            {(parcel.tenant_land_owner_name ||
                              parcel.lessee_land_owner_name) && (
                              <div className="info-row">
                                <span className="info-label">
                                  Land Owner Name:
                                </span>
                                <span className="info-value">
                                  {parcel.tenant_land_owner_name ||
                                    parcel.lessee_land_owner_name}
                                </span>
                              </div>
                            )}
                            <div className="info-row">
                              <span className="info-label">
                                Ownership Document No:
                              </span>
                              <span className="info-value">
                                {parcel.ownership_document_no || "N/A"}
                              </span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">
                                Agrarian Reform Beneficiary:
                              </span>
                              <span className="info-value">
                                {parcel.agrarian_reform_beneficiary || "N/A"}
                              </span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">
                                Within Ancestral Domain:
                              </span>
                              <span className="info-value">
                                {parcel.within_ancestral_domain || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Registration Details Card */}
              <div className="profile-card">
                <h3 className="card-title">� Allocation Comparison</h3>
                <div className="card-content">
                  {allocationComparison ? (
                    <>
                      <div className="info-row">
                        <span className="info-label">Season:</span>
                        <span className="info-value">
                          {allocationComparison.season || "N/A"}
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Fertilizer / ha:</span>
                        <span className="info-value">
                          You:{" "}
                          {formatNumber(
                            allocationComparison.farmerFertilizerPerHa,
                          )}{" "}
                          bags/ha
                          <br />
                          Avg:{" "}
                          {formatNumber(
                            allocationComparison.avgFertilizerPerHa,
                          )}{" "}
                          bags/ha
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Seeds / ha:</span>
                        <span className="info-value">
                          You:{" "}
                          {formatNumber(allocationComparison.farmerSeedPerHa)}{" "}
                          kg/ha
                          <br />
                          Avg: {formatNumber(
                            allocationComparison.avgSeedPerHa,
                          )}{" "}
                          kg/ha
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="no-data">
                      No allocation comparison data available.
                    </p>
                  )}
                </div>
              </div>

              <div className="profile-card">
                <h3 className="card-title">📑 Request History</h3>
                <div className="card-content">
                  {requestLoading ? (
                    <p className="loading-text">Loading request history…</p>
                  ) : requestError ? (
                    <p className="error-message">{requestError}</p>
                  ) : requestHistory.length === 0 ? (
                    <p className="no-data">No request history found.</p>
                  ) : (
                    <div className="table-wrapper">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>Season</th>
                            <th>Status</th>
                            <th>Request Date</th>
                            <th>Farm Area (ha)</th>
                            <th>Fertilizer (bags)</th>
                            <th>Seeds (kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {requestHistory.map((req, idx) => (
                            <tr key={idx}>
                              <td>{req.season || "—"}</td>
                              <td>{req.status || "—"}</td>
                              <td>
                                {formatDate(req.request_date || req.created_at)}
                              </td>
                              <td>{formatNumber(req.farm_area_ha)}</td>
                              <td>
                                {formatNumber(req.assigned_fertilizer_bags)}
                              </td>
                              <td>{formatNumber(req.assigned_seed_kg)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Timeline Card */}
              <div className="profile-card">
                <h3 className="card-title">📅 Activity Timeline</h3>
                <div className="card-content">
                  <div className="timeline">
                    <div className="timeline-item">
                      <div className="timeline-dot"></div>
                      <div className="timeline-content">
                        <div className="timeline-title">Profile Created</div>
                        <div className="timeline-date">
                          {formatDate(farmer.dateSubmitted)}
                        </div>
                      </div>
                    </div>
                    {parcels.length > 0 && (
                      <div className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                          <div className="timeline-title">
                            {parcels.length} Land Parcel(s) Registered
                          </div>
                          <div className="timeline-date">
                            {formatDate(farmer.dateSubmitted)}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="timeline-item">
                      <div className="timeline-dot active"></div>
                      <div className="timeline-content">
                        <div className="timeline-title">
                          Current Status: {farmer.status}
                        </div>
                        <div className="timeline-date">Active</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechFarmerProf;
