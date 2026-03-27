import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAllocationBySeason, createAllocation } from "../../api";
import "../../assets/css/jo css/JoRegionAll.css";
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

interface RegionalAllocation extends Record<
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
  category: "Solid" | "Liquid";
}> = [
  { key: "urea_46_0_0_bags", label: "Urea (46-0-0)", category: "Solid" },
  {
    key: "complete_14_14_14_bags",
    label: "Complete (14-14-14)",
    category: "Solid",
  },
  {
    key: "ammonium_sulfate_21_0_0_bags",
    label: "Ammonium Sulfate (21-0-0)",
    category: "Solid",
  },
  { key: "np_16_20_0_bags", label: "16-20-0", category: "Solid" },
  {
    key: "muriate_potash_0_0_60_bags",
    label: "Muriate of Potash (0-0-60)",
    category: "Solid",
  },
  { key: "zinc_sulfate_bags", label: "Zinc Sulfate", category: "Solid" },
  { key: "vermicompost_bags", label: "Vermicompost", category: "Solid" },
  { key: "chicken_manure_bags", label: "Chicken Manure", category: "Solid" },
  {
    key: "rice_straw_kg",
    label: "Rice Straw (incorporated)",
    category: "Solid",
  },
  {
    key: "carbonized_rice_hull_bags",
    label: "Carbonized Rice Hull (CRH)",
    category: "Solid",
  },
  {
    key: "biofertilizer_liters",
    label: "Biofertilizer (Liquid Concentrate)",
    category: "Liquid",
  },
  {
    key: "nanobiofertilizer_liters",
    label: "Nanobiofertilizer",
    category: "Liquid",
  },
  {
    key: "organic_root_exudate_mix_liters",
    label: "Organic Root Exudate Mix",
    category: "Liquid",
  },
  {
    key: "azolla_microphylla_kg",
    label: "Azolla microphylla",
    category: "Liquid",
  },
  {
    key: "foliar_liquid_fertilizer_npk_liters",
    label: "Foliar Liquid Fertilizer (NPK)",
    category: "Liquid",
  },
];

const SEED_FIELDS: Array<{
  key: AllocationNumericField;
  label: string;
  category: "Hybrid" | "Inbred";
}> = [
  { key: "rice_seeds_nsic_rc160_kg", label: "NSIC Rc 160", category: "Inbred" },
  { key: "rice_seeds_nsic_rc222_kg", label: "NSIC Rc 222", category: "Inbred" },
  { key: "jackpot_kg", label: "Jackpot", category: "Hybrid" },
  { key: "us88_kg", label: "US88", category: "Hybrid" },
  { key: "th82_kg", label: "TH82", category: "Hybrid" },
  { key: "rh9000_kg", label: "RH9000", category: "Hybrid" },
  { key: "lumping143_kg", label: "Lumping143", category: "Inbred" },
  { key: "lp296_kg", label: "LP296", category: "Inbred" },
  { key: "mestiso_1_kg", label: "Mestiso 1 (M1)", category: "Hybrid" },
  { key: "mestiso_20_kg", label: "Mestiso 20 (M20)", category: "Hybrid" },
  { key: "mestiso_29_kg", label: "Mestiso 29", category: "Hybrid" },
  { key: "mestiso_55_kg", label: "Mestiso 55", category: "Hybrid" },
  { key: "mestiso_73_kg", label: "Mestiso 73", category: "Hybrid" },
  { key: "mestiso_99_kg", label: "Mestiso 99", category: "Hybrid" },
  { key: "mestiso_103_kg", label: "Mestiso 103", category: "Hybrid" },
  { key: "nsic_rc402_kg", label: "NSIC Rc 402", category: "Inbred" },
  { key: "nsic_rc480_kg", label: "NSIC Rc 480", category: "Inbred" },
  { key: "nsic_rc216_kg", label: "NSIC Rc 216", category: "Inbred" },
  { key: "nsic_rc218_kg", label: "NSIC Rc 218", category: "Inbred" },
  { key: "nsic_rc506_kg", label: "NSIC Rc 506", category: "Inbred" },
  { key: "nsic_rc508_kg", label: "NSIC Rc 508", category: "Inbred" },
  { key: "nsic_rc512_kg", label: "NSIC Rc 512", category: "Inbred" },
  { key: "nsic_rc534_kg", label: "NSIC Rc 534", category: "Inbred" },
  { key: "tubigan_28_kg", label: "Tubigan 28", category: "Inbred" },
  { key: "tubigan_30_kg", label: "Tubigan 30", category: "Inbred" },
  { key: "tubigan_22_kg", label: "Tubigan 22", category: "Inbred" },
  { key: "sahod_ulan_2_kg", label: "Sahod Ulan 2", category: "Inbred" },
  { key: "sahod_ulan_10_kg", label: "Sahod Ulan 10", category: "Inbred" },
  { key: "salinas_6_kg", label: "Salinas 6", category: "Inbred" },
  { key: "salinas_7_kg", label: "Salinas 7", category: "Inbred" },
  { key: "salinas_8_kg", label: "Salinas 8", category: "Inbred" },
  { key: "malagkit_5_kg", label: "Malagkit 5", category: "Inbred" },
];

const NUMERIC_FIELDS: AllocationNumericField[] = [
  ...FERTILIZER_FIELDS.map((field) => field.key),
  ...SEED_FIELDS.map((field) => field.key),
];

const determineSeasonFromDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;
};

const JoRegionalAllocation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const todayDate = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState<RegionalAllocation>({
    season: determineSeasonFromDate(todayDate),
    allocation_date: todayDate,
    notes: "",
    urea_46_0_0_bags: 0,
    complete_14_14_14_bags: 0,
    ammonium_sulfate_21_0_0_bags: 0,
    np_16_20_0_bags: 0,
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
  });

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    fetchAllocation();
  }, [formData.season]);

  const fetchAllocation = async () => {
    try {
      const response = await getAllocationBySeason(formData.season);
      if (!response.error && response.data) {
        setFormData((prev) => ({
          ...prev,
          ...response.data,
          notes: response.data.notes || "",
        }));
      }
    } catch {
      console.log("No existing allocation found, starting fresh");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;

    if (name === "allocation_date") {
      const autoSeason = determineSeasonFromDate(value);
      setFormData((prev) => ({
        ...prev,
        allocation_date: value,
        season: autoSeason,
      }));
      return;
    }

    if (
      name.includes("bags") ||
      name.includes("kg") ||
      name.includes("liters")
    ) {
      const parsedValue =
        value === "" ? "" : Math.max(0, Number.parseFloat(value) || 0);
      setFormData((prev) => ({
        ...prev,
        [name]: parsedValue,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveSuccess(false);

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

      if (!response.error) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert("Failed to save allocation");
      }
    } catch (error) {
      console.error("Error saving allocation:", error);
      alert("Error saving allocation");
    } finally {
      setLoading(false);
    }
  };

  const totalFertilizer = FERTILIZER_FIELDS.reduce(
    (sum, field) => sum + (Number(formData[field.key]) || 0),
    0,
  );

  const totalSeeds = SEED_FIELDS.reduce(
    (sum, field) => sum + (Number(formData[field.key]) || 0),
    0,
  );

  return (
    <div className="regional-allocation-container">
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

      <div className="main-content jo-regional-main-content">
        <div className="content-header jo-regional-content-header">
          <h2>Regional Allocation Input</h2>
          <p>
            Enter the fertilizer and seed allocation received from Regional
            Office
          </p>
        </div>

        {saveSuccess && (
          <div className="jo-regional-success-message">
            ✅ Regional allocation saved successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="jo-regional-form">
          <div className="jo-regional-card">
            <h3>Season Information</h3>
            <div className="jo-regional-form-grid">
              <div className="jo-regional-form-field">
                <label>Allocation Date *</label>
                <input
                  type="date"
                  name="allocation_date"
                  value={formData.allocation_date}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="jo-regional-form-field">
                <label>Auto-Detected Season</label>
                <input type="text" value={formData.season} readOnly />
              </div>
            </div>
          </div>

          <div className="jo-regional-card">
            <h3>Fertilizer Allocations</h3>
            {(["Solid", "Liquid"] as const).map((category) => (
              <div key={category} style={{ marginBottom: "16px" }}>
                <h4>{category} Fertilizers</h4>
                <div className="jo-regional-form-grid">
                  {FERTILIZER_FIELDS.filter(
                    (field) => field.category === category,
                  ).map((field) => (
                    <div className="jo-regional-form-field" key={field.key}>
                      <label>{field.label}</label>
                      <input
                        type="number"
                        name={field.key}
                        value={formData[field.key]}
                        onChange={handleInputChange}
                        min="0"
                        step={
                          field.key.includes("liters") ||
                          field.key.includes("kg")
                            ? "0.01"
                            : "1"
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="jo-regional-total-summary">
              Total Fertilizer Inputs: {totalFertilizer.toLocaleString()}
            </div>
          </div>

          <div className="jo-regional-card">
            <h3>Seed Allocations (kg)</h3>
            {(["Hybrid", "Inbred"] as const).map((category) => (
              <div key={category} style={{ marginBottom: "16px" }}>
                <h4>{category} Seeds</h4>
                <div className="jo-regional-form-grid">
                  {SEED_FIELDS.filter(
                    (field) => field.category === category,
                  ).map((field) => (
                    <div className="jo-regional-form-field" key={field.key}>
                      <label>{field.label}</label>
                      <input
                        type="number"
                        name={field.key}
                        value={formData[field.key]}
                        onChange={handleInputChange}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="jo-regional-total-summary">
              Total Seed Inputs: {totalSeeds.toLocaleString()} kg
            </div>
          </div>

          <div className="jo-regional-card">
            <h3>Notes</h3>
            <div className="jo-regional-form-field">
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                placeholder="Additional notes or comments about this allocation..."
              />
            </div>
          </div>

          <div className="jo-regional-button-container">
            <button
              type="button"
              onClick={() => navigate("/jo-dashboard")}
              className="jo-regional-btn regional-btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="jo-regional-btn regional-btn-submit"
            >
              {loading ? "Saving..." : "Save Allocation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoRegionalAllocation;
