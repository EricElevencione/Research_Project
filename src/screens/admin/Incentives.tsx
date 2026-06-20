import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAllocations, getFarmerRequests, closeAllocation, reopenAllocation } from "../../api";
import {
  FERTILIZER_FIELD_MAPS,
  SEED_FIELD_MAPS,
} from "../../constants/shortageFieldMaps";
import "../../assets/css/admin css/AdminIncentives.css";
import "../../components/layout/sidebarStyle.css";
import AdminSidebar from "../../components/layout/AdminSidebar";

interface RegionalAllocation {
  id: number;
  season: string;
  allocation_date: string;
  farmer_count?: number;
  [key: string]: any;
}

const Incentives: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

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
      // Sort allocations: Newest first (by date, then by ID as tie-breaker)
      const sortedAllocations = allocationsWithCounts.sort((a, b) => {
        const dateA = new Date(a.allocation_date).getTime();
        const dateB = new Date(b.allocation_date).getTime();

        if (dateB !== dateA) {
          return dateB - dateA;
        }
        return b.id - a.id; // Newest ID first if dates are same
      });

      setAllocations(sortedAllocations);
    } catch (error: any) {
      console.error("Error fetching allocations:", error);
      setError(error.message || "Failed to connect to server");
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseProgram = async (allocationId: number, season: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to close the program "${season}"?\n\nThis will:\n• Mark the program as Closed across all accounts\n• Transfer remaining stock to Excess Inventory\n• Prevent new farmer requests`,
    );
    if (!confirmed) return;

    setClosingId(allocationId);
    try {
      const response = await closeAllocation(allocationId);
      if (response.error) {
        alert(`Failed to close program: ${response.error}`);
      } else {
        fetchAllocations();
      }
    } catch (err: any) {
      alert(`Error closing program: ${err.message}`);
    } finally {
      setClosingId(null);
    }
  };

  const handleReopenProgram = async (allocationId: number, season: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to reopen the program "${season}"?\n\nThis will reactivate the program and move excess stock back to active inventory.`,
    );
    if (!confirmed) return;

    setClosingId(allocationId);
    try {
      const response = await reopenAllocation(allocationId);
      if (response.error) {
        alert(`Failed to reopen program: ${response.error}`);
      } else {
        fetchAllocations();
      }
    } catch (err: any) {
      alert(`Error reopening program: ${err.message}`);
    } finally {
      setClosingId(null);
    }
  };

  const formatSeasonName = (season: string) => {
    return season;
  };

  const getTotalFertilizer = (allocation: RegionalAllocation) => {
    return FERTILIZER_FIELD_MAPS.reduce((acc, map) => {
      return acc + (Number(allocation[map.allocationField]) || 0);
    }, 0);
  };

  const getTotalSeeds = (allocation: RegionalAllocation) => {
    return SEED_FIELD_MAPS.reduce((acc, map) => {
      return acc + (Number(allocation[map.allocationField]) || 0);
    }, 0);
  };

  return (
    <div className="admin-incent-page-container">
      <div className="admin-incent-page has-mobile-sidebar">
        <AdminSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

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
            <div className="admin-incent-dashboard-header-right">
              <button
                className="jo-incent-btn-create"
                onClick={() => navigate("/admin-create-allocation")}
              >
                ➕ New Regional Allocation
              </button>
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
                      <h3 className="admin-incent-card-season">
                        {formatSeasonName(allocation.season)}
                      </h3>
                      {(allocation as any).status === "closed" && (
                        <span style={{
                          display: "inline-block",
                          background: "#ef4444",
                          color: "#fff",
                          padding: "2px 10px",
                          borderRadius: "9999px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          marginTop: 4,
                        }}>CLOSED</span>
                      )}
                      <p className="admin-incent-card-date">
                        {new Date(
                          allocation.allocation_date,
                        ).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="admin-incent-card-body">
                      <div className="admin-incent-stat-grid">
                        <div className="admin-incent-stat-box">
                          <label>TOTAL FERTILIZER</label>
                          <strong>
                            {getTotalFertilizer(allocation).toLocaleString()}{" "}
                            bags
                          </strong>
                        </div>
                        <div className="admin-incent-stat-box">
                          <label>TOTAL SEEDS</label>
                          <strong>
                            {getTotalSeeds(allocation).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            kg
                          </strong>
                        </div>
                      </div>

                      <div className="admin-incent-stat-box farmer-box">
                        <label>FARMER REQUESTS</label>
                        <strong>{allocation.farmer_count || 0} farmers</strong>
                      </div>
                    </div>

                    <div className="admin-incent-card-actions">
                      <button
                        className="admin-incent-btn-view"
                        onClick={() =>
                          navigate(`/view-allocation/${allocation.id}`)
                        }
                      >
                        View
                      </button>
                      <button
                        className="admin-incent-btn-edit"
                        onClick={() =>
                          navigate(`/admin-edit-allocation/${allocation.id}`)
                        }
                        disabled={(allocation as any).status === "closed"}
                        style={(allocation as any).status === "closed" ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                      >
                        Edit
                      </button>
                      <button
                        className="admin-incent-btn-manage"
                        onClick={() =>
                          navigate(`/manage-requests/${allocation.id}`)
                        }
                      >
                        Manage
                      </button>
                      {(allocation as any).status === "closed" ? (
                        <button
                          className="admin-incent-btn-manage"
                          style={{ background: "#16a34a", color: "#fff", border: "none" }}
                          onClick={() => handleReopenProgram(allocation.id, allocation.season)}
                          disabled={closingId === allocation.id}
                        >
                          {closingId === allocation.id ? "Reopening..." : "↩ Reopen"}
                        </button>
                      ) : (
                        <button
                          className="admin-incent-btn-manage"
                          style={{ background: "#ef4444", color: "#fff", border: "none" }}
                          onClick={() => handleCloseProgram(allocation.id, allocation.season)}
                          disabled={closingId === allocation.id}
                        >
                          {closingId === allocation.id ? "Closing..." : "✕ Close"}
                        </button>
                      )}
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
