import React, { useEffect, useMemo, useState } from "react";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  getLandHistoryBarangays,
  getLandHistoryParcelHistory,
  getLandHistoryReportRows,
} from "../../api";
import "../../assets/css/jo css/JoLandHistoryReport.css";
import JOSidebar from "../../components/layout/JOSidebar";

interface LandHistoryReportRow {
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
  id: number;
  parcelNumber: string | null;
  barangay: string;
  occupantName: string;
  farmerName: string;
  roleLabel: string;
  currentAreaHa: number;
  lastChangeDate: string | null;
  isCurrent: boolean;
}

const JoLandHistoryReport: React.FC = () => {
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
  const [parcelModalOpen, setParcelModalOpen] = useState(false);
  const [parcelModalParcelNumber, setParcelModalParcelNumber] = useState<
    string | null
  >(null);
  const [parcelModalRows, setParcelModalRows] = useState<
    LandHistoryReportRow[]
  >([]);
  const [parcelModalLoading, setParcelModalLoading] = useState(false);
  const [parcelModalError, setParcelModalError] = useState<string | null>(null);
  const [selectedHistoryRow, setSelectedHistoryRow] =
    useState<LandHistoryReportRow | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const formatName = (value?: string | null) =>
    String(value || "").trim() || "-";

  const getFarmingRoleLabel = (row: LandHistoryReportRow) => {
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
        currentOnly: true,
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

    setParcelModalRows((response.data as LandHistoryReportRow[]) || []);
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

  const getRowEventDate = (row: LandHistoryReportRow) =>
    row.period_start_date || row.created_at || row.period_end_date || null;

  const toSortableTimestamp = (value?: string | null) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parcelRows = useMemo<ParcelRow[]>(() => {
    return rows
      .filter((row) => row.is_current)
      .map((row) => ({
        id: row.id,
        parcelNumber: row.parcel_number
          ? String(row.parcel_number).trim()
          : null,
        barangay: formatName(row.farm_location_barangay),
        occupantName: formatName(row.land_owner_name),
        farmerName: formatName(row.farmer_name),
        roleLabel: getFarmingRoleLabel(row),
        currentAreaHa: Number(row.total_farm_area_ha) || 0,
        lastChangeDate: getRowEventDate(row),
        isCurrent: row.is_current,
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

  const summary = useMemo(() => {
    const tenantParcels = parcelRows.filter(
      (row) => row.roleLabel === "Tenant",
    ).length;

    const lesseeParcels = parcelRows.filter(
      (row) => row.roleLabel === "Lessee",
    ).length;

    const totalCurrentAreaHa = parcelRows.reduce(
      (sum, row) => sum + (Number(row.currentAreaHa) || 0),
      0,
    );

    return {
      totalHistoryRows: totalCount,
      parcelsOnPage: parcelRows.length,
      currentParcels: parcelRows.length,
      tenantParcels,
      lesseeParcels,
      totalCurrentAreaHa,
    };
  }, [parcelRows, totalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(totalCount, page * pageSize);

  const handleExportPdf = () => {
    if (parcelRows.length === 0) return;

    const relationshipLabelMap: Record<RelationshipFilter, string> = {
      all: "All Relationships",
      owner: "Registered Owner",
      tenant: "Tenant",
      lessee: "Lessee",
      tenantLessee: "Tenant + Lessee",
    };

    const activeFilterSummary = [
      `Search: ${searchTerm.trim() || "All"}`,
      `Barangay: ${barangayFilter === "all" ? "All Barangays" : barangayFilter}`,
      `Relationship: ${relationshipLabelMap[relationshipFilter]}`,
      `Date From: ${dateFrom ? formatDate(dateFrom) : "Any"}`,
      `Date To: ${dateTo ? formatDate(dateTo) : "Any"}`,
    ].join(" | ");

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    const generatedAt = new Date();
    const datePart = generatedAt.toISOString().slice(0, 10);

    doc.setFontSize(16);
    doc.text("Land History Report", 40, 40);
    doc.setFontSize(10);
    doc.text(`Generated: ${generatedAt.toLocaleString()}`, 40, 60);
    doc.text(
      `Page Snapshot: ${parcelRows.length} parcels shown (UI page ${page} of ${totalPages})`,
      40,
      76,
    );
    doc.text(activeFilterSummary, 40, 92, {
      maxWidth: 760,
    });

    autoTable(doc, {
      startY: 108,
      margin: { left: 40, right: 40 },
      headStyles: { fillColor: [27, 72, 120] },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: "linebreak",
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 140 },
        2: { cellWidth: 140 },
        3: { cellWidth: 80 },
        4: { cellWidth: 70, halign: "right" },
        5: { cellWidth: 80 },
        6: { cellWidth: 60 },
      },
      head: [
        [
          "Parcel",
          "Occupant (Owner)",
          "Farmer",
          "Role",
          "Area (ha)",
          "Last Change",
          "Status",
        ],
      ],
      body: parcelRows.map((row) => [
        row.parcelNumber || "-",
        row.occupantName,
        row.farmerName,
        row.roleLabel,
        Number(row.currentAreaHa || 0).toFixed(2),
        formatDate(row.lastChangeDate),
        row.isCurrent ? "Active" : "Inactive",
      ]),
    });

    doc.save(`land-history-report-${datePart}.pdf`);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setBarangayFilter("all");
    setRelationshipFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const noRowsMessage = "No parcels found with the current filters.";

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
            <div className="tech-incent-mobile-title">Land History Report</div>
          </div>

          <div className="jo-land-history-report-header">
            <h1>Land History Report</h1>
            <p>
              Parcel-first view: one row per current parcel with occupant and
              farmer details. Click a row to open full parcel history.
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

              <button
                className="jo-land-history-report-btn primary"
                onClick={handleExportPdf}
                disabled={parcelRows.length === 0}
              >
                Export PDF
              </button>
            </div>

            <div className="jo-land-history-report-kpis">
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Current Parcels</span>
                <strong>{summary.currentParcels}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Tenant Parcels</span>
                <strong>{summary.tenantParcels}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Lessee Parcels</span>
                <strong>{summary.lesseeParcels}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card wide">
                <span className="label">Total Current Area (ha, Page)</span>
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
                      <th>Occupant (Owner)</th>
                      <th>Farmer</th>
                      <th>Role</th>
                      <th>Area (ha)</th>
                      <th>Last Change</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelRows.map((row, index) => (
                      <tr
                        key={`${row.parcelNumber || "unknown"}-${index}`}
                        className={`jo-land-history-report-row ${row.parcelNumber ? "is-clickable" : ""}`}
                        role={row.parcelNumber ? "button" : undefined}
                        tabIndex={row.parcelNumber ? 0 : undefined}
                        aria-label={
                          row.parcelNumber
                            ? `View history for parcel ${row.parcelNumber}`
                            : undefined
                        }
                        onClick={() =>
                          row.parcelNumber
                            ? openParcelHistoryModal(row.parcelNumber)
                            : undefined
                        }
                        onKeyDown={(event) =>
                          handleReportRowKeyDown(event, row.parcelNumber)
                        }
                      >
                        <td>{row.parcelNumber || "-"}</td>
                        <td>{row.occupantName}</td>
                        <td>{row.farmerName}</td>
                        <td>{row.roleLabel}</td>
                        <td>{row.currentAreaHa.toFixed(2)}</td>
                        <td>{formatDate(row.lastChangeDate)}</td>
                        <td>{row.isCurrent ? "Active" : "Inactive"}</td>
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
                <p>History timeline for this parcel.</p>
              </div>
              <button
                className="jo-land-history-report-btn"
                onClick={closeParcelHistoryModal}
              >
                ×
              </button>
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
