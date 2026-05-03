import React, { useState, useMemo } from "react";
import { useAdminDashboardStats, SubsidyStock } from "../../hooks/useAdminDashboardStats";
import AdminSidebar from "../../components/layout/AdminSidebar";
import { 
  Package, 
  Leaf, 
  Droplets, 
  Sprout, 
  ChevronRight, 
  Search,
  ArrowUpRight
} from "lucide-react";
import "../../assets/css/admin css/AdminViewAllocation.css"; // Reuse similar styling
import "./InventoryPage.css";

const InventoryPage: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dashData = useAdminDashboardStats();

  const hybridKeywords = ["Jackpot", "US88", "TH82", "RH9000", "Mestiso"];

  const categorizedData = useMemo(() => {
    const data = dashData.subsidyBreakdown;
    
    const result = {
      seeds: {
        hybrid: [] as SubsidyStock[],
        inbred: [] as SubsidyStock[],
      },
      fertilizers: {
        solid: [] as SubsidyStock[],
        liquid: [] as SubsidyStock[],
      }
    };

    data.forEach(item => {
      const name = item.name.toLowerCase();
      
      // Determine if it's a seed or fertilizer based on unit or name hints
      // From shortageFieldMaps: seeds are generally kg, fertilizers are bags/liters
      // However, our SubsidyStock doesn't have the original unit, so we check name hints
      
      const isLiquid = name.includes("liquid") || name.includes("liters") || name.includes("foliar") || name.includes("biofertilizer");
      const isFertilizer = name.includes("urea") || name.includes("complete") || name.includes("sulfate") || name.includes("potash") || name.includes("manure") || name.includes("compost") || isLiquid;
      
      if (isFertilizer) {
        if (isLiquid) {
          result.fertilizers.liquid.push(item);
        } else {
          result.fertilizers.solid.push(item);
        }
      } else {
        // Assume seed
        const isHybrid = hybridKeywords.some(keyword => item.name.includes(keyword));
        if (isHybrid) {
          result.seeds.hybrid.push(item);
        } else {
          result.seeds.inbred.push(item);
        }
      }
    });

    return result;
  }, [dashData.subsidyBreakdown]);

  const filteredData = (list: SubsidyStock[]) => {
    if (!searchTerm) return list;
    return list.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const InventoryTable = ({ title, items, icon, colorClass }: { title: string, items: SubsidyStock[], icon: React.ReactNode, colorClass: string }) => (
    <div className={`inventory-category-card ${colorClass}`}>
      <div className="inventory-category-header">
        <div className="inventory-category-icon">{icon}</div>
        <div className="inventory-category-title-group">
          <h3>{title}</h3>
          <span className="inventory-count">{items.length} Items</span>
        </div>
      </div>
      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Allocated</th>
              <th>Distributed</th>
              <th>Remaining</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="inventory-empty">No items found in this category</td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const progress = item.allocated > 0 ? (item.distributed / item.allocated) * 100 : 0;
                const isLow = item.remaining > 0 && item.remaining < (item.allocated * 0.15);
                const isOut = item.remaining === 0;

                return (
                  <tr key={idx}>
                    <td className="item-name-cell">{item.name}</td>
                    <td>{item.allocated.toLocaleString()}</td>
                    <td>{item.distributed.toLocaleString()}</td>
                    <td className={`remaining-cell ${isOut ? 'out' : isLow ? 'low' : ''}`}>
                      {item.remaining.toLocaleString()}
                    </td>
                    <td>
                      <div className="stock-indicator-wrapper">
                        <div className="stock-progress-bg">
                          <div 
                            className="stock-progress-fill" 
                            style={{ 
                              width: `${Math.min(100, progress)}%`,
                              background: progress > 90 ? '#ef4444' : progress > 70 ? '#f59e0b' : '#16a34a'
                            }}
                          />
                        </div>
                        <span className="stock-pct">{progress.toFixed(0)}% Used</span>
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

  return (
    <div className="admin-viewalloc-page-container">
      <div className="admin-viewalloc-page has-mobile-sidebar">
        <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

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
              <h2 className="admin-viewalloc-title">Subsidy Inventory</h2>
              <p className="admin-viewalloc-subtitle">Manage and track stock levels for all seasonal allocations</p>
            </div>
            <div className="inventory-header-right">
              <div className="inventory-search-box">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Search inventory..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {dashData.loading ? (
            <div className="admin-viewalloc-loading">Loading inventory data...</div>
          ) : (
            <div className="inventory-grid">
              {/* Summary Section */}
              <div className="inventory-summary-row">
                <div className="inventory-stat-card">
                  <div className="stat-icon seeds"><Sprout /></div>
                  <div className="stat-info">
                    <span className="stat-label">Total Seeds</span>
                    <span className="stat-value">
                      {(categorizedData.seeds.hybrid.length + categorizedData.seeds.inbred.length)}
                    </span>
                  </div>
                </div>
                <div className="inventory-stat-card">
                  <div className="stat-icon ferts"><Leaf /></div>
                  <div className="stat-info">
                    <span className="stat-label">Total Fertilizers</span>
                    <span className="stat-value">
                      {(categorizedData.fertilizers.solid.length + categorizedData.fertilizers.liquid.length)}
                    </span>
                  </div>
                </div>
                <div className="inventory-stat-card">
                  <div className="stat-icon alert"><AlertCircleIcon /></div>
                  <div className="stat-info">
                    <span className="stat-label">Low Stock Items</span>
                    <span className="stat-value text-red">
                      {dashData.subsidyBreakdown.filter(i => i.remaining > 0 && i.remaining < (i.allocated * 0.15)).length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Categorized Tables */}
              <div className="inventory-sections-wrapper">
                <div className="inventory-section">
                  <h3 className="section-title">🌾 Seeds Inventory</h3>
                  <div className="category-row">
                    <InventoryTable 
                      title="Hybrid Seeds" 
                      items={filteredData(categorizedData.seeds.hybrid)} 
                      icon={<ArrowUpRight />} 
                      colorClass="hybrid"
                    />
                    <InventoryTable 
                      title="Inbred Seeds" 
                      items={filteredData(categorizedData.seeds.inbred)} 
                      icon={<ChevronRight />} 
                      colorClass="inbred"
                    />
                  </div>
                </div>

                <div className="inventory-section">
                  <h3 className="section-title">🌱 Fertilizers Inventory</h3>
                  <div className="category-row">
                    <InventoryTable 
                      title="Solid Fertilizers" 
                      items={filteredData(categorizedData.fertilizers.solid)} 
                      icon={<Package />} 
                      colorClass="solid"
                    />
                    <InventoryTable 
                      title="Liquid Fertilizers" 
                      items={filteredData(categorizedData.fertilizers.liquid)} 
                      icon={<Droplets />} 
                      colorClass="liquid"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AlertCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
);

export default InventoryPage;
