import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcels,
} from "../../api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "../../assets/css/admin css/MasterlistStyle.css";
import "../../assets/css/jo css/FarmerDetailModal.css";
import "../../components/layout/sidebarStyle.css";
import FarmlandMap from "../../components/Map/FarmlandMap";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";
import LandRecsIcon from "../../assets/images/landrecord.png";

interface FarmerDetailModal {
  id: string;
  farmerName: string;
  farmerAddress: string;
  age: number | string;
  gender: string;
  mainLivelihood: string;
  farmingActivities: string[];
  parcels: ParcelDetail[];
}

interface ParcelDetail {
  id: string;
  parcelNumber: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: number;
  ownershipTypeRegisteredOwner: boolean;
  ownershipTypeTenant: boolean;
  ownershipTypeLessee: boolean;
  tenantLandOwnerName: string;
  lesseeLandOwnerName: string;
}

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  parcelArea: string;
  parcelCount: number;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  ownershipType?: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
  };
}

const Masterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState("overview");
  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [farmerStatus, setFarmerStatus] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFarmer, setSelectedFarmer] =
    useState<FarmerDetailModal | null>(null);
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const fetchFarmerDetails = async (farmerId: string) => {
    try {
      setLoadingFarmerDetail(true);

      const farmerResponse = await getRsbsaSubmissionById(farmerId);
      if (farmerResponse.error)
        throw new Error("Failed to fetch farmer details");
      const farmerData = farmerResponse.data;

      const parcelsResponse = await getFarmParcels(farmerId);
      if (parcelsResponse.error) throw new Error("Failed to fetch parcels");
      const parcelsData = parcelsResponse.data || [];

      const data = farmerData.data || farmerData;

      const activities: string[] = [];
      if (data.farmerRice || data.FARMER_RICE || data.farmer_rice)
        activities.push("Rice");
      if (data.farmerCorn || data.FARMER_CORN || data.farmer_corn)
        activities.push("Corn");
      if (
        data.farmerOtherCrops ||
        data.FARMER_OTHER_CROPS ||
        data.farmer_other_crops
      ) {
        activities.push(
          `Other Crops: ${data.farmerOtherCropsText || data.FARMER_OTHER_CROPS_TEXT || data.farmer_other_crops_text || ""}`,
        );
      }
      if (
        data.farmerLivestock ||
        data.FARMER_LIVESTOCK ||
        data.farmer_livestock
      ) {
        activities.push(
          `Livestock: ${data.farmerLivestockText || data.FARMER_LIVESTOCK_TEXT || data.farmer_livestock_text || ""}`,
        );
      }
      if (data.farmerPoultry || data.FARMER_POULTRY || data.farmer_poultry) {
        activities.push(
          `Poultry: ${data.farmerPoultryText || data.FARMER_POULTRY_TEXT || data.farmer_poultry_text || ""}`,
        );
      }
      if (activities.length === 0 && data.mainLivelihood)
        activities.push(data.mainLivelihood);

      const calculateAge = (birthdate: string): number | string => {
        if (!birthdate || birthdate === "N/A") return "N/A";
        const today = new Date();
        const birthDate = new Date(birthdate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        )
          age--;
        return age;
      };

      const backendName = farmerData.farmerName || "";
      const reformattedFarmerName = (() => {
        if (!backendName || backendName === "N/A") return "N/A";
        const parts = backendName
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean);
        if (parts.length === 0) return "N/A";
        if (parts.length === 1) return parts[0];
        return `${parts[0]}, ${parts.slice(1).join(" ")}`;
      })();

      let mappedParcels = parcelsData.map((p: any) => ({
        id: p.id,
        parcelNumber: p.parcel_number || "N/A",
        farmLocationBarangay: p.farm_location_barangay || "N/A",
        farmLocationMunicipality: p.farm_location_municipality || "N/A",
        totalFarmAreaHa: parseFloat(p.total_farm_area_ha) || 0,
        ownershipTypeRegisteredOwner:
          p.ownership_type_registered_owner || false,
        ownershipTypeTenant: p.ownership_type_tenant || false,
        ownershipTypeLessee: p.ownership_type_lessee || false,
        tenantLandOwnerName: p.tenant_land_owner_name || "",
        lesseeLandOwnerName: p.lessee_land_owner_name || "",
      }));

      if (mappedParcels.length === 0) {
        const submissionFarmLocation =
          data.farmLocation || data["FARM LOCATION"] || "";
        const submissionParcelArea = parseFloat(
          data.totalFarmArea ||
            data["TOTAL FARM AREA"] ||
            data.parcelArea ||
            data["PARCEL AREA"] ||
            "0",
        );
        const submissionOwnership = data.ownershipType || {};
        if (submissionFarmLocation || submissionParcelArea > 0) {
          const locationParts = submissionFarmLocation
            .split(",")
            .map((s: string) => s.trim());
          mappedParcels = [
            {
              id: `submission-${farmerId}`,
              parcelNumber: "N/A",
              farmLocationBarangay: locationParts[0] || data.barangay || "N/A",
              farmLocationMunicipality:
                locationParts[1] || data.municipality || "Dumangas",
              totalFarmAreaHa: submissionParcelArea,
              ownershipTypeRegisteredOwner:
                submissionOwnership.registeredOwner || false,
              ownershipTypeTenant: submissionOwnership.tenant || false,
              ownershipTypeLessee: submissionOwnership.lessee || false,
              tenantLandOwnerName: "",
              lesseeLandOwnerName: "",
            },
          ];
        }
      }

      setSelectedFarmer({
        id: farmerId,
        farmerName: reformattedFarmerName,
        farmerAddress: farmerData.farmerAddress || "N/A",
        age: calculateAge(data.dateOfBirth || data.birthdate || "N/A"),
        gender: data.gender || "N/A",
        mainLivelihood: data.mainLivelihood || "N/A",
        farmingActivities: activities,
        parcels: mappedParcels,
      });
      setShowModal(true);
    } catch (err: any) {
      console.error("Error fetching farmer details:", err);
      alert("Failed to load farmer details");
    } finally {
      setLoadingFarmerDetail(false);
    }
  };

  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  const fetchRSBSARecords = async () => {
    try {
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);
      const data = response.data || [];

      const formattedRecords: RSBSARecord[] = (
        Array.isArray(data) ? data : []
      ).map((item: any, idx: number) => {
        // Prefer backend-transformed fields; fallback to raw
        const referenceNumber = String(
          item.referenceNumber ?? item.id ?? `RSBSA-${idx + 1}`,
        );
        const composedName = [item.surname, item.firstName, item.middleName]
          .filter(Boolean)
          .join(", ");
        const preferredName = item.farmerName ?? composedName;
        const farmerName = String(preferredName || "—");
        const farmerAddress = String(
          item.farmerAddress ?? item.addressBarangay ?? "—",
        );
        const farmLocation = String(item.farmLocation ?? "—");
        const landParcel = String(item.landParcel ?? "—");
        const parcelArea = (() => {
          const direct = item.parcelArea ?? item["PARCEL AREA"];
          if (
            direct !== undefined &&
            direct !== null &&
            String(direct).trim() !== ""
          ) {
            return String(direct);
          }
          // Fallback: parse from landParcel string e.g., "... (1.25 ha)"
          const match = /\(([^)]+)\)/.exec(landParcel);
          return match ? match[1] : "—";
        })();
        const dateSubmitted = item.dateSubmitted
          ? new Date(item.dateSubmitted).toISOString()
          : item.createdAt
            ? new Date(item.createdAt).toISOString()
            : "";

        // Reflect database status semantics: Submitted / Not Submitted
        const status = String(item.status ?? "Not Submitted");

        return {
          id: String(
            item.id ?? `${idx}-${Math.random().toString(36).slice(2)}`,
          ),
          referenceNumber,
          farmerName,
          farmerAddress,
          farmLocation,
          parcelArea,
          parcelCount:
            typeof item.parcelCount === "number" ? item.parcelCount : 0,
          dateSubmitted,
          status,
          landParcel,
          ownershipType: item.ownershipType,
        };
      });

      setRsbsaRecords(formattedRecords);
      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to load RSBSA records");
      setLoading(false);
    }
  };

  const filteredRecords = rsbsaRecords
    .filter((record) => {
      // Match based on the status field from database
      const matchesFarmerStatus =
        farmerStatus === "all" ||
        (farmerStatus === "active" && record.status === "Active Farmer") ||
        (farmerStatus === "inactive" && record.status === "Not Active");

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        record.farmerName.toLowerCase().includes(q) ||
        record.referenceNumber.toLowerCase().includes(q) ||
        record.farmerAddress.toLowerCase().includes(q) ||
        record.farmLocation.toLowerCase().includes(q);

      return matchesFarmerStatus && matchesSearch;
    })
    .sort(
      (a, b) =>
        new Date(b.dateSubmitted).getTime() -
        new Date(a.dateSubmitted).getTime(),
    );

  // ── Status Counts ──
  const statusCounts = useMemo(() => {
    const active = rsbsaRecords.filter(
      (r) => r.status === "Active Farmer",
    ).length;
    const inactive = rsbsaRecords.filter(
      (r) => r.status === "Not Active",
    ).length;
    const submitted = rsbsaRecords.filter(
      (r) => r.status === "Submitted",
    ).length;
    const notSubmitted = rsbsaRecords.filter(
      (r) => !["Active Farmer", "Not Active", "Submitted"].includes(r.status),
    ).length;
    return {
      active,
      inactive,
      submitted,
      notSubmitted,
      total: rsbsaRecords.length,
    };
  }, [rsbsaRecords]);

  // ── Export helpers ──
  const exportColumns = [
    "FFRS System Generated",
    "Farmer Name",
    "Farmer Address",
    "Parcel Address",
    "No. of Parcels",
    "Parcel Area",
    "Date Submitted",
    "Farmer Status",
  ];

  const recordToRow = (r: RSBSARecord) => [
    r.referenceNumber,
    r.farmerName,
    r.farmerAddress,
    r.farmLocation,
    r.parcelCount,
    r.parcelArea,
    formatDate(r.dateSubmitted),
    r.status || "Not Active",
  ];

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const now = new Date().toLocaleDateString();

    doc.setFontSize(16);
    doc.text("Farmer Masterlist", 14, 18);
    doc.setFontSize(10);

    const filterInfo: string[] = [];
    if (farmerStatus !== "all")
      filterInfo.push(
        `Status: ${farmerStatus === "active" ? "Active" : "Inactive"}`,
      );
    if (searchQuery) filterInfo.push(`Search: "${searchQuery}"`);
    if (filterInfo.length > 0) {
      doc.text(`Filters: ${filterInfo.join(" | ")}`, 14, 25);
    }
    doc.text(
      `Generated: ${now}  •  ${filteredRecords.length} record(s)`,
      14,
      filterInfo.length > 0 ? 31 : 25,
    );

    autoTable(doc, {
      head: [exportColumns],
      body: filteredRecords.map(recordToRow),
      startY: filterInfo.length > 0 ? 36 : 30,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: {
        fillColor: [160, 200, 120],
        textColor: [51, 51, 51],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`Masterlist_${now.replace(/\//g, "-")}.pdf`);
  };

  const handleExportExcel = () => {
    const now = new Date().toLocaleDateString();
    const wsData = [exportColumns, ...filteredRecords.map(recordToRow)];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-fit column widths
    ws["!cols"] = exportColumns.map((_, ci) => ({
      wch:
        Math.max(
          exportColumns[ci].length,
          ...filteredRecords.map((r) => String(recordToRow(r)[ci]).length),
        ) + 2,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Masterlist");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      `Masterlist_${now.replace(/\//g, "-")}.xlsx`,
    );
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return "—";
    }
  };

  return (
    <>
      <div className="masterlist-admin-page-container">
        <div className="masterlist-admin-page">
          {/* Sidebar starts here */}
          <div className="sidebar">
            <nav className="sidebar-nav">
              <div className="sidebar-logo">
                <img src={LogoImage} alt="Logo" />
              </div>

              <button
                className={`sidebar-nav-item ${isActive("/dashboard") ? "active" : ""}`}
                onClick={() => navigate("/dashboard")}
              >
                <span className="nav-icon">
                  <img src={HomeIcon} alt="Home" />
                </span>
                <span className="nav-text">Home</span>
              </button>

              <button
                className={`sidebar-nav-item ${isActive("/rsbsa") ? "active" : ""}`}
                onClick={() => navigate("/rsbsa")}
              >
                <span className="nav-icon">
                  <img src={RSBSAIcon} alt="RSBSA" />
                </span>
                <span className="nav-text">RSBSA</span>
              </button>

              <button
                className={`sidebar-nav-item ${isActive("/audit-trail") ? "active" : ""}`}
                onClick={() => navigate("/audit-trail")}
              >
                <span className="nav-icon">📋</span>
                <span className="nav-text">Audit Trail</span>
              </button>

              <button
                className={`sidebar-nav-item ${isActive("/incentives") ? "active" : ""}`}
                onClick={() => navigate("/incentives")}
              >
                <span className="nav-icon">
                  <img src={IncentivesIcon} alt="Incentives" />
                </span>
                <span className="nav-text">Incentives</span>
              </button>

              <button
                className={`sidebar-nav-item ${isActive("/masterlist") ? "active" : ""}`}
                onClick={() => navigate("/masterlist")}
              >
                <span className="nav-icon">
                  <img src={ApproveIcon} alt="Masterlist" />
                </span>
                <span className="nav-text">Masterlist</span>
              </button>

              <button
                className={`sidebar-nav-item ${isActive("/logout") ? "active" : ""}`}
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

          {/* Main content starts here */}
          <div className="masterlist-admin-main-content">
            <div className="masterlist-admin-dashboard-header">
              <h2 className="masterlist-admin-page-header">Masterlist</h2>
            </div>

            {/* Status Count Cards */}
            {!loading && !error && (
              <div className="masterlist-status-cards">
                <div className="masterlist-status-card masterlist-card-total">
                  <div className="masterlist-card-icon">👥</div>
                  <div className="masterlist-card-info">
                    <span className="masterlist-card-count">
                      {statusCounts.total}
                    </span>
                    <span className="masterlist-card-label">Total Farmers</span>
                  </div>
                </div>
                <div className="masterlist-status-card masterlist-card-active">
                  <div className="masterlist-card-icon">✅</div>
                  <div className="masterlist-card-info">
                    <span className="masterlist-card-count">
                      {statusCounts.active}
                    </span>
                    <span className="masterlist-card-label">Active</span>
                  </div>
                  <div className="masterlist-card-bar">
                    <div
                      className="masterlist-card-bar-fill masterlist-bar-active"
                      style={{
                        width: `${statusCounts.total ? (statusCounts.active / statusCounts.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="masterlist-status-card masterlist-card-inactive">
                  <div className="masterlist-card-icon">❌</div>
                  <div className="masterlist-card-info">
                    <span className="masterlist-card-count">
                      {statusCounts.inactive}
                    </span>
                    <span className="masterlist-card-label">Inactive</span>
                  </div>
                  <div className="masterlist-card-bar">
                    <div
                      className="masterlist-card-bar-fill masterlist-bar-inactive"
                      style={{
                        width: `${statusCounts.total ? (statusCounts.inactive / statusCounts.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="masterlist-status-card masterlist-card-submitted">
                  <div className="masterlist-card-icon">📋</div>
                  <div className="masterlist-card-info">
                    <span className="masterlist-card-count">
                      {statusCounts.submitted}
                    </span>
                    <span className="masterlist-card-label">Submitted</span>
                  </div>
                  <div className="masterlist-card-bar">
                    <div
                      className="masterlist-card-bar-fill masterlist-bar-submitted"
                      style={{
                        width: `${statusCounts.total ? (statusCounts.submitted / statusCounts.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="masterlist-admin-content-card">
              {/* Filters and Search */}
              <div className="masterlist-admin-filters-section">
                <div className="masterlist-admin-search-filter">
                  <input
                    type="text"
                    placeholder="Search by farmer name, reference number, or barangay..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="masterlist-admin-search-input"
                  />
                </div>

                <div className="masterlist-admin-status-filter">
                  <select
                    value={farmerStatus}
                    onChange={(e) =>
                      setFarmerStatus(
                        e.target.value as "all" | "active" | "inactive",
                      )
                    }
                    className="masterlist-admin-status-select"
                  >
                    <option value="all">All Farmers</option>
                    <option value="active">Active Farmers</option>
                    <option value="inactive">Inactive Farmers</option>
                  </select>
                </div>

                {/* Export Buttons */}
                <div className="masterlist-export-buttons">
                  <button
                    className="masterlist-export-btn masterlist-export-pdf"
                    onClick={handleExportPDF}
                    disabled={filteredRecords.length === 0}
                  >
                    📄 Export PDF
                  </button>
                  <button
                    className="masterlist-export-btn masterlist-export-excel"
                    onClick={handleExportExcel}
                    disabled={filteredRecords.length === 0}
                  >
                    📊 Export Excel
                  </button>
                </div>
              </div>

              {/* RSBSA Records Table */}
              <div className="masterlist-admin-table-container">
                <table className="masterlist-admin-farmers-table">
                  <thead>
                    <tr>
                      {[
                        "FFRS System Generated",
                        "Farmer Name",
                        "Farmer Address",
                        "Parcel Address",
                        "No. of Parcels",
                        "Parcel Area",
                        "Date Submitted",
                        "Farmer Status",
                      ].map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td
                          colSpan={8}
                          className="masterlist-admin-loading-cell"
                        >
                          Loading...
                        </td>
                      </tr>
                    )}

                    {error && !loading && (
                      <tr>
                        <td colSpan={8} className="masterlist-admin-error-cell">
                          Error: {error}
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      !error &&
                      filteredRecords.length > 0 &&
                      filteredRecords.map((record) => {
                        return (
                          <tr
                            key={record.id}
                            onClick={() => fetchFarmerDetails(record.id)}
                            style={{ cursor: "pointer" }}
                          >
                            <td>{record.referenceNumber}</td>
                            <td>{record.farmerName}</td>
                            <td>{record.farmerAddress}</td>
                            <td>{record.farmLocation}</td>
                            <td>{record.parcelCount}</td>
                            <td>{record.parcelArea}</td>
                            <td>{formatDate(record.dateSubmitted)}</td>
                            <td>
                              <span
                                className={`masterlist-admin-status-pill ${
                                  record.status === "Active Farmer"
                                    ? "masterlist-admin-status-approved"
                                    : record.status === "Submitted"
                                      ? "masterlist-admin-status-submitted"
                                      : "masterlist-admin-status-not-approved"
                                }`}
                              >
                                {record.status || "Not Active"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                    {!loading &&
                      !error &&
                      filteredRecords.length === 0 &&
                      Array.from({ length: 16 }).map((_, i) => (
                        <tr key={`empty-${i}`}>
                          <td colSpan={8}>&nbsp;</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Farmer Detail Modal */}
      {showModal && selectedFarmer && (
        <div
          className="farmer-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="farmer-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="farmer-modal-header">
              <h2>Farmer Details</h2>
              <button
                className="farmer-modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            <div className="farmer-modal-body">
              {loadingFarmerDetail ? (
                <div className="farmer-modal-loading">
                  Loading farmer details...
                </div>
              ) : (
                <>
                  <div className="farmer-modal-section">
                    <h3 className="farmer-modal-section-title">
                      👤 Personal Information
                    </h3>
                    <div className="farmer-modal-info-grid">
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Farmer Name:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.farmerName}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">
                          Farmer Address:
                        </span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.farmerAddress}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Age:</span>
                        <span className="farmer-modal-value">
                          {typeof selectedFarmer.age === "number"
                            ? `${selectedFarmer.age} years old`
                            : selectedFarmer.age}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Gender:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.gender}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item farmer-modal-full-width">
                        <span className="farmer-modal-label">
                          Main Livelihood:
                        </span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.farmingActivities.length > 0
                            ? selectedFarmer.farmingActivities.join(", ")
                            : "Not Available"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="farmer-modal-section">
                    <h3 className="farmer-modal-section-title">
                      🌾 Farm Information
                    </h3>
                    {selectedFarmer.parcels.length === 0 ? (
                      <p className="farmer-modal-no-data">No parcels found</p>
                    ) : (
                      <div className="farmer-modal-parcels-container">
                        {selectedFarmer.parcels.map((parcel, index) => (
                          <div
                            key={parcel.id}
                            className="farmer-modal-parcel-card"
                          >
                            <div className="farmer-modal-parcel-header">
                              <h4>
                                Parcel #
                                {(() => {
                                  const pNum = parcel.parcelNumber;
                                  if (!pNum || pNum === "N/A") return index + 1;
                                  if (/^\d+$/.test(pNum)) return pNum;
                                  return index + 1;
                                })()}
                              </h4>
                            </div>
                            <div className="farmer-modal-parcel-details">
                              <div className="farmer-modal-parcel-item">
                                <span className="farmer-modal-label">
                                  Land Ownership:
                                </span>
                                <span className="farmer-modal-value">
                                  {parcel.ownershipTypeRegisteredOwner &&
                                    "Registered Owner"}
                                  {parcel.ownershipTypeTenant && (
                                    <>
                                      Tenant
                                      {parcel.tenantLandOwnerName && (
                                        <span className="farmer-modal-owner-name">
                                          {" "}
                                          (Owner: {parcel.tenantLandOwnerName})
                                        </span>
                                      )}
                                    </>
                                  )}
                                  {parcel.ownershipTypeLessee && (
                                    <>
                                      Lessee
                                      {parcel.lesseeLandOwnerName && (
                                        <span className="farmer-modal-owner-name">
                                          {" "}
                                          (Owner: {parcel.lesseeLandOwnerName})
                                        </span>
                                      )}
                                    </>
                                  )}
                                </span>
                              </div>
                              <div className="farmer-modal-parcel-item">
                                <span className="farmer-modal-label">
                                  Parcel Location:
                                </span>
                                <span className="farmer-modal-value">
                                  {parcel.farmLocationBarangay},{" "}
                                  {parcel.farmLocationMunicipality}
                                </span>
                              </div>
                              <div className="farmer-modal-parcel-item">
                                <span className="farmer-modal-label">
                                  Parcel Size:
                                </span>
                                <span className="farmer-modal-value">
                                  {typeof parcel.totalFarmAreaHa === "number"
                                    ? parcel.totalFarmAreaHa.toFixed(2)
                                    : parseFloat(
                                        String(parcel.totalFarmAreaHa || 0),
                                      ).toFixed(2)}{" "}
                                  hectares
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Masterlist;
