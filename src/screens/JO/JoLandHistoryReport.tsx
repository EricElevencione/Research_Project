import React, { useEffect, useMemo, useState } from "react";

import {
  getLandHistoryParcelHistory,
  getLandInventoryReportRows,
  getLandPlotsBarangays,
} from "../../api";
import { printHtmlReport } from "../../utils/printHelper";
import "../../assets/css/jo css/JoLandHistoryReport.css";
import JOSidebar from "../../components/layout/JOSidebar";
import ParcelGeometryPreview from "../../components/FarmerProfile/ParcelGeometryPreview";

// One row per PLOTTED parcel (land_plots), not per history event —
// includes parcels that have real geometry and a resolvable owner but
// were never run through an RSBSA registration, so has_registration can
// legitimately be false. Owner is resolved via land_plots.farmer_id
// (see getLandInventoryReportRows), not derived from land_history.
interface LandInventoryRow {
  id: string;
  parcel_number: string | null;
  barangay: string | null;
  area_ha: number | null;
  owner_name: string | null;
  owner_resolved_via: "farmer_id" | "plot_name_only" | "unresolved";
  has_registration: boolean;
  change_type: string | null;
  change_reason: string | null;
  period_start_date: string | null;
  period_end_date: string | null;
  farmer_name: string | null;
  role_label: string | null;
  geometry?: any | null;
}

// Still land_history's own row shape — used only by the parcel-history
// drill-down modal, which shows the timeline of registration EVENTS for
// one specific parcel. That's a different question from "what land
// exists," so it correctly stays land_history-only.
interface LandHistoryEventRow {
  id: number;
  parcel_number: string | null;
  farm_location_barangay: string | null;
  total_farm_area_ha: number | null;
  land_owner_name: string | null;
  farmer_name: string | null;
  ownership_category?: string | null;
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

type RelationshipFilter =
  | "all"
  | "owner"
  | "tenant"
  | "lessee"
  | "tenantLessee";
interface ParcelRow {
  id: string;
  parcelNumber: string | null;
  barangay: string;
  occupantName: string;
  farmerName: string;
  roleLabel: string;
  currentAreaHa: number;
  lastChangeDate: string | null;
  isCurrent: boolean;
  hasRegistration: boolean;
  ownerResolvedVia: "farmer_id" | "plot_name_only" | "unresolved";
}

const DUMANGAS_BARANGAYS = [
  "Aurora-Del Pilar",
  "Bacay",
  "Bacong",
  "Balabag",
  "Balud",
  "Bantud",
  "Bantud Fabrica",
  "Baras",
  "Barasan",
  "Basa-Mabini Bonifacio",
  "Bolilao",
  "Buenaflor Embarkadero",
  "Burgos-Regidor",
  "Calao",
  "Cali",
  "Cansilayan",
  "Capaliz",
  "Cayos",
  "Compayan",
  "Dacutan",
  "Ermita",
  "Ilaya 1st",
  "Ilaya 2nd",
  "Ilaya 3rd",
  "Jardin",
  "Lacturan",
  "Lopez Jaena - Rizal",
  "Managuit",
  "Maquina",
  "Nanding Lopez",
  "Pagdugue",
  "Paloc Bigque",
  "Paloc Sool",
  "Patlad",
  "Pd Monfort North",
  "Pd Monfort South",
  "Pulao",
  "Rosario",
  "Sapao",
  "Sulangan",
  "Tabucan",
  "Talusan",
  "Tambobo",
  "Tamboilan",
  "Victorias"
].sort();

const JoLandHistoryReport: React.FC = () => {
  const [rows, setRows] = useState<LandInventoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [relationshipFilter, setRelationshipFilter] =
    useState<RelationshipFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [parcelModalOpen, setParcelModalOpen] = useState(false);
  const [parcelModalParcelNumber, setParcelModalParcelNumber] = useState<
    string | null
  >(null);
  const [parcelModalRows, setParcelModalRows] = useState<LandHistoryEventRow[]>(
    [],
  );
  const [parcelModalLoading, setParcelModalLoading] = useState(false);
  const [parcelModalError, setParcelModalError] = useState<string | null>(null);
  const [selectedHistoryRow, setSelectedHistoryRow] =
    useState<LandHistoryEventRow | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const formatName = (value?: string | null) =>
    String(value || "").trim() || "-";

  const getFarmingRoleLabel = (row: LandHistoryEventRow) => {
    if (row.is_registered_owner) return "Owner";
    if (row.is_tenant) return "Tenant";
    if (row.is_lessee) return "Lessee";
    return "Unknown";
  };

  const getChangeTypeColor = (
    changeType?: string | null,
  ): { dotClass: string; label: string } => {
    const ct = String(changeType || "")
      .trim()
      .toLowerCase();
    if (ct.includes("transfer") || ct.includes("ownership"))
      return { dotClass: "dot-transfer", label: "Transfer" };
    if (ct.includes("update") || ct.includes("modif") || ct.includes("edit"))
      return { dotClass: "dot-update", label: "Update" };
    if (
      ct.includes("remov") ||
      ct.includes("expir") ||
      ct.includes("delet") ||
      ct.includes("terminat")
    )
      return { dotClass: "dot-removal", label: "Removal" };
    return { dotClass: "dot-default", label: changeType || "Change" };
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return "-";
    return parsed.toLocaleDateString();
  };

  const parseReportPayload = (payload: any) => {
    const nextRows = Array.isArray(payload?.rows)
      ? (payload.rows as LandInventoryRow[])
      : Array.isArray(payload)
        ? (payload as LandInventoryRow[])
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
      const response = await getLandInventoryReportRows({
        searchTerm,
        barangay: barangayFilter,
        relationship:
          relationshipFilter === "tenantLessee" ? "all" : relationshipFilter,
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
      setError(err?.message || "Failed to load land inventory report data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportRows();
  }, [page, pageSize, searchTerm, barangayFilter, relationshipFilter]);

  const closeParcelHistoryModal = () => {
    setParcelModalOpen(false);
  };

  const openParcelHistoryModal = async (rawParcelNumber?: string | null) => {
    const parcelNumber = String(rawParcelNumber || "").trim();
    if (!parcelNumber) return;

    setParcelModalOpen(true);
    setParcelModalParcelNumber(parcelNumber);
    setParcelModalRows([]);
    setParcelModalError(null);
    setParcelModalLoading(true);

    const response = await getLandHistoryParcelHistory(parcelNumber);
    if (response.error) {
      setParcelModalRows([]);
      setParcelModalError(
        response.error || "Failed to load parcel history records.",
      );
      setParcelModalLoading(false);
      return;
    }

    setParcelModalRows((response.data as LandHistoryEventRow[]) || []);
    setParcelModalError(null);
    setParcelModalLoading(false);
  };

  const handleReportRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    parcelNumber?: string | null,
  ) => {
    const scopedParcelNumber = String(parcelNumber || "").trim();
    if (!scopedParcelNumber) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openParcelHistoryModal(scopedParcelNumber);
    }
  };

  const handlePrintTimeline = () => {
    if (parcelModalTimelineRows.length === 0) {
      alert("No timeline events found to print");
      return;
    }

    const firstRow = parcelModalTimelineRows[0];
    const parcelNo = parcelModalParcelNumber || "-";
    const barangay = formatName(firstRow?.farm_location_barangay);
    const area = firstRow?.total_farm_area_ha != null 
      ? Number(firstRow.total_farm_area_ha).toFixed(2) + " ha"
      : "-";

    const tableHeaderHtml = `
      <th style="width: 15%;">Date</th>
      <th style="width: 15%;">Event Type</th>
      <th style="width: 20%;">Land Owner</th>
      <th style="width: 20%;">Farmer / Occupant</th>
      <th style="width: 12%;">Role</th>
      <th style="width: 18%;">Change Reason</th>
    `;

    const tableBodyHtml = parcelModalTimelineRows.map((row) => {
      const eventDate = formatDate(getRowEventDate(row));
      const eventType = String(row.change_type || "Record");
      const owner = formatName(row.land_owner_name);
      const farmer = formatName(row.farmer_name);
      const role = getFarmingRoleLabel(row);
      const reason = row.change_reason ? row.change_reason : "No additional details";

      return `
        <tr>
          <td><strong>${eventDate}</strong>${row.is_current ? ' <span style="background:#d1fae5;color:#065f46;padding:2px 4px;border-radius:3px;font-size:7px;font-weight:bold;">Current</span>' : ''}</td>
          <td><span style="font-weight:600;">${eventType}</span></td>
          <td>${owner}</td>
          <td>${farmer}</td>
          <td><span style="background:#e2e8f0;padding:1px 4px;border-radius:3px;font-size:7px;">${role}</span></td>
          <td>${reason}</td>
        </tr>
      `;
    }).join("\n");

    printHtmlReport({
      title: `Parcel Timeline Report - ${parcelNo}`,
      reportName: `PARCEL TIMELINE HISTORY REPORT`,
      filterLabel: `Parcel No: ${parcelNo} | Location: Brgy. ${barangay} | Total Area: ${area}`,
      totalCount: parcelModalTimelineRows.length,
      tableHeaderHtml,
      tableBodyHtml,
      printedBy: "JO Staff",
    });
  };

  useEffect(() => {
    if (!parcelModalOpen) return;

    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeParcelHistoryModal();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [parcelModalOpen]);

  const getRowEventDate = (row: LandHistoryEventRow) =>
    row.period_start_date || row.created_at || row.period_end_date || null;

  const toSortableTimestamp = (value?: string | null) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // One row per plotted parcel already (getLandInventoryReportRows), so
  // no aggregation/filtering needed here — just map field names for the
  // table/PDF/summary code below.
  const parcelRows = useMemo<ParcelRow[]>(() => {
    return rows.map((row) => ({
      id: row.id,
      parcelNumber: row.parcel_number ? String(row.parcel_number).trim() : null,
      barangay: formatName(row.barangay),
      occupantName: row.owner_name
        ? formatName(row.owner_name)
        : "Unclaimed — no owner matched",
      farmerName: row.has_registration ? formatName(row.farmer_name) : "-",
      roleLabel: row.has_registration
        ? row.role_label || "Unknown"
        : "No registration on file",
      currentAreaHa: Number(row.area_ha) || 0,
      lastChangeDate: row.period_start_date || row.period_end_date || null,
      isCurrent: row.has_registration,
      hasRegistration: row.has_registration,
      ownerResolvedVia: row.owner_resolved_via,
    }));
  }, [rows]);

  const parcelModalTimelineRows = useMemo(() => {
    const sorted = [...parcelModalRows];
    sorted.sort((a, b) => {
      const aTimestamp = toSortableTimestamp(getRowEventDate(a));
      const bTimestamp = toSortableTimestamp(getRowEventDate(b));
      if (bTimestamp !== aTimestamp) return bTimestamp - aTimestamp;
      return b.id - a.id;
    });
    return sorted;
  }, [parcelModalRows]);

  // Auto-select the most recent (current) row when modal data loads
  useEffect(() => {
    if (parcelModalTimelineRows.length > 0) {
      const currentRow =
        parcelModalTimelineRows.find((r) => r.is_current) ||
        parcelModalTimelineRows[0];
      setSelectedHistoryRow(currentRow);
    } else {
      setSelectedHistoryRow(null);
    }
  }, [parcelModalTimelineRows]);

  const matchedInventoryRow = useMemo(() => {
    return rows.find(
      (r) =>
        String(r.parcel_number || "")
          .trim()
          .toUpperCase() === String(parcelModalParcelNumber || "")
          .trim()
          .toUpperCase()
    );
  }, [rows, parcelModalParcelNumber]);

  const parcelGeometry = matchedInventoryRow?.geometry ?? null;

  const summary = useMemo(() => {
    const tenantParcels = parcelRows.filter(
      (row) => row.roleLabel === "Tenant",
    ).length;

    const lesseeParcels = parcelRows.filter(
      (row) => row.roleLabel === "Lessee",
    ).length;

    const unregisteredParcels = parcelRows.filter(
      (row) => !row.hasRegistration,
    ).length;

    const totalCurrentAreaHa = parcelRows.reduce(
      (sum, row) => sum + (Number(row.currentAreaHa) || 0),
      0,
    );

    return {
      totalPlottedParcels: totalCount,
      parcelsOnPage: parcelRows.length,
      currentParcels: parcelRows.length,
      tenantParcels,
      lesseeParcels,
      unregisteredParcels,
      totalCurrentAreaHa,
    };
  }, [parcelRows, totalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(totalCount, page * pageSize);

  const handlePrint = async (roleFilter: "all" | "owner" | "tenant" | "lessee") => {
    try {
      setLoading(true);
      const response = await getLandInventoryReportRows({
        searchTerm,
        barangay: barangayFilter,
        relationship: roleFilter,
        page: 1,
        pageSize: 1000,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const rawRows = response.data?.rows || [];
      const mappedRows = rawRows.map((row: any) => ({
        parcelNumber: row.parcel_number ? String(row.parcel_number).trim() : null,
        barangay: row.barangay ? String(row.barangay).trim() : null,
        occupantName: row.owner_name ? formatName(row.owner_name) : "Unclaimed — no owner matched",
        farmerName: row.has_registration ? formatName(row.farmer_name) : "-",
        roleLabel: row.has_registration ? row.role_label || "Unknown" : "No registration on file",
        currentAreaHa: Number(row.area_ha) || 0,
        lastChangeDate: row.period_start_date || row.period_end_date || null,
        hasRegistration: row.has_registration,
      }));

      if (mappedRows.length === 0) {
        alert("No records found to print");
        return;
      }

      const rowsHtml = mappedRows
        .map((row: any) => {
          const regLabel = row.hasRegistration ? "On file" : "Not registered";
          const changeDate = row.lastChangeDate ? new Date(row.lastChangeDate).toLocaleDateString() : "-";
          return `<tr>
            <td>${row.parcelNumber || "-"}</td>
            <td>${row.occupantName}</td>
            <td>${row.farmerName}</td>
            <td>${row.roleLabel}</td>
            <td>${Number(row.currentAreaHa || 0).toFixed(2)}</td>
            <td>${changeDate}</td>
            <td>${regLabel}</td>
          </tr>`;
        })
        .join("");

      const roleLabelMap = {
        all: "All Relationships",
        owner: "Registered Owner Only",
        tenant: "Tenant Only",
        lessee: "Lessee Only",
      };

      const filterLabel = [
        `Search: ${searchTerm.trim() || "All"}`,
        `Barangay: ${barangayFilter === "all" ? "All Barangays" : barangayFilter}`,
        `Relationship: ${roleLabelMap[roleFilter]}`,
      ].join(" · ");

      printHtmlReport({
        title: "Land Inventory Report — Dumangas, Iloilo",
        reportName: "Land Inventory Report",
        filterLabel,
        totalCount: mappedRows.length,
        tableHeaderHtml: "<th>Parcel No.</th><th>Registered Owner</th><th>Farmer / Occupant</th><th>Relationship</th><th>Area (ha)</th><th>Last Change</th><th>Registration</th>",
        tableBodyHtml: rowsHtml,
        printedBy: "JO Staff",
      });
    } catch (err: any) {
      console.error("Print error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setBarangayFilter("all");
    setRelationshipFilter("all");
    setPage(1);
  };

  const noRowsMessage = "No plotted parcels found with the current filters.";

  return (
    <div className="jo-land-history-report-page-container">
      <div className="jo-land-history-report-page has-mobile-sidebar">
        <JOSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="jo-land-history-report-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">
              Land Inventory Report
            </div>
          </div>

          <div className="jo-land-history-report-header">
            <h1>Land Inventory Report</h1>
            <p>
              Every plotted parcel — not just ones with a registration on file.
              Owner is resolved from the GIS plot record directly, so land with
              no RSBSA registration still shows up here. Click a row with a
              registration on file to open its full history.
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
                {DUMANGAS_BARANGAYS.map((barangay) => (
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
                <option value="owner">Registered Owner</option>
                <option value="tenant">Tenant</option>
                <option value="lessee">Lessee</option>
              </select>

              <button
                className="jo-land-history-report-btn"
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>

              <div className="jo-land-history-report-print-dropdown">
                <button
                  className="jo-land-history-report-btn primary"
                  disabled={parcelRows.length === 0}
                >
                  Print Report ▾
                </button>
                <div className="jo-land-history-report-print-menu">
                  <button onClick={() => handlePrint("all")}>All Records</button>
                  <button onClick={() => handlePrint("owner")}>Registered Owners Only</button>
                  <button onClick={() => handlePrint("tenant")}>Tenants Only</button>
                  <button onClick={() => handlePrint("lessee")}>Lessees Only</button>
                </div>
              </div>
            </div>

            <div className="jo-land-history-report-kpis">
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Total Plotted Parcels</span>
                <strong>{summary.totalPlottedParcels}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Tenant Parcels</span>
                <strong>{summary.tenantParcels}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Lessee Parcels</span>
                <strong>{summary.lesseeParcels}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card">
                <span className="label">No Registration on File</span>
                <strong>{summary.unregisteredParcels}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card wide">
                <span className="label">Total Area (ha, Page)</span>
                <strong>{summary.totalCurrentAreaHa.toFixed(2)}</strong>
              </div>
            </div>

            <div className="jo-land-history-report-page-meta">
              <span>
                Showing {parcelRows.length} parcels on this page ({pageStart}-
                {pageEnd} of {totalCount} parcels)
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
            ) : parcelRows.length === 0 ? (
              <div className="jo-land-history-report-state">
                {noRowsMessage}
              </div>
            ) : (
              <div className="jo-land-history-report-table-wrap">
                <table className="jo-land-history-report-table">
                  <thead>
                    <tr>
                      <th>Parcel</th>
                      <th>Owner</th>
                      <th>Farmer/Occupant</th>
                      <th>Role</th>
                      <th>Area (ha)</th>
                      <th>Last Change</th>
                      <th style={{ width: "100px", textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelRows.map((row, index) => {
                      const isClickable = !!row.parcelNumber;
                      return (
                        <tr
                          key={`${row.parcelNumber || "unknown"}-${index}`}
                          className={`jo-land-history-report-row ${isClickable ? "is-clickable" : ""}`}
                          role={isClickable ? "button" : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                          aria-label={
                            isClickable
                              ? `View history for parcel ${row.parcelNumber}`
                              : undefined
                          }
                          onClick={() =>
                            isClickable
                              ? openParcelHistoryModal(row.parcelNumber)
                              : undefined
                          }
                          onKeyDown={(event) =>
                            isClickable
                              ? handleReportRowKeyDown(event, row.parcelNumber)
                              : undefined
                          }
                        >
                          <td>{row.parcelNumber || "-"}</td>
                          <td>{row.occupantName}</td>
                          <td>{row.farmerName}</td>
                          <td>{row.roleLabel}</td>
                          <td>{row.currentAreaHa.toFixed(2)}</td>
                          <td>{formatDate(row.lastChangeDate)}</td>
                          <td style={{ textAlign: "center" }}>
                            {isClickable ? (
                              <button
                                className="jo-land-history-report-btn-view"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openParcelHistoryModal(row.parcelNumber!);
                                }}
                                title="View land history timeline"
                              >
                                👁️ View
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
        </div>
      </div>

      {parcelModalOpen && (
        <div
          className="jo-land-history-modal-overlay"
          role="presentation"
          onClick={closeParcelHistoryModal}
        >
          <div
            className="jo-land-history-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Parcel history"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="jo-land-history-modal-header">
              <div>
                <h2>Parcel {parcelModalParcelNumber || "-"}</h2>
                <p>
                  {parcelModalTimelineRows.length > 0 &&
                  parcelModalTimelineRows.some(
                    (r: any) => r._source === "rsbsa_farm_parcels",
                  )
                    ? "Showing RSBSA registration record (no transfer history on file)."
                    : "History timeline for this parcel."}
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handlePrintTimeline}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.4)",
                    color: "white",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print Timeline
                </button>
                <button
                  className="jo-land-history-report-btn"
                  onClick={closeParcelHistoryModal}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="jo-land-history-modal-block">
              {parcelModalLoading ? (
                <div className="jo-land-history-report-state">
                  Loading parcel history...
                </div>
              ) : parcelModalError ? (
                <div className="jo-land-history-report-state error">
                  {parcelModalError}
                </div>
              ) : parcelModalTimelineRows.length === 0 ? (
                <div className="jo-land-history-report-state">
                  No history records found for this parcel.
                </div>
              ) : (
                <div className="jo-land-history-modal-split">
                  {/* ===== LEFT PANEL: Details ===== */}
                  <div className="jo-land-history-modal-details-panel">
                    <div className="jo-land-history-modal-detail-card">
                      <h3 className="jo-land-history-modal-detail-title">
                        <span className="jo-land-history-modal-detail-icon">
                          📋
                        </span>
                        Parcel Details
                      </h3>
                      <div className="jo-land-history-modal-detail-row">
                        <span className="jo-land-history-modal-detail-label">
                          Parcel No.
                        </span>
                        <span className="jo-land-history-modal-detail-value">
                          {parcelModalParcelNumber || "-"}
                        </span>
                      </div>
                      <div className="jo-land-history-modal-detail-row">
                        <span className="jo-land-history-modal-detail-label">
                          Barangay
                        </span>
                        <span className="jo-land-history-modal-detail-value">
                          {formatName(
                            selectedHistoryRow?.farm_location_barangay,
                          )}
                        </span>
                      </div>
                      <div className="jo-land-history-modal-detail-row">
                        <span className="jo-land-history-modal-detail-label">
                          Area (ha)
                        </span>
                        <span className="jo-land-history-modal-detail-value">
                          {selectedHistoryRow?.total_farm_area_ha != null
                            ? Number(
                                selectedHistoryRow.total_farm_area_ha,
                              ).toFixed(2)
                            : "-"}
                        </span>
                      </div>
                      <div className="jo-land-history-modal-detail-row">
                        <span className="jo-land-history-modal-detail-label">
                          Status
                        </span>
                        <span
                          className={`jo-land-history-modal-status-badge ${
                            selectedHistoryRow?.is_current
                              ? "is-current"
                              : "is-past"
                          }`}
                        >
                          {selectedHistoryRow?.is_current ? "Current" : "Past"}
                        </span>
                      </div>
                    </div>

                    <div className="jo-land-history-modal-detail-card">
                      <h3 className="jo-land-history-modal-detail-title">
                        <span className="jo-land-history-modal-detail-icon">
                          👤
                        </span>
                        Owner / Farmer Details
                      </h3>
                      <div className="jo-land-history-modal-detail-row">
                        <span className="jo-land-history-modal-detail-label">
                          Owner
                        </span>
                        <span className="jo-land-history-modal-detail-value">
                          {formatName(selectedHistoryRow?.land_owner_name)}
                        </span>
                      </div>
                      <div className="jo-land-history-modal-detail-row">
                        <span className="jo-land-history-modal-detail-label">
                          Farmer
                        </span>
                        <span className="jo-land-history-modal-detail-value">
                          {formatName(selectedHistoryRow?.farmer_name)}
                        </span>
                      </div>
                      <div className="jo-land-history-modal-detail-row">
                        <span className="jo-land-history-modal-detail-label">
                          Role
                        </span>
                        <span className="jo-land-history-modal-detail-value jo-land-history-modal-role-chip">
                          {selectedHistoryRow
                            ? getFarmingRoleLabel(selectedHistoryRow)
                            : "-"}
                        </span>
                      </div>
                      {selectedHistoryRow?.period_start_date && (
                        <div className="jo-land-history-modal-detail-row">
                          <span className="jo-land-history-modal-detail-label">
                            Period Start
                          </span>
                          <span className="jo-land-history-modal-detail-value">
                            {formatDate(selectedHistoryRow.period_start_date)}
                          </span>
                        </div>
                      )}
                      {selectedHistoryRow?.period_end_date && (
                        <div className="jo-land-history-modal-detail-row">
                          <span className="jo-land-history-modal-detail-label">
                            Period End
                          </span>
                          <span className="jo-land-history-modal-detail-value">
                            {formatDate(selectedHistoryRow.period_end_date)}
                          </span>
                        </div>
                      )}
                    </div>

                    {selectedHistoryRow?.change_reason && (
                      <div className="jo-land-history-modal-detail-card">
                        <h3 className="jo-land-history-modal-detail-title">
                          <span className="jo-land-history-modal-detail-icon">
                            📝
                          </span>
                          Change Reason
                        </h3>
                        <p className="jo-land-history-modal-reason-text">
                          {selectedHistoryRow.change_reason}
                        </p>
                      </div>
                    )}

                  </div>

                  {/* ===== RIGHT PANEL: Timeline ===== */}
                  <div className="jo-land-history-modal-timeline-panel">
                    {/* Map Preview Card */}
                    <div className="jo-land-history-modal-detail-card" style={{ padding: "16px", marginBottom: "20px" }}>
                      <h3 className="jo-land-history-modal-detail-title" style={{ marginBottom: "12px" }}>
                        <span className="jo-land-history-modal-detail-icon">
                          🗺️
                        </span>
                        Map Preview
                      </h3>
                      <ParcelGeometryPreview
                        geometry={parcelGeometry}
                        parcelLabel={parcelModalParcelNumber || "Parcel"}
                      />
                    </div>

                    <h3 className="jo-land-history-modal-timeline-heading">
                      Timeline
                    </h3>
                    <p className="jo-land-history-modal-timeline-subtitle">
                      {parcelModalTimelineRows.length} history{" "}
                      {parcelModalTimelineRows.length === 1
                        ? "record"
                        : "records"}{" "}
                      — click an entry to view its details
                    </p>
                    <ul className="jo-land-history-modal-timeline-list">
                      {parcelModalTimelineRows.map((row, idx) => {
                        const { dotClass } = getChangeTypeColor(
                          row.change_type,
                        );
                        const isSelected = selectedHistoryRow?.id === row.id;
                        const isLast =
                          idx === parcelModalTimelineRows.length - 1;

                        return (
                          <li
                            key={`timeline-${row.id}`}
                            className={`jo-land-history-modal-tl-item ${
                              isSelected ? "selected" : ""
                            } ${isLast ? "is-last" : ""}`}
                            onClick={() => setSelectedHistoryRow(row)}
                            role="button"
                            tabIndex={0}
                            aria-label={`View details for ${
                              row.change_type || "change"
                            } on ${formatDate(getRowEventDate(row))}`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedHistoryRow(row);
                              }
                            }}
                          >
                            <div className="jo-land-history-modal-tl-rail">
                              <div
                                className={`jo-land-history-modal-tl-dot ${dotClass}`}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                              {!isLast && (
                                <div className="jo-land-history-modal-tl-line" />
                              )}
                            </div>
                            <div className="jo-land-history-modal-tl-content">
                              <div className="jo-land-history-modal-tl-header">
                                <strong className="jo-land-history-modal-tl-title">
                                  {String(row.change_type || "Record")}
                                </strong>
                                {row.is_current && (
                                  <span className="jo-land-history-modal-tl-current-badge">
                                    Current
                                  </span>
                                )}
                              </div>
                              <span className="jo-land-history-modal-tl-date">
                                {formatDate(getRowEventDate(row))}
                              </span>
                              <p className="jo-land-history-modal-tl-desc">
                                {row.change_reason
                                  ? row.change_reason
                                  : "No additional details"}
                              </p>
                              <div className="jo-land-history-modal-tl-meta">
                                <span>
                                  {formatName(row.land_owner_name)} →{" "}
                                  {formatName(row.farmer_name)}
                                </span>
                                <span className="jo-land-history-modal-tl-role">
                                  {getFarmingRoleLabel(row)}
                                </span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JoLandHistoryReport;
