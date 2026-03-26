import React, { useEffect, useState } from "react";
import {
  getAllocations,
  getFarmerRequests,
  updateAllocation,
  deleteAllocation,
} from "../../api";
import { useNavigate, useLocation } from "react-router-dom";
import "../../assets/css/jo css/JoIncentStyle.css";
import "../../assets/css/technician css/TechIncentStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

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

const TechIncentives: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editAllocationModal, setEditAllocationModal] =
    useState<RegionalAllocation | null>(null);
  const [editFormData, setEditFormData] = useState<RegionalAllocation | null>(
    null,
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [requestCount, setRequestCount] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

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
    } catch (err: any) {
      console.error("Error fetching allocations:", err);
      setError(err.message || "Failed to connect to server");
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, season: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${season}? This will also delete all associated farmer requests.`,
      )
    ) {
      return;
    }

    try {
      const response = await deleteAllocation(id);
      if (!response.error) {
        alert("Allocation deleted successfully");
        fetchAllocations();
      } else {
        alert("Failed to delete allocation");
      }
    } catch (err) {
      console.error("Error deleting allocation:", err);
      alert("Error deleting allocation");
    }
  };

  const handleEditAllocation = async (allocation: RegionalAllocation) => {
    try {
      const response = await getFarmerRequests(allocation.id, true);
      if (!response.error) {
        const requests = response.data || [];
        setRequestCount(requests.length);
      } else {
        setRequestCount(0);
      }
    } catch (err) {
      console.error("Error fetching requests:", err);
      setRequestCount(0);
    }

    setEditAllocationModal(allocation);
    setEditFormData(allocation);
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    if (!editFormData) return;

    let parsedValue: string | number = value;
    if (name.includes("bags")) {
      parsedValue = parseInt(value, 10) || 0;
    } else if (name.includes("kg")) {
      parsedValue = parseFloat(value) || 0;
    }

    setEditFormData({
      ...editFormData,
      [name]: parsedValue,
    });
  };

  const handleSaveEdit = async () => {
    if (!editFormData) return;

    if (requestCount > 0) {
      const confirmed = window.confirm(
        `Warning: This allocation has ${requestCount} existing farmer request(s).\n\nEditing this allocation may affect these requests.\n\nDo you want to proceed?`,
      );
      if (!confirmed) return;
    }

    setSavingEdit(true);
    try {
      const { id, ...updateData } = editFormData;
      const response = await updateAllocation(id, updateData);

      if (!response.error) {
        alert("Allocation updated successfully");
        setEditAllocationModal(null);
        setEditFormData(null);
        fetchAllocations();
      } else {
        alert("Failed to update allocation");
      }
    } catch (err) {
      console.error("Error updating allocation:", err);
      alert("Error updating allocation");
    } finally {
      setSavingEdit(false);
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
    <div className="jo-incent-page-container">
      <div className="jo-incent-page">
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive("/technician-dashboard") ? "active" : ""}`}
              onClick={() => navigate("/technician-dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-rsbsapage") ? "active" : ""}`}
              onClick={() => navigate("/technician-rsbsa")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-incentives") ? "active" : ""}`}
              onClick={() => navigate("/technician-incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Incentives</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-masterlist") ? "active" : ""}`}
              onClick={() => navigate("/technician-masterlist")}
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

        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <div className="jo-incent-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">
              Technician Incentives
            </div>
          </div>

          <div className="jo-incent-dashboard-header">
            <div>
              <h2 className="jo-incent-page-header">
                Farmer Incentive Requests
              </h2>
              <p className="jo-incent-page-subtitle">
                Add farmer requests to available regional allocations
              </p>
            </div>
          </div>

          <div className="jo-incent-content-card">
            {loading ? (
              <div className="jo-incent-loading">Loading allocations...</div>
            ) : error ? (
              <div className="jo-incent-error-state">
                <div className="jo-incent-error-icon">⚠️</div>
                <h3>Unable to Connect to Server</h3>
                <p>{error}</p>
                <button
                  className="jo-incent-btn-retry"
                  onClick={fetchAllocations}
                >
                  Retry Connection
                </button>
              </div>
            ) : allocations.length === 0 ? (
              <div className="jo-incent-empty-state">
                <div className="jo-incent-empty-icon">📦</div>
                <h3>No Allocations Available</h3>
                <p>Contact the JO officer to create regional allocations</p>
              </div>
            ) : (
              <div className="jo-incent-grid">
                {allocations.map((allocation) => (
                  <div key={allocation.id} className="jo-incent-card">
                    <div className="jo-incent-card-header">
                      <div className="jo-incent-season-info">
                        <h3>{formatSeasonName(allocation.season)}</h3>
                        <span className="jo-incent-date">
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

                    <div className="jo-incent-card-body">
                      <div className="jo-incent-stat-row">
                        <div className="jo-incent-stat-item">
                          <span className="jo-incent-stat-label">
                            Total Fertilizer
                          </span>
                          <span className="jo-incent-stat-value">
                            {getTotalFertilizer(allocation).toLocaleString()}{" "}
                            bags
                          </span>
                        </div>
                        <div className="jo-incent-stat-item">
                          <span className="jo-incent-stat-label">
                            Total Seeds
                          </span>
                          <span className="jo-incent-stat-value">
                            {getTotalSeeds(allocation).toFixed(2)} kg
                          </span>
                        </div>
                      </div>
                      <div className="jo-incent-stat-row">
                        <div className="jo-incent-stat-item">
                          <span className="jo-incent-stat-label">
                            Farmer Requests
                          </span>
                          <span className="jo-incent-stat-value">
                            {allocation.farmer_count || 0} farmers
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="jo-incent-card-actions">
                      <button
                        className="jo-incent-btn-action jo-incent-btn-view"
                        onClick={() =>
                          navigate(
                            `/technician-view-allocation/${allocation.id}`,
                          )
                        }
                        title="View Details"
                      >
                        View
                      </button>
                      <button
                        className="jo-incent-btn-action jo-incent-btn-add"
                        onClick={() =>
                          navigate(
                            `/technician-add-farmer-request/${allocation.id}`,
                          )
                        }
                        title="Add Farmer Request"
                      >
                        Add Farmer
                      </button>
                      <button
                        className="jo-incent-btn-action jo-incent-btn-edit"
                        onClick={() => handleEditAllocation(allocation)}
                        title="Edit Allocation"
                      >
                        Edit
                      </button>
                      <button
                        className="jo-incent-btn-action jo-incent-btn-manage"
                        onClick={() =>
                          navigate(
                            `/technician-manage-requests/${allocation.id}`,
                          )
                        }
                        title="Manage Request"
                      >
                        Manage
                      </button>
                      <button
                        className="jo-incent-btn-action jo-incent-btn-delete"
                        onClick={() =>
                          handleDelete(
                            allocation.id,
                            formatSeasonName(allocation.season),
                          )
                        }
                        title="Delete Allocation"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editAllocationModal && editFormData && (
            <div
              className="jo-incent-modal-overlay"
              onClick={() => setEditAllocationModal(null)}
            >
              <div
                className="jo-incent-modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="jo-incent-modal-header">
                  <h2>Edit Regional Allocation</h2>
                  <button
                    className="jo-incent-modal-close"
                    onClick={() => setEditAllocationModal(null)}
                  >
                    ×
                  </button>
                </div>
                <div className="jo-incent-modal-body">
                  {requestCount > 0 && (
                    <div className="jo-incent-modal-warning">
                      This allocation has {requestCount} existing farmer
                      request(s).
                    </div>
                  )}

                  <div className="tech-incent-modal-form-grid">
                    <div className="tech-incent-modal-form-group full-width">
                      <label>Season</label>
                      <input
                        type="text"
                        value={formatSeasonName(editFormData.season)}
                        disabled
                      />
                    </div>

                    <div className="tech-incent-modal-form-group">
                      <label>Urea (46-0-0)</label>
                      <input
                        type="number"
                        name="urea_46_0_0_bags"
                        value={editFormData.urea_46_0_0_bags}
                        onChange={handleEditInputChange}
                        min="0"
                      />
                    </div>

                    <div className="tech-incent-modal-form-group">
                      <label>Complete (14-14-14)</label>
                      <input
                        type="number"
                        name="complete_14_14_14_bags"
                        value={editFormData.complete_14_14_14_bags}
                        onChange={handleEditInputChange}
                        min="0"
                      />
                    </div>

                    <div className="tech-incent-modal-form-group">
                      <label>Ammonium Sulfate (21-0-0)</label>
                      <input
                        type="number"
                        name="ammonium_sulfate_21_0_0_bags"
                        value={editFormData.ammonium_sulfate_21_0_0_bags}
                        onChange={handleEditInputChange}
                        min="0"
                      />
                    </div>

                    <div className="tech-incent-modal-form-group">
                      <label>Muriate of Potash (0-0-60)</label>
                      <input
                        type="number"
                        name="muriate_potash_0_0_60_bags"
                        value={editFormData.muriate_potash_0_0_60_bags}
                        onChange={handleEditInputChange}
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="jo-incent-modal-actions">
                    <button
                      className="jo-incent-modal-btn-cancel"
                      onClick={() => setEditAllocationModal(null)}
                      disabled={savingEdit}
                    >
                      Cancel
                    </button>
                    <button
                      className="jo-incent-modal-btn-save"
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                    >
                      {savingEdit ? "Saving..." : "Save Changes"}
                    </button>
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

export default TechIncentives;
