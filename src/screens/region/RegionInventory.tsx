import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAdminDashboardStats,
  SubsidyStock,
  ExcessInventoryItem,
} from "../../hooks/useAdminDashboardStats";
import RegionSidebar from "../../components/layout/RegionSidebar";
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

import "../../assets/css/region css/RegionInventoryStyle.css";

const RegionInventory: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAllocationId, setSelectedAllocationId] = useState<
    number | undefined
  >(undefined);
  const dashData = useAdminDashboardStats(selectedAllocationId);

  const hybridKeywords = ["Jackpot", "US88", "TH82", "RH9000", "Mestiso"];
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "region-inv-seeds"
    | "region-inv-ferts"
    | "traceability"
    | "excess"
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
        name.includes("region-inv-liquid") ||
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
      className={`region-inv-category-card ${colorClass} ${!showHeader ? "region-inv-no-header" : ""}`}
    >
      {showHeader && (
        <div className="region-inv-category-header">
          <div className="region-inv-category-icon">{icon}</div>
          <div className="region-inv-category-title-group">
            <h3>{title}</h3>
            <span className="region-inv-count">{items.length} Items</span>
          </div>
          <div className="inventory-category-actions">
            <button
              className="region-inv-btn-mini"
              onClick={() => navigate("/admin-create-allocation")}
            >
              Add Stock
            </button>
          </div>
        </div>
      )}
      <div className="region-region-inv-table-container">
        <table className="region-inventory-farmers-table">
          <thead>
            <tr>
              <th>Item Name</th>
              {showCategory && <th>{categoryHeader}</th>}
              <th>Total Stock</th>
              <th>Requested</th>
              <th>Used</th>
              <th>Current Stock</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={showCategory ? 7 : 6} className="region-inv-empty">
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
                    name.includes("region-inv-liquid") ||
                    name.includes("liters");

                  if (isFert) {
                    const isLiquid =
                      name.includes("region-inv-liquid") ||
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
                  <tr key={idx} className="region-region-inv-table-row">
                    <td className="region-inv-item-name-cell">
                      <div className="region-inv-item-name-wrapper">
                        <span
                          className={`region-inv-item-dot ${colorClass}`}
                        ></span>
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
                    <td className="region-inv-requested-cell">
                      {item.requested.toLocaleString()}
                    </td>
                    <td>{item.distributed.toLocaleString()}</td>
                    <td
                      className={`region-inv-remaining-cell ${isOut ? "out" : isLow ? "low" : ""}`}
                    >
                      {isOut ? (
                        <span
                          className="region-inv-stock-badge out"
                          style={{
                            background: "#ef4444",
                            color: "#fff",
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.85rem",
                          }}
                        >
                          ⚠ 0 — Out of Stock
                        </span>
                      ) : (
                        <span className="region-inv-stock-badge">
                          {item.remaining.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="region-inv-stock-indicator-wrapper">
                        <div className="region-inv-stock-progress-bg">
                          <div
                            className="region-inv-stock-progress-fill"
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
                        <span className="region-inv-stock-pct">
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
        className={`region-inv-search-result-card ${colorClass} ${isOut ? "out" : isLow ? "low" : ""}`}
      >
        <div className="region-inv-search-card-header">
          <div className="region-inv-search-card-icon">
            {colorClass === "region-inv-hybrid" ||
            colorClass === "region-inv-inbred" ? (
              <Sprout size={20} />
            ) : (
              <Droplets size={20} />
            )}
          </div>
          <div className="region-inv-search-card-title-group">
            <h4>{item.name}</h4>
            <span className="region-inv-search-card-category">
              {colorClass.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="region-inv-search-card-stats">
          <div className="region-inv-search-stat">
            <span className="search-region-inv-stat-label">Current Stock</span>
            <span className="search-region-inv-stat-value">
              {item.remaining.toLocaleString()}
            </span>
          </div>
          <div className="region-inv-search-stat">
            <span className="search-region-inv-stat-label">Total Stock</span>
            <span className="search-region-inv-stat-value">
              {item.allocated.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="region-inv-search-card-footer">
          <div className="region-inv-search-progress-bar">
            <div
              className="region-inv-search-progress-fill"
              style={{ width: `${Math.min(100, progress)}%` }}
            ></div>
          </div>
          <span className="region-inv-search-progress-text">
            {progress.toFixed(0)}% Distributed
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="region-inventory-page-container">
      <div className="region-inventory-page has-mobile-sidebar">
        <RegionSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="region-inventory-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <Package size={24} />
            </button>
            <div className="tech-incent-mobile-title">Inventory</div>
          </div>

          {/* Page header */}
          <div className="region-inventory-dashboard-header">
            <div>
              <h1 className="region-inventory-page-title">
                Inventory Management
              </h1>
              <p className="region-inventory-page-subtitle">
                Track and manage variety of fertilizers and seeds in
                Municipality of Dumangas, Iloilo
              </p>
            </div>
          </div>

          {/* Filters */}
          <div
            className="region-inventory-content-card"
            style={{ flex: "none", marginBottom: "5px", padding: "12px 16px" }}
          >
            <div className="region-inventory-filters-section">
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Search variety..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="region-inventory-search-input"
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ width: "240px" }}>
                  <select
                    value={selectedAllocationId || ""}
                    onChange={(e) =>
                      setSelectedAllocationId(
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                    className="region-inventory-status-select"
                    style={{ width: "100%" }}
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
            </div>
          </div>

          {/* Print toolbar */}
          <div
            className="region-inventory-bulk-toolbar"
            style={{ margin: "5px 0 10px" }}
          >
            <div className="region-inventory-bulk-actions">
              <button
                className="region-inventory-bulk-btn"
                onClick={() => window.print()}
              >
                🖨️ Print Report
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
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="inventory-btn-register"
                  onClick={() => navigate("/region-add-stock")}
                  style={{ background: "#10b981" }}
                >
                  <Plus size={18} />
                  Add Stock
                </button>
                <button
                  className="inventory-btn-register"
                  onClick={() => navigate("/region-manage-varieties")}
                >
                  <Plus size={18} />
                  Manage Varieties
                </button>
              </div>
            </div>
          </div>

          <div className="region-inv-tabs-container">
            <div className="region-inv-tabs">
              <button
                className={`region-inv-tab ${activeTab === "overview" ? "active" : ""}`}
                onClick={() => setActiveTab("overview")}
              >
                <BarChart3 size={16} />
                Overview
              </button>
              <button
                className={`region-inv-tab ${activeTab === "region-inv-seeds" ? "active" : ""}`}
                onClick={() => setActiveTab("region-inv-seeds")}
              >
                <Sprout size={16} />
                Seeds Variety
              </button>
              <button
                className={`region-inv-tab ${activeTab === "region-inv-ferts" ? "active" : ""}`}
                onClick={() => setActiveTab("region-inv-ferts")}
              >
                <Leaf size={16} />
                Fertilizers Variety
              </button>
              <button
                className={`inventory-tab ${activeTab === "traceability" ? "active" : ""}`}
                onClick={() => setActiveTab("traceability")}
              >
                Traceability
              </button>
              <button
                className={`region-inv-tab ${activeTab === "excess" ? "active" : ""}`}
                onClick={() => setActiveTab("excess")}
              >
                <Package size={16} />
                Unused
                {dashData.excessInventory.length > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      background: "#ef4444",
                      color: "#fff",
                      borderRadius: "9999px",
                      padding: "1px 7px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {dashData.excessInventory.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {dashData.loading ? (
            <div className="admin-viewalloc-loading">
              <div className="spinner"></div>
              Loading inventory data...
            </div>
          ) : searchTerm ? (
            <div className="region-inv-search-results">
              <h3 className="region-inv-section-title">
                Search Results for "{searchTerm}"
              </h3>
              <div className="region-inv-search-results-grid">
                {dashData.subsidyBreakdown.filter((item) =>
                  item.name.toLowerCase().includes(searchTerm.toLowerCase()),
                ).length === 0 ? (
                  <div className="region-inv-no-results">
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
                        item.name.toLowerCase().includes("region-inv-liquid");
                      const colorClass = isFert
                        ? item.name.toLowerCase().includes("region-inv-liquid")
                          ? "region-inv-liquid"
                          : "region-inv-solid"
                        : hybridKeywords.some((k) => item.name.includes(k))
                          ? "region-inv-hybrid"
                          : "region-inv-inbred";
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
                    <div className="region-inv-summary-row">
                      <div className="region-inv-stat-card">
                        <div className="region-inv-stat-icon region-inv-seeds">
                          <Sprout />
                        </div>
                        <div className="region-inv-stat-info">
                          <span className="region-inv-stat-label">
                            Seeds Variety
                          </span>
                          <span className="region-inv-stat-value">
                            {categorizedData.seeds.all.length}
                          </span>
                        </div>
                      </div>
                      <div className="region-inv-stat-card">
                        <div className="region-inv-stat-icon region-inv-ferts">
                          <Leaf />
                        </div>
                        <div className="region-inv-stat-info">
                          <span className="region-inv-stat-label">
                            Fertilizer Variety
                          </span>
                          <span className="region-inv-stat-value">
                            {categorizedData.fertilizers.all.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedAllocationId ? (
                    <div className="region-inv-report-view">
                      <div className="region-inv-report-header-flex">
                        <h3 className="region-inv-section-title">
                          Program Utilization Report
                        </h3>
                        <div className="region-inv-report-date">
                          {new Date().toLocaleDateString()}
                        </div>
                      </div>

                      <div className="region-inv-report-summary-grid">
                        <div className="region-inv-report-stat-box">
                          <h4>Seeds Utilization</h4>
                          <div className="region-inv-report-stat-main">
                            <span className="region-inv-stat-big">
                              {categorizedData.seeds.all
                                .reduce((s, i) => s + i.distributed, 0)
                                .toLocaleString()}
                            </span>
                            <span className="region-inv-stat-unit">
                              KG Distributed
                            </span>
                          </div>
                          <div className="region-inv-report-stat-sub">
                            Out of{" "}
                            {categorizedData.seeds.all
                              .reduce((s, i) => s + i.allocated, 0)
                              .toLocaleString()}{" "}
                            KG Allocated
                          </div>
                        </div>

                        <div className="region-inv-report-stat-box">
                          <h4>Fertilizer Utilization</h4>
                          <div className="region-inv-report-stat-main">
                            <span className="region-inv-stat-big">
                              {categorizedData.fertilizers.all
                                .reduce((s, i) => s + i.distributed, 0)
                                .toLocaleString()}
                            </span>
                            <span className="region-inv-stat-unit">
                              Bags/Liters Given
                            </span>
                          </div>
                          <div className="region-inv-report-stat-sub">
                            Out of{" "}
                            {categorizedData.fertilizers.all
                              .reduce((s, i) => s + i.allocated, 0)
                              .toLocaleString()}{" "}
                            Units Allocated
                          </div>
                        </div>
                      </div>

                      <div className="region-inv-report-tables-section">
                        <InventoryTable
                          title="Seeds Distribution Report"
                          items={categorizedData.seeds.all}
                          icon={<Sprout />}
                          colorClass="region-inv-hybrid"
                          showCategory={true}
                          categoryHeader="Variety"
                        />
                        <InventoryTable
                          title="Fertilizers Distribution Report"
                          items={categorizedData.fertilizers.all}
                          icon={<Leaf />}
                          colorClass="region-inv-solid"
                          showCategory={true}
                          categoryHeader="Variety"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="inventory-master-view">
                      <div className="region-inv-section-header-flex">
                        <h3 className="region-inv-section-title">
                          Master Variety Catalog
                        </h3>
                      </div>
                      <div className="region-inv-report-tables-section">
                        <div className="region-inv-category-row">
                          <InventoryCategoryCard
                            title="Hybrid Seeds"
                            items={categorizedData.seeds.hybrid}
                            icon={<Sprout />}
                            colorClass="region-inv-hybrid"
                          />
                          <InventoryCategoryCard
                            title="Inbred Seeds"
                            items={categorizedData.seeds.inbred}
                            icon={<Sprout />}
                            colorClass="region-inv-inbred"
                          />
                        </div>
                        <div className="region-inv-category-row">
                          <InventoryCategoryCard
                            title="Solid Fertilizers"
                            items={categorizedData.fertilizers.solid}
                            icon={<Leaf />}
                            colorClass="region-inv-solid"
                          />
                          <InventoryCategoryCard
                            title="Liquid Fertilizers"
                            items={categorizedData.fertilizers.liquid}
                            icon={<Leaf />}
                            colorClass="region-inv-liquid"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === "region-inv-seeds" && (
                <div className="inventory-section region-inv-fade-in">
                  <div className="region-inv-section-header-flex">
                    <h3 className="region-inv-section-title">
                      All Seeds Inventory
                    </h3>
                    <div className="section-actions">
                      <span className="region-inv-section-header-hint">
                        {categorizedData.seeds.all.length} Varieties Found
                      </span>
                    </div>
                  </div>
                  <div className="full-width-inventory">
                    <InventoryTable
                      title="Seeds Catalog"
                      items={categorizedData.seeds.all}
                      icon={<Sprout />}
                      colorClass="region-inv-hybrid"
                      showHeader={false}
                      showCategory={true}
                      categoryHeader="Variety"
                    />
                  </div>
                </div>
              )}

              {activeTab === "region-inv-ferts" && (
                <div className="inventory-section region-inv-fade-in">
                  <div className="region-inv-section-header-flex">
                    <h3 className="region-inv-section-title">
                      All Fertilizers Inventory
                    </h3>
                    <div className="section-actions">
                      <span className="region-inv-section-header-hint">
                        {categorizedData.fertilizers.all.length} Varieties Found
                      </span>
                    </div>
                  </div>
                  <div className="full-width-inventory">
                    <InventoryTable
                      title="Fertilizers Catalog"
                      items={categorizedData.fertilizers.all}
                      icon={<Leaf />}
                      colorClass="region-inv-solid"
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

              {activeTab === "excess" && (
                <div className="inventory-section region-inv-fade-in">
                  <div className="region-inv-section-header-flex">
                    <div className="header-with-icon">
                      <Package className="header-icon-main" />
                      <h3 className="region-inv-section-title">
                        Unused Inventory from Closed Programs
                      </h3>
                    </div>
                    <span className="region-inv-section-header-hint">
                      {dashData.excessInventory.length} unused item(s) total
                    </span>
                  </div>

                  {dashData.excessInventory.length === 0 ? (
                    <div
                      className="admin-viewalloc-empty-state"
                      style={{ padding: "40px 20px", textAlign: "center" }}
                    >
                      <Package
                        size={40}
                        style={{ opacity: 0.3, marginBottom: 12 }}
                      />
                      <p style={{ color: "#94a3b8" }}>
                        No unused inventory. Close a program to see leftover
                        stocks here.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Fertilizers Excess */}
                      {dashData.excessInventory.filter(
                        (i) => i.category === "Fertilizer",
                      ).length > 0 && (
                        <div
                          className="region-inv-category-card solid"
                          style={{ marginBottom: 20 }}
                        >
                          <div className="region-inv-category-header">
                            <div className="region-inv-category-icon">
                              <Leaf size={20} />
                            </div>
                            <div className="region-inv-category-title-group">
                              <h3>Fertilizers (Unused)</h3>
                              <span className="region-inv-count">
                                {
                                  dashData.excessInventory.filter(
                                    (i) => i.category === "Fertilizer",
                                  ).length
                                }{" "}
                                Items
                              </span>
                            </div>
                          </div>
                          <div className="region-inv-table-container">
                            <table className="region-inv-table">
                              <thead>
                                <tr>
                                  <th>Item Name</th>
                                  <th>Sub-Category</th>
                                  <th>Unused Amount</th>
                                  <th>Source Program</th>
                                  <th>Closure Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dashData.excessInventory
                                  .filter((i) => i.category === "Fertilizer")
                                  .map((item, idx) => (
                                    <tr
                                      key={`fert-excess-${idx}`}
                                      className="region-inv-row-hover"
                                    >
                                      <td className="region-inv-item-name-cell">
                                        <div className="region-inv-item-name-wrapper">
                                          <span
                                            className={`region-inv-item-dot ${item.subCategory.toLowerCase()}`}
                                          ></span>
                                          {item.name}
                                        </div>
                                      </td>
                                      <td>
                                        <span
                                          className={`cat-badge ${item.subCategory.toLowerCase()}`}
                                        >
                                          {item.subCategory}
                                        </span>
                                      </td>
                                      <td style={{ fontWeight: 600 }}>
                                        {item.excessAmount.toLocaleString()}
                                      </td>
                                      <td>
                                        <span className="program-badge">
                                          {item.sourceProgram}
                                        </span>
                                      </td>
                                      <td className="date-cell">
                                        {item.closureDate
                                          ? new Date(
                                              item.closureDate,
                                            ).toLocaleDateString(undefined, {
                                              month: "short",
                                              day: "numeric",
                                              year: "numeric",
                                            })
                                          : "—"}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Seeds Excess */}
                      {dashData.excessInventory.filter(
                        (i) => i.category === "Seed",
                      ).length > 0 && (
                        <div
                          className="region-inv-category-card hybrid"
                          style={{ marginBottom: 20 }}
                        >
                          <div className="region-inv-category-header">
                            <div className="region-inv-category-icon">
                              <Sprout size={20} />
                            </div>
                            <div className="region-inv-category-title-group">
                              <h3>Seeds (Unused)</h3>
                              <span className="region-inv-count">
                                {
                                  dashData.excessInventory.filter(
                                    (i) => i.category === "Seed",
                                  ).length
                                }{" "}
                                Items
                              </span>
                            </div>
                          </div>
                          <div className="region-inv-table-container">
                            <table className="region-inv-table">
                              <thead>
                                <tr>
                                  <th>Item Name</th>
                                  <th>Sub-Category</th>
                                  <th>Unused Amount</th>
                                  <th>Source Program</th>
                                  <th>Closure Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dashData.excessInventory
                                  .filter((i) => i.category === "Seed")
                                  .map((item, idx) => (
                                    <tr
                                      key={`seed-excess-${idx}`}
                                      className="region-inv-row-hover"
                                    >
                                      <td className="region-inv-item-name-cell">
                                        <div className="region-inv-item-name-wrapper">
                                          <span
                                            className={`region-inv-item-dot ${item.subCategory.toLowerCase()}`}
                                          ></span>
                                          {item.name}
                                        </div>
                                      </td>
                                      <td>
                                        <span
                                          className={`cat-badge ${item.subCategory.toLowerCase()}`}
                                        >
                                          {item.subCategory}
                                        </span>
                                      </td>
                                      <td style={{ fontWeight: 600 }}>
                                        {item.excessAmount.toLocaleString()}
                                      </td>
                                      <td>
                                        <span className="program-badge">
                                          {item.sourceProgram}
                                        </span>
                                      </td>
                                      <td className="date-cell">
                                        {item.closureDate
                                          ? new Date(
                                              item.closureDate,
                                            ).toLocaleDateString(undefined, {
                                              month: "short",
                                              day: "numeric",
                                              year: "numeric",
                                            })
                                          : "—"}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
                <th>Total Stock</th>
                <th>Used</th>
                <th>Current Stock</th>
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

export default RegionInventory;
