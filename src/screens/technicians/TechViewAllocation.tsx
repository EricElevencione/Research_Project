import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAllocationById, getFarmerRequests } from "../../api";
import "../../assets/css/jo css/JoViewAllocationStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";
import { supabase } from "../../supabase";

interface FarmerRequest {
  id: number;
  farmer_name: string;
  barangay: string;
  requested_urea_bags: number;
  requested_complete_14_bags: number;
  requested_ammonium_sulfate_bags: number;
  requested_ammonium_phosphate_bags: number;
  requested_muriate_potash_bags: number;
  requested_zinc_sulfate_bags: number;
  requested_vermicompost_bags: number;
  requested_chicken_manure_bags: number;
  requested_rice_straw_kg: number;
  requested_carbonized_rice_hull_bags: number;
  requested_biofertilizer_liters: number;
  requested_nanobiofertilizer_liters: number;
  requested_organic_root_exudate_mix_liters: number;
  requested_azolla_microphylla_kg: number;
  requested_foliar_liquid_fertilizer_npk_liters: number;
  requested_rice_seeds_nsic_rc160_kg: number;
  requested_rice_seeds_nsic_rc222_kg: number;
  requested_jackpot_kg: number;
  requested_us88_kg: number;
  requested_th82_kg: number;
  requested_rh9000_kg: number;
  requested_lumping143_kg: number;
  requested_lp296_kg: number;
  requested_mestiso_1_kg: number;
  requested_mestiso_20_kg: number;
  requested_mestiso_29_kg: number;
  requested_mestiso_55_kg: number;
  requested_mestiso_73_kg: number;
  requested_mestiso_99_kg: number;
  requested_mestiso_103_kg: number;
  requested_nsic_rc402_kg: number;
  requested_nsic_rc480_kg: number;
  requested_nsic_rc216_kg: number;
  requested_nsic_rc218_kg: number;
  requested_nsic_rc506_kg: number;
  requested_nsic_rc508_kg: number;
  requested_nsic_rc512_kg: number;
  requested_nsic_rc534_kg: number;
  requested_tubigan_28_kg: number;
  requested_tubigan_30_kg: number;
  requested_tubigan_22_kg: number;
  requested_sahod_ulan_2_kg: number;
  requested_sahod_ulan_10_kg: number;
  requested_salinas_6_kg: number;
  requested_salinas_7_kg: number;
  requested_salinas_8_kg: number;
  requested_malagkit_5_kg: number;
  status: string;
}

type RequestValueField = Exclude<
  keyof FarmerRequest,
  "id" | "farmer_name" | "barangay" | "status"
>;

interface AllocationDetails {
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
  notes?: string;
}

type AllocationValueField = Exclude<
  keyof AllocationDetails,
  "id" | "season" | "allocation_date" | "notes"
>;

const FERTILIZER_ROWS: Array<{
  name: string;
  allocated: AllocationValueField;
  requested: RequestValueField;
  unit: "bags" | "kg" | "liters";
}> = [
  {
    name: "Urea (46-0-0)",
    allocated: "urea_46_0_0_bags",
    requested: "requested_urea_bags",
    unit: "bags",
  },
  {
    name: "Complete (14-14-14)",
    allocated: "complete_14_14_14_bags",
    requested: "requested_complete_14_bags",
    unit: "bags",
  },
  {
    name: "16-20-0",
    allocated: "np_16_20_0_bags",
    requested: "requested_ammonium_phosphate_bags",
    unit: "bags",
  },
  {
    name: "Ammonium Sulfate (21-0-0)",
    allocated: "ammonium_sulfate_21_0_0_bags",
    requested: "requested_ammonium_sulfate_bags",
    unit: "bags",
  },
  {
    name: "Muriate of Potash (0-0-60)",
    allocated: "muriate_potash_0_0_60_bags",
    requested: "requested_muriate_potash_bags",
    unit: "bags",
  },
  {
    name: "Zinc Sulfate",
    allocated: "zinc_sulfate_bags",
    requested: "requested_zinc_sulfate_bags",
    unit: "bags",
  },
  {
    name: "Vermicompost",
    allocated: "vermicompost_bags",
    requested: "requested_vermicompost_bags",
    unit: "bags",
  },
  {
    name: "Chicken Manure",
    allocated: "chicken_manure_bags",
    requested: "requested_chicken_manure_bags",
    unit: "bags",
  },
  {
    name: "Rice Straw",
    allocated: "rice_straw_kg",
    requested: "requested_rice_straw_kg",
    unit: "kg",
  },
  {
    name: "Carbonized Rice Hull (CRH)",
    allocated: "carbonized_rice_hull_bags",
    requested: "requested_carbonized_rice_hull_bags",
    unit: "bags",
  },
  {
    name: "Biofertilizer (Liquid Concentrate)",
    allocated: "biofertilizer_liters",
    requested: "requested_biofertilizer_liters",
    unit: "liters",
  },
  {
    name: "Nanobiofertilizer",
    allocated: "nanobiofertilizer_liters",
    requested: "requested_nanobiofertilizer_liters",
    unit: "liters",
  },
  {
    name: "Organic Root Exudate Mix",
    allocated: "organic_root_exudate_mix_liters",
    requested: "requested_organic_root_exudate_mix_liters",
    unit: "liters",
  },
  {
    name: "Azolla microphylla",
    allocated: "azolla_microphylla_kg",
    requested: "requested_azolla_microphylla_kg",
    unit: "kg",
  },
  {
    name: "Foliar Liquid Fertilizer (NPK)",
    allocated: "foliar_liquid_fertilizer_npk_liters",
    requested: "requested_foliar_liquid_fertilizer_npk_liters",
    unit: "liters",
  },
];

const SEED_ROWS: Array<{
  name: string;
  allocated: AllocationValueField;
  requested: RequestValueField;
  unit: "kg";
}> = [
  {
    name: "NSIC Rc 160",
    allocated: "rice_seeds_nsic_rc160_kg",
    requested: "requested_rice_seeds_nsic_rc160_kg",
    unit: "kg",
  },
  {
    name: "NSIC Rc 222",
    allocated: "rice_seeds_nsic_rc222_kg",
    requested: "requested_rice_seeds_nsic_rc222_kg",
    unit: "kg",
  },
  {
    name: "Jackpot",
    allocated: "jackpot_kg",
    requested: "requested_jackpot_kg",
    unit: "kg",
  },
  {
    name: "US88",
    allocated: "us88_kg",
    requested: "requested_us88_kg",
    unit: "kg",
  },
  {
    name: "TH82",
    allocated: "th82_kg",
    requested: "requested_th82_kg",
    unit: "kg",
  },
  {
    name: "RH9000",
    allocated: "rh9000_kg",
    requested: "requested_rh9000_kg",
    unit: "kg",
  },
  {
    name: "Lumping143",
    allocated: "lumping143_kg",
    requested: "requested_lumping143_kg",
    unit: "kg",
  },
  {
    name: "LP296",
    allocated: "lp296_kg",
    requested: "requested_lp296_kg",
    unit: "kg",
  },
  {
    name: "Mestiso 1",
    allocated: "mestiso_1_kg",
    requested: "requested_mestiso_1_kg",
    unit: "kg",
  },
  {
    name: "Mestiso 20",
    allocated: "mestiso_20_kg",
    requested: "requested_mestiso_20_kg",
    unit: "kg",
  },
  {
    name: "Mestiso 29",
    allocated: "mestiso_29_kg",
    requested: "requested_mestiso_29_kg",
    unit: "kg",
  },
  {
    name: "Mestiso 55",
    allocated: "mestiso_55_kg",
    requested: "requested_mestiso_55_kg",
    unit: "kg",
  },
  {
    name: "Mestiso 73",
    allocated: "mestiso_73_kg",
    requested: "requested_mestiso_73_kg",
    unit: "kg",
  },
  {
    name: "Mestiso 99",
    allocated: "mestiso_99_kg",
    requested: "requested_mestiso_99_kg",
    unit: "kg",
  },
  {
    name: "Mestiso 103",
    allocated: "mestiso_103_kg",
    requested: "requested_mestiso_103_kg",
    unit: "kg",
  },
  {
    name: "NSIC Rc 402",
    allocated: "nsic_rc402_kg",
    requested: "requested_nsic_rc402_kg",
    unit: "kg",
  },
  {
    name: "NSIC Rc 480",
    allocated: "nsic_rc480_kg",
    requested: "requested_nsic_rc480_kg",
    unit: "kg",
  },
  {
    name: "NSIC Rc 216",
    allocated: "nsic_rc216_kg",
    requested: "requested_nsic_rc216_kg",
    unit: "kg",
  },
  {
    name: "NSIC Rc 218",
    allocated: "nsic_rc218_kg",
    requested: "requested_nsic_rc218_kg",
    unit: "kg",
  },
  {
    name: "NSIC Rc 506",
    allocated: "nsic_rc506_kg",
    requested: "requested_nsic_rc506_kg",
    unit: "kg",
  },
  {
    name: "NSIC Rc 508",
    allocated: "nsic_rc508_kg",
    requested: "requested_nsic_rc508_kg",
    unit: "kg",
  },
  {
    name: "NSIC Rc 512",
    allocated: "nsic_rc512_kg",
    requested: "requested_nsic_rc512_kg",
    unit: "kg",
  },
  {
    name: "NSIC Rc 534",
    allocated: "nsic_rc534_kg",
    requested: "requested_nsic_rc534_kg",
    unit: "kg",
  },
  {
    name: "Tubigan 28",
    allocated: "tubigan_28_kg",
    requested: "requested_tubigan_28_kg",
    unit: "kg",
  },
  {
    name: "Tubigan 30",
    allocated: "tubigan_30_kg",
    requested: "requested_tubigan_30_kg",
    unit: "kg",
  },
  {
    name: "Tubigan 22",
    allocated: "tubigan_22_kg",
    requested: "requested_tubigan_22_kg",
    unit: "kg",
  },
  {
    name: "Sahod Ulan 2",
    allocated: "sahod_ulan_2_kg",
    requested: "requested_sahod_ulan_2_kg",
    unit: "kg",
  },
  {
    name: "Sahod Ulan 10",
    allocated: "sahod_ulan_10_kg",
    requested: "requested_sahod_ulan_10_kg",
    unit: "kg",
  },
  {
    name: "Salinas 6",
    allocated: "salinas_6_kg",
    requested: "requested_salinas_6_kg",
    unit: "kg",
  },
  {
    name: "Salinas 7",
    allocated: "salinas_7_kg",
    requested: "requested_salinas_7_kg",
    unit: "kg",
  },
  {
    name: "Salinas 8",
    allocated: "salinas_8_kg",
    requested: "requested_salinas_8_kg",
    unit: "kg",
  },
  {
    name: "Malagkit 5",
    allocated: "malagkit_5_kg",
    requested: "requested_malagkit_5_kg",
    unit: "kg",
  },
];

const TechViewAllocation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { allocationId } = useParams<{ allocationId: string }>();
  const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
  const [requests, setRequests] = useState<FarmerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
      firstName: string;
      lastName: string;
    } | null>(null);
  

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  useEffect(() => {
    fetchAllocationData();
  }, [allocationId]);

  const fetchAllocationData = async () => {
    try {
      setLoading(true);
      setError(null);

      const allocationResponse = await getAllocationById(allocationId || "0");
      if (allocationResponse.error) {
        throw new Error("Failed to fetch allocation");
      }

      const currentAllocation = allocationResponse.data || null;
      if (!currentAllocation) {
        throw new Error("Allocation not found");
      }
      setAllocation(currentAllocation);

      const requestsResponse = await getFarmerRequests(allocationId, true);
      if (!requestsResponse.error) {
        setRequests(requestsResponse.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSeasonName = (season: string) => {
    return season;
  };

  const getTotalAllocated = (field: AllocationValueField) => {
    return allocation ? Number(allocation[field]) || 0 : 0;
  };

  const getTotalRequested = (field: RequestValueField) => {
    return requests.reduce((sum, req) => sum + (Number(req[field]) || 0), 0);
  };

  const getPercentageUsed = (allocated: number, requested: number) => {
    if (allocated === 0) return 0;
    return ((requested / allocated) * 100).toFixed(1);
  };

  const getStatusColor = (allocated: number, requested: number) => {
    if (allocated <= 0) {
      return requested > 0 ? "danger" : "good";
    }
    const percentage = (requested / allocated) * 100;
    if (percentage > 100) return "danger";
    if (percentage > 80) return "warning";
    return "good";
  };

  if (loading) {
    return (
      <div className="jo-view-alloc-page-container">
        <div className="jo-view-alloc-page">
          <div className="jo-view-alloc-main-content">
            <div className="jo-view-alloc-loading">
              <p>Loading allocation details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !allocation) {
    return (
      <div className="jo-view-alloc-page-container">
        <div className="jo-view-alloc-page">
          <div className="jo-view-alloc-main-content">
            <div className="jo-view-alloc-error">
              <div className="jo-view-alloc-error-icon">!</div>
              <h3>Error Loading Allocation</h3>
              <p>{error || "Allocation not found"}</p>
              <button
                className="app-back-button"
                onClick={() => navigate("/technician-incentives")}
              >
                Back to Allocations
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const visibleFertilizerRows = FERTILIZER_ROWS.filter(
    (row) =>
      getTotalAllocated(row.allocated) > 0 ||
      getTotalRequested(row.requested) > 0,
  );

  const visibleSeedRows = SEED_ROWS.filter(
    (row) =>
      getTotalAllocated(row.allocated) > 0 ||
      getTotalRequested(row.requested) > 0,
  );

  const totalAllocatedFertilizer = visibleFertilizerRows.reduce(
    (sum, row) => sum + getTotalAllocated(row.allocated),
    0,
  );

  const totalAllocatedSeeds = visibleSeedRows.reduce(
    (sum, row) => sum + getTotalAllocated(row.allocated),
    0,
  );

  const totalRequestedFertilizer = visibleFertilizerRows.reduce(
    (sum, row) => sum + getTotalRequested(row.requested),
    0,
  );

  const totalRequestedSeeds = visibleSeedRows.reduce(
    (sum, row) => sum + getTotalRequested(row.requested),
    0,
  );

  return (
    <div className="jo-view-alloc-page-container">
      <div className="jo-view-alloc-page">
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

        <div className="jo-view-alloc-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              =
            </button>
            <div className="tech-incent-mobile-title">View Allocation</div>
          </div>

          <div className="jo-view-alloc-header">
            <div>
              <h2 className="jo-view-alloc-title">
                {formatSeasonName(allocation.season)}
              </h2>
              <p className="jo-view-alloc-subtitle">
                Regional Program Details
              </p>
            </div>
          </div>

          <div className="jo-view-alloc-header-actions">
            <button
              className="app-back-button"
              onClick={() => navigate("/technician-incentives")}
            >
              ← Back to Allocations
            </button>
            <button
              className="jo-view-alloc-btn jo-view-alloc-btn-primary"
              onClick={() =>
                navigate(`/technician-manage-requests/${allocationId}`)
              }
            >
              Manage Requests
            </button>
          </div>

          <div className="jo-view-alloc-content-card">
            <div className="jo-view-alloc-overview-grid">
              <div className="jo-view-alloc-overview-card date">
                <div className="jo-view-alloc-overview-label">
                  Allocation Date
                </div>
                <div className="jo-view-alloc-overview-value">
                  {new Date(allocation.allocation_date).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    },
                  )}
                </div>
              </div>

              <div className="jo-view-alloc-overview-card requests">
                <div className="jo-view-alloc-overview-label">
                  Total Requests
                </div>
                <div className="jo-view-alloc-overview-value large">
                  {requests.length}
                </div>
                <div className="jo-view-alloc-overview-sub">
                  {requests.filter((r) => r.status === "pending").length}{" "}
                  pending
                </div>
              </div>

              <div className="jo-view-alloc-overview-card approved">
                <div className="jo-view-alloc-overview-label">Approved</div>
                <div className="jo-view-alloc-overview-value large">
                  {requests.filter((r) => r.status === "approved").length}
                </div>
                <div className="jo-view-alloc-overview-sub">
                  {requests.filter((r) => r.status === "rejected").length}{" "}
                  rejected
                </div>
              </div>
            </div>

            <div className="jo-view-alloc-section">
              <h3 className="jo-view-alloc-section-title">
                Fertilizers Allocation
              </h3>
              <div className="jo-view-alloc-table-container">
                <table className="jo-view-alloc-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Allocated</th>
                      <th>Requested</th>
                      <th>Remaining</th>
                      <th>Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFertilizerRows.map((fertilizer) => {
                      const allocated = getTotalAllocated(fertilizer.allocated);
                      const requested = getTotalRequested(fertilizer.requested);
                      const remaining = allocated - requested;
                      const percentage = getPercentageUsed(
                        allocated,
                        requested,
                      );
                      const statusClass = getStatusColor(allocated, requested);

                      return (
                        <tr key={fertilizer.name}>
                          <td>{fertilizer.name}</td>
                          <td className="allocated">
                            {allocated.toFixed(2)} {fertilizer.unit}
                          </td>
                          <td>
                            {requested.toFixed(2)} {fertilizer.unit}
                          </td>
                          <td
                            className={remaining < 0 ? "negative" : "positive"}
                          >
                            {remaining.toFixed(2)} {fertilizer.unit}
                          </td>
                          <td>
                            <span
                              className={`jo-view-alloc-usage-badge ${statusClass}`}
                            >
                              {percentage}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {visibleFertilizerRows.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          No fertilizer allocation/request data yet.
                        </td>
                      </tr>
                    )}

                    <tr className="total-row">
                      <td>TOTAL</td>
                      <td>{totalAllocatedFertilizer.toFixed(2)}</td>
                      <td>{totalRequestedFertilizer.toFixed(2)}</td>
                      <td
                        className={
                          totalAllocatedFertilizer - totalRequestedFertilizer <
                          0
                            ? "negative"
                            : "positive"
                        }
                      >
                        {(
                          totalAllocatedFertilizer - totalRequestedFertilizer
                        ).toFixed(2)}
                      </td>
                      <td>
                        <span
                          className={`jo-view-alloc-usage-badge ${getStatusColor(totalAllocatedFertilizer, totalRequestedFertilizer)}`}
                        >
                          {getPercentageUsed(
                            totalAllocatedFertilizer,
                            totalRequestedFertilizer,
                          )}
                          %
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="jo-view-alloc-section">
              <h3 className="jo-view-alloc-section-title">Seeds Allocation</h3>
              <div className="jo-view-alloc-table-container">
                <table className="jo-view-alloc-table">
                  <thead>
                    <tr>
                      <th>Variety</th>
                      <th>Allocated</th>
                      <th>Requested</th>
                      <th>Remaining</th>
                      <th>Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSeedRows.map((seed) => {
                      const allocated = getTotalAllocated(seed.allocated);
                      const requested = getTotalRequested(seed.requested);
                      const remaining = allocated - requested;
                      const percentage = getPercentageUsed(
                        allocated,
                        requested,
                      );
                      const statusClass = getStatusColor(allocated, requested);

                      return (
                        <tr key={seed.name}>
                          <td>{seed.name}</td>
                          <td className="allocated">
                            {allocated.toFixed(2)} {seed.unit}
                          </td>
                          <td>
                            {requested.toFixed(2)} {seed.unit}
                          </td>
                          <td
                            className={remaining < 0 ? "negative" : "positive"}
                          >
                            {remaining.toFixed(2)} {seed.unit}
                          </td>
                          <td>
                            <span
                              className={`jo-view-alloc-usage-badge ${statusClass}`}
                            >
                              {percentage}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {visibleSeedRows.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          No seed allocation/request data yet.
                        </td>
                      </tr>
                    )}

                    <tr className="total-row">
                      <td>TOTAL</td>
                      <td>{totalAllocatedSeeds.toFixed(2)} kg</td>
                      <td>{totalRequestedSeeds.toFixed(2)} kg</td>
                      <td
                        className={
                          totalAllocatedSeeds - totalRequestedSeeds < 0
                            ? "negative"
                            : "positive"
                        }
                      >
                        {(totalAllocatedSeeds - totalRequestedSeeds).toFixed(2)}{" "}
                        kg
                      </td>
                      <td>
                        <span
                          className={`jo-view-alloc-usage-badge ${getStatusColor(totalAllocatedSeeds, totalRequestedSeeds)}`}
                        >
                          {getPercentageUsed(
                            totalAllocatedSeeds,
                            totalRequestedSeeds,
                          )}
                          %
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {allocation.notes && (
              <div className="jo-view-alloc-notes">
                <h4 className="jo-view-alloc-notes-title">Notes</h4>
                <p className="jo-view-alloc-notes-text">{allocation.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechViewAllocation;
