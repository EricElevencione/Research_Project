import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getRsbsaSubmissions, getFarmerHistory } from "../../api";
import JOSidebar from "../../components/layout/JOSidebar";
import FarmerHistoryModal from "../../components/FarmerHistory/FarmerHistoryModal";
import "../../assets/css/jo css/JoMasterlistStyle.css";
import { FaBars, FaSearch, FaPrint } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// JoFarmerHistory
//
// Masterlist-style page that lists all RSBSA farmers, matching the design
// and CSS classes of JoMasterlist.tsx perfectly.
//
// Features:
//   - Selection checkboxes in table header and each row.
//   - Multi-Record Bulk Printing: Print selected farmers' histories directly
//     from the list in one click (each history starts on a new page).
//   - Consolidated Farmer column (Avatar, Name, FFRS, Gender).
//   - Stacked Parcels/Area column (Parcels count + sum area) with sorting.
//   - Multi-role support: Displays multiple distinct pills side-by-side
//     (Owner, Tenant, Lessee) rather than a combined text.
//   - Explicit Action column with a "View Timeline 🕐" button.
// ─────────────────────────────────────────────────────────────────────────────

interface FarmerRow {
  id: number;
  name: string;
  barangay: string;
  ffrsCode: string;
  gender: string;
  status: string;
  archivedAt: string | null;
  isOwner: boolean;
  isTenant: boolean;
  isLessee: boolean;
  ownershipCategory: string | null;
  submittedAt: string | null;
  parcelCount: number;
  parcelArea: string;
}

type RoleFilter = "all" | "owner" | "tenantLessee";
type SortKey = "name" | "barangay" | "parcelArea" | "status" | "submittedAt";
type SortDir = "asc" | "desc";

// ── Helpers ────────────────────────────────────────────────────────────────

const getInitials = (name: string): string => {
  const parts = name.split(",").map((p) => p.trim());
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
};

const formatParcelArea = (parcelArea: string) => {
  const tokens = String(parcelArea || "").match(/-?\d+(?:\.\d+)?/g);
  if (tokens && tokens.length > 0) {
    const total = tokens.reduce((s, t) => {
      const n = Number(t);
      return s + (Number.isFinite(n) ? n : 0);
    }, 0);
    if (Number.isFinite(total) && total > 0)
      return `${total.toLocaleString(undefined, { minimumFractionDigits: total % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} ha`;
  }
  return parcelArea && parcelArea !== "—" ? parcelArea : "—";
};

const parseParcelAreaToNumber = (parcelArea: string): number => {
  const tokens = String(parcelArea || "").match(/-?\d+(?:\.\d+)?/g);
  if (!tokens) return 0;
  return tokens.reduce((s, t) => s + (Number(t) || 0), 0);
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : "—";
};

const renderRolePills = (row: FarmerRow) => {
  const pills = [];
  if (row.isOwner) {
    pills.push(
      <span
        key="owner"
        className="jo-masterlist-ownership-pill jo-masterlist-ownership-owner"
      >
        🏡 Owner
      </span>,
    );
  }
  if (row.isTenant) {
    pills.push(
      <span
        key="tenant"
        className="jo-masterlist-ownership-pill jo-masterlist-ownership-tenant"
      >
        🤝 Tenant
      </span>,
    );
  }
  if (row.isLessee) {
    pills.push(
      <span
        key="lessee"
        className="jo-masterlist-ownership-pill jo-masterlist-ownership-lessee"
      >
        📋 Lessee
      </span>,
    );
  }
  if (pills.length === 0) {
    pills.push(
      <span
        key="unknown"
        className="jo-masterlist-ownership-pill jo-masterlist-ownership-unknown"
      >
        —
      </span>,
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>{pills}</div>
  );
};

// ── Component ──────────────────────────────────────────────────────────────

const JoFarmerHistory: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data
  const [allFarmers, setAllFarmers] = useState<FarmerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selection
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(
    new Set(),
  );
  const [printingSelected, setPrintingSelected] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Modal
  const [modalFarmer, setModalFarmer] = useState<FarmerRow | null>(null);

  // Load farmers
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const res = await getRsbsaSubmissions();
      if (res.error) {
        setLoadError(res.error);
      } else if (res.data) {
        const rows: FarmerRow[] = (res.data as any[])
          .map((r) => {
            return {
              id: Number(r.id),
              name: r.farmerName || "Unknown",
              barangay: String(
                r._raw?.BARANGAY || r.farmerAddress?.split(",")[0] || "",
              ).trim(),
              ffrsCode: String(
                r._raw?.FFRS_CODE || r.referenceNumber || "",
              ).trim(),
              gender: String(r.gender || "").trim(),
              status: String(r.status || "").trim(),
              archivedAt: r.archived_at || null,
              isOwner: r.ownershipType?.registeredOwner === true,
              isTenant: r.ownershipType?.tenant === true,
              isLessee: r.ownershipType?.lessee === true,
              ownershipCategory: r.ownershipCategory || null,
              submittedAt: r.dateSubmitted || null,
              parcelCount: Number(r.parcelCount || 0),
              parcelArea: String(r.parcelArea || ""),
            } as FarmerRow;
          })
          .filter((f) => f.id > 0);
        setAllFarmers(rows);
      }
      setLoading(false);
    };
    load();
  }, []);

  const barangayOptions = useMemo(() => {
    const set = new Set(allFarmers.map((f) => f.barangay).filter(Boolean));
    return Array.from(set).sort();
  }, [allFarmers]);

  const displayed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let rows = allFarmers.filter((f) => {
      if (roleFilter === "owner" && !f.isOwner) return false;
      if (roleFilter === "tenantLessee" && !f.isTenant && !f.isLessee)
        return false;
      if (barangayFilter !== "all" && f.barangay !== barangayFilter)
        return false;
      if (statusFilter === "active" && f.archivedAt) return false;
      if (statusFilter === "archived" && !f.archivedAt) return false;
      if (q) {
        return (
          f.name.toLowerCase().includes(q) ||
          f.barangay.toLowerCase().includes(q) ||
          f.ffrsCode.toLowerCase().includes(q)
        );
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      // Prioritize active (non-archived) farmers at the top, and archived at the bottom
      const isArchivedA = !!a.archivedAt;
      const isArchivedB = !!b.archivedAt;
      if (isArchivedA !== isArchivedB) {
        return isArchivedA ? 1 : -1;
      }

      if (sortKey === "parcelArea") {
        const areaA = parseParcelAreaToNumber(a.parcelArea);
        const areaB = parseParcelAreaToNumber(b.parcelArea);
        return sortDir === "asc" ? areaA - areaB : areaB - areaA;
      }
      let valA = "",
        valB = "";
      switch (sortKey) {
        case "name":
          valA = a.name;
          valB = b.name;
          break;
        case "barangay":
          valA = a.barangay;
          valB = b.barangay;
          break;
        case "status":
          valA = a.status;
          valB = b.status;
          break;
        case "submittedAt":
          valA = a.submittedAt || "";
          valB = b.submittedAt || "";
          break;
      }
      const cmp = valA.localeCompare(valB);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [
    allFarmers,
    searchQuery,
    roleFilter,
    barangayFilter,
    statusFilter,
    sortKey,
    sortDir,
  ]);

  // Selection state helpers
  const allFilteredSelected = useMemo(() => {
    return (
      displayed.length > 0 &&
      displayed.every((f) => selectedRecordIds.has(f.id))
    );
  }, [displayed, selectedRecordIds]);

  const toggleSelectAllFiltered = useCallback(() => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        displayed.forEach((f) => next.delete(f.id));
      } else {
        displayed.forEach((f) => next.add(f.id));
      }
      return next;
    });
  }, [displayed, allFilteredSelected]);

  const toggleSelectRecord = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Multi-record printing logic
  const handlePrintSelected = useCallback(async () => {
    if (selectedRecordIds.size === 0) return;
    setPrintingSelected(true);

    try {
      const selectedIds = Array.from(selectedRecordIds);
      const fetchPromises = selectedIds.map((id) => getFarmerHistory(id));
      const results = await Promise.all(fetchPromises);

      const validRecords = results
        .map((res) => res.data)
        .filter((d): d is { profile: any; events: any[] } => !!d);

      if (validRecords.length === 0) {
        alert("No valid farmer histories could be retrieved.");
        setPrintingSelected(false);
        return;
      }

      const w = window.open("", "_blank");
      if (!w) {
        alert("Please allow popups to print reports.");
        setPrintingSelected(false);
        return;
      }

      const printPagesHtml = validRecords
        .map((rec, index) => {
          const { profile, events } = rec;
          const acts = [];
          if (profile.farmerRice) acts.push("Rice");
          if (profile.farmerCorn) acts.push("Corn");
          if (profile.farmerOtherCrops)
            acts.push(
              profile.farmerOtherCropsText
                ? `Crops (${profile.farmerOtherCropsText})`
                : "Other Crops",
            );
          if (profile.farmerLivestock)
            acts.push(
              profile.farmerLivestockText
                ? `Livestock (${profile.farmerLivestockText})`
                : "Livestock",
            );
          if (profile.farmerPoultry)
            acts.push(
              profile.farmerPoultryText
                ? `Poultry (${profile.farmerPoultryText})`
                : "Poultry",
            );

          const tableRows = events
            .map((ev) => {
              const o = ev.is_registered_owner,
                t = ev.is_tenant,
                l = ev.is_lessee;
              let roleStr = "Unknown";
              if (o && (t || l)) roleStr = "Owner-Farmer";
              else if (o) roleStr = "Owner";
              else if (t) roleStr = "Tenant";
              else if (l) roleStr = "Lessee";

              const dateStr = formatDate(ev.period_start_date || ev.created_at);
              const areaStr =
                ev.total_farm_area_ha != null
                  ? Number(ev.total_farm_area_ha).toFixed(2)
                  : "—";
              const ownerStr = ev.land_owner_name || "—";
              const startStr = formatDate(ev.period_start_date);
              const endStr = ev.period_end_date
                ? formatDate(ev.period_end_date)
                : "Present";
              const statusStr = ev.is_current ? "Current" : "Past";

              return `
                <tr>
                  <td>${dateStr}</td>
                  <td>${ev.parcel_number || "—"}</td>
                  <td>${ev.farm_location_barangay || "—"}</td>
                  <td>${areaStr}</td>
                  <td>${roleStr}</td>
                  <td>${ownerStr}</td>
                  <td>${startStr}</td>
                  <td>${endStr}</td>
                  <td>${statusStr}</td>
                </tr>
              `;
            })
            .join("");

          const isLast = index === validRecords.length - 1;
          const pageBreakHtml = isLast ? "" : '<div class="page-break"></div>';

          const uniqueParcels = new Set(
            events
              .map((e) => String(e.parcel_number || "").trim())
              .filter(Boolean),
          ).size;
          const current = events.filter((e) => e.is_current);
          const currentParcels = new Set(
            current
              .map((e) => String(e.parcel_number || "").trim())
              .filter(Boolean),
          ).size;
          const activeArea = current.reduce(
            (s, e) => s + (Number(e.total_farm_area_ha) || 0),
            0,
          );

          return `
            <div class="farmer-page">
              <div class="hdr">
                <div class="main-title">Republic of the Philippines</div>
                <div class="dept-title">Department of Agriculture</div>
                <div class="agency-title">Registry System for Basic Sectors in Agriculture (RSBSA)</div>
                <div class="report-title">Farmer Land Tenure History Report</div>
                <div class="sub-title">Municipality of Dumangas, Iloilo</div>
              </div>
              <div class="profile-card">
                <div class="profile-title">${profile.farmerName}</div>
                <div class="profile-meta">
                  <strong>FFRS Code:</strong> ${profile.ffrsCode || "—"} &nbsp;&nbsp;&nbsp;&nbsp;
                  <strong>Barangay:</strong> Brgy. ${profile.barangay || "—"} &nbsp;&nbsp;&nbsp;&nbsp;
                  <strong>Gender:</strong> ${profile.gender || "—"} &nbsp;&nbsp;&nbsp;&nbsp;
                  <strong>Livelihood:</strong> ${profile.mainLivelihood || "—"} ${acts.length > 0 ? `(${acts.join(", ")})` : ""}
                </div>
                <div class="profile-stats">
                  Total Parcels: <strong>${uniqueParcels}</strong> &nbsp;|&nbsp;
                  Current Parcels: <strong>${currentParcels}</strong> &nbsp;|&nbsp;
                  Active Area: <strong>${activeArea.toFixed(2)} ha</strong>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="width:12%">Date</th>
                    <th style="width:12%">Parcel No.</th>
                    <th style="width:12%">Barangay</th>
                    <th style="width:8%">Area (ha)</th>
                    <th style="width:10%">Role</th>
                    <th style="width:15%">Land Owner</th>
                    <th style="width:11%">Period Start</th>
                    <th style="width:11%">Period End</th>
                    <th style="width:9%">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows || '<tr><td colspan="9" style="text-align:center;">No land tenure records found.</td></tr>'}
                </tbody>
              </table>
              <div class="ftr">
                Farmer History Report — Dumangas, Iloilo · Printed by JO Staff · Page ${index + 1} of ${validRecords.length}
              </div>
            </div>
            ${pageBreakHtml}
          `;
        })
        .join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Farmer History Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page {
      size: auto;
      margin: 0mm;
    }
    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 9px;
      margin: 0;
      color: #1e293b;
      line-height: 1.4;
      background: #fff;
    }
    .farmer-page {
      padding: 12mm;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .hdr { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 8px; margin-bottom: 12px; }
    .main-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }
    .dept-title { font-size: 11px; font-weight: 700; color: #1e3a8a; }
    .agency-title { font-size: 9px; font-weight: 600; color: #475569; margin: 1px 0; }
    .report-title { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .sub-title { font-size: 10px; font-weight: 600; color: #64748b; }
    
    .profile-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .profile-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .profile-meta {
      font-size: 9px;
      color: #334155;
      margin-bottom: 4px;
    }
    .profile-stats {
      font-size: 9px;
      color: #64748b;
      font-weight: 500;
    }
    
    table { width: 100%; border-collapse: collapse; font-size: 8px; margin-top: 5px; }
    th { background: #059669; color: #fff; padding: 4px 6px; text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: .5px solid #e2e8f0; }
    td { padding: 3px 6px; border: .5px solid #e2e8f0; vertical-align: middle; color: #334155; }
    tr:nth-child(even) td { background: #f8fafc; }
    .ftr { margin-top: auto; padding-top: 10px; font-size: 8px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
    
    @media print {
      body { background: none; }
      .page-break {
        page-break-before: always;
        break-before: page;
      }
    }
  </style>
</head>
<body>
  ${printPagesHtml}
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

      w.document.write(html);
      w.document.close();
    } catch (err: any) {
      alert("Error printing reports: " + err.message);
    } finally {
      setPrintingSelected(false);
    }
  }, [selectedRecordIds]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDir === "asc" ? "▲" : "▼";
  };

  const isSortActive = (key: SortKey) => sortKey === key;

  return (
    <div className="jo-masterlist-page-container">
      <JOSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="jo-masterlist-page">
        <div className="jo-masterlist-main-content">
          {/* Header */}
          <div className="jo-masterlist-dashboard-header">
            <div>
              <h1 className="jo-masterlist-page-title">Farmer History</h1>
              <p className="jo-masterlist-page-subtitle">
                Select a farmer to view their complete land history and
                timeline.
              </p>
            </div>
          </div>

          <div
            className="jo-masterlist-status-card jo-masterlist-card-active"
            style={{ flex: "0 0 auto", minWidth: 150, maxWidth: 200 }}
          >
            <div className="jo-masterlist-card-icon">🌾</div>
            <div className="jo-masterlist-card-info">
              <span className="jo-masterlist-card-count">
                {loading ? "..." : displayed.length}
              </span>
              <span className="jo-masterlist-card-label">Farmers Listed</span>
            </div>
          </div>

          {/* Content Card */}
          <div className="jo-masterlist-content-card">
            {/* Filters */}
            <div className="jo-masterlist-filters-section">
              {/* Search */}
              <div className="jo-masterlist-filters-row-1">
                <div className="jo-masterlist-search-filter">
                  <input
                    type="text"
                    placeholder="Search name, barangay, or FFRS code…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="jo-masterlist-search-input"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Select Dropdowns */}
              <div className="jo-masterlist-filters-row-2">
                <div className="jo-masterlist-status-filter">
                  <select
                    className="jo-masterlist-status-select"
                    value={roleFilter}
                    onChange={(e) =>
                      setRoleFilter(e.target.value as RoleFilter)
                    }
                    disabled={loading}
                  >
                    <option value="all">All Roles</option>
                    <option value="owner">Owner</option>
                    <option value="tenantLessee">Tenant / Lessee</option>
                  </select>
                </div>

                <div className="jo-masterlist-status-filter">
                  <select
                    className="jo-masterlist-status-select"
                    value={barangayFilter}
                    onChange={(e) => setBarangayFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="all">All Barangays</option>
                    {barangayOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="jo-masterlist-status-filter">
                  <select
                    className="jo-masterlist-status-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {loadError && (
              <div className="jo-masterlist-error-cell">{loadError}</div>
            )}

            {/* Bulk Actions Toolbar */}
            {!loading && !loadError && selectedRecordIds.size > 0 && (
              <div className="jo-masterlist-bulk-toolbar">
                <span className="jo-masterlist-bulk-count">
                  {selectedRecordIds.size} farmer
                  {selectedRecordIds.size === 1 ? "" : "s"} selected
                </span>
                <div className="jo-masterlist-bulk-actions">
                  <button
                    className="jo-masterlist-bulk-btn"
                    onClick={handlePrintSelected}
                    disabled={printingSelected}
                  >
                    <FaPrint style={{ marginRight: 5 }} />
                    {printingSelected
                      ? "Preparing Reports..."
                      : "Print Selected Histories"}
                  </button>
                  <button
                    className="jo-masterlist-bulk-btn jo-masterlist-bulk-btn-clear"
                    onClick={() => setSelectedRecordIds(new Set())}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* Table Container */}
            <div className="jo-masterlist-table-container">
              {loading ? (
                <div className="jo-masterlist-loading-cell">
                  <div
                    className="fhp-spinner"
                    style={{ margin: "0 auto 10px" }}
                  />
                  Loading farmers list…
                </div>
              ) : displayed.length === 0 ? (
                <div className="jo-masterlist-empty-cell">
                  No farmers found.
                </div>
              ) : (
                <table className="jo-masterlist-farmers-table">
                  <thead>
                    <tr>
                      <th
                        className="jo-masterlist-checkbox-col"
                        style={{
                          background:
                            "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          padding: "10px 11px",
                          textAlign: "center",
                        }}
                      >
                        <input
                          type="checkbox"
                          className="jo-masterlist-header-checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          aria-label="Select all farmers"
                        />
                      </th>
                      <th>
                        <button
                          className={`jo-masterlist-sort-btn ${isSortActive("name") ? "is-active" : ""}`}
                          onClick={() => handleSort("name")}
                        >
                          Farmer <span>{getSortIndicator("name")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          className={`jo-masterlist-sort-btn ${isSortActive("barangay") ? "is-active" : ""}`}
                          onClick={() => handleSort("barangay")}
                        >
                          Barangay <span>{getSortIndicator("barangay")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          className={`jo-masterlist-sort-btn ${isSortActive("parcelArea") ? "is-active" : ""}`}
                          onClick={() => handleSort("parcelArea")}
                        >
                          Parcels / Area{" "}
                          <span>{getSortIndicator("parcelArea")}</span>
                        </button>
                      </th>
                      <th>Tenure Roles</th>
                      <th>
                        <button
                          className={`jo-masterlist-sort-btn ${isSortActive("status") ? "is-active" : ""}`}
                          onClick={() => handleSort("status")}
                        >
                          Status <span>{getSortIndicator("status")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          className={`jo-masterlist-sort-btn ${isSortActive("submittedAt") ? "is-active" : ""}`}
                          onClick={() => handleSort("submittedAt")}
                        >
                          Submitted{" "}
                          <span>{getSortIndicator("submittedAt")}</span>
                        </button>
                      </th>
                      <th
                        style={{
                          width: 150,
                          textAlign: "center",
                          color: "#fff",
                          textTransform: "uppercase",
                          fontSize: "11px",
                          fontWeight: "700",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((farmer, idx) => {
                      const isSelected = selectedRecordIds.has(farmer.id);
                      return (
                        <tr
                          key={farmer.id}
                          className={`jo-masterlist-table-row ${isSelected ? "jo-masterlist-row-selected" : ""}`}
                          onClick={() => setModalFarmer(farmer)}
                          style={
                            isSelected
                              ? { backgroundColor: "#f3fbf0" }
                              : undefined
                          }
                        >
                          <td
                            className="jo-masterlist-checkbox-col"
                            onClick={(e) => e.stopPropagation()}
                            style={{ textAlign: "center" }}
                          >
                            <input
                              type="checkbox"
                              className="jo-masterlist-row-checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                toggleSelectRecord(farmer.id, e as any)
                              }
                              aria-label={`Select ${farmer.name}`}
                            />
                          </td>
                          <td>
                            <div className="jo-masterlist-farmer-cell">
                              <div className="jo-masterlist-farmer-avatar">
                                {getInitials(farmer.name)}
                              </div>
                              <div className="jo-masterlist-farmer-meta">
                                <span className="jo-masterlist-farmer-name">
                                  {farmer.name}
                                </span>
                                <span className="jo-masterlist-farmer-ref">
                                  {farmer.ffrsCode || "No FFRS"} ·{" "}
                                  {farmer.gender || "—"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td
                            className="jo-masterlist-address-cell"
                            style={{
                              display: "table-cell",
                              verticalAlign: "middle",
                              alignItems: "unset",
                            }}
                          >
                            <span className="jo-masterlist-address-primary">
                              {farmer.barangay || "—"}
                            </span>
                          </td>
                          <td>
                            <div
                              className="jo-masterlist-parcel-cell"
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                gap: "3px",
                              }}
                            >
                              <span className="jo-masterlist-parcel-count">
                                {farmer.parcelCount} parcel
                                {farmer.parcelCount === 1 ? "" : "s"}
                              </span>
                              <span className="jo-masterlist-parcel-area">
                                {formatParcelArea(farmer.parcelArea)}
                              </span>
                            </div>
                          </td>
                          <td>{renderRolePills(farmer)}</td>
                          <td>
                            {farmer.archivedAt ? (
                              <span
                                className="jo-masterlist-status-pill jo-masterlist-status-not-approved"
                                style={{ border: "1px solid #f5c6cb" }}
                              >
                                Archived
                              </span>
                            ) : (
                              <span
                                className="jo-masterlist-status-pill jo-masterlist-status-approved"
                                style={{ border: "1px solid #c3e6cb" }}
                              >
                                Active
                              </span>
                            )}
                          </td>
                          <td className="jo-masterlist-date">
                            {formatDate(farmer.submittedAt)}
                          </td>
                          <td
                            className="jo-masterlist-actions-cell"
                            style={{ textAlign: "center" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="jo-masterlist-view-btn"
                              onClick={() => setModalFarmer(farmer)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {modalFarmer && (
        <FarmerHistoryModal
          submissionId={modalFarmer.id}
          farmerLabel={modalFarmer.name}
          onClose={() => setModalFarmer(null)}
        />
      )}
    </div>
  );
};

export default JoFarmerHistory;
