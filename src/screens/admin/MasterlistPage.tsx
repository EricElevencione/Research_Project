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
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

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

type SortKey = "dateSubmitted" | "status" | "parcelArea";
type SortDirection = "asc" | "desc";
type ExportFormat = "csv" | "xlsx" | "pdf";

const Masterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFarmer, setSelectedFarmer] =
    useState<FarmerDetailModal | null>(null);
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>({ key: "dateSubmitted", direction: "desc" });
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(
    new Set(),
  );
  const [openQuickActionsId, setOpenQuickActionsId] = useState<string | null>(
    null,
  );
  const [showBulkExportMenu, setShowBulkExportMenu] = useState(false);

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

  useEffect(() => {
    const handleWindowClick = () => {
      setOpenQuickActionsId(null);
      setShowBulkExportMenu(false);
    };

    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  useEffect(() => {
    setSelectedRecordIds((previous) => {
      const validIds = new Set(rsbsaRecords.map((record) => record.id));
      const next = new Set<string>();
      previous.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [rsbsaRecords]);

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
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        record.farmerName.toLowerCase().includes(q) ||
        record.referenceNumber.toLowerCase().includes(q) ||
        record.farmerAddress.toLowerCase().includes(q) ||
        record.farmLocation.toLowerCase().includes(q);

      return matchesSearch;
    })
    .sort((a, b) => {
      const factor = sortConfig.direction === "asc" ? 1 : -1;

      if (sortConfig.key === "dateSubmitted") {
        return (
          (new Date(a.dateSubmitted).getTime() -
            new Date(b.dateSubmitted).getTime()) *
          factor
        );
      }

      if (sortConfig.key === "status") {
        return a.status.localeCompare(b.status) * factor;
      }

      const parseAreaValue = (value: string) => {
        const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
      };

      return (
        (parseAreaValue(a.parcelArea) - parseAreaValue(b.parcelArea)) * factor
      );
    });

  const selectedRecords = useMemo(
    () => rsbsaRecords.filter((record) => selectedRecordIds.has(record.id)),
    [rsbsaRecords, selectedRecordIds],
  );

  const allFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((record) => selectedRecordIds.has(record.id));

  const toggleSelectAllFiltered = () => {
    setSelectedRecordIds((previous) => {
      const next = new Set(previous);
      if (allFilteredSelected) {
        filteredRecords.forEach((record) => next.delete(record.id));
      } else {
        filteredRecords.forEach((record) => next.add(record.id));
      }
      return next;
    });
  };

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSortChange = (key: SortKey) => {
    setSortConfig((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "desc" };
    });
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "▲" : "▼";
  };

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

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return "—";
    }
  };

  const formatParcelArea = (parcelArea: string) => {
    const parsed = parseFloat(parcelArea);
    if (Number.isFinite(parsed)) {
      return `${parsed.toLocaleString(undefined, {
        minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })} ha`;
    }
    return parcelArea && parcelArea !== "—" ? parcelArea : "—";
  };

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

  const recordToExportRow = (record: RSBSARecord) => [
    record.referenceNumber,
    record.farmerName,
    record.farmerAddress,
    record.farmLocation,
    record.parcelCount,
    formatParcelArea(record.parcelArea),
    formatDate(record.dateSubmitted),
    record.status || "Not Active",
  ];

  const downloadCsv = (records: RSBSARecord[], filename: string) => {
    const escapeCell = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const csvRows = [
      exportColumns.map(escapeCell).join(","),
      ...records.map((record) =>
        recordToExportRow(record).map(escapeCell).join(","),
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportRecords = (
    records: RSBSARecord[],
    format: ExportFormat,
    label: string,
  ) => {
    if (records.length === 0) {
      alert("No records selected for export.");
      return;
    }

    const stamp = new Date().toISOString().split("T")[0];
    const normalizedLabel = label.replace(/\s+/g, "_");

    if (format === "csv") {
      downloadCsv(records, `${normalizedLabel}_${stamp}.csv`);
      return;
    }

    if (format === "xlsx") {
      const wsData = [exportColumns, ...records.map(recordToExportRow)];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = exportColumns.map((_, colIndex) => ({
        wch:
          Math.max(
            exportColumns[colIndex].length,
            ...records.map(
              (record) => String(recordToExportRow(record)[colIndex]).length,
            ),
          ) + 2,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Masterlist");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([buffer], { type: "application/octet-stream" }),
        `${normalizedLabel}_${stamp}.xlsx`,
      );
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Farmer Masterlist", 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 25);

    autoTable(doc, {
      head: [exportColumns],
      body: records.map(recordToExportRow),
      startY: 30,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 251, 244] },
    });

    doc.save(`${normalizedLabel}_${stamp}.pdf`);
  };

  const getStatusClassName = (status: string) => {
    if (status === "Active Farmer") return "masterlist-admin-status-approved";
    if (status === "Submitted") return "masterlist-admin-status-submitted";
    return "masterlist-admin-status-not-approved";
  };

  const getFarmerInitials = (fullName: string) => {
    const cleaned = (fullName || "")
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "");
    return cleaned.join("") || "NA";
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
                <span className="nav-text">Subsidy</span>
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
              <div className="masterlist-admin-page-left">
                <h2 className="masterlist-admin-page-header">Masterlist</h2>
                <p className="masterlist-admin-page-subtitle">
                  Browse all RSBSA farmers, filter by status, and manage records
                </p>
              </div>
            </div>

<<<<<<< HEAD
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
                </div>
                <div className="masterlist-status-card masterlist-card-inactive">
                  <div className="masterlist-card-icon">❌</div>
                  <div className="masterlist-card-info">
                    <span className="masterlist-card-count">
                      {statusCounts.inactive}
                    </span>
                    <span className="masterlist-card-label">Inactive</span>
                  </div>
                </div>
              </div>
            )}
=======
            {/* RSBSA Records Table */}
            <div className="masterlist-admin-table-container">
              <table className="masterlist-admin-farmers-table" data-responsive="stack">
                <thead>
                  <tr>
                    {[
                      'FFRS System Generated',
                      'Farmer Name',
                      'Farmer Address',
                      'Parcel Address',
                      'Parcel Area',
                      'Date Submitted',
                      'Farmer Status'
                    ].map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={7} className="masterlist-admin-loading-cell">Loading...</td></tr>
                  )}
>>>>>>> a56c5cb443fac3b0e2bb2aadcf109b8a76693409

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
              </div>

<<<<<<< HEAD
              {!loading && !error && (
                <div className="masterlist-admin-table-meta">
                  <span>
                    Showing {filteredRecords.length} of {rsbsaRecords.length}{" "}
                    farmers
                  </span>
                  <span>Tip: Click a row or use Quick Actions.</span>
                </div>
              )}
=======
                  {!loading && !error && filteredRecords.length > 0 && (
                    filteredRecords.map((record) => {
                      return (
                        <tr key={record.id}>
                          <td data-label="FFRS System Generated">{record.referenceNumber}</td>
                          <td data-label="Farmer Name">{record.farmerName}</td>
                          <td data-label="Farmer Address">{record.farmerAddress}</td>
                          <td data-label="Parcel Address">{record.farmLocation}</td>
                          <td data-label="Parcel Area">{record.parcelArea}</td>
                          <td data-label="Date Submitted">{formatDate(record.dateSubmitted)}</td>
                          <td data-label="Farmer Status">
                            <span className={`masterlist-admin-status-pill ${record.status === 'Active Farmer' ? 'masterlist-admin-status-approved' : 'masterlist-admin-status-not-approved'}`}>
                              {record.status || 'Not Active'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
>>>>>>> a56c5cb443fac3b0e2bb2aadcf109b8a76693409

              {!loading && !error && selectedRecordIds.size > 0 && (
                <div className="masterlist-admin-bulk-toolbar">
                  <span className="masterlist-admin-bulk-count">
                    {selectedRecordIds.size} farmer
                    {selectedRecordIds.size === 1 ? "" : "s"} selected
                  </span>
                  <div className="masterlist-admin-bulk-actions">
                    <div
                      className="masterlist-admin-bulk-export-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="masterlist-admin-bulk-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBulkExportMenu((previous) => !previous);
                        }}
                      >
                        Multi-Export ▾
                      </button>
                      {showBulkExportMenu && (
                        <div className="masterlist-admin-bulk-menu">
                          <button
                            className="masterlist-admin-quick-item"
                            onClick={() => {
                              exportRecords(
                                selectedRecords,
                                "csv",
                                "Masterlist_Selected",
                              );
                              setShowBulkExportMenu(false);
                            }}
                          >
                            Export Selected CSV
                          </button>
                          <button
                            className="masterlist-admin-quick-item"
                            onClick={() => {
                              exportRecords(
                                selectedRecords,
                                "xlsx",
                                "Masterlist_Selected",
                              );
                              setShowBulkExportMenu(false);
                            }}
                          >
                            Export Selected Excel
                          </button>
                          <button
                            className="masterlist-admin-quick-item"
                            onClick={() => {
                              exportRecords(
                                selectedRecords,
                                "pdf",
                                "Masterlist_Selected",
                              );
                              setShowBulkExportMenu(false);
                            }}
                          >
                            Export Selected PDF
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      className="masterlist-admin-bulk-btn masterlist-admin-bulk-btn-clear"
                      onClick={() => setSelectedRecordIds(new Set())}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}

              {/* RSBSA Records Table */}
              <div className="masterlist-admin-table-container">
                <table className="masterlist-admin-farmers-table">
                  <thead>
                    <tr>
                      <th className="masterlist-admin-checkbox-col">
                        <input
                          type="checkbox"
                          className="masterlist-admin-header-checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Select all visible farmers"
                        />
                      </th>
                      <th>Farmer</th>
                      <th>Address</th>
                      <th>
                        <button
                          className={`masterlist-admin-sort-btn ${
                            sortConfig.key === "parcelArea" ? "is-active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSortChange("parcelArea");
                          }}
                        >
                          Parcel Area{" "}
                          <span>{getSortIndicator("parcelArea")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          className={`masterlist-admin-sort-btn ${
                            sortConfig.key === "dateSubmitted"
                              ? "is-active"
                              : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSortChange("dateSubmitted");
                          }}
                        >
                          Date Submitted{" "}
                          <span>{getSortIndicator("dateSubmitted")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          className={`masterlist-admin-sort-btn ${
                            sortConfig.key === "status" ? "is-active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSortChange("status");
                          }}
                        >
                          Status <span>{getSortIndicator("status")}</span>
                        </button>
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td
                          colSpan={7}
                          className="masterlist-admin-loading-cell"
                        >
                          Loading...
                        </td>
                      </tr>
                    )}

                    {error && !loading && (
                      <tr>
                        <td colSpan={7} className="masterlist-admin-error-cell">
                          Error: {error}
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      !error &&
                      filteredRecords.length > 0 &&
                      filteredRecords.map((record) => {
                        const statusText = record.status || "Not Active";

                        return (
                          <tr
                            key={record.id}
                            className="masterlist-admin-table-row"
                            onClick={() => fetchFarmerDetails(record.id)}
                          >
                            <td className="masterlist-admin-checkbox-col">
                              <input
                                type="checkbox"
                                className="masterlist-admin-row-checkbox"
                                checked={selectedRecordIds.has(record.id)}
                                onChange={() => toggleSelectRecord(record.id)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Select ${record.farmerName}`}
                              />
                            </td>
                            <td>
                              <div className="masterlist-admin-farmer-cell">
                                <div className="masterlist-admin-farmer-avatar">
                                  {getFarmerInitials(record.farmerName)}
                                </div>
                                <div className="masterlist-admin-farmer-meta">
                                  <span className="masterlist-admin-farmer-name">
                                    {record.farmerName}
                                  </span>
                                  <span className="masterlist-admin-farmer-ref">
                                    Ref: {record.referenceNumber}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="masterlist-admin-address-cell">
                                <span className="masterlist-admin-address-primary">
                                  {record.farmerAddress}
                                </span>
                                <span className="masterlist-admin-address-secondary">
                                  Parcel: {record.farmLocation}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="masterlist-admin-parcel-cell">
                                <span className="masterlist-admin-parcel-count">
                                  {record.parcelCount} parcel
                                  {record.parcelCount === 1 ? "" : "s"}
                                </span>
                                <span className="masterlist-admin-parcel-area">
                                  {formatParcelArea(record.parcelArea)}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="masterlist-admin-date">
                                {formatDate(record.dateSubmitted)}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`masterlist-admin-status-pill ${getStatusClassName(statusText)}`}
                              >
                                {statusText}
                              </span>
                            </td>
                            <td className="masterlist-admin-actions-cell">
                              <div
                                className="masterlist-admin-quick-actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  className="masterlist-admin-view-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenQuickActionsId((previous) =>
                                      previous === record.id ? null : record.id,
                                    );
                                  }}
                                >
                                  Quick Actions ▾
                                </button>
                                {openQuickActionsId === record.id && (
                                  <div className="masterlist-admin-quick-menu">
                                    <button
                                      className="masterlist-admin-quick-item"
                                      onClick={() => {
                                        fetchFarmerDetails(record.id);
                                        setOpenQuickActionsId(null);
                                      }}
                                    >
                                      View
                                    </button>
                                    <button
                                      className="masterlist-admin-quick-item"
                                      onClick={() => {
                                        exportRecords(
                                          [record],
                                          "xlsx",
                                          `Farmer_${record.referenceNumber}`,
                                        );
                                        setOpenQuickActionsId(null);
                                      }}
                                    >
                                      Export Single Record
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                    {!loading && !error && filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={7} className="masterlist-admin-empty-cell">
                          No farmers found for the selected filters.
                        </td>
                      </tr>
                    )}
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
