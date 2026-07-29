import { useState, useMemo } from "react";
import "../../assets/css/admin css/DashStyle.css";
import "../../components/layout/sidebarStyle.css";
import "../../components/Dashboard/AdminDashboardCharts.css";
import {
  RegionKPICards,
  TopVarietiesChart,
  RequestStatusChart,
  StockShortageAlerts,
  AllocationBurnList,
  BarangayDemandList
} from "../../components/Dashboard/RegionDashboardCharts";
import {
  useRegionDashboardStats
} from "../../hooks/useRegionDashboardStats";
import RegionSidebar from "../../components/layout/RegionSidebar";
import { formatSeasonLabel } from "../../hooks/useAdminDashboardStats"; // reuse formatter

const RegionDashboard: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = useState<number | undefined>(undefined);

  const dashData = useRegionDashboardStats(selectedAllocationId);

  // Derive available allocations from burn rate list for the dropdown
  const availableAllocations = useMemo(() => {
    return dashData.allocationBurnRate.map(a => ({
      id: a.allocationId,
      label: a.label
    }));
  }, [dashData.allocationBurnRate]);

  const selectedAllocationLabel = selectedAllocationId
    ? availableAllocations.find((a) => a.id === selectedAllocationId)?.label
    : undefined;

  return (
    <div className="admin-page-container">
      <div className="admin-dashboard-page has-mobile-sidebar">
        <RegionSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Main content starts here */}
        <div className="admin-dashboard-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="tech-incent-mobile-title">Region</div>
          </div>

          {/* Header with season selector */}
          <div className="admin-dash-header">
            <div>
              <h1 className="admin-dash-title">Region Dashboard</h1>
              <p className="admin-dash-subtitle">
                {selectedAllocationLabel || formatSeasonLabel(dashData.currentSeason)}{" "}
                &bull; Last updated: {dashData.lastUpdated.toLocaleTimeString()}
              </p>
            </div>

            <select
              className="admin-dash-season-select"
              value={selectedAllocationId ?? ""}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedAllocationId(next ? Number(next) : undefined);
              }}
            >
              <option value="">All Active Programs</option>
              {availableAllocations.map((allocation) => (
                <option
                  key={allocation.id}
                  value={allocation.id}
                >
                  {allocation.label}
                </option>
              ))}
            </select>
          </div>

          {dashData.loading ? (
            <div className="admin-dash-loading">
              <div className="spinner"></div>
              <p>Loading region data...</p>
            </div>
          ) : (
            <>
              {/* Top Level Summary */}
              <RegionKPICards kpi={dashData.kpi} />

              <div className="admin-dashboard-pillars" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px', marginTop: '32px' }}>
                
                {/* Left Pillar: Operations & Fulfillment */}
                <div className="admin-dashboard-pillar" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="pillar-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', paddingBottom: '12px', borderBottom: '2px solid #e2e8f0' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Operations & Fulfillment</h2>
                  </div>

                  <div className="admin-dashboard-card">
                    <div className="admin-dashboard-card-header">
                      <div>
                        <h3>Request Processing Status</h3>
                        <p className="admin-dashboard-card-subtitle">
                          Overview of current farmer requests statuses across the region
                        </p>
                      </div>
                    </div>
                    <RequestStatusChart stats={dashData.requestStatusCounts} />
                  </div>

                  <div className="admin-dashboard-card">
                    <div className="admin-dashboard-card-header">
                      <div>
                        <h3>Allocation Burn Rate</h3>
                        <p className="admin-dashboard-card-subtitle">
                          Track the utilization of active regional allocations
                        </p>
                      </div>
                    </div>
                    <AllocationBurnList burnRates={dashData.allocationBurnRate} />
                  </div>
                </div>

                {/* Right Pillar: Supply & Demand */}
                <div className="admin-dashboard-pillar" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="pillar-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', paddingBottom: '12px', borderBottom: '2px solid #e2e8f0' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Supply & Demand</h2>
                  </div>

                  <div className="admin-dashboard-card" style={{ border: dashData.stockShortageAlerts.length > 0 ? '1px solid #fecdd3' : undefined }}>
                    <div className="admin-dashboard-card-header">
                      <div>
                        <h3 style={{ color: dashData.stockShortageAlerts.length > 0 ? '#be123c' : undefined }}>Stock Shortage Alerts</h3>
                        <p className="admin-dashboard-card-subtitle">
                          Monitor potential stock shortages against current demand
                        </p>
                      </div>
                    </div>
                    <StockShortageAlerts alerts={dashData.stockShortageAlerts} />
                  </div>

                  <div className="admin-dashboard-card">
                    <div className="admin-dashboard-card-header">
                      <div>
                        <h3>Top Requested Varieties</h3>
                        <p className="admin-dashboard-card-subtitle">
                          Most requested items across all active requests
                        </p>
                      </div>
                    </div>
                    <TopVarietiesChart data={dashData.topRequestedVarieties} />
                  </div>
                </div>

              </div>

              {/* Full Width Bottom Section */}
              <div className="admin-dashboard-card" style={{ marginTop: '32px' }}>
                <div className="admin-dashboard-card-header">
                  <div>
                    <h3>Barangay Demand</h3>
                    <p className="admin-dashboard-card-subtitle">
                      Demand distribution across barangays
                    </p>
                  </div>
                </div>
                {/* For full width, maybe we want a grid or a wider list in BarangayDemandList? It will adapt naturally. */}
                <div style={{ padding: '16px' }}>
                  <BarangayDemandList demands={dashData.barangayDemand} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegionDashboard;
