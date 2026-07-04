import { useState, useMemo } from "react";
import "../../assets/css/admin css/DashStyle.css";
import "../../components/layout/sidebarStyle.css";
import "../../components/Dashboard/AdminDashboardCharts.css";
import FarmlandMap from "../../components/Map/FarmlandMap";
import {
  KPICards,
  SeasonComparisonChart,
  InventorySummary,
} from "../../components/Dashboard/AdminDashboardCharts";
import {
  useAdminDashboardStats,
  formatSeasonLabel,
} from "../../hooks/useAdminDashboardStats";
import RegionSidebar from "../../components/layout/RegionSidebar";

const RegionDashboard: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = useState<
    number | undefined
  >(undefined);

  const dashData = useAdminDashboardStats(selectedAllocationId);

  // Build farmer density map for the heatmap: barangay name -> farmer count
  const farmerDensityMap = useMemo(() => {
    const map: Record<string, number> = {};
    dashData.barangayDensity.forEach((b) => {
      map[b.name] = b.farmerCount;
    });
    return map;
  }, [dashData.barangayDensity]);

  // Available allocations for the dropdown
  const availableAllocations = useMemo(() => {
    return dashData.seasonComparison;
  }, [dashData.seasonComparison]);

  const selectedAllocationLabel = selectedAllocationId
    ? availableAllocations.find((a) => a.allocationId === selectedAllocationId)
        ?.label
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
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
                {selectedAllocationLabel ||
                  formatSeasonLabel(dashData.currentSeason)}{" "}
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
              <option value="">Current Program</option>
              {availableAllocations.map((allocation) => (
                <option
                  key={allocation.allocationId}
                  value={allocation.allocationId}
                >
                  {allocation.label}
                </option>
              ))}
            </select>
          </div>

          {dashData.loading ? (
            <div className="admin-dash-loading">
              <div className="spinner"></div>
              <p>Loading dashboard data...</p>
            </div>
          ) : (
            <>
              {/* KPI Stat Cards */}
              <KPICards
                kpi={dashData.kpi}
                currentSeason={dashData.currentSeason}
              />

              {/* Main Charts Row: Program Utility */}
              <div className="admin-dashboard-charts-row">
                <div className="admin-dashboard-card">
                  <div className="admin-dashboard-card-header">
                    <div>
                      <h3>📊 Program Utility Rate</h3>
                      <p className="admin-dashboard-card-subtitle">
                        Allocations vs. distributions by season
                      </p>
                    </div>
                  </div>
                  <SeasonComparisonChart data={dashData.seasonComparison} />
                </div>

                <div className="admin-dashboard-card">
                  <div className="admin-dashboard-card-header">
                    <div>
                      <h3>📦 Inventory Utility</h3>
                      <p className="admin-dashboard-card-subtitle">
                        Total allocated vs distributed subsidy stocks
                      </p>
                    </div>
                  </div>
                  <InventorySummary data={dashData.subsidyBreakdown} />
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
