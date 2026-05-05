import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createAllocation } from "../../api";
import "../../assets/css/technician css/TechCreateAllocationStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";
import { supabase } from "../../supabase";

interface AllocationFormData {
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

const TechCreateAllocation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "warning";
  }>({
    show: false,
    message: "",
    type: "success",
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [addedFertilizers, setAddedFertilizers] = useState<string[]>([]);
  const [addedSeeds, setAddedSeeds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);

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

  const showToast = (
    message: string,
    type: "success" | "error" | "warning" = "success",
    duration: number = 3000,
  ) => {
    setToast({ show: true, message, type });
    if (duration > 0) {
      setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, duration);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  const todayDate = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState<AllocationFormData>({
    season: "",
    allocation_date: todayDate,
    urea_46_0_0_bags: 0,
    complete_14_14_14_bags: 0,
    np_16_20_0_bags: 0,
    ammonium_sulfate_21_0_0_bags: 0,
    muriate_potash_0_0_60_bags: 0,
    zinc_sulfate_bags: 0,
    vermicompost_bags: 0,
    chicken_manure_bags: 0,
    rice_straw_kg: 0,
    carbonized_rice_hull_bags: 0,
    biofertilizer_liters: 0,
    nanobiofertilizer_liters: 0,
    organic_root_exudate_mix_liters: 0,
    azolla_microphylla_kg: 0,
    foliar_liquid_fertilizer_npk_liters: 0,
    rice_seeds_nsic_rc160_kg: 0,
    rice_seeds_nsic_rc222_kg: 0,
    jackpot_kg: 0,
    us88_kg: 0,
    th82_kg: 0,
    rh9000_kg: 0,
    lumping143_kg: 0,
    lp296_kg: 0,
    mestiso_1_kg: 0,
    mestiso_20_kg: 0,
    mestiso_29_kg: 0,
    mestiso_55_kg: 0,
    mestiso_73_kg: 0,
    mestiso_99_kg: 0,
    mestiso_103_kg: 0,
    nsic_rc402_kg: 0,
    nsic_rc480_kg: 0,
    nsic_rc216_kg: 0,
    nsic_rc218_kg: 0,
    nsic_rc506_kg: 0,
    nsic_rc508_kg: 0,
    nsic_rc512_kg: 0,
    nsic_rc534_kg: 0,
    tubigan_28_kg: 0,
    tubigan_30_kg: 0,
    tubigan_22_kg: 0,
    sahod_ulan_2_kg: 0,
    sahod_ulan_10_kg: 0,
    salinas_6_kg: 0,
    salinas_7_kg: 0,
    salinas_8_kg: 0,
    malagkit_5_kg: 0,
    complete_16_16_16_bags: 0,
    ammonium_phosphate_16_20_0_bags: 0,
    rice_seeds_nsic_rc440_kg: 0,
    corn_seeds_hybrid_kg: 0,
    corn_seeds_opm_kg: 0,
    vegetable_seeds_kg: 0,
    notes: "",
  });

  const isActive = (path: string) => location.pathname === path;

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "season" || name === "allocation_date" || name === "notes"
          ? value
          : parseFloat(value) || 0,
    }));
  };

  const addFertilizer = (name: string) => {
    if (!addedFertilizers.includes(name)) {
      setAddedFertilizers([...addedFertilizers, name]);
    }
  };

  const removeFertilizer = (name: string) => {
    setAddedFertilizers(addedFertilizers.filter((item) => item !== name));
    setFormData((prev) => ({ ...prev, [name]: 0 }));
  };

  const addSeed = (name: string) => {
    if (!addedSeeds.includes(name)) {
      setAddedSeeds([...addedSeeds, name]);
    }
  };

  const removeSeed = (name: string) => {
    setAddedSeeds(addedSeeds.filter((item) => item !== name));
    setFormData((prev) => ({ ...prev, [name]: 0 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.season.trim()) {
      showToast("Please provide a Program Name", "warning");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await createAllocation(formData);

      if (response.error) {
        throw new Error(response.error || "Failed to save allocation");
      }

      const result = response.data;
      const allocationId = result?.id;

      if (!allocationId) {
        throw new Error("No allocation ID returned from server");
      }

      showToast("Regional program created successfully!", "success", 2500);
      setTimeout(() => {
        navigate(`/technician-add-farmer-request/${allocationId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to save allocation");
      showToast(err.message || "Failed to save allocation", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tech-allocation-page-container">
      <div className="tech-allocation-page">
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

          </nav>
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
        </div>

        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <div className="tech-allocation-main-content">
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
            <div className="tech-incent-mobile-title">Create Program</div>
          </div>

          <div className="tech-allocation-header">
            <h2 className="tech-allocation-title">📦 Regional Allocation</h2>
            <p className="tech-allocation-subtitle">
              Define resource allocation for a new agricultural program
            </p>
          </div>

          <div className="tech-allocation-content-card">
            <form onSubmit={handleSubmit}>
              <div className="tech-allocation-section">
                <h3 className="tech-allocation-section-title">
                  Program Information
                </h3>
                <div className="tech-allocation-grid-2">
                  <div className="tech-allocation-field">
                    <label className="tech-allocation-label">
                      Allocation Date{" "}
                      <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="date"
                      name="allocation_date"
                      value={formData.allocation_date}
                      onChange={handleInputChange}
                      required
                      className="tech-allocation-input"
                    />
                  </div>
                  <div className="tech-allocation-field">
                    <label className="tech-allocation-label">
                      Program Name <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="season"
                      value={formData.season}
                      onChange={handleInputChange}
                      placeholder="e.g. Rice Subsidy 2024"
                      required
                      className="tech-allocation-input"
                    />
                  </div>
                </div>
              </div>

              <div className="tech-allocation-section">
                <h3 className="tech-allocation-section-title">
                  🌱 Fertilizer Allocation
                </h3>
                <div className="tech-allocation-dropdown-group">
                  <label className="tech-allocation-label">
                    Select Fertilizer to Add
                  </label>
                  <select
                    className="tech-allocation-select"
                    onChange={(e) => {
                      if (e.target.value) {
                        addFertilizer(e.target.value);
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">-- Choose Fertilizer --</option>
                    {FERTILIZER_FIELDS.filter(
                      (f) => !addedFertilizers.includes(f.name),
                    ).map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="tech-allocation-dynamic-grid">
                  {addedFertilizers.map((fieldName) => {
                    const field = FERTILIZER_FIELDS.find(
                      (f) => f.name === fieldName,
                    );
                    return (
                      <div
                        key={fieldName}
                        className="tech-allocation-field dynamic-field"
                      >
                        <div className="field-header">
                          <label className="tech-allocation-label">
                            {field?.label}
                          </label>
                          <button
                            type="button"
                            className="remove-btn"
                            onClick={() => removeFertilizer(fieldName)}
                          >
                            ×
                          </button>
                        </div>
                        <input
                          type="number"
                          name={fieldName}
                          value={
                            formData[fieldName as keyof AllocationFormData]
                          }
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="tech-allocation-input"
                          autoFocus
                        />
                      </div>
                    );
                  })}
                  {addedFertilizers.length === 0 && (
                    <div className="empty-selection-msg">
                      No fertilizers added yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="tech-allocation-section">
                <h3 className="tech-allocation-section-title">
                  🌾 Seed Allocation
                </h3>
                <div className="tech-allocation-dropdown-group">
                  <label className="tech-allocation-label">
                    Select Seed to Add
                  </label>
                  <select
                    className="tech-allocation-select"
                    onChange={(e) => {
                      if (e.target.value) {
                        addSeed(e.target.value);
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">-- Choose Seed --</option>
                    {SEED_FIELDS.filter(
                      (s) => !addedSeeds.includes(s.name),
                    ).map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="tech-allocation-dynamic-grid">
                  {addedSeeds.map((fieldName) => {
                    const field = SEED_FIELDS.find((f) => f.name === fieldName);
                    return (
                      <div
                        key={fieldName}
                        className="tech-allocation-field dynamic-field"
                      >
                        <div className="field-header">
                          <label className="tech-allocation-label">
                            {field?.label}
                          </label>
                          <button
                            type="button"
                            className="remove-btn"
                            onClick={() => removeSeed(fieldName)}
                          >
                            ×
                          </button>
                        </div>
                        <input
                          type="number"
                          name={fieldName}
                          value={
                            formData[fieldName as keyof AllocationFormData]
                          }
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="tech-allocation-input"
                          autoFocus
                        />
                      </div>
                    );
                  })}
                  {addedSeeds.length === 0 && (
                    <div className="empty-selection-msg">
                      No seeds added yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="tech-allocation-section">
                <label className="tech-allocation-label">Notes / Remarks</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Add any additional notes or remarks..."
                  className="tech-allocation-textarea"
                />
              </div>

              {error && <div className="tech-allocation-error">{error}</div>}

              <div className="tech-allocation-actions">
                <button
                  type="button"
                  onClick={() => navigate("/technician-incentives")}
                  className="tech-allocation-btn-cancel"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tech-allocation-btn-submit"
                  disabled={loading}
                >
                  {loading ? "💾 Saving..." : "✅ Create Allocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {toast.show && (
        <div className={`tech-toast-notification tech-toast-${toast.type}`}>
          <div className="tech-toast-icon">
            {toast.type === "success" && "✅"}
            {toast.type === "error" && "❌"}
            {toast.type === "warning" && "⚠️"}
          </div>
          <div className="tech-toast-content">
            <span className="tech-toast-message">{toast.message}</span>
          </div>
          <button
            className="tech-toast-close"
            onClick={() => setToast((prev) => ({ ...prev, show: false }))}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default TechCreateAllocation;
