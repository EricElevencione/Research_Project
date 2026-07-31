import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useRegionInventory, RegionInventoryItem } from "../../hooks/useRegionInventory";
import { useAdminDashboardStats, SubsidyStock } from "../../hooks/useAdminDashboardStats";
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

  // Region inventory reads from the `inventory` table (per-product stock)
  const invData = useRegionInventory(selectedAllocationId);

  // Admin stats still used for Traceability and Excess tabs
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
    const seeds = invData.items.filter(i => i.productType === 'seed');
    const ferts = invData.items.filter(i => i.productType === 'fertilizer');

    const isLiquidName = (name: string) =>
      name.toLowerCase().includes("liquid") ||
      name.toLowerCase().includes("liters") ||
      name.toLowerCase().includes("foliar") ||
      name.toLowerCase().includes("biofertilizer");

    const isHybridName = (name: string) =>
      hybridKeywords.some(k => name.toLowerCase().includes(k.toLowerCase()));

    return {
      seeds: {
        hybrid: seeds.filter(i => isHybridName(i.name)),
        inbred: seeds.filter(i => !isHybridName(i.name)),
        all: seeds,
      },
      fertilizers: {
        solid: ferts.filter(i => !isLiquidName(i.name)),
        liquid: ferts.filter(i => isLiquidName(i.name)),
        all: ferts,
      },
    };
  }, [invData.items]);

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
    items: RegionInventoryItem[];
    icon: React.ReactNode;
    colorClass: string;
    showHeader?: boolean;
    showCategory?: boolean;
    categoryHeader?: string;
  }) => {
    // Determine accent color from colorClass
    const accentColor =
      colorClass === 'region-inv-hybrid' ? '#16a34a' :
      colorClass === 'region-inv-inbred' ? '#0ea5e9' :
      colorClass === 'region-inv-solid'  ? '#f59e0b' :
      colorClass === 'region-inv-liquid' ? '#8b5cf6' : '#16a34a';

    return (
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        marginBottom: '20px',
      }}>
        {showHeader && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 20px',
            borderBottom: '1px solid #f3f4f6',
            background: '#fafafa',
          }}>
            <span style={{ color: accentColor, display: 'flex', alignItems: 'center' }}>{icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{title}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{items.length} varieties</div>
            </div>
            <div style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '9999px',
                background: accentColor + '18',
                color: accentColor,
                letterSpacing: '0.3px',
              }}>
                {items.filter(i => i.remaining > 0).length} In Stock
              </span>
              {items.filter(i => i.remaining === 0).length > 0 && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  background: '#fef2f2',
                  color: '#ef4444',
                }}>
                  {items.filter(i => i.remaining === 0).length} Empty
                </span>
              )}
            </div>
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Item Name</th>
                {showCategory && <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{categoryHeader}</th>}
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Stock</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Used</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Remaining</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', width: '120px' }}>Usage</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={showCategory ? 6 : 5} style={{ padding: '28px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>
                    No items in this category
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const progress = item.allocated > 0 ? (item.distributed / item.allocated) * 100 : 0;
                  const isLow = item.remaining > 0 && item.remaining < item.allocated * 0.15;
                  const isOut = item.remaining === 0 && item.allocated > 0;
                  const neverStocked = item.allocated === 0;

                  let categoryLabel = '';
                  if (showCategory) {
                    const name = item.name.toLowerCase();
                    const isLiquid = name.includes('liquid') || name.includes('liters') || name.includes('foliar') || name.includes('biofertilizer');
                    const isFert = name.includes('urea') || name.includes('complete') || name.includes('sulfate') || name.includes('potash') || name.includes('manure') || name.includes('compost') || isLiquid;
                    if (isFert) {
                      categoryLabel = isLiquid ? 'Liquid' : 'Solid';
                    } else {
                      const isHybrid = hybridKeywords.some(k => item.name.toLowerCase().includes(k.toLowerCase()));
                      categoryLabel = isHybrid ? 'Hybrid' : 'Inbred';
                    }
                  }

                  const badgeColor =
                    categoryLabel === 'Hybrid' ? '#16a34a' :
                    categoryLabel === 'Inbred' ? '#0ea5e9' :
                    categoryLabel === 'Solid'  ? '#f59e0b' :
                    categoryLabel === 'Liquid' ? '#8b5cf6' : accentColor;

                  return (
                    <tr key={idx} style={{
                      borderBottom: '1px solid #f3f4f6',
                      transition: 'background 0.15s',
                      background: isOut ? '#fffafa' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = isOut ? '#fffafa' : 'transparent')}
                    >
                      <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                            background: neverStocked ? '#d1d5db' : isOut ? '#ef4444' : isLow ? '#f59e0b' : accentColor,
                          }}></span>
                          <span style={{ fontWeight: 500, color: '#111827', fontSize: '13px' }}>{item.name}</span>
                        </div>
                      </td>
                      {showCategory && (
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: badgeColor + '18',
                            color: badgeColor,
                          }}>{categoryLabel}</span>
                        </td>
                      )}
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>
                        {item.allocated > 0 ? item.allocated.toLocaleString() : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>
                        {item.distributed > 0 ? item.distributed.toLocaleString() : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {neverStocked ? (
                          <span style={{ color: '#9ca3af', fontSize: '12px' }}>Not stocked</span>
                        ) : isOut ? (
                          <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '12px' }}>Out of stock</span>
                        ) : (
                          <span style={{ color: isLow ? '#f59e0b' : '#16a34a', fontWeight: 600 }}>
                            {item.remaining.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <div style={{ height: '6px', flex: 1, background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(100, progress)}%`,
                              background: progress > 90 ? '#ef4444' : progress > 70 ? '#f59e0b' : accentColor,
                              borderRadius: '3px',
                              transition: 'width 0.6s ease',
                            }}></div>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', width: '32px', textAlign: 'right' }}>
                            {item.allocated > 0 ? `${progress.toFixed(0)}%` : '—'}
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
  };

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
                    {invData.allocationOptions.map((alloc) => (
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

          {invData.loading ? (
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
                {invData.items.filter((item) =>
                  item.name.toLowerCase().includes(searchTerm.toLowerCase()),
                ).length === 0 ? (
                  <div className="region-inv-no-results">
                    No varieties found matching your search.
                  </div>
                ) : (
                  invData.items
                    .filter((item) =>
                      item.name
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()),
                    )
                    .map((item, idx) => {
                      const colorClass = item.productType === 'fertilizer'
                        ? (item.name.toLowerCase().includes("liquid") || item.name.toLowerCase().includes("foliar") ? "region-inv-liquid" : "region-inv-solid")
                        : (hybridKeywords.some((k) => item.name.includes(k)) ? "region-inv-hybrid" : "region-inv-inbred");
                      return (
                        <div
                          key={idx}
                          className={`region-inv-search-result-card ${colorClass} ${item.remaining === 0 ? "out" : item.remaining < item.allocated * 0.15 ? "low" : ""}`}
                        >
                          <div className="region-inv-search-card-header">
                            <div className="region-inv-search-card-icon">
                              {item.productType === 'seed' ? <Sprout size={20} /> : <Droplets size={20} />}
                            </div>
                            <div className="region-inv-search-card-title-group">
                              <h4>{item.name}</h4>
                              <span className="region-inv-search-card-category">{item.productType.toUpperCase()}</span>
                            </div>
                          </div>
                          <div className="region-inv-search-card-stats">
                            <div className="region-inv-search-stat">
                              <span className="search-region-inv-stat-label">Current Stock</span>
                              <span className="search-region-inv-stat-value">{item.remaining.toLocaleString()}</span>
                            </div>
                            <div className="region-inv-search-stat">
                              <span className="search-region-inv-stat-label">Total Stock</span>
                              <span className="search-region-inv-stat-value">{item.allocated.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="region-inv-search-card-footer">
                            <div className="region-inv-search-progress-bar">
                              <div
                                className="region-inv-search-progress-fill"
                                style={{ width: `${Math.min(100, item.allocated > 0 ? (item.distributed / item.allocated) * 100 : 0)}%` }}
                              ></div>
                            </div>
                            <span className="region-inv-search-progress-text">
                              {item.allocated > 0 ? ((item.distributed / item.allocated) * 100).toFixed(0) : 0}% Used
                            </span>
                          </div>
                        </div>
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
                      {/* Seeds Section */}
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '2px solid #e5e7eb' }}>
                          <Sprout size={18} style={{ color: '#16a34a' }} />
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>Seeds</span>
                          <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>
                            {categorizedData.seeds.all.length} varieties
                          </span>
                        </div>
                        <InventoryCategoryCard
                          title="Hybrid Seeds"
                          items={categorizedData.seeds.hybrid}
                          icon={<Sprout size={16} />}
                          colorClass="region-inv-hybrid"
                        />
                        <InventoryCategoryCard
                          title="Inbred Seeds"
                          items={categorizedData.seeds.inbred}
                          icon={<Sprout size={16} />}
                          colorClass="region-inv-inbred"
                        />
                      </div>

                      {/* Fertilizers Section */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '2px solid #e5e7eb' }}>
                          <Leaf size={18} style={{ color: '#f59e0b' }} />
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>Fertilizers</span>
                          <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>
                            {categorizedData.fertilizers.all.length} varieties
                          </span>
                        </div>
                        <InventoryCategoryCard
                          title="Solid Fertilizers"
                          items={categorizedData.fertilizers.solid}
                          icon={<Leaf size={16} />}
                          colorClass="region-inv-solid"
                        />
                        <InventoryCategoryCard
                          title="Liquid Fertilizers"
                          items={categorizedData.fertilizers.liquid}
                          icon={<Droplets size={16} />}
                          colorClass="region-inv-liquid"
                        />
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

                  <div className="region-inventory-table-container">
                    <table className="region-inventory-farmers-table">
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
                              className="region-inv-empty"
                            >
                              No distribution records found.
                            </td>
                          </tr>
                        ) : (
                          dashData.traceabilityLog.map((log) => (
                            <tr key={log.id} className="region-inventory-table-row">
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
                    ? invData.allocationOptions.find(
                        (a) => a.allocationId === selectedAllocationId,
                      )?.label ?? "Master Inventory View"
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
