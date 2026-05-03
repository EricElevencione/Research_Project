import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getAllocations,
  getFarmerRequests,
  deleteAllocation,
  updateAllocation,
} from "../../api";
import "../../assets/css/jo css/JoIncentStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";
import {
  EDIT_REGIONAL_FERTILIZER_FIELDS,
  EDIT_REGIONAL_SEED_FIELDS,
} from "../../constants/joRegionalAllocationEditCatalog";

interface RegionalAllocation {
  id: number;
  season: string;
  allocation_date: string;
  urea_46_0_0_bags: number;
  complete_14_14_14_bags: number;
  np_16_20_0_bags?: number;
  ammonium_sulfate_21_0_0_bags: number;
  muriate_potash_0_0_60_bags: number;
  zinc_sulfate_bags?: number;
  vermicompost_bags?: number;
  chicken_manure_bags?: number;
  rice_straw_kg?: number;
  carbonized_rice_hull_bags?: number;
  biofertilizer_liters?: number;
  nanobiofertilizer_liters?: number;
  organic_root_exudate_mix_liters?: number;
  azolla_microphylla_kg?: number;
  foliar_liquid_fertilizer_npk_liters?: number;
  rice_seeds_nsic_rc160_kg: number;
  rice_seeds_nsic_rc222_kg: number;
  jackpot_kg?: number;
  us88_kg?: number;
  th82_kg?: number;
  rh9000_kg?: number;
  lumping143_kg?: number;
  lp296_kg?: number;
  mestiso_1_kg?: number;
  mestiso_20_kg?: number;
  mestiso_29_kg?: number;
  mestiso_55_kg?: number;
  mestiso_73_kg?: number;
  mestiso_99_kg?: number;
  mestiso_103_kg?: number;
  nsic_rc402_kg?: number;
  nsic_rc480_kg?: number;
  nsic_rc216_kg?: number;
  nsic_rc218_kg?: number;
  nsic_rc506_kg?: number;
  nsic_rc508_kg?: number;
  nsic_rc512_kg?: number;
  nsic_rc534_kg?: number;
  tubigan_28_kg?: number;
  tubigan_30_kg?: number;
  tubigan_22_kg?: number;
  sahod_ulan_2_kg?: number;
  sahod_ulan_10_kg?: number;
  salinas_6_kg?: number;
  salinas_7_kg?: number;
  salinas_8_kg?: number;
  malagkit_5_kg?: number;
  complete_16_16_16_bags?: number;
  ammonium_phosphate_16_20_0_bags?: number;
  rice_seeds_nsic_rc440_kg?: number;
  corn_seeds_hybrid_kg?: number;
  corn_seeds_opm_kg?: number;
  vegetable_seeds_kg?: number;
  notes?: string;
  status?: string;
  farmer_count?: number;
}

type AllocationNumericField =
  | "urea_46_0_0_bags"
  | "complete_14_14_14_bags"
  | "np_16_20_0_bags"
  | "ammonium_sulfate_21_0_0_bags"
  | "muriate_potash_0_0_60_bags"
  | "zinc_sulfate_bags"
  | "vermicompost_bags"
  | "chicken_manure_bags"
  | "rice_straw_kg"
  | "carbonized_rice_hull_bags"
  | "biofertilizer_liters"
  | "nanobiofertilizer_liters"
  | "organic_root_exudate_mix_liters"
  | "azolla_microphylla_kg"
  | "foliar_liquid_fertilizer_npk_liters"
  | "rice_seeds_nsic_rc160_kg"
  | "rice_seeds_nsic_rc222_kg"
  | "jackpot_kg"
  | "us88_kg"
  | "th82_kg"
  | "rh9000_kg"
  | "lumping143_kg"
  | "lp296_kg"
  | "mestiso_1_kg"
  | "mestiso_20_kg"
  | "mestiso_29_kg"
  | "mestiso_55_kg"
  | "mestiso_73_kg"
  | "mestiso_99_kg"
  | "mestiso_103_kg"
  | "nsic_rc402_kg"
  | "nsic_rc480_kg"
  | "nsic_rc216_kg"
  | "nsic_rc218_kg"
  | "nsic_rc506_kg"
  | "nsic_rc508_kg"
  | "nsic_rc512_kg"
  | "nsic_rc534_kg"
  | "tubigan_28_kg"
  | "tubigan_30_kg"
  | "tubigan_22_kg"
  | "sahod_ulan_2_kg"
  | "sahod_ulan_10_kg"
  | "salinas_6_kg"
  | "salinas_7_kg"
  | "salinas_8_kg"
  | "malagkit_5_kg"
  | "complete_16_16_16_bags"
  | "ammonium_phosphate_16_20_0_bags"
  | "rice_seeds_nsic_rc440_kg"
  | "corn_seeds_hybrid_kg"
  | "corn_seeds_opm_kg"
  | "vegetable_seeds_kg";

const PROGRAM_NAME_OPTIONS = [
  "RCEF (Rice Competitiveness Enhancement Fund)",
  "National Rice Program",
  "National Corn Program",
  "High Value Crops Development Program (HVCDP)",
  "Hybrid Rice Program",
  "Organic Agriculture Program",
  "Special Area for Agricultural Development (SAAD)",
  "LSA (Learning Site for Agriculture)",
  "Regular Program",
];

const EDIT_FERTILIZER_FIELDS = EDIT_REGIONAL_FERTILIZER_FIELDS as Array<{
  key: AllocationNumericField;
  label: string;
  category: "Solid" | "Liquid";
}>;

const EDIT_SEED_FIELDS = EDIT_REGIONAL_SEED_FIELDS as Array<{
  key: AllocationNumericField;
  label: string;
  category: "Hybrid" | "Inbred";
}>;

const EDIT_NUMERIC_FIELDS: AllocationNumericField[] = [
  ...EDIT_FERTILIZER_FIELDS.map((field) => field.key),
  ...EDIT_SEED_FIELDS.map((field) => field.key),
];

const FERTILIZER_TOTAL_FIELDS: Array<keyof RegionalAllocation | string> =
  EDIT_FERTILIZER_FIELDS.map((field) => field.key);

const SEED_TOTAL_FIELDS: Array<keyof RegionalAllocation | string> =
  EDIT_SEED_FIELDS.map((field) => field.key);

interface DeleteConfirmationState {
  id: number;
  season: string;
}

const JoIncentives: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editAllocationModal, setEditAllocationModal] =
    useState<RegionalAllocation | null>(null);
  const [editFormData, setEditFormData] = useState<RegionalAllocation | null>(
    null,
  );
  const [addedFields, setAddedFields] = useState<Set<string>>(new Set());
  const [requestCount, setRequestCount] = useState<number>(0);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmationState | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteNotification, setShowDeleteNotification] = useState(false);
  const [deleteNotificationMessage, setDeleteNotificationMessage] =
    useState("");
  const [deleteNotificationType, setDeleteNotificationType] = useState<
    "success" | "error"
  >("success");
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [updateNotificationMessage, setUpdateNotificationMessage] =
    useState("");
  const [updateNotificationType, setUpdateNotificationType] = useState<
    "success" | "error"
  >("success");

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

  const handleDelete = async (id: number, season: string) => {
    setDeleteConfirmation({ id, season });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;

    try {
      setDeleting(true);
      const response = await deleteAllocation(deleteConfirmation.id);

      if (!response.error) {
        setDeleteConfirmation(null);
        setDeleteNotificationType("success");
        setDeleteNotificationMessage("✅ Allocation deleted successfully");
        setShowDeleteNotification(true);
        setTimeout(() => setShowDeleteNotification(false), 2600);
        fetchAllocations();
      } else {
        setDeleteNotificationType("error");
        setDeleteNotificationMessage("❌ Failed to delete allocation");
        setShowDeleteNotification(true);
        setTimeout(() => setShowDeleteNotification(false), 3000);
      }
    } catch (error) {
      console.error("Error deleting allocation:", error);
      setDeleteNotificationType("error");
      setDeleteNotificationMessage("❌ Error deleting allocation");
      setShowDeleteNotification(true);
      setTimeout(() => setShowDeleteNotification(false), 3000);
    } finally {
      setDeleting(false);
    }
  };

  const formatSeasonName = (season: string) => {
    return season; // Simply return the string as it is now a Program Name
  };

  const getTotalFertilizer = (allocation: RegionalAllocation) => {
    const total = FERTILIZER_TOTAL_FIELDS.reduce(
      (sum, field) => sum + (Number((allocation as any)[field]) || 0),
      0,
    );
    return isNaN(total) ? 0 : total;
  };

  const getTotalSeeds = (allocation: RegionalAllocation) => {
    const total = SEED_TOTAL_FIELDS.reduce(
      (sum, field) => sum + (Number((allocation as any)[field]) || 0),
      0,
    );
    return isNaN(total) ? 0 : total;
  };

  const handleEditAllocation = async (allocation: RegionalAllocation) => {
    setAddedFields(new Set());
    try {
      // Fetch request count for this allocation
      const response = await getFarmerRequests(allocation.id, true);
      if (!response.error) {
        const requests = response.data || [];
        setRequestCount(requests.length);
      } else {
        setRequestCount(0);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
      setRequestCount(0);
    }

    const normalizedAllocation: RegionalAllocation = {
      ...allocation,
      ...Object.fromEntries(
        EDIT_NUMERIC_FIELDS.map((field) => [
          field,
          Number((allocation as any)[field]) || 0,
        ]),
      ),
    };

    setEditAllocationModal(normalizedAllocation);
    setEditFormData(normalizedAllocation);
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    if (!editFormData) return;

    let parsedValue: any = value;
    if (name.includes("bags")) {
      // Bags should be integers
      parsedValue = parseInt(value) || 0;
    } else if (name.includes("kg") || name.includes("liters")) {
      // Seeds and liquid inputs can have decimals
      parsedValue = parseFloat(value) || 0;
    }

    setEditFormData({
      ...editFormData,
      [name]: parsedValue,
    });
  };

  const handleDateChange = (part: "year" | "month" | "day", value: string) => {
    if (!editFormData) return;

    const currentDate = editFormData.allocation_date
      ? new Date(editFormData.allocation_date)
      : new Date();
    let year = currentDate.getFullYear();
    let month = currentDate.getMonth();
    let day = currentDate.getDate();

    if (part === "year") year = parseInt(value);
    if (part === "month") month = parseInt(value);
    if (part === "day") day = parseInt(value);

    const newDate = new Date(year, month, day);
    setEditFormData({
      ...editFormData,
      allocation_date: newDate.toISOString().split("T")[0],
    });
  };

  const visibleEditFertilizerFields = editFormData
    ? EDIT_FERTILIZER_FIELDS.filter(
        (field) =>
          Number((editFormData as any)[field.key]) > 0 ||
          addedFields.has(field.key),
      )
    : [];

  const visibleEditSeedFields = editFormData
    ? EDIT_SEED_FIELDS.filter(
        (field) =>
          Number((editFormData as any)[field.key]) > 0 ||
          addedFields.has(field.key),
      )
    : [];

  const addFieldToEdit = (key: string) => {
    setAddedFields((prev) => new Set(prev).add(key));
  };

  const removeAllocationLineItem = (key: string) => {
    if (!editFormData) return;
    setAddedFields((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setEditFormData({
      ...editFormData,
      [key]: 0 as any,
    });
  };

  const buildAllocationUpdatePayload = (allocation: RegionalAllocation) => {
    return {
      season: allocation.season,
      allocation_date: allocation.allocation_date,
      notes: allocation.notes || "",
      ...Object.fromEntries(
        EDIT_NUMERIC_FIELDS.map((field) => [
          field,
          Number((allocation as any)[field]) || 0,
        ]),
      ),
    };
  };

  const showUpdateToast = (
    message: string,
    type: "success" | "error",
    timeout = 3000,
  ) => {
    setUpdateNotificationType(type);
    setUpdateNotificationMessage(message);
    setShowUpdateNotification(true);
    setTimeout(() => setShowUpdateNotification(false), timeout);
  };

  const handleSaveEdit = async () => {
    if (!editFormData) return;

    // Confirm if there are existing requests
    if (requestCount > 0) {
      const confirmed = window.confirm(
        `⚠️ Warning: This allocation has ${requestCount} existing farmer request(s).\n\n` +
          `Editing this allocation may affect these requests.\n\n` +
          `Do you want to proceed?`,
      );
      if (!confirmed) return;
    }

    setSavingEdit(true);
    try {
      const payload = buildAllocationUpdatePayload(editFormData);
      const response = await updateAllocation(editFormData.id, payload);

      if (response.error) {
        throw new Error(response.error || "Failed to update allocation");
      }

      showUpdateToast("✅ Allocation updated successfully!", "success", 2600);
      setEditAllocationModal(null);
      setEditFormData(null);
      fetchAllocations(); // Refresh allocations list
    } catch (error: any) {
      console.error("Error updating allocation:", error);
      showUpdateToast(
        `❌ Error updating allocation: ${error.message || "Please try again."}`,
        "error",
        3800,
      );
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="jo-incent-page-container">
      {showDeleteNotification && (
        <div
          className={`jo-incent-delete-toast ${deleteNotificationType === "success" ? "success" : "error"}`}
        >
          <span className="jo-incent-delete-toast-message">
            {deleteNotificationMessage}
          </span>
          <button
            className="jo-incent-delete-toast-close"
            onClick={() => setShowDeleteNotification(false)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}

      {showUpdateNotification && (
        <div
          className={`jo-incent-update-toast ${updateNotificationType === "success" ? "success" : "error"}`}
          role="status"
          aria-live="polite"
        >
          <span className="jo-incent-update-toast-message">
            {updateNotificationMessage}
          </span>
          <button
            className="jo-incent-update-toast-close"
            onClick={() => setShowUpdateNotification(false)}
            aria-label="Close update notification"
          >
            ×
          </button>
        </div>
      )}

      <div className="jo-incent-page">
        {/* Sidebar starts here */}
        <div className="sidebar">
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive("/jo-dashboard") ? "active" : ""}`}
              onClick={() => navigate("/jo-dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-rsbsapage") ? "active" : ""}`}
              onClick={() => navigate("/jo-rsbsapage")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-incentives") ? "active" : ""}`}
              onClick={() => navigate("/jo-incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Subsidy</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-masterlist") ? "active" : ""}`}
              onClick={() => navigate("/jo-masterlist")}
            >
              <span className="nav-icon">
                <img src={MasterlistIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <div
              className={`sidebar-nav-item ${isActive("/jo-land-registry") ? "active" : ""}`}
              onClick={() => navigate("/jo-land-registry")}
            >
              <div className="nav-icon">🗺️</div>
              <span className="nav-text">Land Registry</span>
            </div>

            <div
              className={`sidebar-nav-item ${isActive("/jo-land-history-report") ? "active" : ""}`}
              onClick={() => navigate("/jo-land-history-report")}
            >
              <div className="nav-icon">📜</div>
              <span className="nav-text">Land History Report</span>
            </div>

            <button
              className="sidebar-nav-item logout"
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

        {/* Main content starts here */}
        <div className="jo-incent-main-content">
          <div className="jo-incent-dashboard-header">
            <h2 className="jo-incent-page-header">Farmer Programs</h2>
            <p className="jo-incent-page-subtitle">
              Add farmer requests to available regional programs
            </p>
          </div>

          <div className="jo-incent-action-header">
          </div>

          <div className="jo-incent-content-card">
            {loading ? (
              <div className="jo-incent-loading">Loading allocations...</div>
            ) : error ? (
              <div className="jo-incent-error-state">
                <div className="jo-incent-error-icon">⚠️</div>
                <h3>Unable to Connect to Server</h3>
                <p>{error}</p>
                <div className="jo-incent-error-help">
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
                  className="jo-incent-btn-retry"
                  onClick={fetchAllocations}
                >
                  🔄 Retry Connection
                </button>
              </div>
            ) : allocations.length === 0 ? (
              <div className="jo-incent-empty-state">
                <div className="jo-incent-empty-icon">📦</div>
                <h3>No Allocations Yet</h3>
                <p>Create your first regional allocation to get started</p>
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
                          navigate(`/jo-view-allocation/${allocation.id}`)
                        }
                        title="View Details"
                      >
                        👁️ View
                      </button>
                      <button
                        className="jo-incent-btn-action jo-incent-btn-edit"
                        onClick={() => handleEditAllocation(allocation)}
                        title="Edit Allocation"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="jo-incent-btn-action jo-incent-btn-add"
                        onClick={() =>
                          navigate(`/jo-add-farmer-request/${allocation.id}`)
                        }
                        title="Add Farmer Request"
                      >
                        ➕ Add Request
                      </button>
                      <button
                        className="jo-incent-btn-action jo-incent-btn-manage"
                        onClick={() =>
                          navigate(`/jo-manage-requests/${allocation.id}`)
                        }
                        title="Manage Requests"
                      >
                        📋 Manage
                      </button>
                      <button
                        className="jo-incent-btn-action jo-incent-btn-delete"
                        onClick={() =>
                          handleDelete(allocation.id, allocation.season)
                        }
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Edit Allocation Modal */}
            {editAllocationModal && editFormData && (
              <div
                className="jo-incent-modal-overlay"
                onClick={() => setEditAllocationModal(null)}
              >
                <div
                  className="jo-incent-modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="jo-incent-modal-header">
                    <h2>✏️ Edit Regional Allocation</h2>
                    <button
                      onClick={() => setEditAllocationModal(null)}
                      className="jo-incent-modal-close"
                    >
                      ×
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="jo-incent-modal-body">
                    {requestCount > 0 && (
                      <div className="jo-incent-modal-warning">
                        ⚠️ <strong>Warning:</strong> This allocation has{" "}
                        {requestCount} existing farmer request(s). Changes may
                        affect these requests.
                      </div>
                    )}

                    {/* Season Information */}
                    <div style={{ marginBottom: "24px" }}>
                      <h4 className="jo-incent-modal-section-title">
                        Program Information
                      </h4>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <label className="jo-incent-edit-label">
                            Program Name <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <input
                            type="text"
                            name="season"
                            list="program-names"
                            className="jo-incent-edit-input"
                            value={editFormData.season}
                            onChange={handleEditInputChange}
                            placeholder="Type or select a program..."
                          />
                          <datalist id="program-names">
                            {PROGRAM_NAME_OPTIONS.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </div>
                        <div>
                          <label className="jo-incent-edit-label">
                            Allocation Date
                          </label>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "2fr 1fr 1fr",
                              gap: "10px",
                            }}
                          >
                            {/* Month Dropdown */}
                            <select
                              value={
                                editFormData.allocation_date
                                  ? new Date(
                                      editFormData.allocation_date,
                                    ).getMonth()
                                  : new Date().getMonth()
                              }
                              onChange={(e) =>
                                handleDateChange("month", e.target.value)
                              }
                              className="jo-incent-edit-input"
                            >
                              <option value="0">January</option>
                              <option value="1">February</option>
                              <option value="2">March</option>
                              <option value="3">April</option>
                              <option value="4">May</option>
                              <option value="5">June</option>
                              <option value="6">July</option>
                              <option value="7">August</option>
                              <option value="8">September</option>
                              <option value="9">October</option>
                              <option value="10">November</option>
                              <option value="11">December</option>
                            </select>

                            {/* Day Dropdown */}
                            <select
                              value={
                                editFormData.allocation_date
                                  ? new Date(
                                      editFormData.allocation_date,
                                    ).getDate()
                                  : new Date().getDate()
                              }
                              onChange={(e) =>
                                handleDateChange("day", e.target.value)
                              }
                              className="jo-incent-edit-input"
                            >
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(
                                (day) => (
                                  <option key={day} value={day}>
                                    {day}
                                  </option>
                                ),
                              )}
                            </select>

                            {/* Year Dropdown */}
                            <select
                              value={
                                editFormData.allocation_date
                                  ? new Date(
                                      editFormData.allocation_date,
                                    ).getFullYear()
                                  : new Date().getFullYear()
                              }
                              onChange={(e) =>
                                handleDateChange("year", e.target.value)
                              }
                              className="jo-incent-edit-input"
                            >
                              {Array.from(
                                { length: 76 },
                                (_, i) => 2025 + i,
                              ).map((year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fertilizers — only rows with quantity or added via dropdown; remove clears to zero */}
                    <div style={{ marginBottom: "24px" }}>
                      <h4 className="jo-incent-modal-section-title">
                        🌱 Fertilizer Allocation
                      </h4>
                      <div style={{ marginBottom: "16px" }}>
                        <select
                          className="jo-incent-edit-input"
                          aria-label="Select fertilizer to add"
                          value=""
                          onChange={(e) => {
                            const key = e.target.value;
                            if (key) {
                              addFieldToEdit(key);
                            }
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>
                            Select Fertilizer to Add...
                          </option>
                          {(["Solid", "Liquid"] as const).map((category) => (
                            <optgroup
                              key={category}
                              label={`${category} Fertilizers`}
                            >
                              {EDIT_FERTILIZER_FIELDS.filter(
                                (f) =>
                                  f.category === category &&
                                  !visibleEditFertilizerFields.some(
                                    (vf) => vf.key === f.key,
                                  ),
                              ).map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      {visibleEditFertilizerFields.length === 0 ? (
                        <p
                          style={{
                            margin: 0,
                            color: "#6b7280",
                            fontSize: "14px",
                          }}
                        >
                          No fertilizer inputs in this allocation. Add rows
                          from the dropdown above.
                        </p>
                      ) : (
                        (["Solid", "Liquid"] as const).map((category) => {
                          const categoryFields =
                            visibleEditFertilizerFields.filter(
                              (field) => field.category === category,
                            );

                          if (categoryFields.length === 0) return null;

                          return (
                            <div
                              key={category}
                              style={{ marginBottom: "16px" }}
                            >
                              <h5
                                style={{
                                  margin: "0 0 8px 0",
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#374151",
                                }}
                              >
                                {category} Fertilizers
                              </h5>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, 1fr)",
                                  gap: "12px",
                                }}
                              >
                                {categoryFields.map((field) => (
                                  <div key={field.key}>
                                    <label
                                      style={{
                                        display: "block",
                                        marginBottom: "6px",
                                        fontSize: "14px",
                                      }}
                                    >
                                      {field.label}
                                    </label>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "8px",
                                        alignItems: "center",
                                      }}
                                    >
                                      <input
                                        type="number"
                                        name={field.key}
                                        value={
                                          Number(
                                            (editFormData as any)[field.key],
                                          ) || 0
                                        }
                                        onChange={handleEditInputChange}
                                        min="0"
                                        step={
                                          field.key.includes("liters") ||
                                          field.key.includes("kg")
                                            ? "0.01"
                                            : "1"
                                        }
                                        className="jo-incent-edit-input"
                                        style={{
                                          flex: 1,
                                          backgroundColor: "white",
                                        }}
                                      />
                                      <button
                                        type="button"
                                        aria-label={`Remove ${field.label}`}
                                        onClick={() =>
                                          removeAllocationLineItem(field.key)
                                        }
                                        title="Remove (sets amount to 0)"
                                        style={{
                                          flexShrink: 0,
                                          padding: "0 10px",
                                          alignSelf: "stretch",
                                          minHeight: "38px",
                                          background: "#fee2e2",
                                          color: "#ef4444",
                                          border: "none",
                                          borderRadius: "4px",
                                          cursor: "pointer",
                                          fontSize: "16px",
                                          lineHeight: 1,
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Seeds */}
                    <div style={{ marginBottom: "24px" }}>
                      <h4 className="jo-incent-modal-section-title">
                        🌾 Seed Allocation
                      </h4>
                      <div style={{ marginBottom: "16px" }}>
                        <select
                          className="jo-incent-edit-input"
                          onChange={(e) => {
                            addFieldToEdit(e.target.value);
                            e.target.value = "";
                          }}
                          value=""
                        >
                          <option value="" disabled>
                            Select Seed to Add...
                          </option>
                          {["Hybrid", "Inbred"].map((category) => (
                            <optgroup key={category} label={`${category} Seeds`}>
                              {EDIT_SEED_FIELDS.filter(
                                (s) =>
                                  s.category === category &&
                                  !visibleEditSeedFields.some(
                                    (vs) => vs.key === s.key,
                                  ),
                              ).map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      {visibleEditSeedFields.length === 0 ? (
                        <p
                          style={{
                            margin: 0,
                            color: "#6b7280",
                            fontSize: "14px",
                          }}
                        >
                          No seed inputs in this allocation. Add rows from the
                          dropdown above.
                        </p>
                      ) : (
                        (["Hybrid", "Inbred"] as const).map((category) => {
                          const categoryFields = visibleEditSeedFields.filter(
                            (field) => field.category === category,
                          );

                          if (categoryFields.length === 0) return null;

                          return (
                            <div
                              key={category}
                              style={{ marginBottom: "16px" }}
                            >
                              <h5
                                style={{
                                  margin: "0 0 8px 0",
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#374151",
                                }}
                              >
                                {category} Seeds
                              </h5>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, 1fr)",
                                  gap: "12px",
                                }}
                              >
                                {categoryFields.map((field) => (
                                  <div key={field.key}>
                                    <label
                                      style={{
                                        display: "block",
                                        marginBottom: "6px",
                                        fontSize: "14px",
                                      }}
                                    >
                                      {field.label}
                                    </label>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "8px",
                                        alignItems: "center",
                                      }}
                                    >
                                      <input
                                        type="number"
                                        name={field.key}
                                        value={
                                          Number(
                                            (editFormData as any)[field.key],
                                          ) || 0
                                        }
                                        onChange={handleEditInputChange}
                                        min="0"
                                        step="0.01"
                                        className="jo-incent-edit-input"
                                        style={{
                                          flex: 1,
                                          backgroundColor: "white",
                                        }}
                                      />
                                      <button
                                        type="button"
                                        aria-label={`Remove ${field.label}`}
                                        onClick={() =>
                                          removeAllocationLineItem(field.key)
                                        }
                                        title="Remove (sets amount to 0)"
                                        style={{
                                          flexShrink: 0,
                                          padding: "0 10px",
                                          alignSelf: "stretch",
                                          minHeight: "38px",
                                          background: "#fee2e2",
                                          color: "#ef4444",
                                          border: "none",
                                          borderRadius: "4px",
                                          cursor: "pointer",
                                          fontSize: "16px",
                                          lineHeight: 1,
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom: "20px" }}>
                      <h4 className="jo-incent-modal-section-title">
                        📝 Notes
                      </h4>
                      <textarea
                        name="notes"
                        value={editFormData.notes || ""}
                        onChange={handleEditInputChange}
                        rows={3}
                        className="jo-incent-edit-input"
                        style={{ backgroundColor: "white", minHeight: "80px", cursor: "auto" }}
                        placeholder="Add any notes or comments..."
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="jo-incent-modal-actions">
                      <button
                        onClick={() => setEditAllocationModal(null)}
                        className="jo-incent-modal-btn-cancel"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={savingEdit}
                        className="jo-incent-modal-btn-save"
                      >
                        {savingEdit ? "💾 Saving..." : "✅ Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation && (
              <div
                className="jo-incent-modal-overlay"
                onClick={() => !deleting && setDeleteConfirmation(null)}
              >
                <div
                  className="jo-incent-modal-content jo-incent-delete-modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="jo-incent-modal-header jo-incent-delete-modal-header">
                    <h2>🗑️ Delete Regional Allocation</h2>
                    <button
                      onClick={() => setDeleteConfirmation(null)}
                      className="jo-incent-modal-close"
                      disabled={deleting}
                    >
                      ×
                    </button>
                  </div>

                  <div className="jo-incent-modal-body">
                    <div className="jo-incent-modal-warning jo-incent-delete-modal-warning">
                      <strong>
                        Are you sure you want to delete{" "}
                        {deleteConfirmation.season}? This will also delete all
                        associated farmer requests.
                      </strong>
                    </div>

                    <div className="jo-incent-modal-actions">
                      <button
                        onClick={() => setDeleteConfirmation(null)}
                        className="jo-incent-modal-btn-cancel"
                        disabled={deleting}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmDelete}
                        className="jo-incent-modal-btn-delete"
                        disabled={deleting}
                      >
                        {deleting ? "Deleting..." : "Yes, Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoIncentives;
