import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../assets/css/admin css/DashStyle.css";
import "../../components/layout/sidebarStyle.css";
import "../../components/Dashboard/AdminDashboardCharts.css";
import FarmlandMap from "../../components/Map/FarmlandMap";
import {
  KPICards,
  SeasonComparisonChart,
  ClaimRateTrendChart,
} from "../../components/Dashboard/AdminDashboardCharts";
import {
  useAdminDashboardStats,
  formatSeasonLabel,
} from "../../hooks/useAdminDashboardStats";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = useState<
    number | undefined
  >(undefined);

  const dashData = useAdminDashboardStats(selectedAllocationId);

  const isActive = (path: string) => location.pathname === path;

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

  // Heatmap legend items
  const heatmapLegend = [
    { color: "#ef4444", label: "0 farmers" },
    { color: "#f97316", label: "1" },
    { color: "#eab308", label: "2" },
    { color: "#84cc16", label: "3-4" },
    { color: "#22c55e", label: "5-8" },
    { color: "#14532d", label: "8+" },
  ];

  const selectedAllocationLabel = selectedAllocationId
    ? availableAllocations.find((a) => a.allocationId === selectedAllocationId)
        ?.label
    : undefined;

  return (
    <div className="admin-page-container">
      <div className="admin-dashboard-page has-mobile-sidebar">
        {/* Sidebar starts here */}
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive("/dashboard") ? "active" : ""}`}
              onClick={() => navigate("/dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/rsbsa") ? "active" : ""}`}
              onClick={() => navigate("/rsbsa")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/audit-trail") ? "active" : ""}`}
              onClick={() => navigate("/audit-trail")}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-text">Audit Trail</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/incentives") ? "active" : ""}`}
              onClick={() => navigate("/incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Subsidy</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/masterlist") ? "active" : ""}`}
              onClick={() => navigate("/masterlist")}
            >
              <span className="nav-icon">
                <img src={ApproveIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/") ? "active" : ""}`}
              onClick={() => navigate("/")}
            >
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </div>
        {/* Sidebar ends here */}
        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Main content starts here */}
        <div className="admin-dashboard-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">Admin</div>
          </div>

          {/* Header with season selector */}
          <div className="admin-dash-header">
            <div>
              <h1 className="admin-dash-title">Admin Dashboard</h1>
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
              <option value="">Current Season</option>
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

              {/* Barangay Coverage Heatmap */}
              <div className="admin-dashboard-card admin-dashboard-map-section">
                <div className="admin-dashboard-card-header">
                  <div>
                    <h3>🗺️ Barangay Farmer Coverage</h3>
                  </div>
                </div>
                <div className="admin-dashboard-map-container">
                  <FarmlandMap
                    dashboardMode
                    hideLegend
                    farmerDensity={farmerDensityMap}
                  />
                </div>
              </div>

              {/* Charts Row: Season Comparison + Claim Rate Trend */}
              <div className="admin-dashboard-charts-row">
                <div className="admin-dashboard-card">
                  <div className="admin-dashboard-card-header">
                    <div>
                      <h3>📊 Season-over-Season Comparison</h3>
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
                      <h3>📈 Claim Rate Trend</h3>
                      <p className="admin-dashboard-card-subtitle">
                        Weekly claim rate progression through the season
                      </p>
                    </div>
                  </div>
                  <ClaimRateTrendChart data={dashData.claimRateTrend} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
