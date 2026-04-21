import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createAllocation } from "../../api";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import "../../assets/css/jo css/JoIncentStyle.css";
import "../../assets/css/jo css/JoCreateAllocationStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

type NumericInput = number | "";

type AllocationNumericField =
  | "urea_46_0_0_bags"
  | "complete_14_14_14_bags"
  | "ammonium_sulfate_21_0_0_bags"
  | "np_16_20_0_bags"
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
  | "malagkit_5_kg";

interface AllocationFormData extends Record<
  AllocationNumericField,
  NumericInput
> {
  season: string;
  allocation_date: string;
  notes: string;
}

const FERTILIZER_FIELDS: Array<{
  key: AllocationNumericField;
  label: string;
}> = [
  { key: "urea_46_0_0_bags", label: "Urea (46-0-0)" },
  { key: "complete_14_14_14_bags", label: "Complete (14-14-14)" },
  {
    key: "ammonium_sulfate_21_0_0_bags",
    label: "Ammonium Sulfate (21-0-0)",
  },
  { key: "np_16_20_0_bags", label: "16-20-0" },
  { key: "muriate_potash_0_0_60_bags", label: "Muriate of Potash (0-0-60)" },
  { key: "zinc_sulfate_bags", label: "Zinc Sulfate" },
  { key: "vermicompost_bags", label: "Vermicompost" },
  { key: "chicken_manure_bags", label: "Chicken Manure" },
  { key: "rice_straw_kg", label: "Rice Straw (incorporated)" },
  { key: "carbonized_rice_hull_bags", label: "Carbonized Rice Hull (CRH)" },
  { key: "biofertilizer_liters", label: "Biofertilizer (Liquid Concentrate)" },
  { key: "nanobiofertilizer_liters", label: "Nanobiofertilizer" },
  {
    key: "organic_root_exudate_mix_liters",
    label: "Organic Root Exudate Mix",
  },
  { key: "azolla_microphylla_kg", label: "Azolla microphylla" },
  {
    key: "foliar_liquid_fertilizer_npk_liters",
    label: "Foliar Liquid Fertilizer (NPK)",
  },
];

const FERTILIZER_CATALOG_ROWS: Array<{ name: string; category: string }> = [
  { name: "Urea (46-0-0)", category: "Solid" },
  { name: "Complete (14-14-14)", category: "Solid" },
  { name: "Ammonium Sulfate (21-0-0)", category: "Solid" },
  { name: "Muriate of Potash (0-0-60)", category: "Solid" },
  { name: "16-20-0", category: "Solid" },
  { name: "Zinc Sulfate", category: "Solid" },
  { name: "Vermicompost", category: "Solid" },
  { name: "Chicken Manure", category: "Solid" },
  { name: "Rice Straw (incorporated)", category: "Solid" },
  { name: "Carbonized Rice Hull (CRH)", category: "Solid" },
  { name: "Biofertilizer (Liquid Concentrate)", category: "Liquid" },
  { name: "Nanobiofertilizer", category: "Liquid" },
  { name: "Organic Root Exudate Mix", category: "Liquid" },
  { name: "Azolla microphylla", category: "Liquid" },
  { name: "Foliar Liquid Fertilizer (NPK)", category: "Liquid" },
];

const SEED_FIELDS: Array<{
  key: AllocationNumericField;
  label: string;
}> = [
  { key: "rice_seeds_nsic_rc160_kg", label: "NSIC Rc 160" },
  { key: "rice_seeds_nsic_rc222_kg", label: "NSIC Rc 222" },
  { key: "jackpot_kg", label: "Jackpot" },
  { key: "us88_kg", label: "US88" },
  { key: "th82_kg", label: "TH82" },
  { key: "rh9000_kg", label: "RH9000" },
  { key: "lumping143_kg", label: "Lumping143" },
  { key: "lp296_kg", label: "LP296" },
  { key: "mestiso_1_kg", label: "Mestiso 1 (M1)" },
  { key: "mestiso_20_kg", label: "Mestiso 20 (M20)" },
  { key: "mestiso_29_kg", label: "Mestiso 29" },
  { key: "mestiso_55_kg", label: "Mestiso 55" },
  { key: "mestiso_73_kg", label: "Mestiso 73" },
  { key: "mestiso_99_kg", label: "Mestiso 99" },
  { key: "mestiso_103_kg", label: "Mestiso 103" },
  { key: "nsic_rc402_kg", label: "NSIC Rc 402" },
  { key: "nsic_rc480_kg", label: "NSIC Rc 480" },
  { key: "nsic_rc216_kg", label: "NSIC Rc 216" },
  { key: "nsic_rc218_kg", label: "NSIC Rc 218" },
  { key: "nsic_rc506_kg", label: "NSIC Rc 506" },
  { key: "nsic_rc508_kg", label: "NSIC Rc 508" },
  { key: "nsic_rc512_kg", label: "NSIC Rc 512" },
  { key: "nsic_rc534_kg", label: "NSIC Rc 534" },
  { key: "tubigan_28_kg", label: "Tubigan 28" },
  { key: "tubigan_30_kg", label: "Tubigan 30" },
  { key: "tubigan_22_kg", label: "Tubigan 22" },
  { key: "sahod_ulan_2_kg", label: "Sahod Ulan 2" },
  { key: "sahod_ulan_10_kg", label: "Sahod Ulan 10" },
  { key: "salinas_6_kg", label: "Salinas 6" },
  { key: "salinas_7_kg", label: "Salinas 7" },
  { key: "salinas_8_kg", label: "Salinas 8" },
  { key: "malagkit_5_kg", label: "Malagkit 5" },
];

const SEED_CATALOG_ROWS: Array<{ name: string; category: string }> = [
  { name: "Mestiso 1 (M1)", category: "Hybrid" },
  { name: "Mestiso 20 (M20)", category: "Hybrid" },
  { name: "Mestiso 29", category: "Hybrid" },
  { name: "Mestiso 55", category: "Hybrid" },
  { name: "Mestiso 73", category: "Hybrid" },
  { name: "Mestiso 99", category: "Hybrid" },
  { name: "Mestiso 103", category: "Hybrid" },
  { name: "Jackpot", category: "Hybrid" },
  { name: "US88", category: "Hybrid" },
  { name: "TH82", category: "Hybrid" },
  { name: "RH9000", category: "Hybrid" },
  { name: "NSIC Rc 222", category: "Inbred" },
  { name: "NSIC Rc 402", category: "Inbred" },
  { name: "NSIC Rc 480", category: "Inbred" },
  { name: "NSIC Rc 216", category: "Inbred" },
  { name: "NSIC Rc 160", category: "Inbred" },
  { name: "NSIC Rc 218", category: "Inbred" },
  { name: "NSIC Rc 506", category: "Inbred" },
  { name: "NSIC Rc 508", category: "Inbred" },
  { name: "NSIC Rc 512", category: "Inbred" },
  { name: "NSIC Rc 534", category: "Inbred" },
  { name: "Tubigan 28", category: "Inbred" },
  { name: "Tubigan 30", category: "Inbred" },
  { name: "Tubigan 22", category: "Inbred" },
  { name: "Sahod Ulan 2", category: "Inbred" },
  { name: "Sahod Ulan 10", category: "Inbred" },
  { name: "Salinas 6", category: "Inbred" },
  { name: "Salinas 7", category: "Inbred" },
  { name: "Salinas 8", category: "Inbred" },
  { name: "Malagkit 5", category: "Inbred" },
  { name: "Lumping143", category: "Inbred" },
  { name: "LP296", category: "Inbred" },
];

const NUMERIC_FIELDS: AllocationNumericField[] = [
  ...FERTILIZER_FIELDS.map((field) => field.key),
  ...SEED_FIELDS.map((field) => field.key),
];

const JoCreateAllocation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAllocationId, setCreatedAllocationId] = useState<number | null>(
    null,
  );

  // Function to determine season based on date
  const determineSeasonFromDate = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1; // 0-11 -> 1-12
    const year = date.getFullYear();

    // Wet Season: May to October (months 5-10)
    // Dry Season: November to April (months 11-12, 1-4)
    if (month >= 5 && month <= 10) {
      return `wet_${year}`;
    } else {
      // For November-December, use current year; for January-April, use current year
      return `dry_${year}`;
    }
  };

  const todayDate = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState<AllocationFormData>({
    season: determineSeasonFromDate(todayDate),
    allocation_date: todayDate,
    urea_46_0_0_bags: "",
    complete_14_14_14_bags: "",
    ammonium_sulfate_21_0_0_bags: "",
    np_16_20_0_bags: "",
    muriate_potash_0_0_60_bags: "",
    zinc_sulfate_bags: "",
    vermicompost_bags: "",
    chicken_manure_bags: "",
    rice_straw_kg: "",
    carbonized_rice_hull_bags: "",
    biofertilizer_liters: "",
    nanobiofertilizer_liters: "",
    organic_root_exudate_mix_liters: "",
    azolla_microphylla_kg: "",
    foliar_liquid_fertilizer_npk_liters: "",
    rice_seeds_nsic_rc160_kg: "",
    rice_seeds_nsic_rc222_kg: "",
    jackpot_kg: "",
    us88_kg: "",
    th82_kg: "",
    rh9000_kg: "",
    lumping143_kg: "",
    lp296_kg: "",
    mestiso_1_kg: "",
    mestiso_20_kg: "",
    mestiso_29_kg: "",
    mestiso_55_kg: "",
    mestiso_73_kg: "",
    mestiso_99_kg: "",
    mestiso_103_kg: "",
    nsic_rc402_kg: "",
    nsic_rc480_kg: "",
    nsic_rc216_kg: "",
    nsic_rc218_kg: "",
    nsic_rc506_kg: "",
    nsic_rc508_kg: "",
    nsic_rc512_kg: "",
    nsic_rc534_kg: "",
    tubigan_28_kg: "",
    tubigan_30_kg: "",
    tubigan_22_kg: "",
    sahod_ulan_2_kg: "",
    sahod_ulan_10_kg: "",
    salinas_6_kg: "",
    salinas_7_kg: "",
    salinas_8_kg: "",
    malagkit_5_kg: "",
    notes: "",
  });

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    const isSeedField = SEED_FIELDS.some((field) => field.key === name);

    // If allocation_date changes, automatically update season
    if (name === "allocation_date") {
      const autoSeason = determineSeasonFromDate(value);
      setFormData((prev) => ({
        ...prev,
        allocation_date: value,
        season: autoSeason,
      }));
    } else if (
      name.includes("bags") ||
      name.includes("kg") ||
      name.includes("liters")
    ) {
      const parsedValue =
        value === ""
          ? ""
          : Math.max(
              0,
              isSeedField
                ? Number.parseFloat(value) || 0
                : Number.parseInt(value, 10) || 0,
            );
      setFormData((prev) => ({
        ...prev,
        [name]: parsedValue,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, string | number> = {
        season: formData.season,
        allocation_date: formData.allocation_date,
        notes: formData.notes,
      };

      NUMERIC_FIELDS.forEach((field) => {
        payload[field] = Number(formData[field]) || 0;
      });

      const response = await createAllocation(payload);

      if (response.error) {
        throw new Error(response.error || "Failed to save allocation");
      }

      const result = response.data;
      console.log("✅ Allocation created:", result);
      const allocationId = result?.id;

      if (!allocationId) {
        throw new Error("No allocation ID returned from server");
      }

      // Success - show in-app modal and let user choose when to continue
      setCreatedAllocationId(allocationId);

      // Log audit trail
      try {
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const auditLogger = getAuditLogger();
        await auditLogger.logCRUD(
          {
            id: currentUser.id,
            name: currentUser.name || currentUser.username || "Unknown",
            role: currentUser.role || "JO",
          },
          "CREATE",
          AuditModule.ALLOCATIONS,
          "regional_allocation",
          allocationId,
          `Created allocation for ${formData.season}`,
          undefined,
          payload,
        );
      } catch (auditErr) {
        console.error("Audit log failed (non-blocking):", auditErr);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save allocation");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToAddFarmers = () => {
    if (!createdAllocationId) return;
    navigate(`/jo-add-farmer-request/${createdAllocationId}`);
  };

  return (
    <div className="jo-allocation-page-container">
      <div className="jo-allocation-page has-mobile-sidebar">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
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

            <button className="sidebar-nav-item logout" onClick={handleLogout}>
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

        {/* Main Content */}
        <div className="jo-allocation-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="tech-incent-mobile-title">JO Create Allocation</div>
          </div>

          <div className="jo-allocation-header">
            <h2 className="jo-allocation-title">Create Regional Allocation</h2>
            <p className="jo-allocation-subtitle">
              Input fertilizer and seed allocation from Regional Office
            </p>
          </div>

          <div className="jo-allocation-content-card">
            <form onSubmit={handleSubmit}>
              {/* Season Selection */}
              <div className="jo-allocation-section">
                <h3 className="jo-allocation-section-title">
                  Season Information
                </h3>
                <div className="jo-allocation-grid-2">
                  <div className="jo-allocation-field">
                    <label className="jo-allocation-label">
                      Allocation Date{" "}
                      <span className="jo-allocation-required">*</span>
                    </label>
                    <input
                      type="date"
                      name="allocation_date"
                      value={formData.allocation_date}
                      onChange={handleInputChange}
                      required
                      className="jo-allocation-input"
                    />
                  </div>
                  <div className="jo-allocation-field">
                    <label className="jo-allocation-label">
                      Auto-Detected Season
                    </label>
                    <div className="jo-allocation-season-display">
                      {formData.season ? (
                        <span>
                          {formData.season.includes("wet")
                            ? "🌧️ Wet Season"
                            : "☀️ Dry Season"}{" "}
                          {formData.season.split("_")[1]}
                        </span>
                      ) : (
                        <span className="jo-allocation-season-placeholder">
                          Select a date first
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="jo-allocation-season-info">
                  💡 <strong>Wet Season:</strong> May - October |{" "}
                  <strong>Dry Season:</strong> November - April
                </p>
              </div>

              {/* Fertilizers Section */}
              <div className="jo-allocation-section">
                <h3 className="jo-allocation-section-title">
                  🌱 Fertilizer Allocation (bags)
                </h3>
                {["Solid", "Liquid"].map((category) => (
                  <div key={category} className="jo-allocation-category-group">
                    <h4 className="jo-allocation-category-heading">
                      {category} Fertilizers
                    </h4>
                    <div className="jo-allocation-grid-2">
                      {FERTILIZER_FIELDS.filter((field) => {
                        const fieldCategory = FERTILIZER_CATALOG_ROWS.find(
                          (row) =>
                            row.name
                              .toLowerCase()
                              .includes(field.label.toLowerCase()),
                        )?.category;
                        return fieldCategory === category;
                      }).map((field) => (
                        <div className="jo-allocation-field" key={field.key}>
                          <label className="jo-allocation-label">
                            {field.label}
                          </label>
                          <input
                            type="number"
                            name={field.key}
                            value={formData[field.key]}
                            onChange={handleInputChange}
                            min="0"
                            step="1"
                            inputMode="numeric"
                            className="jo-allocation-input"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Seeds Section */}
              <div className="jo-allocation-section">
                <h3 className="jo-allocation-section-title">
                  🌾 Seed Allocation (kg)
                </h3>
                {["Hybrid", "Inbred"].map((category) => (
                  <div key={category} className="jo-allocation-category-group">
                    <h4 className="jo-allocation-category-heading">
                      {category} Seeds
                    </h4>
                    <div className="jo-allocation-grid-2">
                      {SEED_FIELDS.filter((field) => {
                        const fieldCategory = SEED_CATALOG_ROWS.find((row) =>
                          row.name
                            .toLowerCase()
                            .includes(field.label.toLowerCase()),
                        )?.category;
                        return fieldCategory === category;
                      }).map((field) => (
                        <div className="jo-allocation-field" key={field.key}>
                          <label className="jo-allocation-label">
                            {field.label}
                          </label>
                          <input
                            type="number"
                            name={field.key}
                            value={formData[field.key]}
                            onChange={handleInputChange}
                            min="0"
                            step="any"
                            inputMode="decimal"
                            className="jo-allocation-input"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes Section */}
              <div className="jo-allocation-section">
                <label className="jo-allocation-label">Notes / Remarks</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Add any additional notes (e.g., 'First batch', 'Mid-season tranche', 'Emergency allocation')..."
                  className="jo-allocation-textarea"
                />
                <p
                  className="jo-allocation-season-info"
                  style={{ marginTop: "8px" }}
                >
                  💡 <strong>Tip:</strong> You can create multiple allocations
                  for the same season. Use notes to differentiate between
                  batches.
                </p>
              </div>

              {/* Error Message */}
              {error && <div className="jo-allocation-error">{error}</div>}

              {/* Action Buttons */}
              <div className="jo-allocation-actions">
                <button
                  type="button"
                  onClick={() => navigate("/jo-incentives")}
                  className="jo-allocation-btn-cancel"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jo-allocation-btn-submit"
                  disabled={loading}
                >
                  {loading ? "💾 Saving..." : "✅ Create Allocation"}
                </button>
              </div>
            </form>
          </div>

          {createdAllocationId && (
            <div
              className="jo-allocation-success-overlay"
              role="dialog"
              aria-modal="true"
            >
              <div className="jo-allocation-success-modal">
                <div className="jo-allocation-success-icon">✅</div>
                <h3 className="jo-allocation-success-title">
                  Regional allocation created
                </h3>
                <p className="jo-allocation-success-text">
                  Your allocation was saved successfully. You can now add
                  farmers to this batch.
                </p>
                <div className="jo-allocation-success-meta">
                  Allocation ID: <strong>{createdAllocationId}</strong>
                </div>
                <div className="jo-allocation-success-actions">
                  <button
                    type="button"
                    className="jo-allocation-success-btn-secondary"
                    onClick={() => setCreatedAllocationId(null)}
                  >
                    Stay on this page
                  </button>
                  <button
                    type="button"
                    className="jo-allocation-success-btn-primary"
                    onClick={handleProceedToAddFarmers}
                  >
                    Add farmers now
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoCreateAllocation;
