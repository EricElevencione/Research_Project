import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAdminDashboardStats,
  SubsidyStock,
} from "../../hooks/useAdminDashboardStats";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import {
  Package,
  Leaf,
  Droplets,
  Sprout,
  ChevronRight,
  Search,
  ArrowUpRight,
  Plus,
  Filter,
  BarChart3,
  History,
  FileDown,
  UserCheck,
  Printer,
  FileText,
} from "lucide-react";
import "../../assets/css/admin css/AdminViewAllocation.css";

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAllocationId, setSelectedAllocationId] = useState<
    number | undefined
  >(undefined);
  const dashData = useAdminDashboardStats(selectedAllocationId);

  const hybridKeywords = ["Jackpot", "US88", "TH82", "RH9000", "Mestiso"];
  const [activeTab, setActiveTab] = useState<
    "overview" | "seeds" | "ferts" | "traceability"
  >("overview");

  const categorizedData = useMemo(() => {
    const data = dashData.subsidyBreakdown;

    const result = {
      seeds: {
        hybrid: [] as SubsidyStock[],
        inbred: [] as SubsidyStock[],
        all: [] as SubsidyStock[],
      },
      fertilizers: {
        solid: [] as SubsidyStock[],
        liquid: [] as SubsidyStock[],
        all: [] as SubsidyStock[],
      },
    };

    data.forEach((item) => {
      const name = item.name.toLowerCase();

      const isLiquid =
        name.includes("liquid") ||
        name.includes("liters") ||
        name.includes("foliar") ||
        name.includes("biofertilizer");
      const isFertilizer =
        name.includes("urea") ||
        name.includes("complete") ||
        name.includes("sulfate") ||
        name.includes("potash") ||
        name.includes("manure") ||
        name.includes("compost") ||
        isLiquid;

      if (isFertilizer) {
        result.fertilizers.all.push(item);
        if (isLiquid) {
          result.fertilizers.liquid.push(item);
        } else {
          result.fertilizers.solid.push(item);
        }
      } else {
        result.seeds.all.push(item);
        const isHybrid = hybridKeywords.some((keyword) =>
          item.name.toLowerCase().includes(keyword.toLowerCase()),
        );
        if (isHybrid) {
          result.seeds.hybrid.push(item);
        } else {
          result.seeds.inbred.push(item);
        }
      }
    });

    return result;
  }, [dashData.subsidyBreakdown]);

  const InventoryTable = ({
    title,
    items,
    icon,
    colorClass,
    showHeader = true,
    showCategory = false,
    categoryHeader = "Category",
  }: {
    title: string;
    items: SubsidyStock[];
    icon: React.ReactNode;
    colorClass: string;
    showHeader?: boolean;
    showCategory?: boolean;
    categoryHeader?: string;
  }) => (
    <div
      className={`inventory-category-card ${colorClass} ${!showHeader ? "no-header" : ""}`}
    >
      {showHeader && (
        <div className="inventory-category-header">
          <div className="inventory-category-icon">{icon}</div>
          <div className="inventory-category-title-group">
            <h3>{title}</h3>
            <span className="inventory-count">{items.length} Items</span>
          </div>
          <div className="inventory-category-actions">
            <button
              className="inventory-btn-mini"
              onClick={() => navigate("/admin-create-allocation")}
            >
              Add Stock
            </button>
          </div>
        </div>
      )}
      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Item Name</th>
              {showCategory && <th>{categoryHeader}</th>}
              <th>Allocated</th>
              <th>Requested</th>
              <th>Distributed</th>
              <th>Remaining</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={showCategory ? 7 : 6} className="inventory-empty">
                  No items found in this category
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const progress =
                  item.allocated > 0
                    ? (item.distributed / item.allocated) * 100
                    : 0;
                const isLow =
                  item.remaining > 0 && item.remaining < item.allocated * 0.15;
                const isOut = item.remaining === 0;

                let categoryLabel = "";
                if (showCategory) {
                  const name = item.name.toLowerCase();
                  const isFert =
                    name.includes("urea") ||
                    name.includes("complete") ||
                    name.includes("sulfate") ||
                    name.includes("potash") ||
                    name.includes("manure") ||
                    name.includes("compost") ||
                    name.includes("liquid") ||
                    name.includes("liters");

                  if (isFert) {
                    const isLiquid =
                      name.includes("liquid") ||
                      name.includes("liters") ||
                      name.includes("foliar") ||
                      name.includes("biofertilizer");
                    categoryLabel = isLiquid ? "Liquid" : "Solid";
                  } else {
                    const isHybrid = hybridKeywords.some((keyword) =>
                      item.name.toLowerCase().includes(keyword.toLowerCase()),
                    );
                    categoryLabel = isHybrid ? "Hybrid" : "Inbred";
                  }
                }

                return (
                  <tr key={idx} className="inventory-row-hover">
                    <td className="item-name-cell">
                      <div className="item-name-wrapper">
                        <span className={`item-dot ${colorClass}`}></span>
                        {item.name}
                      </div>
                    </td>
                    {showCategory && (
                      <td>
                        <span
                          className={`cat-badge ${categoryLabel.toLowerCase()}`}
                        >
                          {categoryLabel}
                        </span>
                      </td>
                    )}
                    <td>{item.allocated.toLocaleString()}</td>
                    <td className="requested-cell">
                      {item.requested.toLocaleString()}
                    </td>
                    <td>{item.distributed.toLocaleString()}</td>
                    <td
                      className={`remaining-cell ${isOut ? "out" : isLow ? "low" : ""}`}
                    >
                      <span className="stock-badge">
                        {item.remaining.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <div className="stock-indicator-wrapper">
                        <div className="stock-progress-bg">
                          <div
                            className="stock-progress-fill"
                            style={{
                              width: `${Math.min(100, progress)}%`,
                              background:
                                progress > 90
                                  ? "#ef4444"
                                  : progress > 70
                                    ? "#f59e0b"
                                    : "#16a34a",
                            }}
                          />
                        </div>
                        <span className="stock-pct">
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const InventoryCategoryCard = ({ title, items, icon, colorClass }: any) => (
    <InventoryTable
      title={title}
      items={items}
      icon={icon}
      colorClass={colorClass}
    />
  );

  const SearchCard = ({
    item,
    colorClass,
  }: {
    item: SubsidyStock;
    colorClass: string;
  }) => {
    const progress =
      item.allocated > 0 ? (item.distributed / item.allocated) * 100 : 0;
    const isLow = item.remaining > 0 && item.remaining < item.allocated * 0.15;
    const isOut = item.remaining === 0;

    return (
      <div
        className={`inventory-search-result-card ${colorClass} ${isOut ? "out" : isLow ? "low" : ""}`}
      >
        <div className="search-card-header">
          <div className="search-card-icon">
            {colorClass === "hybrid" || colorClass === "inbred" ? (
              <Sprout size={20} />
            ) : (
              <Droplets size={20} />
            )}
          </div>
          <div className="search-card-title-group">
            <h4>{item.name}</h4>
            <span className="search-card-category">
              {colorClass.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="search-card-stats">
          <div className="search-stat">
            <span className="search-stat-label">Remaining</span>
            <span className="search-stat-value">
              {item.remaining.toLocaleString()}
            </span>
          </div>
          <div className="search-stat">
            <span className="search-stat-label">Total Allocated</span>
            <span className="search-stat-value">
              {item.allocated.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="search-card-footer">
          <div className="search-progress-bar">
            <div
              className="search-progress-fill"
              style={{ width: `${Math.min(100, progress)}%` }}
            ></div>
          </div>
          <span className="search-progress-text">
            {progress.toFixed(0)}% Distributed
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-viewalloc-page-container">
      <div className="admin-viewalloc-page has-mobile-sidebar">
        <AdminSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="admin-viewalloc-main-content inventory-page-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <Package size={24} />
            </button>
            <div className="tech-incent-mobile-title">Inventory</div>
          </div>

          <div className="inventory-header">
            <div className="inventory-header-left">
              <h2 className="admin-viewalloc-title">Inventory Management</h2>
              <p className="admin-viewalloc-subtitle">
                Track and manage variety of fertilizers and seeds
              </p>
            </div>
            <div className="inventory-header-right">
              <div className="inventory-filter-group">
                <div className="inventory-select-wrapper">
                  <Package size={16} className="select-icon" />
                  <select
                    value={selectedAllocationId || ""}
                    onChange={(e) =>
                      setSelectedAllocationId(
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                    className="inventory-program-select"
                  >
                    <option value="">Master Inventory View</option>
                    {dashData.seasonComparison.map((alloc) => (
                      <option
                        key={alloc.allocationId}
                        value={alloc.allocationId}
                      >
                        {alloc.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                className="inventory-btn-print"
                onClick={() => window.print()}
              >
                <Printer size={18} />
                Print Report
              </button>
              <div className="inventory-search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search variety..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                className="inventory-btn-register"
                onClick={() => navigate("/manage-varieties")}
              >
                <Plus size={18} />
                Manage Varieties
              </button>
            </div>
          </div>

          <div className="inventory-tabs-container">
            <div className="inventory-tabs">
              <button
                className={`inventory-tab ${activeTab === "overview" ? "active" : ""}`}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
              <button
                className={`inventory-tab ${activeTab === "seeds" ? "active" : ""}`}
                onClick={() => setActiveTab("seeds")}
              >
                Seeds Variety
              </button>
              <button
                className={`inventory-tab ${activeTab === "ferts" ? "active" : ""}`}
                onClick={() => setActiveTab("ferts")}
              >
                Fertilizers Variety
              </button>
              <button
                className={`inventory-tab ${activeTab === "traceability" ? "active" : ""}`}
                onClick={() => setActiveTab("traceability")}
              >
                Traceability
              </button>
            </div>
          </div>

          {dashData.loading ? (
            <div className="admin-viewalloc-loading">
              <div className="spinner"></div>
              Loading inventory data...
            </div>
          ) : searchTerm ? (
            <div className="inventory-search-results">
              <h3 className="section-title">
                Search Results for "{searchTerm}"
              </h3>
              <div className="search-results-grid">
                {dashData.subsidyBreakdown.filter((item) =>
                  item.name.toLowerCase().includes(searchTerm.toLowerCase()),
                ).length === 0 ? (
                  <div className="no-results">
                    No varieties found matching your search.
                  </div>
                ) : (
                  dashData.subsidyBreakdown
                    .filter((item) =>
                      item.name
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()),
                    )
                    .map((item, idx) => {
                      const isFert =
                        item.name.toLowerCase().includes("urea") ||
                        item.name.toLowerCase().includes("complete") ||
                        item.name.toLowerCase().includes("liquid");
                      const colorClass = isFert
                        ? item.name.toLowerCase().includes("liquid")
                          ? "liquid"
                          : "solid"
                        : hybridKeywords.some((k) => item.name.includes(k))
                          ? "hybrid"
                          : "inbred";
                      return (
                        <SearchCard
                          key={idx}
                          item={item}
                          colorClass={colorClass}
                        />
                      );
                    })
                )}
              </div>
            </div>
          ) : (
            <div className="inventory-grid">
              {activeTab === "overview" && (
                <>
                  {!selectedAllocationId && (
                    <div className="inventory-summary-row">
                      <div className="inventory-stat-card">
                        <div className="stat-icon seeds">
                          <Sprout />
                        </div>
                        <div className="stat-info">
                          <span className="stat-label">Seeds Variety</span>
                          <span className="stat-value">
                            {categorizedData.seeds.all.length}
                          </span>
                        </div>
                      </div>
                      <div className="inventory-stat-card">
                        <div className="stat-icon ferts">
                          <Leaf />
                        </div>
                        <div className="stat-info">
                          <span className="stat-label">Fertilizer Variety</span>
                          <span className="stat-value">
                            {categorizedData.fertilizers.all.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedAllocationId ? (
                    <div className="inventory-report-view">
                      <div className="report-header-flex">
                        <h3 className="section-title">
                          Program Utilization Report
                        </h3>
                        <div className="report-date">
                          {new Date().toLocaleDateString()}
                        </div>
                      </div>

                      <div className="report-summary-grid">
                        <div className="report-stat-box">
                          <h4>Seeds Utilization</h4>
                          <div className="report-stat-main">
                            <span className="stat-big">
                              {categorizedData.seeds.all
                                .reduce((s, i) => s + i.distributed, 0)
                                .toLocaleString()}
                            </span>
                            <span className="stat-unit">KG Distributed</span>
                          </div>
                          <div className="report-stat-sub">
                            Out of{" "}
                            {categorizedData.seeds.all
                              .reduce((s, i) => s + i.allocated, 0)
                              .toLocaleString()}{" "}
                            KG Allocated
                          </div>
                        </div>

                        <div className="report-stat-box">
                          <h4>Fertilizer Utilization</h4>
                          <div className="report-stat-main">
                            <span className="stat-big">
                              {categorizedData.fertilizers.all
                                .reduce((s, i) => s + i.distributed, 0)
                                .toLocaleString()}
                            </span>
                            <span className="stat-unit">Bags/Liters Given</span>
                          </div>
                          <div className="report-stat-sub">
                            Out of{" "}
                            {categorizedData.fertilizers.all
                              .reduce((s, i) => s + i.allocated, 0)
                              .toLocaleString()}{" "}
                            Units Allocated
                          </div>
                        </div>
                      </div>

                      <div className="report-tables-section">
                        <InventoryTable
                          title="Seeds Distribution Report"
                          items={categorizedData.seeds.all}
                          icon={<Sprout />}
                          colorClass="hybrid"
                          showCategory={true}
                          categoryHeader="Variety"
                        />
                        <InventoryTable
                          title="Fertilizers Distribution Report"
                          items={categorizedData.fertilizers.all}
                          icon={<Leaf />}
                          colorClass="solid"
                          showCategory={true}
                          categoryHeader="Variety"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="inventory-master-view">
                      <div className="section-header-flex">
                        <h3 className="section-title">
                          Master Variety Catalog
                        </h3>
                      </div>
                      <div className="report-tables-section">
                        <div className="category-row">
                          <InventoryCategoryCard
                            title="Hybrid Seeds"
                            items={categorizedData.seeds.hybrid}
                            icon={<Sprout />}
                            colorClass="hybrid"
                          />
                          <InventoryCategoryCard
                            title="Inbred Seeds"
                            items={categorizedData.seeds.inbred}
                            icon={<Sprout />}
                            colorClass="inbred"
                          />
                        </div>
                        <div className="category-row">
                          <InventoryCategoryCard
                            title="Solid Fertilizers"
                            items={categorizedData.fertilizers.solid}
                            icon={<Leaf />}
                            colorClass="solid"
                          />
                          <InventoryCategoryCard
                            title="Liquid Fertilizers"
                            items={categorizedData.fertilizers.liquid}
                            icon={<Leaf />}
                            colorClass="liquid"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === "seeds" && (
                <div className="inventory-section fade-in">
                  <div className="section-header-flex">
                    <h3 className="section-title">All Seeds Inventory</h3>
                    <div className="section-actions">
                      <span className="section-header-hint">
                        {categorizedData.seeds.all.length} Varieties Found
                      </span>
                    </div>
                  </div>
                  <div className="full-width-inventory">
                    <InventoryTable
                      title="Seeds Catalog"
                      items={categorizedData.seeds.all}
                      icon={<Sprout />}
                      colorClass="hybrid"
                      showHeader={false}
                      showCategory={true}
                      categoryHeader="Variety"
                    />
                  </div>
                </div>
              )}

              {activeTab === "ferts" && (
                <div className="inventory-section fade-in">
                  <div className="section-header-flex">
                    <h3 className="section-title">All Fertilizers Inventory</h3>
                    <div className="section-actions">
                      <span className="section-header-hint">
                        {categorizedData.fertilizers.all.length} Varieties Found
                      </span>
                    </div>
                  </div>
                  <div className="full-width-inventory">
                    <InventoryTable
                      title="Fertilizers Catalog"
                      items={categorizedData.fertilizers.all}
                      icon={<Leaf />}
                      colorClass="solid"
                      showHeader={false}
                      showCategory={true}
                      categoryHeader="Variety"
                    />
                  </div>
                </div>
              )}

              {activeTab === "traceability" && (
                <div className="inventory-section fade-in">
                  <div className="section-header-flex">
                    <div className="header-with-icon">
                      <History className="header-icon-main" />
                      <h3 className="section-title">
                        Farmer Distribution Log (Traceability)
                      </h3>
                    </div>
                  </div>

                  <div className="traceability-table-container">
                    <table className="inventory-table traceability-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Farmer Name</th>
                          <th>Barangay</th>
                          {!selectedAllocationId && <th>Program/Allocation</th>}
                          <th>Items Received</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashData.traceabilityLog.length === 0 ? (
                          <tr>
                            <td
                              colSpan={selectedAllocationId ? 5 : 6}
                              className="inventory-empty"
                            >
                              No distribution records found.
                            </td>
                          </tr>
                        ) : (
                          dashData.traceabilityLog.map((log) => (
                            <tr key={log.id} className="inventory-row-hover">
                              <td className="date-cell">
                                {new Date(log.date).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </td>
                              <td className="farmer-name-cell">
                                <div className="farmer-info-wrapper">
                                  <UserCheck
                                    size={14}
                                    className="farmer-icon"
                                  />
                                  {log.farmerName}
                                </div>
                              </td>
                              <td>{log.barangay}</td>
                              {!selectedAllocationId && (
                                <td>
                                  <span className="program-badge">
                                    {log.program}
                                  </span>
                                </td>
                              )}
                              <td className="items-cell">{log.items}</td>
                              <td>
                                <span
                                  className={`status-badge ${log.status.toLowerCase().replace(/[^a-z]/g, "-")}`}
                                >
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── PRINTABLE REPORT OVERLAY (HIDDEN ON SCREEN) ──────────────── */}
      <div className="printable-report-root">
        <div className="print-report-header">
          <div className="print-logo-section">
            <img
              src="/logo.png"
              alt="Logo"
              className="print-logo"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <div className="print-header-text">
              <h2>Republic of the Philippines</h2>
              <h3>Department of Agriculture</h3>
              <h4>Office of the Municipal Agriculturist</h4>
            </div>
          </div>
          <div className="print-report-info">
            <h1>INVENTORY & DISTRIBUTION REPORT</h1>
            <p className="print-report-meta">
              <span>
                Program:{" "}
                <strong>
                  {selectedAllocationId
                    ? dashData.seasonComparison.find(
                        (a) => a.allocationId === selectedAllocationId,
                      )?.label
                    : "Master Inventory View"}
                </strong>
              </span>
              <span>
                Generated: <strong>{new Date().toLocaleDateString()}</strong>
              </span>
            </p>
          </div>
        </div>

        <div className="print-report-summary">
          <div className="print-summary-box">
            <h4>Seeds Utilization</h4>
            <div className="print-summary-stat">
              <span className="val">
                {categorizedData.seeds.all
                  .reduce((s, i) => s + i.distributed, 0)
                  .toLocaleString()}
              </span>
              <span className="unit">KG</span>
            </div>
            <p>
              Total Distributed of{" "}
              {categorizedData.seeds.all
                .reduce((s, i) => s + i.allocated, 0)
                .toLocaleString()}{" "}
              KG Allocated
            </p>
          </div>
          <div className="print-summary-box">
            <h4>Fertilizer Utilization</h4>
            <div className="print-summary-stat">
              <span className="val">
                {categorizedData.fertilizers.all
                  .reduce((s, i) => s + i.distributed, 0)
                  .toLocaleString()}
              </span>
              <span className="unit">Bags/Liters</span>
            </div>
            <p>
              Total Given of{" "}
              {categorizedData.fertilizers.all
                .reduce((s, i) => s + i.allocated, 0)
                .toLocaleString()}{" "}
              Units Allocated
            </p>
          </div>
        </div>

        <div className="print-section">
          <h3>Detailed Inventory Breakdown</h3>
          <table className="print-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Allocated</th>
                <th>Distributed</th>
                <th>Remaining</th>
                <th>Usage %</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...categorizedData.seeds.all,
                ...categorizedData.fertilizers.all,
              ].map((item, idx) => (
                <tr key={idx}>
                  <td>{item.name}</td>
                  <td>
                    {item.name.toLowerCase().includes("urea") ||
                    item.name.toLowerCase().includes("bags")
                      ? "Fertilizer"
                      : "Seeds"}
                  </td>
                  <td>{item.allocated.toLocaleString()}</td>
                  <td>{item.distributed.toLocaleString()}</td>
                  <td>{item.remaining.toLocaleString()}</td>
                  <td>
                    {Math.round(
                      (item.distributed / (item.allocated || 1)) * 100,
                    )}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="print-section page-break">
          <h3>Farmer Distribution Traceability Log</h3>
          <table className="print-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Farmer Name</th>
                <th>Barangay</th>
                <th>Items Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dashData.traceabilityLog.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.date).toLocaleDateString()}</td>
                  <td>{log.farmerName}</td>
                  <td>{log.barangay}</td>
                  <td>{log.items}</td>
                  <td>{log.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="print-footer">
          <div className="print-signature-row">
            <div className="sig-box">
              <div className="sig-line"></div>
              <p>Prepared By</p>
              <span>Inventory Clerk / Admin Staff</span>
            </div>
            <div className="sig-box">
              <div className="sig-line"></div>
              <p>Verified By</p>
              <span>Municipal Agriculturist</span>
            </div>
          </div>
          <p className="print-confidential">
            This is an automated system-generated report. Printed on{" "}
            {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;
