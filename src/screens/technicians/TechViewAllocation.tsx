import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { useNavigate, useParams } from 'react-router-dom';
import '../../assets/css/jo css/JoIncentStyle.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import FarmerIcon from '../../assets/images/farmer (1).png';
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

const TechViewAllocation: React.FC = () => {
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
            const { data: allocations, error: allocationError } = await supabase
                .from('regional_allocations')
                .select('*');

            if (allocationError) {
                console.error('Error fetching allocations:', allocationError);
                throw new Error('Failed to fetch allocations');
            }

            console.log('📦 All allocations:', allocations);

            const currentAllocation = allocations.find((a: any) => a.id === parseInt(allocationId || '0'));
            console.log('🎯 Current allocation:', currentAllocation);

            if (!currentAllocation) {
                throw new Error('Allocation not found');
            }
            setAllocation(currentAllocation);

            // Fetch farmer requests for this season
            const { data: requestsData, error: requestsError } = await supabase
                .from('farmer_requests')
                .select('*')
                .eq('season', currentAllocation.season);

            if (requestsError) {
                console.error('Error fetching requests:', requestsError);
            } else {
                setRequests(requestsData || []);
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
        if (percentage > 100) return '#ef4444'; // Red - over allocated
        if (percentage > 80) return '#f59e0b'; // Orange - nearing limit
        return '#10b981'; // Green - good
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="page">
                    <div className="main-content">
                        <div className="loading-message">Loading allocation details...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !allocation) {
        return (
            <div className="page-container">
                <div className="page">
                    <div className="main-content">
                        <div className="error-state">
                            <div className="error-icon">⚠️</div>
                            <h3>Error Loading Allocation</h3>
                            <p>{error || 'Allocation not found'}</p>
                            <button className="btn-retry" onClick={() => navigate('/technician-incentives')}>
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
        <div className="page-container">
            <div className="page">
                {/* Sidebar */}
                <div className="sidebar">
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

                {/* Main Content */}
                <div className="main-content">
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
            </div>
        </div >
    );
};

export default TechViewAllocation;
