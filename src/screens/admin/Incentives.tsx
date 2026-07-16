import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getAllocations,
  getFarmerRequests,
  closeAllocation,
  reopenAllocation,
} from "../../api";
import {
  FERTILIZER_FIELD_MAPS,
  SEED_FIELD_MAPS,
} from "../../constants/shortageFieldMaps";
import "../../assets/css/admin css/AdminIncentives.css";
import "../../components/layout/sidebarStyle.css";
import AdminSidebar from "../../components/layout/AdminSidebar";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";

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

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

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
        try {
          const auditUser = await getCurrentUserForAudit();
          const auditLogger = getAuditLogger();
          await auditLogger.logCRUD(
            auditUser,
            "UPDATE",
            AuditModule.ALLOCATIONS,
            "regional_allocation",
            allocationId,
            `Closed regional program: ${season}`,
          );
        } catch (auditErr) {
          console.error("Audit log failed:", auditErr);
        }
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
        try {
          const auditUser = await getCurrentUserForAudit();
          const auditLogger = getAuditLogger();
          await auditLogger.logCRUD(
            auditUser,
            "UPDATE",
            AuditModule.ALLOCATIONS,
            "regional_allocation",
            allocationId,
            `Reopened regional program: ${season}`,
          );
        } catch (auditErr) {
          console.error("Audit log failed:", auditErr);
        }
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

  const filteredAllocations = allocations.filter((allocation) => {
    const matchesSearch = formatSeasonName(allocation.season)
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const isClosed = (allocation as any).status === "closed";
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "closed" && isClosed) ||
      (statusFilter === "open" && !isClosed);

    const totalFertilizer = getTotalFertilizer(allocation);
    const totalSeeds = getTotalSeeds(allocation);

    let matchesType = true;
    if (typeFilter === "seeds") {
      matchesType = totalSeeds > 0 && totalFertilizer === 0;
    } else if (typeFilter === "fertilizer") {
      matchesType = totalFertilizer > 0 && totalSeeds === 0;
    } else if (typeFilter === "both") {
      matchesType = totalFertilizer > 0 && totalSeeds > 0;
    }

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="admin-incent-page-container">
      <style>{`
        .admin-incent-table-row:hover {
          background-color: #f8fafc;
        }
      `}</style>
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
          </div>

          <div className="admin-incent-content-card">
            <div
              className="admin-incent-filters"
              style={{
                display: "flex",
                gap: "1rem",
                marginBottom: "1.5rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1", minWidth: "200px" }}>
                <input
                  type="text"
                  placeholder="Search by season..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    outline: "none",
                    fontSize: "0.95rem",
                  }}
                />
              </div>
              <div style={{ width: "200px" }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    outline: "none",
                    fontSize: "0.95rem",
                    backgroundColor: "white",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div style={{ width: "200px" }}>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    outline: "none",
                    fontSize: "0.95rem",
                    backgroundColor: "white",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Types</option>
                  <option value="seeds">Seeds Only</option>
                  <option value="fertilizer">Fertilizer Only</option>
                  <option value="both">Both Seeds & Fertilizer</option>
                </select>
              </div>
            </div>

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
            ) : filteredAllocations.length === 0 ? (
              <div className="admin-incent-empty-state">
                <div className="admin-incent-empty-icon">🔍</div>
                <h3>No Allocations Found</h3>
                <p>Try adjusting your search or filters</p>
              </div>
            ) : (
              <div
                className="table-responsive"
                style={{
                  overflowX: "auto",
                  backgroundColor: "#fff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                    fontSize: "0.95rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  <thead
                    style={{
                      backgroundColor: "#f8fafc",
                      borderBottom: "2px solid #e2e8f0",
                    }}
                  >
                    <tr>
                      <th
                        style={{
                          padding: "1rem",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Season
                      </th>
                      <th
                        style={{
                          padding: "1rem",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Date
                      </th>
                      <th
                        style={{
                          padding: "1rem",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Total Fertilizer
                      </th>
                      <th
                        style={{
                          padding: "1rem",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Total Seeds
                      </th>
                      <th
                        style={{
                          padding: "1rem",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Farmer Requests
                      </th>
                      <th
                        style={{
                          padding: "1rem",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Status
                      </th>
                      <th
                        style={{
                          padding: "1rem",
                          color: "#64748b",
                          fontWeight: 600,
                          textAlign: "center",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllocations.map((allocation) => (
                      <tr
                        key={allocation.id}
                        style={{ borderBottom: "1px solid #e2e8f0" }}
                        className="admin-incent-table-row"
                      >
                        <td
                          style={{
                            padding: "1rem",
                            fontWeight: 500,
                            color: "#0f172a",
                          }}
                        >
                          {formatSeasonName(allocation.season)}
                        </td>
                        <td style={{ padding: "1rem", color: "#475569" }}>
                          {new Date(
                            allocation.allocation_date,
                          ).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td style={{ padding: "1rem", color: "#475569" }}>
                          <strong>
                            {getTotalFertilizer(allocation).toLocaleString()}
                          </strong>{" "}
                          bags
                        </td>
                        <td style={{ padding: "1rem", color: "#475569" }}>
                          <strong>
                            {getTotalSeeds(allocation).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </strong>{" "}
                          kg
                        </td>
                        <td style={{ padding: "1rem", color: "#475569" }}>
                          <span
                            style={{
                              backgroundColor: "#e0f2fe",
                              color: "#0369a1",
                              padding: "0.25rem 0.75rem",
                              borderRadius: "9999px",
                              fontSize: "0.85rem",
                              fontWeight: 600,
                            }}
                          >
                            {allocation.farmer_count || 0} farmers
                          </span>
                        </td>
                        <td style={{ padding: "1rem" }}>
                          {(allocation as any).status === "closed" ? (
                            <span
                              style={{
                                background: "#fef2f2",
                                color: "#ef4444",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                border: "1px solid #fecaca",
                              }}
                            >
                              CLOSED
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "#f0fdf4",
                                color: "#16a34a",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                border: "1px solid #bbf7d0",
                              }}
                            >
                              OPEN
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "1rem" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              justifyContent: "center",
                            }}
                          >
                            <button
                              onClick={() =>
                                navigate(`/view-allocation/${allocation.id}`)
                              }
                              style={{
                                padding: "0.4rem 0.8rem",
                                background: "#e2e8f0",
                                color: "#334155",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              View
                            </button>

                            <button
                              onClick={() =>
                                navigate(`/manage-requests/${allocation.id}`)
                              }
                              style={{
                                padding: "0.4rem 0.8rem",
                                background: "#8b5cf6",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Manage
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Incentives;
