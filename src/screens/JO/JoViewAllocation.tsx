import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAllocations, getFarmerRequests } from '../../api';
import '../../assets/css/jo css/JoViewAllocationStyle.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';

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

const JoViewAllocation: React.FC = () => {
    const navigate = useNavigate();
    const { allocationId } = useParams<{ allocationId: string }>();
    const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
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

    const getStatusColor = (allocated: number, requested: number) => {
        const percentage = (requested / allocated) * 100;
        if (percentage > 100) return 'danger';
        if (percentage > 80) return 'warning';
        return 'good';
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
                            <div className="jo-view-alloc-error-icon">⚠️</div>
                            <h3>Error Loading Allocation</h3>
                            <p>{error || 'Allocation not found'}</p>
                            <button className="jo-view-alloc-btn jo-view-alloc-btn-secondary" onClick={() => navigate('/jo-incentives')}>
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
        <div className="jo-view-alloc-page-container">
            <div className="jo-view-alloc-page">
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
                            className={`sidebar-nav-item ${isActive('/jo-gap-analysis') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-gap-analysis')}
                        >
                            <span className="nav-icon">📊</span>
                            <span className="nav-text">Gap Analysis</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-distribution') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-distribution')}
                        >
                            <span className="nav-icon">🚚</span>
                            <span className="nav-text">Distribution Log</span>
                        </button>

                        <button
                            className="sidebar-nav-item logout"
                            onClick={() => navigate('/')}
                        >
                            <span className="nav-icon">
                                <img src={LogoutIcon} alt="Logout" />
                            </span>
                            <span className="nav-text">Logout</span>
                        </button>
                    </nav>
                </div>

                {/* Main Content */}
                <div className="jo-view-alloc-main-content">
                    {/* Header */}
                    <div className="jo-view-alloc-header">
                        <div>
                            <h2 className="jo-view-alloc-title">{formatSeasonName(allocation.season)}</h2>
                            <p className="jo-view-alloc-subtitle">Regional Allocation Details</p>
                        </div>
                    </div>
                    <div className="jo-view-alloc-header-actions">
                        <button
                            className="jo-view-alloc-btn jo-view-alloc-btn-secondary"
                            onClick={() => navigate('/jo-incentives')}
                        >
                            ← Back
                        </button>
                        <button
                            className="jo-view-alloc-btn jo-view-alloc-btn-primary"
                            onClick={() => navigate(`/jo-manage-requests/${allocationId}`)}
                        >
                            📋 Manage Requests
                        </button>
                    </div>

                    <div className="jo-view-alloc-content-card">
                        {/* Overview Cards */}
                        <div className="jo-view-alloc-overview-grid">
                            <div className="jo-view-alloc-overview-card date">
                                <div className="jo-view-alloc-overview-label">📅 Allocation Date</div>
                                <div className="jo-view-alloc-overview-value">
                                    {new Date(allocation.allocation_date).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </div>
                            </div>
                            <div className="jo-view-alloc-overview-card requests">
                                <div className="jo-view-alloc-overview-label">📝 Total Requests</div>
                                <div className="jo-view-alloc-overview-value large">{requests.length}</div>
                                <div className="jo-view-alloc-overview-sub">
                                    {requests.filter(r => r.status === 'pending').length} pending
                                </div>
                            </div>
                            <div className="jo-view-alloc-overview-card approved">
                                <div className="jo-view-alloc-overview-label">✅ Approved</div>
                                <div className="jo-view-alloc-overview-value large">
                                    {requests.filter(r => r.status === 'approved').length}
                                </div>
                                <div className="jo-view-alloc-overview-sub">
                                    {requests.filter(r => r.status === 'rejected').length} rejected
                                </div>
                            </div>
                        </div>

                        {/* Fertilizers Section */}
                        <div className="jo-view-alloc-section">
                            <h3 className="jo-view-alloc-section-title">🌱 Fertilizers Allocation</h3>
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
                                            const statusClass = getStatusColor(allocated, requested);

                                            return (
                                                <tr key={fertilizer.name}>
                                                    <td>{fertilizer.name}</td>
                                                    <td className="allocated">{allocated.toFixed(2)} bags</td>
                                                    <td>{requested.toFixed(2)} bags</td>
                                                    <td className={remaining < 0 ? 'negative' : 'positive'}>
                                                        {remaining.toFixed(2)} bags
                                                    </td>
                                                    <td>
                                                        <span className={`jo-view-alloc-usage-badge ${statusClass}`}>
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
                                            <td className={(totalAllocatedFertilizer - totalRequestedFertilizer) < 0 ? 'negative' : 'positive'}>
                                                {(totalAllocatedFertilizer - totalRequestedFertilizer).toFixed(2)} bags
                                            </td>
                                            <td>
                                                <span className={`jo-view-alloc-usage-badge ${getStatusColor(totalAllocatedFertilizer, totalRequestedFertilizer)}`}>
                                                    {getPercentageUsed(totalAllocatedFertilizer, totalRequestedFertilizer)}%
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Seeds Section */}
                        <div className="jo-view-alloc-section">
                            <h3 className="jo-view-alloc-section-title">🌾 Seeds Allocation</h3>
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
                                            const statusClass = getStatusColor(allocated, requested);

                                            return (
                                                <tr key={seed.name}>
                                                    <td>{seed.name}</td>
                                                    <td className="allocated">{allocated.toFixed(2)} kg</td>
                                                    <td>{requested.toFixed(2)} kg</td>
                                                    <td className={remaining < 0 ? 'negative' : 'positive'}>
                                                        {remaining.toFixed(2)} kg
                                                    </td>
                                                    <td>
                                                        <span className={`jo-view-alloc-usage-badge ${statusClass}`}>
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
                                            <td className={(totalAllocatedSeeds - totalRequestedSeeds) < 0 ? 'negative' : 'positive'}>
                                                {(totalAllocatedSeeds - totalRequestedSeeds).toFixed(2)} kg
                                            </td>
                                            <td>
                                                <span className={`jo-view-alloc-usage-badge ${getStatusColor(totalAllocatedSeeds, totalRequestedSeeds)}`}>
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
                            <div className="jo-view-alloc-notes">
                                <h4 className="jo-view-alloc-notes-title">📝 Notes</h4>
                                <p className="jo-view-alloc-notes-text">{allocation.notes}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoViewAllocation;
