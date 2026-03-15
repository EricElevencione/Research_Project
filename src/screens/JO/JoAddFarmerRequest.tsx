import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAllocations,
  getFarmerRequests,
  getRsbsaSubmissions,
  createFarmerRequest,
} from "../../api";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import "../../assets/css/jo css/JoAddFarmerRequestStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

interface Farmer {
  id: number;
  rsbsa_no: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  extension_name: string;
  barangay: string;
}

interface AllocationDetails {
  id: number;
  season: string;
  allocation_date: string;
  urea_46_0_0_bags?: number;
  complete_14_14_14_bags?: number;
  ammonium_sulfate_21_0_0_bags?: number;
  muriate_potash_0_0_60_bags?: number;
  jackpot_kg?: number;
  us88_kg?: number;
  th82_kg?: number;
  rh9000_kg?: number;
  lumping143_kg?: number;
  lp296_kg?: number;
}

interface FarmerRequestForm {
  farmer_id: number;
  requested_urea_bags: number;
  requested_complete_14_bags: number;
  requested_ammonium_sulfate_bags: number;
  requested_muriate_potash_bags: number;
  requested_jackpot_kg: number;
  requested_us88_kg: number;
  requested_th82_kg: number;
  requested_rh9000_kg: number;
  requested_lumping143_kg: number;
  requested_lp296_kg: number;
  notes: string;
}

type RequestField = keyof Omit<FarmerRequestForm, "farmer_id" | "notes">;

const FERTILIZER_ITEMS: Array<{
  label: string;
  allocationField: keyof AllocationDetails;
  requestField: RequestField;
}> = [
  {
    label: "Urea (46-0-0)",
    allocationField: "urea_46_0_0_bags",
    requestField: "requested_urea_bags",
  },
  {
    label: "Complete (14-14-14)",
    allocationField: "complete_14_14_14_bags",
    requestField: "requested_complete_14_bags",
  },
  {
    label: "Ammonium Sulfate (21-0-0)",
    allocationField: "ammonium_sulfate_21_0_0_bags",
    requestField: "requested_ammonium_sulfate_bags",
  },
  {
    label: "Muriate of Potash (0-0-60)",
    allocationField: "muriate_potash_0_0_60_bags",
    requestField: "requested_muriate_potash_bags",
  },
];

const SEED_ITEMS: Array<{
  label: string;
  allocationField: keyof AllocationDetails;
  requestField: RequestField;
}> = [
  {
    label: "Jackpot",
    allocationField: "jackpot_kg",
    requestField: "requested_jackpot_kg",
  },
  {
    label: "US88",
    allocationField: "us88_kg",
    requestField: "requested_us88_kg",
  },
  {
    label: "TH82",
    allocationField: "th82_kg",
    requestField: "requested_th82_kg",
  },
  {
    label: "RH9000",
    allocationField: "rh9000_kg",
    requestField: "requested_rh9000_kg",
  },
  {
    label: "Lumping143",
    allocationField: "lumping143_kg",
    requestField: "requested_lumping143_kg",
  },
  {
    label: "LP296",
    allocationField: "lp296_kg",
    requestField: "requested_lp296_kg",
  },
];

const JoAddFarmerRequest: React.FC = () => {
  const navigate = useNavigate();
  const { allocationId } = useParams<{ allocationId: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [existingRequests, setExistingRequests] = useState<number[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState<"success" | "error">(
    "success",
  );

  const [formData, setFormData] = useState<FarmerRequestForm>({
    farmer_id: 0,
    requested_urea_bags: 0,
    requested_complete_14_bags: 0,
    requested_ammonium_sulfate_bags: 0,
    requested_muriate_potash_bags: 0,
    requested_jackpot_kg: 0,
    requested_us88_kg: 0,
    requested_th82_kg: 0,
    requested_rh9000_kg: 0,
    requested_lumping143_kg: 0,
    requested_lp296_kg: 0,
    notes: "",
  });

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    fetchAllocation();
    fetchFarmers();
  }, [allocationId]);

  useEffect(() => {
    if (allocation?.season) {
      fetchExistingRequests();
    }
  }, [allocation]);

  const fetchAllocation = async () => {
    try {
      const response = await getAllocations();
      if (!response.error) {
        const allocations = response.data || [];
        const targetId = parseInt(allocationId || "0", 10);
        const found = allocations.find((a: any) => a.id === targetId);
        setAllocation(found || null);
        if (!found) {
          setError(`Allocation with ID ${allocationId} not found`);
        }
      } else {
        setError("Failed to fetch allocation data");
      }
    } catch (err) {
      console.error("Failed to fetch allocation:", err);
      setError("Error loading allocation data");
    }
  };

  const fetchExistingRequests = async () => {
    if (!allocationId) return;

    try {
      const response = await getFarmerRequests(allocationId, true);
      if (!response.error) {
        const requests = response.data || [];
        const farmerIds = requests.map((req: any) => Number(req.farmer_id));
        setExistingRequests(farmerIds);
      }
    } catch (err) {
      console.error("Failed to fetch existing requests:", err);
    }
  };

  const fetchFarmers = async () => {
    try {
      const response = await getRsbsaSubmissions();
      if (!response.error) {
        const data = response.data || [];
        const transformedFarmers = data
          .filter((item: any) => {
            const status = String(item.status ?? "")
              .toLowerCase()
              .trim();
            const allowedStatuses = [
              "active farmer",
              "submitted",
              "approved",
              "active",
            ];
            return status !== "no parcels" && allowedStatuses.includes(status);
          })
          .map((item: any) => {
            const nameParts = (item.farmerName || "").split(", ");
            const lastName = nameParts[0] || "";
            const firstAndMiddle = nameParts[1] || "";
            const [firstName, ...middleNameParts] = firstAndMiddle.split(" ");
            const addressParts = (item.farmerAddress || "").split(", ");
            const barangay = addressParts[0] || "";

            return {
              id: item.id,
              rsbsa_no: item.referenceNumber || `RSBSA-${item.id}`,
              first_name: firstName || "",
              middle_name: middleNameParts.join(" ") || "",
              last_name: lastName,
              extension_name: "",
              barangay,
            };
          });
        setFarmers(transformedFarmers);
      }
    } catch (err) {
      console.error("Failed to fetch farmers:", err);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "farmer_id" || name.includes("requested_")
          ? value === ""
            ? 0
            : parseFloat(value)
          : value,
    }));
  };

  const visibleFertilizerItems = FERTILIZER_ITEMS.filter(
    (item) => (Number(allocation?.[item.allocationField]) || 0) > 0,
  );

  const visibleSeedItems = SEED_ITEMS.filter(
    (item) => (Number(allocation?.[item.allocationField]) || 0) > 0,
  );

  const hasVisibleAllocationItems =
    visibleFertilizerItems.length > 0 || visibleSeedItems.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.farmer_id) {
      setError("Please select a farmer");
      return;
    }

    if (!allocation || !allocation.season) {
      setError("Allocation data not loaded. Please refresh the page.");
      return;
    }

    if (!hasVisibleAllocationItems) {
      setError(
        "This allocation has no available fertilizer or seed items to request.",
      );
      return;
    }

    const selectedFarmer = farmers.find(
      (f) => Number(f.id) === Number(formData.farmer_id),
    );
    if (!selectedFarmer) {
      setError("Selected farmer not found");
      return;
    }

    const farmerFullName =
      `${selectedFarmer.last_name}, ${selectedFarmer.first_name} ${selectedFarmer.middle_name || ""}`.trim();

    setLoading(true);
    setError(null);

    try {
      const totalFertilizerRequested = visibleFertilizerItems.reduce(
        (sum, item) => sum + (Number(formData[item.requestField]) || 0),
        0,
      );

      const totalSeedsRequested = visibleSeedItems.reduce(
        (sum, item) => sum + (Number(formData[item.requestField]) || 0),
        0,
      );

      const response = await createFarmerRequest({
        allocation_id: Number(allocationId),
        season: allocation.season,
        farmer_id: formData.farmer_id,
        farmer_name: farmerFullName,
        barangay: selectedFarmer.barangay,
        farm_area_ha: 0,
        crop_type: "Rice",
        ownership_type: "Owner",
        num_parcels: 1,
        fertilizer_requested: totalFertilizerRequested > 0,
        seeds_requested: totalSeedsRequested > 0,
        request_notes: formData.notes || null,
        created_by: null,
        requested_urea_bags: formData.requested_urea_bags,
        requested_complete_14_bags: formData.requested_complete_14_bags,
        requested_ammonium_sulfate_bags:
          formData.requested_ammonium_sulfate_bags,
        requested_muriate_potash_bags: formData.requested_muriate_potash_bags,
        requested_jackpot_kg: formData.requested_jackpot_kg,
        requested_us88_kg: formData.requested_us88_kg,
        requested_th82_kg: formData.requested_th82_kg,
        requested_rh9000_kg: formData.requested_rh9000_kg,
        requested_lumping143_kg: formData.requested_lumping143_kg,
        requested_lp296_kg: formData.requested_lp296_kg,
      });

      if (response.error) {
        throw new Error(response.error || "Failed to save farmer request");
      }

      try {
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const auditLogger = getAuditLogger();
        const allocationLabel = allocation.season
          ? allocation.season.replace("_", " ").toUpperCase()
          : "UNKNOWN SEASON";

        await auditLogger.logCRUD(
          {
            id: currentUser.id,
            name: currentUser.name || currentUser.username || "Unknown",
            role: currentUser.role || "JO",
          },
          "CREATE",
          AuditModule.REQUESTS,
          "farmer_request",
          response.data?.id || 0,
          `Added farmer request for ${farmerFullName} (${allocationLabel})`,
          undefined,
          {
            farmer_name: farmerFullName,
            allocation_season: allocation.season || null,
            allocation_date: allocation.allocation_date || null,
            requested_fertilizer_total_bags: totalFertilizerRequested,
            requested_seed_total_kg: totalSeedsRequested,
            requested_urea_bags: formData.requested_urea_bags,
            requested_complete_14_bags: formData.requested_complete_14_bags,
            requested_ammonium_sulfate_bags:
              formData.requested_ammonium_sulfate_bags,
            requested_muriate_potash_bags:
              formData.requested_muriate_potash_bags,
            requested_jackpot_kg: formData.requested_jackpot_kg,
            requested_us88_kg: formData.requested_us88_kg,
            requested_th82_kg: formData.requested_th82_kg,
            requested_rh9000_kg: formData.requested_rh9000_kg,
            requested_lumping143_kg: formData.requested_lumping143_kg,
            requested_lp296_kg: formData.requested_lp296_kg,
            request_notes: formData.notes || null,
          },
          {
            includeRouteContext: false,
            metadata: null,
          },
        );
      } catch (auditErr) {
        console.error("Audit log failed (non-blocking):", auditErr);
      }

      setNotificationType("success");
      setNotificationMessage("Farmer request added successfully!");
      setShowNotification(true);

      setTimeout(() => {
        setShowNotification(false);
        setTimeout(() => {
          navigate(`/jo-manage-requests/${allocationId}`);
        }, 300);
      }, 2000);
    } catch (err: any) {
      setNotificationType("error");
      setNotificationMessage(err.message || "Failed to save farmer request");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 4000);
      setError(err.message || "Failed to save farmer request");
    } finally {
      setLoading(false);
    }
  };

  const filteredFarmers = farmers.filter((farmer) => {
    if (existingRequests.includes(Number(farmer.id))) {
      return false;
    }

    const searchLower = searchTerm.toLowerCase();
    const fullName =
      `${farmer.first_name} ${farmer.middle_name} ${farmer.last_name}`.toLowerCase();
    const rsbsa = farmer.rsbsa_no?.toLowerCase() || "";
    return fullName.includes(searchLower) || rsbsa.includes(searchLower);
  });

  return (
    <div className="jo-add-farmer-page-container">
      {showNotification && (
        <div className={`notification-toast notification-${notificationType}`}>
          <div className="notification-content">
            <span className="notification-icon">
              {notificationType === "success" ? "✅" : "❌"}
            </span>
            <span className="notification-message">{notificationMessage}</span>
          </div>
          <button
            className="notification-close"
            onClick={() => setShowNotification(false)}
          >
            ×
          </button>
        </div>
      )}

      <div className="jo-add-farmer-page">
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
              <span className="nav-text">Incentives</span>
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

        <div className="jo-add-farmer-main-content">
          <div className="jo-add-farmer-header">
            <h2 className="jo-add-farmer-title">➕ Add Farmer Request</h2>
            <p className="jo-add-farmer-subtitle">
              {allocation
                ? `Season: ${allocation.season.replace("_", " ").toUpperCase()}`
                : "Loading..."}
            </p>
            <button
              className="jo-add-farmer-back-btn"
              onClick={() => navigate(`/jo-manage-requests/${allocationId}`)}
            >
              ← Back to Manage Requests
            </button>
          </div>

          <div className="jo-add-farmer-content-card">
            <form onSubmit={handleSubmit}>
              <div className="jo-add-farmer-section">
                <h3 className="jo-add-farmer-section-title">Select Farmer</h3>
                <div className="jo-add-farmer-search-container">
                  <input
                    type="text"
                    placeholder="🔍 Search by name or RSBSA number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="jo-add-farmer-search-input"
                  />
                  {existingRequests.length > 0 && (
                    <div className="jo-add-farmer-info-box">
                      <span>ℹ️</span>
                      <span>
                        {existingRequests.length} farmer
                        {existingRequests.length !== 1 ? "s" : ""} hidden
                        (already have request
                        {existingRequests.length !== 1 ? "s" : ""} for this
                        season)
                      </span>
                    </div>
                  )}
                </div>
                <div className="jo-add-farmer-list-container">
                  {filteredFarmers.length === 0 ? (
                    <div className="jo-add-farmer-empty-state">
                      No farmers found
                    </div>
                  ) : (
                    filteredFarmers.map((farmer) => (
                      <label
                        key={farmer.id}
                        className={`jo-add-farmer-item ${Number(formData.farmer_id) === Number(farmer.id) ? "selected" : ""}`}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            farmer_id: Number(farmer.id),
                          }));
                        }}
                      >
                        <input
                          type="radio"
                          name="farmer_id"
                          value={farmer.id}
                          checked={
                            Number(formData.farmer_id) === Number(farmer.id)
                          }
                          onChange={() => {}}
                          className="jo-add-farmer-radio"
                        />
                        <div className="jo-add-farmer-item-content">
                          <div className="jo-add-farmer-name">
                            {farmer.last_name}, {farmer.first_name}{" "}
                            {farmer.middle_name ? farmer.middle_name + " " : ""}
                            {farmer.extension_name
                              ? farmer.extension_name + " "
                              : ""}
                          </div>
                          <div className="jo-add-farmer-details">
                            📍 {farmer.barangay} • RSBSA: {farmer.rsbsa_no}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="jo-add-farmer-section">
                <h3 className="jo-add-farmer-section-title">
                  🌱 Requested Fertilizers (bags)
                </h3>
                <div className="jo-add-farmer-form-grid">
                  {visibleFertilizerItems.length === 0 ? (
                    <div className="jo-add-farmer-empty-state">
                      No fertilizer items are available in this allocation.
                    </div>
                  ) : (
                    visibleFertilizerItems.map((item) => (
                      <div
                        key={item.requestField}
                        className="jo-add-farmer-form-group"
                      >
                        <label className="jo-add-farmer-label">
                          {item.label}
                        </label>
                        <input
                          type="number"
                          name={item.requestField}
                          value={Number(formData[item.requestField]) || 0}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="jo-add-farmer-input"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="jo-add-farmer-section">
                <h3 className="jo-add-farmer-section-title">
                  🌾 Requested Seeds (kg)
                </h3>
                <div className="jo-add-farmer-form-grid">
                  {visibleSeedItems.length === 0 ? (
                    <div className="jo-add-farmer-empty-state">
                      No seed items are available in this allocation.
                    </div>
                  ) : (
                    visibleSeedItems.map((item) => (
                      <div
                        key={item.requestField}
                        className="jo-add-farmer-form-group"
                      >
                        <label className="jo-add-farmer-label">
                          {item.label}
                        </label>
                        <input
                          type="number"
                          name={item.requestField}
                          value={Number(formData[item.requestField]) || 0}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="jo-add-farmer-input"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {!hasVisibleAllocationItems && (
                <div className="jo-add-farmer-error-box">
                  This allocation has no items with values greater than zero.
                </div>
              )}

              <div className="jo-add-farmer-section">
                <label className="jo-add-farmer-label">Notes / Remarks</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Add any additional notes..."
                  className="jo-add-farmer-textarea"
                />
              </div>

              {error && <div className="jo-add-farmer-error-box">{error}</div>}

              <div className="jo-add-farmer-actions">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/jo-manage-requests/${allocationId}`)
                  }
                  className="jo-add-farmer-cancel-btn"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jo-add-farmer-submit-btn"
                  disabled={loading || !hasVisibleAllocationItems}
                >
                  {loading ? "💾 Saving..." : "✅ Add Farmer Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoAddFarmerRequest;
