import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAllocations, getFarmerRequests } from "../../api";
import "../../assets/css/admin css/AdminIncentives.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";
import ApproveIcon from "../../assets/images/approve.png";

interface RegionalAllocation {
  id: number;
  season: string;
  allocation_date: string;
  urea_46_0_0_bags: number;
  complete_14_14_14_bags: number;
  ammonium_sulfate_21_0_0_bags: number;
  muriate_potash_0_0_60_bags: number;
  rice_seeds_nsic_rc160_kg: number;
  rice_seeds_nsic_rc222_kg: number;
  rice_seeds_nsic_rc440_kg: number;
  corn_seeds_hybrid_kg: number;
  corn_seeds_opm_kg: number;
  vegetable_seeds_kg: number;
  farmer_count?: number;
}

const Incentives: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchAllocations();
  }, []);

  const fetchAllocations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getAllocations();

      if (response.error) {
        throw new Error(response.error);
      }

      const data = response.data || [];

      // Fetch farmer count for each allocation (by allocation ID, not season)
      const allocationsWithCounts = await Promise.all(
        data.map(async (allocation: RegionalAllocation) => {
          try {
            const requestsResponse = await getFarmerRequests(
              allocation.id,
              true,
            );
            if (!requestsResponse.error) {
              const requests = requestsResponse.data || [];
              return { ...allocation, farmer_count: requests.length };
            }
            return { ...allocation, farmer_count: 0 };
          } catch {
            return { ...allocation, farmer_count: 0 };
          }
        }),
      );
      setAllocations(allocationsWithCounts);
    } catch (error: any) {
      console.error("Error fetching allocations:", error);
      setError(error.message || "Failed to connect to server");
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  const formatSeasonName = (season: string) => {
    const [type, year] = season.split("_");
    return `${type.charAt(0).toUpperCase() + type.slice(1)} Season ${year}`;
  };

  const getTotalFertilizer = (allocation: RegionalAllocation) => {
    const total =
      (Number(allocation.urea_46_0_0_bags) || 0) +
      (Number(allocation.complete_14_14_14_bags) || 0) +
      (Number(allocation.ammonium_sulfate_21_0_0_bags) || 0) +
      (Number(allocation.muriate_potash_0_0_60_bags) || 0);
    return isNaN(total) ? 0 : total;
  };

  const getTotalSeeds = (allocation: RegionalAllocation) => {
    // Prefer detailed allocation fields (jackpot_kg, us88_kg, etc.) if present
    const jackpot = (allocation as any).jackpot_kg;
    const us88 = (allocation as any).us88_kg;
    const th82 = (allocation as any).th82_kg;
    const rh9000 = (allocation as any).rh9000_kg;
    const lumping143 = (allocation as any).lumping143_kg;
    const lp296 = (allocation as any).lp296_kg;

    if (
      jackpot !== undefined ||
      us88 !== undefined ||
      th82 !== undefined ||
      rh9000 !== undefined ||
      lumping143 !== undefined ||
      lp296 !== undefined
    ) {
      const total =
        (Number(jackpot) || 0) +
        (Number(us88) || 0) +
        (Number(th82) || 0) +
        (Number(rh9000) || 0) +
        (Number(lumping143) || 0) +
        (Number(lp296) || 0);
      return isNaN(total) ? 0 : total;
    }

    // Fallback to legacy rice/corn/vegetable seed fields
    const total =
      (Number(allocation.rice_seeds_nsic_rc160_kg) || 0) +
      (Number(allocation.rice_seeds_nsic_rc222_kg) || 0) +
      (Number(allocation.rice_seeds_nsic_rc440_kg) || 0) +
      (Number(allocation.corn_seeds_hybrid_kg) || 0) +
      (Number(allocation.corn_seeds_opm_kg) || 0) +
      (Number(allocation.vegetable_seeds_kg) || 0);
    return isNaN(total) ? 0 : total;
  };

  return (
    <div className="admin-incent-page-container">
      <div className="admin-incent-page has-mobile-sidebar">
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
              className={`sidebar-nav-item ${isActive("/logout") ? "active" : ""}`}
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
        <div className="admin-incent-main-content">
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
            <div className="tech-incent-mobile-title">Admin Incentives</div>
          </div>

          <div className="admin-incent-dashboard-header">
            <div className="admin-incent-dashboard-header-left">
              <h2 className="admin-incent-page-header">Farmer Allocations</h2>
              <p className="jo-incent-page-subtitle">
                View Farmer Requests & Regional Allocations
              </p>
            </div>
          </div>

          <div className="admin-incent-content-card">
            <div className="admin-incent-action-header"></div>

            {loading ? (
              <div className="admin-incent-loading">Loading allocations...</div>
            ) : error ? (
              <div className="admin-incent-error-state">
                <div className="admin-incent-error-icon">⚠️</div>
                <h3>Unable to Connect to Server</h3>
                <p>{error}</p>
                <div className="admin-incent-error-help">
                  <p>
                    <strong>Please ensure:</strong>
                  </p>
                  <ul>
                    <li>Backend server is running on port 5000</li>
                    <li>Database table 'regional_allocations' exists</li>
                    <li>
                      Run: <code>cd backend && node server.cjs</code>
                    </li>
                  </ul>
                </div>
                <button
                  className="admin-incent-btn-retry"
                  onClick={fetchAllocations}
                >
                  🔄 Retry Connection
                </button>
              </div>
            ) : allocations.length === 0 ? (
              <div className="admin-incent-empty-state">
                <div className="admin-incent-empty-icon">📦</div>
                <h3>No Allocations Yet</h3>
                <p>Create your first regional allocation to get started</p>
              </div>
            ) : (
              <div className="admin-incent-grid">
                {allocations.map((allocation) => (
                  <div key={allocation.id} className="admin-incent-card">
                    <div className="admin-incent-card-header">
                      <div className="admin-incent-season-info">
                        <h3>{formatSeasonName(allocation.season)}</h3>
                        <span className="admin-incent-date">
                          {new Date(
                            allocation.allocation_date,
                          ).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="admin-incent-card-body">
                      <div className="admin-incent-stat-row">
                        <div className="admin-incent-stat-item">
                          <span className="admin-incent-stat-label">
                            Total Fertilizer
                          </span>
                          <span className="admin-incent-stat-value">
                            {getTotalFertilizer(allocation).toLocaleString()}{" "}
                            bags
                          </span>
                        </div>
                        <div className="admin-incent-stat-item">
                          <span className="admin-incent-stat-label">
                            Total Seeds
                          </span>
                          <span className="admin-incent-stat-value">
                            {getTotalSeeds(allocation).toFixed(2)} kg
                          </span>
                        </div>
                      </div>
                      <div className="admin-incent-stat-row">
                        <div className="admin-incent-stat-item">
                          <span className="admin-incent-stat-label">
                            Farmer Requests
                          </span>
                          <span className="admin-incent-stat-value">
                            {allocation.farmer_count || 0} farmers
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="admin-incent-card-actions">
                      <button
                        className="admin-incent-btn-action admin-incent-btn-view"
                        onClick={() =>
                          navigate(`/view-allocation/${allocation.id}`)
                        }
                        title="View Details"
                      >
                        👁️ View
                      </button>
                      <button
                        className="admin-incent-btn-action admin-incent-btn-manage"
                        onClick={() =>
                          navigate(`/manage-requests/${allocation.id}`)
                        }
                        title="Manage Requests"
                      >
                        📋 Manage
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Incentives;
