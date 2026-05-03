import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAllocations, getFarmerRequests } from "../../api";
import "../../assets/css/admin css/AdminIncentives.css";
import "../../components/layout/sidebarStyle.css";
import AdminSidebar from "../../components/layout/AdminSidebar";

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

      // Fetch farmer count for each allocation
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
        <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="admin-incent-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="tech-incent-mobile-title">Admin Incentives</div>
          </div>

          <div className="admin-incent-dashboard-header">
            <div className="admin-incent-dashboard-header-left">
              <h2 className="admin-incent-page-header">Farmer Allocations</h2>
              <p className="jo-incent-page-subtitle">View Farmer Requests & Regional Allocations</p>
            </div>
            <div className="admin-incent-dashboard-header-right">
              <button className="jo-incent-btn-create" onClick={() => navigate("/admin-create-allocation")}>➕ New Regional Allocation</button>
            </div>
          </div>

          <div className="admin-incent-content-card">
            {loading ? (
              <div className="admin-incent-loading">Loading allocations...</div>
            ) : error ? (
              <div className="admin-incent-error-state">
                <div className="admin-incent-error-icon">⚠️</div>
                <h3>Unable to Connect to Server</h3>
                <p>{error}</p>
                <button className="admin-incent-btn-retry" onClick={fetchAllocations}>🔄 Retry Connection</button>
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
                        <span className="admin-incent-date">{new Date(allocation.allocation_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                      </div>
                    </div>
                    <div className="admin-incent-card-body">
                      <div className="admin-incent-stat-row">
                        <span className="admin-incent-stat-label">Fertilizer (Total)</span>
                        <span className="admin-incent-stat-value">{getTotalFertilizer(allocation)} bags</span>
                      </div>
                      <div className="admin-incent-stat-row">
                        <span className="admin-incent-stat-label">Seeds (Total)</span>
                        <span className="admin-incent-stat-value">{getTotalSeeds(allocation)} kg</span>
                      </div>
                      <div className="admin-incent-stat-row">
                        <span className="admin-incent-stat-label">Registered Farmers</span>
                        <span className="admin-incent-stat-value">{allocation.farmer_count || 0}</span>
                      </div>
                    </div>
                    <div className="admin-incent-card-footer">
                      <button className="admin-incent-btn-view" onClick={() => navigate(`/view-allocation/${allocation.id}`)}>View Details</button>
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
