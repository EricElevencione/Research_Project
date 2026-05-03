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
import { supabase } from "../../supabase";

interface RegionalAllocation {
  id: number;
  season: string;
  allocation_date: string;
  urea_46_0_0_bags: number;
  complete_14_14_14_bags: number;
  np_16_20_0_bags: number;
  ammonium_sulfate_21_0_0_bags: number;
  muriate_potash_0_0_60_bags: number;
  zinc_sulfate_bags: number;
  vermicompost_bags: number;
  chicken_manure_bags: number;
  rice_straw_kg: number;
  carbonized_rice_hull_bags: number;
  biofertilizer_liters: number;
  nanobiofertilizer_liters: number;
  organic_root_exudate_mix_liters: number;
  azolla_microphylla_kg: number;
  foliar_liquid_fertilizer_npk_liters: number;
  rice_seeds_nsic_rc160_kg: number;
  rice_seeds_nsic_rc222_kg: number;
  jackpot_kg: number;
  us88_kg: number;
  th82_kg: number;
  rh9000_kg: number;
  lumping143_kg: number;
  lp296_kg: number;
  mestiso_1_kg: number;
  mestiso_20_kg: number;
  mestiso_29_kg: number;
  mestiso_55_kg: number;
  mestiso_73_kg: number;
  mestiso_99_kg: number;
  mestiso_103_kg: number;
  nsic_rc402_kg: number;
  nsic_rc480_kg: number;
  nsic_rc216_kg: number;
  nsic_rc218_kg: number;
  nsic_rc506_kg: number;
  nsic_rc508_kg: number;
  nsic_rc512_kg: number;
  nsic_rc534_kg: number;
  tubigan_28_kg: number;
  tubigan_30_kg: number;
  tubigan_22_kg: number;
  sahod_ulan_2_kg: number;
  sahod_ulan_10_kg: number;
  salinas_6_kg: number;
  salinas_7_kg: number;
  salinas_8_kg: number;
  malagkit_5_kg: number;
  complete_16_16_16_bags: number;
  ammonium_phosphate_16_20_0_bags: number;
  rice_seeds_nsic_rc440_kg: number;
  corn_seeds_hybrid_kg: number;
  corn_seeds_opm_kg: number;
  vegetable_seeds_kg: number;
  notes: string;
  farmer_count?: number;
}

const FERTILIZER_FIELDS = [
  { name: "urea_46_0_0_bags", label: "Urea (46-0-0) [bags]" },
  { name: "complete_14_14_14_bags", label: "Complete (14-14-14) [bags]" },
  { name: "np_16_20_0_bags", label: "16-20-0 [bags]" },
  {
    name: "ammonium_sulfate_21_0_0_bags",
    label: "Ammonium Sulfate (21-0-0) [bags]",
  },
  {
    name: "muriate_potash_0_0_60_bags",
    label: "Muriate of Potash (0-0-60) [bags]",
  },
  { name: "zinc_sulfate_bags", label: "Zinc Sulfate [bags]" },
  { name: "vermicompost_bags", label: "Vermicompost [bags]" },
  { name: "chicken_manure_bags", label: "Chicken Manure [bags]" },
  { name: "rice_straw_kg", label: "Rice Straw [kg]" },
  {
    name: "carbonized_rice_hull_bags",
    label: "Carbonized Rice Hull (CRH) [bags]",
  },
  { name: "biofertilizer_liters", label: "Biofertilizer [liters]" },
  { name: "nanobiofertilizer_liters", label: "Nanobiofertilizer [liters]" },
  {
    name: "organic_root_exudate_mix_liters",
    label: "Organic Root Exudate Mix [liters]",
  },
  { name: "azolla_microphylla_kg", label: "Azolla microphylla [kg]" },
  {
    name: "foliar_liquid_fertilizer_npk_liters",
    label: "Foliar Liquid Fertilizer (NPK) [liters]",
  },
  { name: "complete_16_16_16_bags", label: "Complete (16-16-16) [bags]" },
  {
    name: "ammonium_phosphate_16_20_0_bags",
    label: "Ammonium Phosphate (16-20-0) [bags]",
  },
];

const SEED_FIELDS = [
  { name: "rice_seeds_nsic_rc160_kg", label: "NSIC Rc 160 [kg]" },
  { name: "rice_seeds_nsic_rc222_kg", label: "NSIC Rc 222 [kg]" },
  { name: "jackpot_kg", label: "Jackpot [kg]" },
  { name: "us88_kg", label: "US88 [kg]" },
  { name: "th82_kg", label: "TH82 [kg]" },
  { name: "rh9000_kg", label: "RH9000 [kg]" },
  { name: "lumping143_kg", label: "Lumping143 [kg]" },
  { name: "lp296_kg", label: "LP296 [kg]" },
  { name: "mestiso_1_kg", label: "Mestiso 1 [kg]" },
  { name: "mestiso_20_kg", label: "Mestiso 20 [kg]" },
  { name: "mestiso_29_kg", label: "Mestiso 29 [kg]" },
  { name: "mestiso_55_kg", label: "Mestiso 55 [kg]" },
  { name: "mestiso_73_kg", label: "Mestiso 73 [kg]" },
  { name: "mestiso_99_kg", label: "Mestiso 99 [kg]" },
  { name: "mestiso_103_kg", label: "Mestiso 103 [kg]" },
  { name: "nsic_rc402_kg", label: "NSIC Rc 402 [kg]" },
  { name: "nsic_rc480_kg", label: "NSIC Rc 480 [kg]" },
  { name: "nsic_rc216_kg", label: "NSIC Rc 216 [kg]" },
  { name: "nsic_rc218_kg", label: "NSIC Rc 218 [kg]" },
  { name: "nsic_rc506_kg", label: "NSIC Rc 506 [kg]" },
  { name: "nsic_rc508_kg", label: "NSIC Rc 508 [kg]" },
  { name: "nsic_rc512_kg", label: "NSIC Rc 512 [kg]" },
  { name: "nsic_rc534_kg", label: "NSIC Rc 534 [kg]" },
  { name: "tubigan_28_kg", label: "Tubigan 28 [kg]" },
  { name: "tubigan_30_kg", label: "Tubigan 30 [kg]" },
  { name: "tubigan_22_kg", label: "Tubigan 22 [kg]" },
  { name: "sahod_ulan_2_kg", label: "Sahod Ulan 2 [kg]" },
  { name: "sahod_ulan_10_kg", label: "Sahod Ulan 10 [kg]" },
  { name: "salinas_6_kg", label: "Salinas 6 [kg]" },
  { name: "salinas_7_kg", label: "Salinas 7 [kg]" },
  { name: "salinas_8_kg", label: "Salinas 8 [kg]" },
  { name: "malagkit_5_kg", label: "Malagkit 5 [kg]" },
  { name: "rice_seeds_nsic_rc440_kg", label: "NSIC Rc 440 [kg]" },
  { name: "corn_seeds_hybrid_kg", label: "Corn Seeds (Hybrid) [kg]" },
  { name: "corn_seeds_opm_kg", label: "Corn Seeds (OPM) [kg]" },
  { name: "vegetable_seeds_kg", label: "Vegetable Seeds [kg]" },
];

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
  const [addedFields, setAddedFields] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    fetchAllocations();
  }, []);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const firstName = user.user_metadata?.first_name || "";
        const lastName = user.user_metadata?.last_name || "";
        setCurrentUser({ firstName, lastName });
      }
    };
    fetchCurrentUser();
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

    const fieldsWithValues = new Set<string>();
    [...FERTILIZER_FIELDS, ...SEED_FIELDS].forEach((field) => {
      if (Number(allocation[field.name as keyof RegionalAllocation] || 0) > 0) {
        fieldsWithValues.add(field.name);
      }
    });

    setAddedFields(fieldsWithValues);
    setEditAllocationModal(allocation);
    setEditFormData({ ...allocation });
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    if (!editFormData) return;

    setEditFormData({
      ...editFormData,
      [name]:
        name === "season" || name === "allocation_date" || name === "notes"
          ? value
          : parseFloat(value) || 0,
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
    return season;
  };

  const getTotalFertilizer = (allocation: RegionalAllocation) => {
    return FERTILIZER_FIELDS.reduce(
      (sum, field) =>
        sum + (Number(allocation[field.name as keyof RegionalAllocation]) || 0),
      0,
    );
  };

  const getTotalSeeds = (allocation: RegionalAllocation) => {
    return SEED_FIELDS.reduce(
      (sum, field) =>
        sum + (Number(allocation[field.name as keyof RegionalAllocation]) || 0),
      0,
    );
  };

  const addFieldToEdit = (fieldName: string) => {
    setAddedFields((prev) => {
      const next = new Set(prev);
      next.add(fieldName);
      return next;
    });
  };

  const removeFieldFromEdit = (fieldName: string) => {
    setAddedFields((prev) => {
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
    setEditFormData((prev) => (prev ? { ...prev, [fieldName]: 0 } : null));
  };

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
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
              className={`sidebar-nav-item ${isActive("/technician-rsbsa") ? "active" : ""}`}
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
              <span className="nav-text">Subsidy</span>
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

            <button className="sidebar-nav-item logout" onClick={handleLogout}>
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>

            {/* Current User — inside nav, at the bottom */}
            {currentUser && (
              <div className="sidebar-current-user">
                <div className="sidebar-current-user-avatar">
                  {currentUser.firstName.charAt(0).toUpperCase()}
                  {currentUser.lastName.charAt(0).toUpperCase()}
                </div>
                <div className="sidebar-current-user-info">
                  <span className="sidebar-current-user-name">
                    {currentUser.firstName} {currentUser.lastName}
                  </span>
                  <span className="sidebar-current-user-label">Logged in</span>
                </div>
              </div>
            )}
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
                Manage farmer requests for agricultural programs
              </p>
            </div>
          </div>

          <div className="jo-incent-content-card">
            {loading ? (
              <div className="jo-incent-loading">Loading programs...</div>
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
                <h3>No Programs Available</h3>
                <p>Regional programs will appear here once created</p>
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
                  <h2>Edit Regional Program</h2>
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
                      This program has {requestCount} existing farmer
                      request(s).
                    </div>
                  )}

                  <div className="tech-incent-modal-form-grid">
                    <div className="tech-incent-modal-form-group full-width">
                      <label>Program Name</label>
                      <input
                        type="text"
                        name="season"
                        value={editFormData.season}
                        onChange={handleEditInputChange}
                      />
                    </div>

                    <div className="tech-incent-modal-form-group full-width">
                      <label>Select to Add Item</label>
                      <select
                        className="tech-allocation-select"
                        onChange={(e) => {
                          if (e.target.value) {
                            addFieldToEdit(e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="">
                          -- Choose Fertilizer or Seed --
                        </option>
                        <optgroup label="Fertilizers">
                          {FERTILIZER_FIELDS.filter(
                            (f) => !addedFields.has(f.name),
                          ).map((f) => (
                            <option key={f.name} value={f.name}>
                              {f.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Seeds">
                          {SEED_FIELDS.filter(
                            (s) => !addedFields.has(s.name),
                          ).map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {[...addedFields].sort().map((fieldName) => {
                      const field = [...FERTILIZER_FIELDS, ...SEED_FIELDS].find(
                        (f) => f.name === fieldName,
                      );
                      return (
                        <div
                          key={fieldName}
                          className="tech-incent-modal-form-group dynamic-edit-field"
                        >
                          <div className="field-label-row">
                            <label>{field?.label}</label>
                            <button
                              type="button"
                              className="remove-field-btn"
                              onClick={() => removeFieldFromEdit(fieldName)}
                            >
                              ×
                            </button>
                          </div>
                          <input
                            type="number"
                            name={fieldName}
                            value={
                              editFormData[
                                fieldName as keyof RegionalAllocation
                              ] || 0
                            }
                            onChange={handleEditInputChange}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      );
                    })}
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
