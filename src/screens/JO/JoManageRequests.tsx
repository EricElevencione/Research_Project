import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../../assets/css/jo css/JoIncentStyle.css';
import '../../assets/css/navigation/nav.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';

interface FarmerRequest {
    id: number;
    season: string;
    request_date: string;
    farmer_id: number;
    farmer_name: string;
    barangay: string;
    farm_area_ha: number;
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
    priority_score: number;
    status: string;
    request_notes: string;
    created_at: string;
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
}

const JoManageRequests: React.FC = () => {
    const navigate = useNavigate();
    const { allocationId } = useParams<{ allocationId: string }>();
    const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
    const [requests, setRequests] = useState<FarmerRequest[]>([]);
    const [filteredRequests, setFilteredRequests] = useState<FarmerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [barangayFilter, setBarangayFilter] = useState<string>('all');

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    useEffect(() => {
        fetchAllocation();
        fetchRequests();
    }, [allocationId]);

    useEffect(() => {
        filterRequests();
    }, [requests, searchTerm, statusFilter, barangayFilter]);

    const fetchAllocation = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/allocations`);
            if (response.ok) {
                const allocations = await response.json();
                const found = allocations.find((a: any) => a.id === parseInt(allocationId || '0'));
                setAllocation(found || null);
            }
        } catch (err) {
            console.error('Failed to fetch allocation:', err);
        }
    };

    const fetchRequests = async () => {
        try {
            setLoading(true);
            setError(null);

            // First get the allocation to get the season
            const allocationResponse = await fetch(`http://localhost:5000/api/distribution/allocations`);
            if (!allocationResponse.ok) {
                throw new Error('Failed to fetch allocation');
            }
            const allocations = await allocationResponse.json();
            const currentAllocation = allocations.find((a: any) => a.id === parseInt(allocationId || '0'));

            if (!currentAllocation) {
                throw new Error('Allocation not found');
            }

            // Fetch requests by season
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${currentAllocation.season}`);
            if (!response.ok) {
                throw new Error('Failed to fetch requests');
            }

            const data = await response.json();
            setRequests(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filterRequests = () => {
        let filtered = [...requests];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(req =>
                req.farmer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.barangay.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(req => req.status === statusFilter);
        }

        // Barangay filter
        if (barangayFilter !== 'all') {
            filtered = filtered.filter(req => req.barangay === barangayFilter);
        }

        setFilteredRequests(filtered);
    };

    const handleDelete = async (id: number, farmerName: string) => {
        if (!confirm(`Are you sure you want to delete the request from ${farmerName}?`)) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('✅ Request deleted successfully');
                fetchRequests();
            } else {
                alert('❌ Failed to delete request');
            }
        } catch (error) {
            console.error('Error deleting request:', error);
            alert('❌ Error deleting request');
        }
    };

    const handleStatusChange = async (id: number, newStatus: string) => {
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                alert(`✅ Status updated to ${newStatus}`);
                fetchRequests();
            } else {
                alert('❌ Failed to update status');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('❌ Error updating status');
        }
    };

    const getUniqueBarangays = () => {
        const barangays = [...new Set(requests.map(req => req.barangay))];
        return barangays.sort();
    };

    const getTotalRequested = (field: keyof FarmerRequest) => {
        return filteredRequests.reduce((sum, req) => sum + (Number(req[field]) || 0), 0);
    };

    const formatSeasonName = (season: string) => {
        const [type, year] = season.split('_');
        return `${type.charAt(0).toUpperCase() + type.slice(1)} Season ${year}`;
    };

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
                            className={`sidebar-nav-item ${isActive('/jo-gap-analysis') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-gap-analysis')}
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
                            className={`sidebar-nav-item ${isActive('/jo-landrecords') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-landrecords')}
                        >
                            <span className="nav-icon">
                                <img src={LandRecsIcon} alt="Land Records" />
                            </span>
                            <span className="nav-text">Land Records</span>
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
                            <h2 className="page-header">Manage Farmer Requests</h2>
                        </div>
                        <button
                            className="btn-create-allocation"
                            onClick={() => navigate('/jo-incentives')}
                        >
                            ← Back to Allocations
                        </button>
                    </div>

                    <div className="content-card-incent">
                        {/* Filters */}
                        <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                placeholder="🔍 Search by farmer name or barangay..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    flex: '1',
                                    minWidth: '250px',
                                    padding: '10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                style={{
                                    padding: '10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <select
                                value={barangayFilter}
                                onChange={(e) => setBarangayFilter(e.target.value)}
                                style={{
                                    padding: '10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="all">All Barangays</option>
                                {getUniqueBarangays().map(barangay => (
                                    <option key={barangay} value={barangay}>{barangay}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => navigate(`/jo-add-farmer-request/${allocationId}`)}
                                style={{
                                    padding: '10px 20px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                ➕ Add Farmer
                            </button>
                        </div>

                        {/* Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ padding: '16px', background: '#f3f4f6', borderRadius: '8px' }}>
                                <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Requests</div>
                                <div style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>{filteredRequests.length}</div>
                            </div>
                            <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '8px' }}>
                                <div style={{ fontSize: '14px', color: '#92400e' }}>Pending</div>
                                <div style={{ fontSize: '24px', fontWeight: '600', color: '#92400e' }}>
                                    {filteredRequests.filter(r => r.status === 'pending').length}
                                </div>
                            </div>
                            <div style={{ padding: '16px', background: '#d1fae5', borderRadius: '8px' }}>
                                <div style={{ fontSize: '14px', color: '#065f46' }}>Approved</div>
                                <div style={{ fontSize: '24px', fontWeight: '600', color: '#065f46' }}>
                                    {filteredRequests.filter(r => r.status === 'approved').length}
                                </div>
                            </div>
                            <div style={{ padding: '16px', background: '#fee2e2', borderRadius: '8px' }}>
                                <div style={{ fontSize: '14px', color: '#991b1b' }}>Rejected</div>
                                <div style={{ fontSize: '24px', fontWeight: '600', color: '#991b1b' }}>
                                    {filteredRequests.filter(r => r.status === 'rejected').length}
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="loading-message">Loading requests...</div>
                        ) : error ? (
                            <div className="error-state">
                                <div className="error-icon">⚠️</div>
                                <h3>Error Loading Requests</h3>
                                <p>{error}</p>
                            </div>
                        ) : filteredRequests.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📝</div>
                                <h3>No Farmer Requests</h3>
                                <p>No requests found matching your filters</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: '14px'
                                }}>
                                    <thead>
                                        <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Farmer Name</th>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Barangay</th>
                                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Fertilizers (bags)</th>
                                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Seeds (kg)</th>
                                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Priority</th>
                                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Status</th>
                                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRequests.map(request => {
                                            const totalFertilizer = Number(request.requested_urea_bags || 0) +
                                                Number(request.requested_complete_14_bags || 0) +
                                                Number(request.requested_ammonium_sulfate_bags || 0) +
                                                Number(request.requested_muriate_potash_bags || 0);

                                            const totalSeeds = Number(request.requested_jackpot_kg || 0) +
                                                Number(request.requested_us88_kg || 0) +
                                                Number(request.requested_th82_kg || 0) +
                                                Number(request.requested_rh9000_kg || 0) +
                                                Number(request.requested_lumping143_kg || 0) +
                                                Number(request.requested_lp296_kg || 0);

                                            return (
                                                <tr key={request.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                    <td style={{ padding: '12px' }}>{request.farmer_name}</td>
                                                    <td style={{ padding: '12px' }}>{request.barangay}</td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>{totalFertilizer.toFixed(2)}</td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>{totalSeeds.toFixed(2)}</td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>{request.priority_score}</td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '4px 12px',
                                                            borderRadius: '12px',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            background: request.status === 'pending' ? '#fef3c7' :
                                                                request.status === 'approved' ? '#d1fae5' : '#fee2e2',
                                                            color: request.status === 'pending' ? '#92400e' :
                                                                request.status === 'approved' ? '#065f46' : '#991b1b'
                                                        }}>
                                                            {request.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            {request.status === 'pending' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleStatusChange(request.id, 'approved')}
                                                                        style={{
                                                                            padding: '6px 12px',
                                                                            background: '#10b981',
                                                                            color: 'white',
                                                                            border: 'none',
                                                                            borderRadius: '4px',
                                                                            cursor: 'pointer',
                                                                            fontSize: '12px'
                                                                        }}
                                                                    >
                                                                        ✓ Approve
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleStatusChange(request.id, 'rejected')}
                                                                        style={{
                                                                            padding: '6px 12px',
                                                                            background: '#ef4444',
                                                                            color: 'white',
                                                                            border: 'none',
                                                                            borderRadius: '4px',
                                                                            cursor: 'pointer',
                                                                            fontSize: '12px'
                                                                        }}
                                                                    >
                                                                        ✕ Reject
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={() => handleDelete(request.id, request.farmer_name)}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    background: '#6b7280',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '12px'
                                                                }}
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb', fontWeight: '600' }}>
                                            <td colSpan={2} style={{ padding: '12px' }}>TOTALS</td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {(getTotalRequested('requested_urea_bags') +
                                                    getTotalRequested('requested_complete_14_bags') +
                                                    getTotalRequested('requested_ammonium_sulfate_bags') +
                                                    getTotalRequested('requested_muriate_potash_bags')).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {(getTotalRequested('requested_jackpot_kg') +
                                                    getTotalRequested('requested_us88_kg') +
                                                    getTotalRequested('requested_th82_kg') +
                                                    getTotalRequested('requested_rh9000_kg') +
                                                    getTotalRequested('requested_lumping143_kg') +
                                                    getTotalRequested('requested_lp296_kg')).toFixed(2)}
                                            </td>
                                            <td colSpan={3}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoManageRequests;
