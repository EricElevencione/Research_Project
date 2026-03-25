import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAllocations, getFarmerRequests } from "../../api";
import "../../assets/css/technician css/TechViewAllocationStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

interface FarmerRequest {
  id: number;
  farmer_name: string;
  barangay: string;
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
  status: string;
}

interface AllocationDetails {
  id: number;
  season: string;
  allocation_date: string;
  urea_46_0_0_bags: number;
  complete_14_14_14_bags: number;
  ammonium_sulfate_21_0_0_bags: number;
  muriate_potash_0_0_60_bags: number;
  jackpot_kg: number;
  us88_kg: number;
  th82_kg: number;
  rh9000_kg: number;
  lumping143_kg: number;
  lp296_kg: number;
  notes: string;
}

type RequestValueField =
  | "requested_urea_bags"
  | "requested_complete_14_bags"
  | "requested_ammonium_sulfate_bags"
  | "requested_muriate_potash_bags"
  | "requested_jackpot_kg"
  | "requested_us88_kg"
  | "requested_th82_kg"
  | "requested_rh9000_kg"
  | "requested_lumping143_kg"
  | "requested_lp296_kg";

type AllocationValueField =
  | "urea_46_0_0_bags"
  | "complete_14_14_14_bags"
  | "ammonium_sulfate_21_0_0_bags"
  | "muriate_potash_0_0_60_bags"
  | "jackpot_kg"
  | "us88_kg"
  | "th82_kg"
  | "rh9000_kg"
  | "lumping143_kg"
  | "lp296_kg";

const FERTILIZER_ROWS: Array<{
  name: string;
  allocated: AllocationValueField;
  requested: RequestValueField;
  unit: "bags" | "kg";
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
];

const SEED_ROWS: Array<{
  name: string;
  allocated: AllocationValueField;
  requested: RequestValueField;
  unit: "bags" | "kg";
}> = [
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
];

const TechViewAllocation: React.FC = () => {
<<<<<<< HEAD
  const navigate = useNavigate();
  const { allocationId } = useParams<{ allocationId: string }>();
  const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
  const [requests, setRequests] = useState<FarmerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
=======
    const navigate = useNavigate();
    const { allocationId } = useParams<{ allocationId: string }>();
    const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
    const [requests, setRequests] = useState<FarmerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
>>>>>>> 3405086e1de361b58526f3720d311f5faef5da57

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

      console.log("🔍 Fetching allocation with ID:", allocationId);

      // Fetch allocation details using API wrapper
      const allocationsResponse = await getAllocations();

      if (allocationsResponse.error) {
        console.error("Error fetching allocations:", allocationsResponse.error);
        throw new Error("Failed to fetch allocations");
      }

      const allocations = allocationsResponse.data;
      console.log("📦 All allocations:", allocations);

      const currentAllocation = allocations.find(
        (a: any) => a.id === parseInt(allocationId || "0"),
      );
      console.log("🎯 Current allocation:", currentAllocation);

      if (!currentAllocation) {
        throw new Error("Allocation not found");
      }
      setAllocation(currentAllocation);

      // Fetch farmer requests for this season using API wrapper
      const requestsResponse = await getFarmerRequests(
        currentAllocation.season,
      );

      if (requestsResponse.error) {
        console.error("Error fetching requests:", requestsResponse.error);
      } else {
        setRequests(requestsResponse.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSeasonName = (season: string) => {
    const [type, year] = season.split("_");
    return `${type.charAt(0).toUpperCase() + type.slice(1)} Season ${year}`;
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
<<<<<<< HEAD
      <div className="tech-view-alloc-page-container">
        <div className="tech-view-alloc-page">
          <div className="tech-view-alloc-main-content">
            <div className="tech-view-alloc-loading">
              <p>Loading allocation details...</p>
=======
        <div className="page-container">
            <div className="page">
                {/* Sidebar */}
                <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
                    <nav className="sidebar-nav">
                        <div className='sidebar-logo'>
                            <img src={LogoImage} alt="Logo" />
                        </div>

                        <button
                            className={`sidebar-nav-item ${isActive('/technician-dashboard') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-dashboard')}
                        >
                            <span className="nav-icon">
                                <img src={HomeIcon} alt="Home" />
                            </span>
                            <span className="nav-text">Home</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/technician-rsbsa') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-rsbsa')}
                        >
                            <span className="nav-icon">
                                <img src={RSBSAIcon} alt="RSBSA" />
                            </span>
                            <span className="nav-text">RSBSA</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/technician-incentives') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-incentives')}
                        >
                            <span className="nav-icon">
                                <img src={IncentivesIcon} alt="Incentives" />
                            </span>
                            <span className="nav-text">Incentives</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/technician-masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-masterlist')}
                        >
                            <span className="nav-icon">
                                <img src={ApproveIcon} alt="Masterlist" />
                            </span>
                            <span className="nav-text">Masterlist</span>
                        </button>

                        <button
                            className="sidebar-nav-item logout"
                            onClick={handleLogout}
                        >
                            <span className="nav-icon">
                                <img src={LogoutIcon} alt="Logout" />
                            </span>
                            <span className="nav-text">Logout</span>
                        </button>
                    </nav>
                </div>

                <div className={`tech-incent-sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

                {/* Main Content */}
                <div className="main-content">
                    <div className="tech-incent-mobile-header">
                        <button className="tech-incent-hamburger" onClick={() => setSidebarOpen(prev => !prev)}>☰</button>
                        <div className="tech-incent-mobile-title">View Allocation</div>
                    </div>
                    <div className="dashboard-header-incent">
                        <div>
                            <h2 className="page-header">View Allocation</h2>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                className="btn-create-allocation"
                                onClick={() => navigate(`/technician-manage-requests/${allocationId}`)}
                            >
                                📋 Manage Requests
                            </button>
                            <button
                                className="btn-create-allocation"
                                onClick={() => navigate('/technician-incentives')}
                            >
                                ← Back
                            </button>
                        </div>
                    </div>

                    <div className="content-card-incent">
                        {/* Overview Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                            <div style={{ padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', color: 'white' }}>
                                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Allocation Date</div>
                                <div style={{ fontSize: '24px', fontWeight: '700' }}>
                                    {new Date(allocation.allocation_date).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </div>
                            </div>
                            <div style={{ padding: '20px', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', borderRadius: '12px', color: 'white' }}>
                                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Requests</div>
                                <div style={{ fontSize: '36px', fontWeight: '700' }}>{requests.length}</div>
                                <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                                    {requests.filter(r => r.status === 'pending').length} pending
                                </div>
                            </div>
                        </div>

                        {/* Fertilizers Section */}
                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🌱 Fertilizers Allocation
                            </h3>
                            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #d1d5db' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Type</th>
                                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Allocated</th>
                                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Requested</th>
                                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Remaining</th>
                                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Usage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { name: 'Urea (46-0-0)', allocated: 'urea_46_0_0_bags', requested: 'requested_urea_bags' },
                                            { name: 'Complete (14-14-14)', allocated: 'complete_14_14_14_bags', requested: 'requested_complete_14_bags' },
                                            { name: 'Ammonium Sulfate (21-0-0)', allocated: 'ammonium_sulfate_21_0_0_bags', requested: 'requested_ammonium_sulfate_bags' },
                                            { name: 'Muriate of Potash (0-0-60)', allocated: 'muriate_potash_0_0_60_bags', requested: 'requested_muriate_potash_bags' }
                                        ].map(fertilizer => {
                                            const allocated = getTotalAllocated(fertilizer.allocated as keyof AllocationDetails);
                                            const requested = getTotalRequested(fertilizer.requested as keyof FarmerRequest);
                                            const remaining = allocated - requested;
                                            const percentage = getPercentageUsed(allocated, requested);
                                            const statusColor = getStatusColor(allocated, requested);

                                            return (
                                                <tr key={fertilizer.name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                    <td style={{ padding: '12px', color: '#1f2937' }}>{fertilizer.name}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>{allocated.toFixed(2)} bags</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>{requested.toFixed(2)} bags</td>
                                                    <td style={{ padding: '12px', textAlign: 'right', color: remaining < 0 ? '#ef4444' : '#059669' }}>
                                                        {remaining.toFixed(2)} bags
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                                        <span style={{
                                                            padding: '4px 12px',
                                                            borderRadius: '12px',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            color: 'white',
                                                            background: statusColor
                                                        }}>
                                                            {percentage}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr style={{ borderTop: '2px solid #d1d5db', background: '#f3f4f6', fontWeight: '700' }}>
                                            <td style={{ padding: '12px' }}>TOTAL</td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>{totalAllocatedFertilizer.toFixed(2)} bags</td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>{totalRequestedFertilizer.toFixed(2)} bags</td>
                                            <td style={{ padding: '12px', textAlign: 'right', color: (totalAllocatedFertilizer - totalRequestedFertilizer) < 0 ? '#ef4444' : '#059669' }}>
                                                {(totalAllocatedFertilizer - totalRequestedFertilizer).toFixed(2)} bags
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    color: 'white',
                                                    background: getStatusColor(totalAllocatedFertilizer, totalRequestedFertilizer)
                                                }}>
                                                    {getPercentageUsed(totalAllocatedFertilizer, totalRequestedFertilizer)}%
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Seeds Section */}
                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🌾 Seeds Allocation
                            </h3>
                            <div style={{ background: '#f9fafb', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #d1d5db' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Variety</th>
                                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Allocated</th>
                                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Requested</th>
                                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Remaining</th>
                                            <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Usage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { name: 'Jackpot', allocated: 'jackpot_kg', requested: 'requested_jackpot_kg' },
                                            { name: 'US88', allocated: 'us88_kg', requested: 'requested_us88_kg' },
                                            { name: 'TH82', allocated: 'th82_kg', requested: 'requested_th82_kg' },
                                            { name: 'RH9000', allocated: 'rh9000_kg', requested: 'requested_rh9000_kg' },
                                            { name: 'Lumping143', allocated: 'lumping143_kg', requested: 'requested_lumping143_kg' },
                                            { name: 'LP296', allocated: 'lp296_kg', requested: 'requested_lp296_kg' }
                                        ].map(seed => {
                                            const allocated = getTotalAllocated(seed.allocated as keyof AllocationDetails);
                                            const requested = getTotalRequested(seed.requested as keyof FarmerRequest);
                                            const remaining = allocated - requested;
                                            const percentage = getPercentageUsed(allocated, requested);
                                            const statusColor = getStatusColor(allocated, requested);

                                            return (
                                                <tr key={seed.name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                    <td style={{ padding: '12px', color: '#1f2937' }}>{seed.name}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>{allocated.toFixed(2)} kg</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>{requested.toFixed(2)} kg</td>
                                                    <td style={{ padding: '12px', textAlign: 'right', color: remaining < 0 ? '#ef4444' : '#059669' }}>
                                                        {remaining.toFixed(2)} kg
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                                        <span style={{
                                                            padding: '4px 12px',
                                                            borderRadius: '12px',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            color: 'white',
                                                            background: statusColor
                                                        }}>
                                                            {percentage}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr style={{ borderTop: '2px solid #d1d5db', background: '#f3f4f6', fontWeight: '700' }}>
                                            <td style={{ padding: '12px' }}>TOTAL</td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>{totalAllocatedSeeds.toFixed(2)} kg</td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>{totalRequestedSeeds.toFixed(2)} kg</td>
                                            <td style={{ padding: '12px', textAlign: 'right', color: (totalAllocatedSeeds - totalRequestedSeeds) < 0 ? '#ef4444' : '#059669' }}>
                                                {(totalAllocatedSeeds - totalRequestedSeeds).toFixed(2)} kg
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    color: 'white',
                                                    background: getStatusColor(totalAllocatedSeeds, totalRequestedSeeds)
                                                }}>
                                                    {getPercentageUsed(totalAllocatedSeeds, totalRequestedSeeds)}%
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Notes */}
                        {allocation.notes && (
                            <div style={{ marginTop: '24px', padding: '16px', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '8px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>📝 Notes</h4>
                                <p style={{ fontSize: '14px', color: '#78350f', margin: 0 }}>{allocation.notes}</p>
                            </div>
                        )}
                    </div>
                </div>
>>>>>>> 3405086e1de361b58526f3720d311f5faef5da57
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !allocation) {
    return (
      <div className="tech-view-alloc-page-container">
        <div className="tech-view-alloc-page">
          <div className="tech-view-alloc-main-content">
            <div className="tech-view-alloc-error">
              <div className="tech-view-alloc-error-icon">⚠️</div>
              <h3>Error Loading Allocation</h3>
              <p>{error || "Allocation not found"}</p>
              <button
                className="tech-view-alloc-btn tech-view-alloc-btn-secondary"
                onClick={() => navigate("/technician-incentives")}
              >
                ← Back to Allocations
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const visibleFertilizerRows = FERTILIZER_ROWS;
  const visibleSeedRows = SEED_ROWS;

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
    <div className="tech-view-alloc-page-container">
      <div className="tech-view-alloc-page">
        {/* Sidebar */}
        <div className="sidebar">
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

            <button className="sidebar-nav-item logout" onClick={handleLogout}>
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="tech-view-alloc-main-content">
          <div className="tech-view-alloc-header">
            <div>
              <h2 className="tech-view-alloc-title">
                {formatSeasonName(allocation.season)}
              </h2>
              <p className="tech-view-alloc-subtitle">
                Regional Allocation Details
              </p>
            </div>
          </div>
          <div className="tech-view-alloc-header-actions">
            <button
              className="tech-view-alloc-btn tech-view-alloc-btn-secondary"
              onClick={() => navigate("/technician-incentives")}
            >
              ← Back
            </button>
            <button
              className="tech-view-alloc-btn tech-view-alloc-btn-primary"
              onClick={() =>
                navigate(`/technician-manage-requests/${allocationId}`)
              }
            >
              📋 Manage Requests
            </button>
          </div>

          <div className="tech-view-alloc-content-card">
            <div className="tech-view-alloc-overview-grid">
              <div className="tech-view-alloc-overview-card date">
                <div className="tech-view-alloc-overview-label">
                  📅 Allocation Date
                </div>
                <div className="tech-view-alloc-overview-value">
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
              <div className="tech-view-alloc-overview-card requests">
                <div className="tech-view-alloc-overview-label">
                  📝 Total Requests
                </div>
                <div className="tech-view-alloc-overview-value large">
                  {requests.length}
                </div>
                <div className="tech-view-alloc-overview-sub">
                  {requests.filter((r) => r.status === "pending").length}{" "}
                  pending
                </div>
              </div>
              <div className="tech-view-alloc-overview-card approved">
                <div className="tech-view-alloc-overview-label">
                  ✅ Approved
                </div>
                <div className="tech-view-alloc-overview-value large">
                  {requests.filter((r) => r.status === "approved").length}
                </div>
                <div className="tech-view-alloc-overview-sub">
                  {requests.filter((r) => r.status === "rejected").length}{" "}
                  rejected
                </div>
              </div>
            </div>

            <div className="tech-view-alloc-section">
              <h3 className="tech-view-alloc-section-title">
                🌱 Fertilizers Allocation
              </h3>
              <div className="tech-view-alloc-table-container">
                <table className="tech-view-alloc-table">
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
                            {allocated.toFixed(2)} bags
                          </td>
                          <td>{requested.toFixed(2)} bags</td>
                          <td
                            className={remaining < 0 ? "negative" : "positive"}
                          >
                            {remaining.toFixed(2)} bags
                          </td>
                          <td>
                            <span
                              className={`tech-view-alloc-usage-badge ${statusClass}`}
                            >
                              {percentage}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="total-row">
                      <td>TOTAL</td>
                      <td>{totalAllocatedFertilizer.toFixed(2)} bags</td>
                      <td>{totalRequestedFertilizer.toFixed(2)} bags</td>
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
                        ).toFixed(2)}{" "}
                        bags
                      </td>
                      <td>
                        <span
                          className={`tech-view-alloc-usage-badge ${getStatusColor(totalAllocatedFertilizer, totalRequestedFertilizer)}`}
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

            <div className="tech-view-alloc-section">
              <h3 className="tech-view-alloc-section-title">
                🌾 Seeds Allocation
              </h3>
              <div className="tech-view-alloc-table-container">
                <table className="tech-view-alloc-table">
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
                            {allocated.toFixed(2)} kg
                          </td>
                          <td>{requested.toFixed(2)} kg</td>
                          <td
                            className={remaining < 0 ? "negative" : "positive"}
                          >
                            {remaining.toFixed(2)} kg
                          </td>
                          <td>
                            <span
                              className={`tech-view-alloc-usage-badge ${statusClass}`}
                            >
                              {percentage}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
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
                          className={`tech-view-alloc-usage-badge ${getStatusColor(totalAllocatedSeeds, totalRequestedSeeds)}`}
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
              <div className="tech-view-alloc-notes">
                <h4 className="tech-view-alloc-notes-title">📝 Notes</h4>
                <p className="tech-view-alloc-notes-text">{allocation.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechViewAllocation;
