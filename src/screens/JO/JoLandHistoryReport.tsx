import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getLandHistoryBarangays,
  getLandHistoryAssociationRows,
  getLandHistoryReportRows,
} from "../../api";
import "../../components/layout/sidebarStyle.css";
import "../../assets/css/jo css/JoLandHistoryReport.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

interface LandHistoryReportRow {
  id: number;
  parcel_number: string | null;
  farm_location_barangay: string | null;
  total_farm_area_ha: number | null;
  land_owner_name: string | null;
  farmer_name: string | null;
  is_registered_owner: boolean;
  is_tenant: boolean;
  is_lessee: boolean;
  is_current: boolean;
  period_start_date: string | null;
  period_end_date: string | null;
  change_type: string | null;
  change_reason: string | null;
  created_at: string | null;
}

type RelationshipFilter = "all" | "owner" | "tenant" | "lessee";

const JoLandHistoryReport: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [rows, setRows] = useState<LandHistoryReportRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [relationshipFilter, setRelationshipFilter] =
    useState<RelationshipFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [barangayOptions, setBarangayOptions] = useState<string[]>([]);
  const [farmerModalOpen, setFarmerModalOpen] = useState(false);
  const [farmerModalFarmerName, setFarmerModalFarmerName] = useState("");
  const [farmerModalRows, setFarmerModalRows] = useState<
    LandHistoryReportRow[]
  >([]);
  const [farmerModalAssociationRows, setFarmerModalAssociationRows] = useState<
    LandHistoryReportRow[]
  >([]);
  const [farmerModalLoading, setFarmerModalLoading] = useState(false);
  const [farmerModalError, setFarmerModalError] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const isActive = (path: string) => location.pathname === path;

  const getRelationship = (row: LandHistoryReportRow) => {
    if (row.is_registered_owner) return "Owner";
    if (row.is_tenant) return "Tenant";
    if (row.is_lessee) return "Lessee";
    return "Other";
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return "-";
    return parsed.toLocaleDateString();
  };

  const parseReportPayload = (payload: any) => {
    const nextRows = Array.isArray(payload?.rows)
      ? (payload.rows as LandHistoryReportRow[])
      : Array.isArray(payload)
        ? (payload as LandHistoryReportRow[])
        : [];
    const nextTotal = Number(payload?.totalCount ?? nextRows.length ?? 0);

    return {
      rows: nextRows,
      totalCount: nextTotal,
    };
  };

  const fetchReportRows = async (pageOverride?: number) => {
    try {
      setLoading(true);
      setError(null);

      const targetPage = pageOverride || page;
      const response = await getLandHistoryReportRows({
        searchTerm,
        farmerName: "all",
        barangay: barangayFilter,
        relationship: relationshipFilter,
        dateFrom,
        dateTo,
        page: targetPage,
        pageSize,
      });
      if (response.error) {
        throw new Error(response.error);
      }

      const parsedPayload = parseReportPayload(response.data);
      const nextRows = parsedPayload.rows;
      const nextTotal = parsedPayload.totalCount;

      setRows(nextRows);
      setTotalCount(nextTotal);

      if (targetPage > 1 && nextRows.length === 0 && nextTotal > 0) {
        setPage(1);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load land history report data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBarangayOptions = async () => {
    const response = await getLandHistoryBarangays();
    if (response.error) return;
    setBarangayOptions((response.data as string[]) || []);
  };

  useEffect(() => {
    fetchBarangayOptions();
  }, []);

  useEffect(() => {
    fetchReportRows();
  }, [
    page,
    pageSize,
    searchTerm,
    barangayFilter,
    relationshipFilter,
    dateFrom,
    dateTo,
  ]);

  const uniqueBarangays = useMemo(
    () => [...barangayOptions].sort((a, b) => a.localeCompare(b)),
    [barangayOptions],
  );

  const normalizeName = (value?: string | null) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[,.-]/g, " ")
      .trim();

  const namesLikelyMatch = (left?: string | null, right?: string | null) => {
    const a = normalizeName(left);
    const b = normalizeName(right);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  };

  const buildFarmerAssociations = (
    scopedFarmerName: string,
    scopedRows: LandHistoryReportRow[],
    scopedAssociationRows: LandHistoryReportRow[],
  ) => {
    if (!scopedFarmerName) {
      return {
        linkedOwners: [],
        linkedTenantsLessees: [],
      };
    }

    const ownerMap = new Map<
      string,
      {
        ownerName: string;
        asTenant: number;
        asLessee: number;
        parcels: Set<string>;
      }
    >();

    scopedRows.forEach((row) => {
      const ownerName = String(row.land_owner_name || "").trim();
      if (!ownerName || namesLikelyMatch(ownerName, scopedFarmerName)) return;
      if (!row.is_tenant && !row.is_lessee) return;

      const key = normalizeName(ownerName);
      if (!ownerMap.has(key)) {
        ownerMap.set(key, {
          ownerName,
          asTenant: 0,
          asLessee: 0,
          parcels: new Set<string>(),
        });
      }

      const existing = ownerMap.get(key)!;
      if (row.is_tenant) existing.asTenant += 1;
      if (row.is_lessee) existing.asLessee += 1;
      if (row.parcel_number) existing.parcels.add(String(row.parcel_number));
    });

    const counterpartMap = new Map<
      string,
      {
        farmerName: string;
        tenantRows: number;
        lesseeRows: number;
        currentRows: number;
        parcels: Set<string>;
      }
    >();

    scopedAssociationRows.forEach((row) => {
      const ownerName = String(row.land_owner_name || "").trim();
      const farmerName = String(row.farmer_name || "").trim();
      if (!ownerName || !farmerName) return;
      if (!namesLikelyMatch(ownerName, scopedFarmerName)) return;
      if (namesLikelyMatch(farmerName, scopedFarmerName)) return;
      if (!row.is_tenant && !row.is_lessee) return;

      const key = normalizeName(farmerName);
      if (!counterpartMap.has(key)) {
        counterpartMap.set(key, {
          farmerName,
          tenantRows: 0,
          lesseeRows: 0,
          currentRows: 0,
          parcels: new Set<string>(),
        });
      }

      const existing = counterpartMap.get(key)!;
      if (row.is_tenant) existing.tenantRows += 1;
      if (row.is_lessee) existing.lesseeRows += 1;
      if (row.is_current) existing.currentRows += 1;
      if (row.parcel_number) existing.parcels.add(String(row.parcel_number));
    });

    return {
      linkedOwners: Array.from(ownerMap.values()).sort((a, b) =>
        a.ownerName.localeCompare(b.ownerName),
      ),
      linkedTenantsLessees: Array.from(counterpartMap.values()).sort((a, b) =>
        a.farmerName.localeCompare(b.farmerName),
      ),
    };
  };

  const buildFarmerTimeline = (
    scopedFarmerName: string,
    scopedAssociationRows: LandHistoryReportRow[],
  ) => {
    if (!scopedFarmerName) return [];

    const toTimestamp = (value?: string | null) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const timelineRows = scopedAssociationRows.filter((row) => {
      const changeType = String(row.change_type || "").toLowerCase();
      const reason = String(row.change_reason || "").toLowerCase();
      const looksLikeTransfer =
        changeType.includes("transfer") ||
        changeType.includes("change") ||
        reason.includes("transfer") ||
        reason.includes("change");

      return looksLikeTransfer || row.is_tenant || row.is_lessee;
    });

    const events = timelineRows.map((row, index) => {
      const ownerName = String(row.land_owner_name || "").trim();
      const farmerName = String(row.farmer_name || "").trim();

      let fromName = ownerName || "Unknown";
      let toName = farmerName || scopedFarmerName;

      if (
        ownerName &&
        farmerName &&
        namesLikelyMatch(ownerName, scopedFarmerName) &&
        !namesLikelyMatch(farmerName, scopedFarmerName)
      ) {
        fromName = scopedFarmerName;
        toName = farmerName;
      } else if (
        ownerName &&
        farmerName &&
        namesLikelyMatch(farmerName, scopedFarmerName) &&
        !namesLikelyMatch(ownerName, scopedFarmerName)
      ) {
        fromName = ownerName;
        toName = scopedFarmerName;
      }

      const relationship = row.is_tenant
        ? "Tenant"
        : row.is_lessee
          ? "Lessee"
          : row.is_registered_owner
            ? "Owner"
            : "Other";

      const eventDate =
        row.period_start_date || row.created_at || row.period_end_date || null;

      return {
        id: `${row.id}-${eventDate || "none"}-${index}`,
        eventDate,
        fromName,
        toName,
        parcelNumber: String(row.parcel_number || "").trim(),
        barangay: String(row.farm_location_barangay || "").trim(),
        relationship,
        changeType: String(row.change_type || "").trim(),
        changeReason: String(row.change_reason || "").trim(),
      };
    });

    events.sort((a, b) => toTimestamp(b.eventDate) - toTimestamp(a.eventDate));
    return events;
  };

  const closeFarmerHistoryModal = () => {
    setFarmerModalOpen(false);
  };

  const openFarmerHistoryModal = async (rawFarmerName?: string | null) => {
    const scopedFarmerName = String(rawFarmerName || "").trim();
    if (!scopedFarmerName) return;

    setFarmerModalOpen(true);
    setFarmerModalFarmerName(scopedFarmerName);
    setFarmerModalRows([]);
    setFarmerModalAssociationRows([]);
    setFarmerModalError(null);
    setFarmerModalLoading(true);

    const [reportResponse, associationResponse] = await Promise.all([
      getLandHistoryReportRows({
        searchTerm: "",
        farmerName: scopedFarmerName,
        barangay: "all",
        relationship: "all",
        dateFrom: "",
        dateTo: "",
        page: 1,
        pageSize: 5000,
      }),
      getLandHistoryAssociationRows({
        farmerName: scopedFarmerName,
        barangay: "all",
        dateFrom: "",
        dateTo: "",
        limit: 5000,
      }),
    ]);

    if (reportResponse.error || associationResponse.error) {
      setFarmerModalRows([]);
      setFarmerModalAssociationRows([]);
      setFarmerModalError(
        reportResponse.error ||
          associationResponse.error ||
          "Failed to load farmer history.",
      );
      setFarmerModalLoading(false);
      return;
    }

    const parsedPayload = parseReportPayload(reportResponse.data);
    setFarmerModalRows(parsedPayload.rows);
    setFarmerModalAssociationRows(
      (associationResponse.data as LandHistoryReportRow[]) || [],
    );
    setFarmerModalError(null);
    setFarmerModalLoading(false);
  };

  useEffect(() => {
    if (!farmerModalOpen) return;

    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeFarmerHistoryModal();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [farmerModalOpen]);

  const farmerModalSummary = useMemo(() => {
    const currentRecords = farmerModalRows.filter((row) => row.is_current);
    const roleLabels = [
      currentRecords.some((row) => row.is_registered_owner) ? "Owner" : null,
      currentRecords.some((row) => row.is_tenant) ? "Tenant" : null,
      currentRecords.some((row) => row.is_lessee) ? "Lessee" : null,
    ].filter(Boolean) as string[];

    const transferRows = farmerModalRows.filter((row) => {
      const type = String(row.change_type || "").toLowerCase();
      return type.includes("transfer") || type.includes("change");
    }).length;

    const totalAreaHa = farmerModalRows.reduce(
      (sum, row) => sum + (Number(row.total_farm_area_ha) || 0),
      0,
    );

    return {
      totalRecords: farmerModalRows.length,
      currentRecords: currentRecords.length,
      transferRows,
      totalAreaHa,
      roleLabels,
    };
  }, [farmerModalRows]);

  const farmerModalAssociations = useMemo(
    () =>
      buildFarmerAssociations(
        farmerModalFarmerName,
        farmerModalRows,
        farmerModalAssociationRows,
      ),
    [farmerModalAssociationRows, farmerModalFarmerName, farmerModalRows],
  );

  const farmerModalTimeline = useMemo(
    () =>
      buildFarmerTimeline(farmerModalFarmerName, farmerModalAssociationRows),
    [farmerModalAssociationRows, farmerModalFarmerName],
  );

  const summary = useMemo(() => {
    const totalRecords = totalCount;
    const currentRecords = rows.filter((row) => row.is_current).length;
    const tenantRecords = rows.filter((row) => row.is_tenant).length;
    const transferRecords = rows.filter((row) => {
      const type = String(row.change_type || "").toLowerCase();
      return type.includes("transfer") || type.includes("change");
    }).length;

    const totalAreaHa = rows.reduce(
      (sum, row) => sum + (Number(row.total_farm_area_ha) || 0),
      0,
    );

    return {
      totalRecords,
      currentRecords,
      tenantRecords,
      transferRecords,
      totalAreaHa,
    };
  }, [rows, totalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(totalCount, page * pageSize);
  const farmerModalTimelineLimit = 30;

  const escapeCsvValue = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const downloadCsvFile = (fileName: string, lines: string[]) => {
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (rows.length === 0) return;

    const headers = [
      "Record ID",
      "Parcel Number",
      "Barangay",
      "Land Owner",
      "Farmer",
      "Relationship",
      "Area (ha)",
      "Current",
      "Period Start",
      "Period End",
      "Change Type",
      "Change Reason",
    ];

    const lines = [headers.map(escapeCsvValue).join(",")];

    rows.forEach((row) => {
      lines.push(
        [
          row.id,
          row.parcel_number || "-",
          row.farm_location_barangay || "-",
          row.land_owner_name || "-",
          row.farmer_name || "-",
          getRelationship(row),
          Number(row.total_farm_area_ha || 0).toFixed(2),
          row.is_current ? "Yes" : "No",
          formatDate(row.period_start_date),
          formatDate(row.period_end_date),
          row.change_type || "-",
          row.change_reason || "-",
        ]
          .map(escapeCsvValue)
          .join(","),
      );
    });

    const datePart = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`land-history-report-${datePart}.csv`, lines);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setBarangayFilter("all");
    setRelationshipFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const noRowsMessage = "No history records match your filters.";

  return (
    <div className="jo-land-history-report-page-container">
      <div className="jo-land-history-report-page has-mobile-sidebar">
        <div className={`tech-incent-sidebar ${sidebarOpen ? "active" : ""}`}>
          <div className="sidebar-header">
            <img src={LogoImage} alt="DARDA Logo" className="sidebar-logo" />
            <h2>DARDA</h2>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`sidebar-nav-item ${isActive("/jo-dashboard") ? "active" : ""}`}
              onClick={() => navigate("/jo-dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-rsbsapage") ? "active" : ""}`}
              onClick={() => navigate("/jo-rsbsapage")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-incentives") ? "active" : ""}`}
              onClick={() => navigate("/jo-incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Subsidy</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-masterlist") ? "active" : ""}`}
              onClick={() => navigate("/jo-masterlist")}
            >
              <span className="nav-icon">
                <img src={MasterlistIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <div
              className={`sidebar-nav-item ${isActive("/jo-land-registry") ? "active" : ""}`}
              onClick={() => navigate("/jo-land-registry")}
            >
              <div className="nav-icon">🗺️</div>
              <span className="nav-text">Land Registry</span>
            </div>

            <div
              className={`sidebar-nav-item ${isActive("/jo-land-history-report") ? "active" : ""}`}
              onClick={() => navigate("/jo-land-history-report")}
            >
              <div className="nav-icon">📜</div>
              <span className="nav-text">Land History Report</span>
            </div>

            <button
              className="sidebar-nav-item logout"
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

        <div className="jo-land-history-report-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">Land History Report</div>
          </div>

          <div className="jo-land-history-report-header">
            <h1>Land History Report</h1>
            <p>
              Click any farmer name in the table to open a focused farmer
              history modal, or use filters for the full ledger view.
            </p>
          </div>

          <div className="jo-land-history-report-content-card">
            <div className="jo-land-history-report-filters">
              <input
                className="jo-land-history-report-search"
                type="text"
                placeholder="Search parcel, owner, farmer, change type..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />

              <select
                className="jo-land-history-report-select"
                value={barangayFilter}
                onChange={(e) => {
                  setBarangayFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Barangays</option>
                {uniqueBarangays.map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </select>

              <select
                className="jo-land-history-report-select"
                value={relationshipFilter}
                onChange={(e) => {
                  setRelationshipFilter(e.target.value as RelationshipFilter);
                  setPage(1);
                }}
              >
                <option value="all">All Relationships</option>
                <option value="owner">Owner</option>
                <option value="tenant">Tenant</option>
                <option value="lessee">Lessee</option>
              </select>

              <input
                className="jo-land-history-report-date"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />

              <input
                className="jo-land-history-report-date"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />

              <button
                className="jo-land-history-report-btn"
                onClick={() => fetchReportRows(page)}
              >
                Refresh
              </button>

              <button
                className="jo-land-history-report-btn"
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>

              <button
                className="jo-land-history-report-btn primary"
                onClick={handleExportCsv}
                disabled={rows.length === 0}
              >
                Export Current View
              </button>
            </div>

            <div className="jo-land-history-report-kpis">
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Records</span>
                <strong>{summary.totalRecords}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Current</span>
                <strong>{summary.currentRecords}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Tenant Rows (Page)</span>
                <strong>{summary.tenantRecords}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Transfer Rows (Page)</span>
                <strong>{summary.transferRecords}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card wide">
                <span className="label">Total Area (ha, Page)</span>
                <strong>{summary.totalAreaHa.toFixed(2)}</strong>
              </div>
            </div>

            <div className="jo-land-history-report-page-meta">
              <span>
                Showing {pageStart}-{pageEnd} of {totalCount} filtered records
              </span>
              <label>
                Rows per page:
                <select
                  className="jo-land-history-report-page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </label>
            </div>

            {loading ? (
              <div className="jo-land-history-report-state">
                Loading report data...
              </div>
            ) : error ? (
              <div className="jo-land-history-report-state error">{error}</div>
            ) : rows.length === 0 ? (
              <div className="jo-land-history-report-state">
                {noRowsMessage}
              </div>
            ) : (
              <div className="jo-land-history-report-table-wrap">
                <table className="jo-land-history-report-table">
                  <thead>
                    <tr>
                      <th>Parcel</th>
                      <th>Barangay</th>
                      <th>Owner</th>
                      <th>Farmer (click to view)</th>
                      <th>Relationship</th>
                      <th>Area (ha)</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Status</th>
                      <th>Change Type</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.parcel_number || "-"}</td>
                        <td>{row.farm_location_barangay || "-"}</td>
                        <td>{row.land_owner_name || "-"}</td>
                        <td>
                          {row.farmer_name ? (
                            <button
                              type="button"
                              className="jo-land-history-farmer-link"
                              onClick={() =>
                                openFarmerHistoryModal(row.farmer_name)
                              }
                            >
                              {row.farmer_name}
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{getRelationship(row)}</td>
                        <td>
                          {Number(row.total_farm_area_ha || 0).toFixed(2)}
                        </td>
                        <td>{formatDate(row.period_start_date)}</td>
                        <td>{formatDate(row.period_end_date)}</td>
                        <td>{row.is_current ? "Current" : "Past"}</td>
                        <td>{row.change_type || "-"}</td>
                        <td>{row.change_reason || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="jo-land-history-report-pagination">
              <button
                className="jo-land-history-report-btn"
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <span className="jo-land-history-report-page-indicator">
                Page {page} of {totalPages}
              </span>
              <button
                className="jo-land-history-report-btn"
                disabled={page >= totalPages || loading}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Next
              </button>
            </div>
          </div>

          {farmerModalOpen && (
            <div
              className="jo-land-history-modal-overlay"
              onClick={closeFarmerHistoryModal}
            >
              <div
                className="jo-land-history-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Land history for ${farmerModalFarmerName}`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="jo-land-history-modal-header">
                  <div>
                    <h2>{farmerModalFarmerName || "Farmer History"}</h2>
                    <p>Complete history view for the selected farmer.</p>
                  </div>
                  <button
                    type="button"
                    className="jo-land-history-report-btn"
                    onClick={closeFarmerHistoryModal}
                  >
                    Close
                  </button>
                </div>

                {farmerModalLoading ? (
                  <div className="jo-land-history-report-state">
                    Loading selected farmer history...
                  </div>
                ) : farmerModalError ? (
                  <div className="jo-land-history-report-state error">
                    {farmerModalError}
                  </div>
                ) : (
                  <>
                    <div className="jo-land-history-report-kpis jo-land-history-modal-kpis">
                      <div className="jo-land-history-report-kpi-card">
                        <span className="label">Records</span>
                        <strong>{farmerModalSummary.totalRecords}</strong>
                      </div>
                      <div className="jo-land-history-report-kpi-card">
                        <span className="label">Current Rows</span>
                        <strong>{farmerModalSummary.currentRecords}</strong>
                      </div>
                      <div className="jo-land-history-report-kpi-card">
                        <span className="label">Transfer Rows</span>
                        <strong>{farmerModalSummary.transferRows}</strong>
                      </div>
                      <div className="jo-land-history-report-kpi-card wide">
                        <span className="label">Total Area (ha)</span>
                        <strong>
                          {farmerModalSummary.totalAreaHa.toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    <div className="jo-land-history-report-farmer-roles">
                      Roles now:{" "}
                      {farmerModalSummary.roleLabels.length > 0
                        ? farmerModalSummary.roleLabels.join(", ")
                        : "No current role tagged."}
                    </div>

                    <div className="jo-land-history-association-grid jo-land-history-modal-block">
                      <section className="jo-land-history-association-card">
                        <header>
                          <h3>Linked Land Owners</h3>
                          <span>
                            {farmerModalAssociations.linkedOwners.length} linked
                          </span>
                        </header>

                        {farmerModalAssociations.linkedOwners.length === 0 ? (
                          <p className="jo-land-history-association-empty">
                            No owner links found for this farmer.
                          </p>
                        ) : (
                          <ul className="jo-land-history-association-list">
                            {farmerModalAssociations.linkedOwners.map(
                              (owner) => (
                                <li key={owner.ownerName}>
                                  <strong>{owner.ownerName}</strong>
                                  <span>
                                    Tenant rows: {owner.asTenant} | Lessee rows:{" "}
                                    {owner.asLessee}
                                  </span>
                                  <small>
                                    Parcels linked: {owner.parcels.size}
                                  </small>
                                </li>
                              ),
                            )}
                          </ul>
                        )}
                      </section>

                      <section className="jo-land-history-association-card">
                        <header>
                          <h3>Tenants / Lessees Under This Farmer</h3>
                          <span>
                            {
                              farmerModalAssociations.linkedTenantsLessees
                                .length
                            }{" "}
                            linked
                          </span>
                        </header>

                        {farmerModalAssociations.linkedTenantsLessees.length ===
                        0 ? (
                          <p className="jo-land-history-association-empty">
                            No tenant or lessee links where this farmer appears
                            as owner.
                          </p>
                        ) : (
                          <ul className="jo-land-history-association-list">
                            {farmerModalAssociations.linkedTenantsLessees.map(
                              (counterpart) => (
                                <li key={counterpart.farmerName}>
                                  <strong>{counterpart.farmerName}</strong>
                                  <span>
                                    Tenant rows: {counterpart.tenantRows} |
                                    Lessee rows: {counterpart.lesseeRows}
                                  </span>
                                  <small>
                                    Current rows: {counterpart.currentRows} |
                                    Parcels linked: {counterpart.parcels.size}
                                  </small>
                                </li>
                              ),
                            )}
                          </ul>
                        )}
                      </section>
                    </div>

                    <section className="jo-land-history-timeline-card jo-land-history-modal-block">
                      <header>
                        <h3>Transfer Timeline</h3>
                        <span>{farmerModalTimeline.length} events</span>
                      </header>

                      {farmerModalTimeline.length === 0 ? (
                        <p className="jo-land-history-association-empty">
                          No transfer or tenancy flow found for this farmer.
                        </p>
                      ) : (
                        <ol className="jo-land-history-timeline-list">
                          {farmerModalTimeline
                            .slice(0, farmerModalTimelineLimit)
                            .map((event) => (
                              <li key={event.id}>
                                <div className="jo-land-history-timeline-head">
                                  <span>{formatDate(event.eventDate)}</span>
                                  <small>
                                    {event.changeType || "Status update"}
                                  </small>
                                </div>

                                <div className="jo-land-history-timeline-flow">
                                  <strong>{event.fromName || "Unknown"}</strong>
                                  <span>→</span>
                                  <strong>{event.toName || "Unknown"}</strong>
                                </div>

                                <div className="jo-land-history-timeline-meta">
                                  <span>Role: {event.relationship}</span>
                                  <span>
                                    Parcel: {event.parcelNumber || "-"} |
                                    Barangay: {event.barangay || "-"}
                                  </span>
                                </div>

                                {event.changeReason && (
                                  <p className="jo-land-history-timeline-reason">
                                    Reason: {event.changeReason}
                                  </p>
                                )}
                              </li>
                            ))}
                        </ol>
                      )}

                      {farmerModalTimeline.length >
                        farmerModalTimelineLimit && (
                        <p className="jo-land-history-timeline-note">
                          Showing latest {farmerModalTimelineLimit} of{" "}
                          {farmerModalTimeline.length} timeline events.
                        </p>
                      )}
                    </section>

                    <div className="jo-land-history-report-table-wrap jo-land-history-modal-block">
                      <table className="jo-land-history-report-table">
                        <thead>
                          <tr>
                            <th>Parcel</th>
                            <th>Barangay</th>
                            <th>Owner</th>
                            <th>Farmer</th>
                            <th>Relationship</th>
                            <th>Area (ha)</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Status</th>
                            <th>Change Type</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {farmerModalRows.length === 0 ? (
                            <tr>
                              <td colSpan={11}>
                                No history rows found for this farmer.
                              </td>
                            </tr>
                          ) : (
                            farmerModalRows.map((row) => (
                              <tr
                                key={`modal-${row.id}-${row.period_start_date || ""}`}
                              >
                                <td>{row.parcel_number || "-"}</td>
                                <td>{row.farm_location_barangay || "-"}</td>
                                <td>{row.land_owner_name || "-"}</td>
                                <td>{row.farmer_name || "-"}</td>
                                <td>{getRelationship(row)}</td>
                                <td>
                                  {Number(row.total_farm_area_ha || 0).toFixed(
                                    2,
                                  )}
                                </td>
                                <td>{formatDate(row.period_start_date)}</td>
                                <td>{formatDate(row.period_end_date)}</td>
                                <td>{row.is_current ? "Current" : "Past"}</td>
                                <td>{row.change_type || "-"}</td>
                                <td>{row.change_reason || "-"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoLandHistoryReport;
