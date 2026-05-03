import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createAllocation } from "../../api";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import "../../assets/css/admin css/index.css";
import "../../assets/css/jo css/JoIncentStyle.css";
import "../../assets/css/jo css/JoCreateAllocationStyle.css";
import "../../components/layout/sidebarStyle.css";
import AdminSidebar from "../../components/layout/AdminSidebar";

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
  | "malagkit_5_kg"
  | "complete_16_16_16_bags"
  | "ammonium_phosphate_16_20_0_bags"
  | "rice_seeds_nsic_rc440_kg"
  | "corn_seeds_hybrid_kg"
  | "corn_seeds_opm_kg"
  | "vegetable_seeds_kg";

interface AllocationItem {
  key: AllocationNumericField;
  value: number;
}

const FERTILIZER_FIELDS: Array<{
  key: AllocationNumericField;
  label: string;
}> = [
  { key: "urea_46_0_0_bags", label: "Urea (46-0-0)" },
  { key: "complete_14_14_14_bags", label: "Complete (14-14-14)" },
  { key: "ammonium_sulfate_21_0_0_bags", label: "Ammonium Sulfate (21-0-0)" },
  { key: "np_16_20_0_bags", label: "16-20-0" },
  { key: "muriate_potash_0_0_60_bags", label: "Muriate of Potash (0-0-60)" },
  { key: "zinc_sulfate_bags", label: "Zinc Sulfate" },
  { key: "vermicompost_bags", label: "Vermicompost" },
  { key: "chicken_manure_bags", label: "Chicken Manure" },
  { key: "rice_straw_kg", label: "Rice Straw (incorporated)" },
  { key: "carbonized_rice_hull_bags", label: "Carbonized Rice Hull (CRH)" },
  { key: "biofertilizer_liters", label: "Biofertilizer (Liquid Concentrate)" },
  { key: "nanobiofertilizer_liters", label: "Nanobiofertilizer" },
  { key: "organic_root_exudate_mix_liters", label: "Organic Root Exudate Mix" },
  { key: "azolla_microphylla_kg", label: "Azolla microphylla" },
  { key: "foliar_liquid_fertilizer_npk_liters", label: "Foliar Liquid Fertilizer (NPK)" },
  { key: "complete_16_16_16_bags", label: "Complete (16-16-16)" },
  { key: "ammonium_phosphate_16_20_0_bags", label: "Ammonium Phosphate" },
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
  { key: "rice_seeds_nsic_rc440_kg", label: "NSIC Rc 440" },
  { key: "corn_seeds_hybrid_kg", label: "Corn Seeds (Hybrid)" },
  { key: "corn_seeds_opm_kg", label: "Corn Seeds (OPM)" },
  { key: "vegetable_seeds_kg", label: "Vegetable Seeds" },
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
  { name: "Complete (16-16-16)", category: "Solid" },
  { name: "Ammonium Phosphate", category: "Solid" },
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
  { name: "NSIC Rc 440", category: "Inbred" },
  { name: "Corn Seeds (Hybrid)", category: "Hybrid" },
  { name: "Corn Seeds (OPM)", category: "Inbred" },
  { name: "Vegetable Seeds", category: "Inbred" },
];

const AdminCreateAllocation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAllocationId, setCreatedAllocationId] = useState<number | null>(null);

  const todayDate = new Date().toISOString().split("T")[0];
  
  const [formData, setFormData] = useState({
    season: "", // This will now store the "Program Name"
    allocation_date: todayDate,
    notes: "",
  });

  const [selectedFertilizers, setSelectedFertilizers] = useState<AllocationItem[]>([]);
  const [selectedSeeds, setSelectedSeeds] = useState<AllocationItem[]>([]);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addItem = (type: 'fertilizer' | 'seed', key: string) => {
    if (!key) return;
    const itemKey = key as AllocationNumericField;
    const setter = type === 'fertilizer' ? setSelectedFertilizers : setSelectedSeeds;
    const list = type === 'fertilizer' ? selectedFertilizers : selectedSeeds;

    if (list.some(item => item.key === itemKey)) return;

    setter(prev => [...prev, { key: itemKey, value: 0 }]);
  };

  const updateItemValue = (type: 'fertilizer' | 'seed', index: number, value: number) => {
    const setter = type === 'fertilizer' ? setSelectedFertilizers : setSelectedSeeds;
    setter(prev => {
      const newList = [...prev];
      newList[index] = { ...newList[index], value: Math.max(0, value) };
      return newList;
    });
  };

  const removeItem = (type: 'fertilizer' | 'seed', index: number) => {
    const setter = type === 'fertilizer' ? setSelectedFertilizers : setSelectedSeeds;
    setter(prev => prev.filter((_, i) => i !== index));
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

      // Initialize all numeric fields to 0
      [...FERTILIZER_FIELDS, ...SEED_FIELDS].forEach(field => {
        payload[field.key] = 0;
      });

      // Populate from selected lists
      selectedFertilizers.forEach(item => {
        payload[item.key] = (payload[item.key] as number) + item.value;
      });
      selectedSeeds.forEach(item => {
        payload[item.key] = (payload[item.key] as number) + item.value;
      });

      const response = await createAllocation(payload);
      if (response.error) throw new Error(response.error);

      const allocationId = response.data?.id;
      if (!allocationId) throw new Error("No allocation ID returned");

      setCreatedAllocationId(allocationId);

      // Audit Log
      try {
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const auditLogger = getAuditLogger();
        await auditLogger.logCRUD(
          { id: currentUser.id, name: currentUser.name || "Admin", role: currentUser.role || "ADMIN" },
          "CREATE",
          AuditModule.ALLOCATIONS,
          "regional_allocation",
          allocationId,
          `Created allocation for ${formData.season}`,
          undefined,
          payload
        );
      } catch (auditErr) {
        console.error("Audit log failed:", auditErr);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save allocation");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="jo-allocation-page-container">
      <div className="jo-allocation-page has-mobile-sidebar">
        <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="jo-allocation-main-content">
          <div className="tech-incent-mobile-header">
            <button className="tech-incent-hamburger" onClick={() => setSidebarOpen(prev => !prev)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="tech-incent-mobile-title">Admin Create Allocation</div>
          </div>

          <div className="jo-allocation-header">
            <h2 className="jo-allocation-title">Create Regional Allocation</h2>
            <p className="jo-allocation-subtitle">Input fertilizer and seed allocation from Regional Office</p>
          </div>

          <div className="jo-allocation-content-card">
            <form onSubmit={handleSubmit}>
              <div className="jo-allocation-section">
                <h3 className="jo-allocation-section-title">Program Information</h3>
                <div className="jo-allocation-grid-2">
                  <div className="jo-allocation-field">
                    <label className="jo-allocation-label">Allocation Date <span className="jo-allocation-required">*</span></label>
                    <input type="date" name="allocation_date" value={formData.allocation_date} onChange={handleInputChange} required className="jo-allocation-input" />
                  </div>
                  <div className="jo-allocation-field">
                    <label className="jo-allocation-label">Program Name <span className="jo-allocation-required">*</span></label>
                    <input 
                      type="text" 
                      name="season" 
                      value={formData.season} 
                      onChange={handleInputChange} 
                      required 
                      className="jo-allocation-input" 
                      placeholder="e.g. Rice Subsidy 2024"
                    />
                  </div>
                </div>
              </div>

              {/* Fertilizer Section */}
              <div className="jo-allocation-section">
                <h3 className="jo-allocation-section-title">🌱 Fertilizer Allocation</h3>
                <div className="jo-allocation-dynamic-controls">
                  <select 
                    className="jo-allocation-input" 
                    onChange={(e) => {
                      addItem('fertilizer', e.target.value);
                      e.target.value = "";
                    }}
                    value=""
                  >
                    <option value="" disabled>Select Fertilizer to Add...</option>
                    {["Solid", "Liquid"].map(category => (
                      <optgroup key={category} label={`${category} Fertilizers`}>
                        {FERTILIZER_FIELDS.filter(f => {
                          const cat = FERTILIZER_CATALOG_ROWS.find(c => c.name === f.label)?.category;
                          return cat === category && !selectedFertilizers.some(sf => sf.key === f.key);
                        }).map(f => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                
                <div className="jo-allocation-dynamic-list">
                  {selectedFertilizers.map((item, index) => {
                    const label = FERTILIZER_FIELDS.find(f => f.key === item.key)?.label;
                    return (
                      <div key={item.key} className="jo-allocation-dynamic-row">
                        <div className="jo-allocation-row-label">{label}</div>
                        <input 
                          type="number" 
                          className="jo-allocation-input row-input" 
                          value={item.value} 
                          onChange={(e) => updateItemValue('fertilizer', index, Number(e.target.value))}
                          placeholder="Amount in bags"
                        />
                        <button type="button" className="jo-allocation-row-remove" onClick={() => removeItem('fertilizer', index)}>✕</button>
                      </div>
                    );
                  })}
                  {selectedFertilizers.length === 0 && <p className="jo-allocation-empty-hint">No fertilizers added yet.</p>}
                </div>
              </div>

              {/* Seed Section */}
              <div className="jo-allocation-section">
                <h3 className="jo-allocation-section-title">🌾 Seed Allocation</h3>
                <div className="jo-allocation-dynamic-controls">
                  <select 
                    className="jo-allocation-input" 
                    onChange={(e) => {
                      addItem('seed', e.target.value);
                      e.target.value = "";
                    }}
                    value=""
                  >
                    <option value="" disabled>Select Seed to Add...</option>
                    {["Hybrid", "Inbred"].map(category => (
                      <optgroup key={category} label={`${category} Seeds`}>
                        {SEED_FIELDS.filter(s => {
                          const cat = SEED_CATALOG_ROWS.find(c => c.name === s.label)?.category;
                          return cat === category && !selectedSeeds.some(ss => ss.key === s.key);
                        }).map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                
                <div className="jo-allocation-dynamic-list">
                  {selectedSeeds.map((item, index) => {
                    const label = SEED_FIELDS.find(s => s.key === item.key)?.label;
                    return (
                      <div key={item.key} className="jo-allocation-dynamic-row">
                        <div className="jo-allocation-row-label">{label}</div>
                        <input 
                          type="number" 
                          className="jo-allocation-input row-input" 
                          value={item.value} 
                          onChange={(e) => updateItemValue('seed', index, Number(e.target.value))}
                          placeholder="Amount in kg"
                          step="any"
                        />
                        <button type="button" className="jo-allocation-row-remove" onClick={() => removeItem('seed', index)}>✕</button>
                      </div>
                    );
                  })}
                  {selectedSeeds.length === 0 && <p className="jo-allocation-empty-hint">No seeds added yet.</p>}
                </div>
              </div>

              <div className="jo-allocation-section">
                <label className="jo-allocation-label">Notes / Remarks</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={4} placeholder="Add any additional notes..." className="jo-allocation-textarea" />
              </div>

              {error && <div className="jo-allocation-error">{error}</div>}

              <div className="jo-allocation-actions">
                <button type="button" onClick={() => navigate("/incentives")} className="jo-allocation-btn-cancel" disabled={loading}>Cancel</button>
                <button type="submit" className="jo-allocation-btn-submit" disabled={loading}>{loading ? "💾 Saving..." : "✅ Create Allocation"}</button>
              </div>
            </form>
          </div>

          {createdAllocationId && (
            <div className="jo-allocation-success-overlay" role="dialog" aria-modal="true">
              <div className="jo-allocation-success-modal">
                <div className="jo-allocation-success-icon">✅</div>
                <h3 className="jo-allocation-success-title">Regional allocation created</h3>
                <p className="jo-allocation-success-text">Your allocation was saved successfully.</p>
                <div className="jo-allocation-success-meta">Allocation ID: <strong>{createdAllocationId}</strong></div>
                <div className="jo-allocation-success-actions">
                  <button type="button" className="jo-allocation-success-btn-primary" onClick={() => navigate("/incentives")}>Back to List</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .jo-allocation-dynamic-controls { margin-bottom: 15px; }
        .jo-allocation-dynamic-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
        .jo-allocation-dynamic-row { 
          display: grid; 
          grid-template-columns: 1fr 150px 40px; 
          gap: 15px; 
          align-items: center; 
          padding: 12px; 
          background: #f8fafc; 
          border-radius: 8px; 
          border: 1px solid #e2e8f0;
          animation: slideIn 0.2s ease-out;
        }
        .jo-allocation-row-label { font-weight: 500; color: #334155; }
        .jo-allocation-row-remove { 
          background: #fee2e2; 
          color: #ef4444; 
          border: none; 
          width: 32px; 
          height: 32px; 
          border-radius: 6px; 
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .jo-allocation-row-remove:hover { background: #fecaca; transform: scale(1.1); }
        .jo-allocation-empty-hint { color: #94a3b8; font-style: italic; font-size: 0.9rem; text-align: center; padding: 20px; border: 2px dashed #e2e8f0; border-radius: 8px; }
        .row-input { margin-bottom: 0 !important; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AdminCreateAllocation;
