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
import { supabase } from "../../supabase";
import TechSidebar from "../../components/layout/TechSidebar";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "seeds" | "fertilizer">("all");

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

  const filteredAllocations = React.useMemo(() => {
    return allocations.filter((allocation) => {
      if (
        searchTerm &&
        !allocation.season.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      if (statusFilter !== "all") {
        const isClosed = (allocation as any).status === "closed";
        if (statusFilter === "open" && isClosed) return false;
        if (statusFilter === "closed" && !isClosed) return false;
      }
      if (typeFilter !== "all") {
        const hasSeeds = getTotalSeeds(allocation) > 0;
        const hasFert = getTotalFertilizer(allocation) > 0;
        if (typeFilter === "seeds" && !hasSeeds) return false;
        if (typeFilter === "fertilizer" && !hasFert) return false;
      }
      return true;
    });
  }, [allocations, searchTerm, statusFilter, typeFilter]);

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
        <TechSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
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

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search programs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 1rem 0.55rem 2.4rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.45, fontSize: '0.95rem' }}>🔍</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', backgroundColor: 'white', minWidth: '130px' }}
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', backgroundColor: 'white', minWidth: '150px' }}
            >
              <option value="all">All Types</option>
              <option value="seeds">Seeds Only</option>
              <option value="fertilizer">Fertilizer Only</option>
            </select>
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
            ) : filteredAllocations.length === 0 ? (
              <div className="jo-incent-empty-state">
                <div className="jo-incent-empty-icon">🔍</div>
                <h3>No Programs Found</h3>
                <p>Try adjusting your search or filters</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.93rem', whiteSpace: 'nowrap' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Program</th>
                      <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Total Fertilizer</th>
                      <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Total Seeds</th>
                      <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Farmer Requests</th>
                      <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '1rem', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllocations.map((allocation) => (
                      <tr key={allocation.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '1rem', fontWeight: 500, color: '#0f172a' }}>
                          {formatSeasonName(allocation.season)}
                        </td>
                        <td style={{ padding: '1rem', color: '#475569' }}>
                          {new Date(allocation.allocation_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td style={{ padding: '1rem', color: '#475569' }}>
                          <strong>{getTotalFertilizer(allocation).toLocaleString()}</strong> bags
                        </td>
                        <td style={{ padding: '1rem', color: '#475569' }}>
                          <strong>{getTotalSeeds(allocation).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> kg
                        </td>
                        <td style={{ padding: '1rem', color: '#475569' }}>
                          <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.7rem', borderRadius: '9999px', fontSize: '0.83rem', fontWeight: 600 }}>
                            {allocation.farmer_count || 0} farmers
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {(allocation as any).status === 'closed' ? (
                            <span style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #fecaca' }}>CLOSED</span>
                          ) : (
                            <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #bbf7d0' }}>OPEN</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => navigate(`/technician-view-allocation/${allocation.id}`)}
                              style={{ padding: '0.4rem 0.8rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              View
                            </button>
                            <button
                              onClick={() => navigate(`/technician-manage-requests/${allocation.id}`)}
                              disabled={(allocation as any).status === 'closed'}
                              style={{
                                padding: '0.4rem 0.8rem',
                                background: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.83rem',
                                fontWeight: 600,
                                cursor: (allocation as any).status === 'closed' ? 'not-allowed' : 'pointer',
                                opacity: (allocation as any).status === 'closed' ? 0.4 : 1,
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
