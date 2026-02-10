import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAllocations, getFarmerRequests } from '../../api';
import { UsageGauges, BarangayBreakdownTable, SeasonComparisonTable } from '../../components/Incentives/AllocationVisuals';
import '../../assets/css/admin css/AdminViewAllocation.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';

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

const ViewAllocation: React.FC = () => {
    const navigate = useNavigate();
    const { allocationId } = useParams<{ allocationId: string }>();
    const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
    const [allAllocations, setAllAllocations] = useState<any[]>([]);
    const [requests, setRequests] = useState<FarmerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    useEffect(() => {
        fetchAllocationData();
    }, [allocationId]);

    const fetchAllocationData = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔍 Fetching allocation with ID:', allocationId);

            // Fetch allocation details
            const allocationResponse = await getAllocations();
            if (allocationResponse.error) {
                throw new Error('Failed to fetch allocation');
            }
            const allocations = allocationResponse.data || [];
            console.log('📦 All allocations:', allocations);
            setAllAllocations(allocations);

            const currentAllocation = allocations.find((a: any) => a.id === parseInt(allocationId || '0'));
            console.log('🎯 Current allocation:', currentAllocation);

            if (!currentAllocation) {
                throw new Error('Allocation not found');
            }
            setAllocation(currentAllocation);

            // Fetch farmer requests for this season
            const requestsResponse = await getFarmerRequests(currentAllocation.season);
            if (!requestsResponse.error) {
                const requestsData = requestsResponse.data || [];
                setRequests(requestsData);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatSeasonName = (season: string) => {
        const [type, year] = season.split('_');
        return `${type.charAt(0).toUpperCase() + type.slice(1)} Season ${year}`;
    };

    const getTotalAllocated = (field: keyof AllocationDetails) => {
        return allocation ? Number(allocation[field]) || 0 : 0;
    };

    const getTotalRequested = (field: keyof FarmerRequest) => {
        return requests.reduce((sum, req) => sum + (Number(req[field]) || 0), 0);
    };

    const getPercentageUsed = (allocated: number, requested: number) => {
        if (allocated === 0) return 0;
        return ((requested / allocated) * 100).toFixed(1);
    };

    if (loading) {
        return (
            <div className="admin-viewalloc-page-container">
                <div className="admin-viewalloc-page">
                    <div className="admin-viewalloc-main-content">
                        <div className="admin-viewalloc-loading">Loading allocation details...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !allocation) {
        return (
            <div className="admin-viewalloc-page-container">
                <div className="admin-viewalloc-page">
                    <div className="admin-viewalloc-main-content">
                        <div className="admin-viewalloc-error-state">
                            <div className="admin-viewalloc-error-icon">⚠️</div>
                            <h3>Error Loading Allocation</h3>
                            <p>{error || 'Allocation not found'}</p>
                            <button className="admin-viewalloc-btn-back" onClick={() => navigate('/incentives')}>
                                ← Back to Allocations
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const totalAllocatedFertilizer = getTotalAllocated('urea_46_0_0_bags') +
        getTotalAllocated('complete_14_14_14_bags') +
        getTotalAllocated('ammonium_sulfate_21_0_0_bags') +
        getTotalAllocated('muriate_potash_0_0_60_bags');

    const totalAllocatedSeeds = getTotalAllocated('jackpot_kg') +
        getTotalAllocated('us88_kg') +
        getTotalAllocated('th82_kg') +
        getTotalAllocated('rh9000_kg') +
        getTotalAllocated('lumping143_kg') +
        getTotalAllocated('lp296_kg');

    const totalRequestedFertilizer = getTotalRequested('requested_urea_bags') +
        getTotalRequested('requested_complete_14_bags') +
        getTotalRequested('requested_ammonium_sulfate_bags') +
        getTotalRequested('requested_muriate_potash_bags');

    const totalRequestedSeeds = getTotalRequested('requested_jackpot_kg') +
        getTotalRequested('requested_us88_kg') +
        getTotalRequested('requested_th82_kg') +
        getTotalRequested('requested_rh9000_kg') +
        getTotalRequested('requested_lumping143_kg') +
        getTotalRequested('requested_lp296_kg');

    return (
        <div className="admin-viewalloc-page-container">
            <div className="admin-viewalloc-page">
                {/* Sidebar */}
                <div className="sidebar">
                    <nav className="sidebar-nav">
                        <div className='sidebar-logo'>
                            <img src={LogoImage} alt="Logo" />
                        </div>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-dashboard') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-dashboard')}
                        >
                            <span className="nav-icon">
                                <img src={HomeIcon} alt="Home" />
                            </span>
                            <span className="nav-text">Home</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-rsbsapage') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-rsbsapage')}
                        >
                            <span className="nav-icon">
                                <img src={RSBSAIcon} alt="RSBSA" />
                            </span>
                            <span className="nav-text">RSBSA</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-incentives') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-incentives')}
                        >
                            <span className="nav-icon">
                                <img src={IncentivesIcon} alt="Incentives" />
                            </span>
                            <span className="nav-text">Incentives</span>
                        </button>

                        <div
                            className={`sidebar-nav-item ${isActive('/gap-analysis') ? 'active' : ''}`}
                            onClick={() => navigate('/gap-analysis')}
                        >
                            <div className="nav-icon">📊</div>
                            <span className="nav-text">Gap Analysis</span>
                        </div>

                        <div
                            className={`sidebar-nav-item ${isActive('/jo-distribution') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-distribution')}
                        >
                            <div className="nav-icon">🚚</div>
                            <span className="nav-text">Distribution Log</span>
                        </div>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-masterlist')}
                        >
                            <span className="nav-icon">
                                <img src={MasterlistIcon} alt="Masterlist" />
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

                {/* Main Content */}
                <div className="admin-viewalloc-main-content">
                    <div className="admin-viewalloc-header">
                        <h2 className="admin-viewalloc-title">View Allocation</h2>
                        <div className="admin-viewalloc-header-actions">
                            <button
                                className="admin-viewalloc-btn-nav"
                                onClick={() => navigate(`/manage-requests/${allocationId}`)}
                            >
                                📋 View Requests
                            </button>
                            <button
                                className="admin-viewalloc-btn-nav"
                                onClick={() => navigate('/incentives')}
                            >
                                ← Back to Allocations
                            </button>
                        </div>
                    </div>

                    <div className="admin-viewalloc-content-card">
                        {/* ── Depletion Gauges ── */}
                        <UsageGauges
                            fertilizers={[
                                { name: 'Urea (46-0-0)', allocated: getTotalAllocated('urea_46_0_0_bags'), requested: getTotalRequested('requested_urea_bags'), unit: 'bags' },
                                { name: 'Complete (14-14-14)', allocated: getTotalAllocated('complete_14_14_14_bags'), requested: getTotalRequested('requested_complete_14_bags'), unit: 'bags' },
                                { name: 'Amm. Sulfate', allocated: getTotalAllocated('ammonium_sulfate_21_0_0_bags'), requested: getTotalRequested('requested_ammonium_sulfate_bags'), unit: 'bags' },
                                { name: 'Muriate Potash', allocated: getTotalAllocated('muriate_potash_0_0_60_bags'), requested: getTotalRequested('requested_muriate_potash_bags'), unit: 'bags' },
                            ]}
                            seeds={[
                                { name: 'Jackpot', allocated: getTotalAllocated('jackpot_kg'), requested: getTotalRequested('requested_jackpot_kg'), unit: 'kg' },
                                { name: 'US88', allocated: getTotalAllocated('us88_kg'), requested: getTotalRequested('requested_us88_kg'), unit: 'kg' },
                                { name: 'TH82', allocated: getTotalAllocated('th82_kg'), requested: getTotalRequested('requested_th82_kg'), unit: 'kg' },
                                { name: 'RH9000', allocated: getTotalAllocated('rh9000_kg'), requested: getTotalRequested('requested_rh9000_kg'), unit: 'kg' },
                                { name: 'Lumping143', allocated: getTotalAllocated('lumping143_kg'), requested: getTotalRequested('requested_lumping143_kg'), unit: 'kg' },
                                { name: 'LP296', allocated: getTotalAllocated('lp296_kg'), requested: getTotalRequested('requested_lp296_kg'), unit: 'kg' },
                            ]}
                        />

                        {/* ── Barangay Breakdown ── */}
                        <BarangayBreakdownTable requests={requests} />

                        {/* ── Season Comparison ── */}
                        <SeasonComparisonTable allocations={allAllocations} />

                        {/* Overview Cards */}
                        <div className="admin-viewalloc-overview-grid">
                            <div className="admin-viewalloc-overview-card admin-viewalloc-card-date">
                                <div className="admin-viewalloc-overview-label">Allocation Date</div>
                                <div className="admin-viewalloc-overview-value">
                                    {new Date(allocation.allocation_date).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </div>
                            </div>
                            <div className="admin-viewalloc-overview-card admin-viewalloc-card-requests">
                                <div className="admin-viewalloc-overview-label">Total Requests</div>
                                <div className="admin-viewalloc-overview-value-lg">{requests.length}</div>
                                <div className="admin-viewalloc-overview-sub">
                                    {requests.filter(r => r.status === 'pending').length} pending
                                </div>
                            </div>
                        </div>

                        {/* Fertilizers Section */}
                        <div className="admin-viewalloc-section">
                            <h3 className="admin-viewalloc-section-title">
                                🌱 Fertilizers Allocation
                            </h3>
                            <div className="admin-viewalloc-table-wrap">
                                <table className="admin-viewalloc-table">
                                    <thead>
                                        <tr>
                                            <th>Type</th>
                                            <th className="text-right">Allocated</th>
                                            <th className="text-right">Requested</th>
                                            <th className="text-right">Remaining</th>
                                            <th className="text-right">Usage</th>
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
                                            const badgeClass = `admin-viewalloc-badge ${remaining < 0 ? 'admin-viewalloc-badge-red' : Number(percentage) > 80 ? 'admin-viewalloc-badge-orange' : 'admin-viewalloc-badge-green'}`;

                                            return (
                                                <tr key={fertilizer.name}>
                                                    <td>{fertilizer.name}</td>
                                                    <td className="text-right bold">{allocated.toFixed(2)} bags</td>
                                                    <td className="text-right">{requested.toFixed(2)} bags</td>
                                                    <td className={`text-right ${remaining < 0 ? 'admin-viewalloc-negative' : 'admin-viewalloc-positive'}`}>
                                                        {remaining.toFixed(2)} bags
                                                    </td>
                                                    <td className="text-right">
                                                        <span className={badgeClass}>{percentage}%</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(() => {
                                            const fertRemaining = totalAllocatedFertilizer - totalRequestedFertilizer;
                                            const fertPct = getPercentageUsed(totalAllocatedFertilizer, totalRequestedFertilizer);
                                            const fertBadge = `admin-viewalloc-badge ${fertRemaining < 0 ? 'admin-viewalloc-badge-red' : Number(fertPct) > 80 ? 'admin-viewalloc-badge-orange' : 'admin-viewalloc-badge-green'}`;
                                            return (
                                                <tr className="admin-viewalloc-total-row">
                                                    <td>TOTAL</td>
                                                    <td className="text-right">{totalAllocatedFertilizer.toFixed(2)} bags</td>
                                                    <td className="text-right">{totalRequestedFertilizer.toFixed(2)} bags</td>
                                                    <td className={`text-right ${fertRemaining < 0 ? 'admin-viewalloc-negative' : 'admin-viewalloc-positive'}`}>
                                                        {fertRemaining.toFixed(2)} bags
                                                    </td>
                                                    <td className="text-right">
                                                        <span className={fertBadge}>{fertPct}%</span>
                                                    </td>
                                                </tr>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Seeds Section */}
                        <div className="admin-viewalloc-section">
                            <h3 className="admin-viewalloc-section-title">
                                🌾 Seeds Allocation
                            </h3>
                            <div className="admin-viewalloc-table-wrap">
                                <table className="admin-viewalloc-table">
                                    <thead>
                                        <tr>
                                            <th>Variety</th>
                                            <th className="text-right">Allocated</th>
                                            <th className="text-right">Requested</th>
                                            <th className="text-right">Remaining</th>
                                            <th className="text-right">Usage</th>
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
                                            const badgeClass = `admin-viewalloc-badge ${remaining < 0 ? 'admin-viewalloc-badge-red' : Number(percentage) > 80 ? 'admin-viewalloc-badge-orange' : 'admin-viewalloc-badge-green'}`;

                                            return (
                                                <tr key={seed.name}>
                                                    <td>{seed.name}</td>
                                                    <td className="text-right bold">{allocated.toFixed(2)} kg</td>
                                                    <td className="text-right">{requested.toFixed(2)} kg</td>
                                                    <td className={`text-right ${remaining < 0 ? 'admin-viewalloc-negative' : 'admin-viewalloc-positive'}`}>
                                                        {remaining.toFixed(2)} kg
                                                    </td>
                                                    <td className="text-right">
                                                        <span className={badgeClass}>{percentage}%</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(() => {
                                            const seedRemaining = totalAllocatedSeeds - totalRequestedSeeds;
                                            const seedPct = getPercentageUsed(totalAllocatedSeeds, totalRequestedSeeds);
                                            const seedBadge = `admin-viewalloc-badge ${seedRemaining < 0 ? 'admin-viewalloc-badge-red' : Number(seedPct) > 80 ? 'admin-viewalloc-badge-orange' : 'admin-viewalloc-badge-green'}`;
                                            return (
                                                <tr className="admin-viewalloc-total-row">
                                                    <td>TOTAL</td>
                                                    <td className="text-right">{totalAllocatedSeeds.toFixed(2)} kg</td>
                                                    <td className="text-right">{totalRequestedSeeds.toFixed(2)} kg</td>
                                                    <td className={`text-right ${seedRemaining < 0 ? 'admin-viewalloc-negative' : 'admin-viewalloc-positive'}`}>
                                                        {seedRemaining.toFixed(2)} kg
                                                    </td>
                                                    <td className="text-right">
                                                        <span className={seedBadge}>{seedPct}%</span>
                                                    </td>
                                                </tr>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Notes */}
                        {allocation.notes && (
                            <div className="admin-viewalloc-notes">
                                <h4>📝 Notes</h4>
                                <p>{allocation.notes}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default ViewAllocation;
