import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { getAllocations, getFarmerRequests, deleteAllocation, createAllocation } from '../../api';
import '../../assets/css/jo css/JoIncentStyle.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';

interface RegionalAllocation {
    id: number;
    season: string;
    allocation_date: string;
    urea_46_0_0_bags: number;
    complete_14_14_14_bags: number;
    complete_16_16_16_bags?: number;
    ammonium_sulfate_21_0_0_bags: number;
    ammonium_phosphate_16_20_0_bags?: number;
    muriate_potash_0_0_60_bags: number;
    rice_seeds_nsic_rc160_kg: number;
    rice_seeds_nsic_rc222_kg: number;
    rice_seeds_nsic_rc440_kg: number;
    corn_seeds_hybrid_kg: number;
    corn_seeds_opm_kg: number;
    vegetable_seeds_kg: number;
    jackpot_kg?: number;
    us88_kg?: number;
    th82_kg?: number;
    rh9000_kg?: number;
    lumping143_kg?: number;
    lp296_kg?: number;
    notes?: string;
    status?: string;
    farmer_count?: number;
}

const JoIncentives: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editAllocationModal, setEditAllocationModal] = useState<RegionalAllocation | null>(null);
    const [editFormData, setEditFormData] = useState<RegionalAllocation | null>(null);
    const [requestCount, setRequestCount] = useState<number>(0);
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => {
        fetchAllocations();
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

            // Fetch farmer count for each allocation
            const allocationsWithCounts = await Promise.all(
                data.map(async (allocation: RegionalAllocation) => {
                    try {
                        const requestsResponse = await getFarmerRequests(allocation.season);
                        if (!requestsResponse.error) {
                            const requests = requestsResponse.data || [];
                            return { ...allocation, farmer_count: requests.length };
                        }
                        return { ...allocation, farmer_count: 0 };
                    } catch {
                        return { ...allocation, farmer_count: 0 };
                    }
                })
            );
            setAllocations(allocationsWithCounts);
        } catch (error: any) {
            console.error('Error fetching allocations:', error);
            setError(error.message || 'Failed to connect to server');
            setAllocations([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, season: string) => {
        if (!confirm(`Are you sure you want to delete ${season}? This will also delete all associated farmer requests.`)) {
            return;
        }

        try {
            const response = await deleteAllocation(id);

            if (!response.error) {
                alert('✅ Allocation deleted successfully');
                fetchAllocations();
            } else {
                alert('❌ Failed to delete allocation');
            }
        } catch (error) {
            console.error('Error deleting allocation:', error);
            alert('❌ Error deleting allocation');
        }
    };

    const formatSeasonName = (season: string) => {
        const [type, year] = season.split('_');
        return `${type.charAt(0).toUpperCase() + type.slice(1)} Season ${year}`;
    };

    const getTotalFertilizer = (allocation: RegionalAllocation) => {
        const total = (Number(allocation.urea_46_0_0_bags) || 0) +
            (Number(allocation.complete_14_14_14_bags) || 0) +
            (Number(allocation.ammonium_sulfate_21_0_0_bags) || 0) +
            (Number(allocation.muriate_potash_0_0_60_bags) || 0);
        return isNaN(total) ? 0 : total;
    };

    const getTotalSeeds = (allocation: RegionalAllocation) => {
        // Prefer detailed allocation fields (jackpot_kg, us88_kg, etc.) if present
        const jackpot = (allocation as any).jackpot_kg;
        const us88 = (allocation as any).us88_kg;
        const th82 = (allocation as any).th82_kg;
        const rh9000 = (allocation as any).rh9000_kg;
        const lumping143 = (allocation as any).lumping143_kg;
        const lp296 = (allocation as any).lp296_kg;

        if (jackpot !== undefined || us88 !== undefined || th82 !== undefined || rh9000 !== undefined || lumping143 !== undefined || lp296 !== undefined) {
            const total = (Number(jackpot) || 0) +
                (Number(us88) || 0) +
                (Number(th82) || 0) +
                (Number(rh9000) || 0) +
                (Number(lumping143) || 0) +
                (Number(lp296) || 0);
            return isNaN(total) ? 0 : total;
        }

        // Fallback to legacy rice/corn/vegetable seed fields
        const total = (Number(allocation.rice_seeds_nsic_rc160_kg) || 0) +
            (Number(allocation.rice_seeds_nsic_rc222_kg) || 0) +
            (Number(allocation.rice_seeds_nsic_rc440_kg) || 0) +
            (Number(allocation.corn_seeds_hybrid_kg) || 0) +
            (Number(allocation.corn_seeds_opm_kg) || 0) +
            (Number(allocation.vegetable_seeds_kg) || 0);
        return isNaN(total) ? 0 : total;
    };

    const handleEditAllocation = async (allocation: RegionalAllocation) => {
        try {
            // Fetch request count for this season
            const response = await getFarmerRequests(allocation.season);
            if (!response.error) {
                const requests = response.data || [];
                setRequestCount(requests.length);
            } else {
                setRequestCount(0);
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
            setRequestCount(0);
        }

        setEditAllocationModal(allocation);
        setEditFormData(allocation);
    };

    const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (!editFormData) return;

        let parsedValue: any = value;
        if (name.includes('bags')) {
            // Bags should be integers
            parsedValue = parseInt(value) || 0;
        } else if (name.includes('kg')) {
            // Seeds can have decimals
            parsedValue = parseFloat(value) || 0;
        }

        setEditFormData({
            ...editFormData,
            [name]: parsedValue
        });
    };

    const handleDateChange = (part: 'year' | 'month' | 'day', value: string) => {
        if (!editFormData) return;

        const currentDate = editFormData.allocation_date ? new Date(editFormData.allocation_date) : new Date();
        let year = currentDate.getFullYear();
        let month = currentDate.getMonth();
        let day = currentDate.getDate();

        if (part === 'year') year = parseInt(value);
        if (part === 'month') month = parseInt(value);
        if (part === 'day') day = parseInt(value);

        const newDate = new Date(year, month, day);
        setEditFormData({
            ...editFormData,
            allocation_date: newDate.toISOString().split('T')[0]
        });
    };

    const handleSaveEdit = async () => {
        if (!editFormData) return;

        // Confirm if there are existing requests
        if (requestCount > 0) {
            const confirmed = window.confirm(
                `⚠️ Warning: This allocation has ${requestCount} existing farmer request(s).\n\n` +
                `Editing this allocation may affect these requests.\n\n` +
                `Do you want to proceed?`
            );
            if (!confirmed) return;
        }

        setSavingEdit(true);
        try {
            const response = await createAllocation(editFormData);

            if (response.error) {
                throw new Error(response.error || 'Failed to update allocation');
            }

            alert('✅ Allocation updated successfully!');
            setEditAllocationModal(null);
            setEditFormData(null);
            fetchAllocations(); // Refresh allocations list
        } catch (error: any) {
            console.error('Error updating allocation:', error);
            alert(`❌ Error updating allocation: ${error.message}`);
        } finally {
            setSavingEdit(false);
        }
    };




    return (
        <div className="jo-incent-page-container">

            <div className="jo-incent-page">

                {/* Sidebar starts here */}
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
                {/* Sidebar ends here */}

                {/* Main content starts here */}
                <div className="jo-incent-main-content">

                    <div className="jo-incent-dashboard-header">
                        <h2 className="jo-incent-page-header">Farmer Incentive Requests</h2>
                        <p className="jo-incent-page-subtitle">Add farmer requests to available regional allocations</p>
                    </div>

                    <div className="jo-incent-action-header">
                        <button
                            className="jo-incent-btn-create"
                            onClick={() => {
                                console.log('Button clicked! Navigating to /jo-create-allocation');
                                navigate('/jo-create-allocation');
                            }}
                        >
                            ➕ New Regional Allocation
                        </button>
                    </div>

                    <div className="jo-incent-content-card">

                        {loading ? (
                            <div className="jo-incent-loading">Loading allocations...</div>
                        ) : error ? (
                            <div className="jo-incent-error-state">
                                <div className="jo-incent-error-icon">⚠️</div>
                                <h3>Unable to Connect to Server</h3>
                                <p>{error}</p>
                                <div className="jo-incent-error-help">
                                    <p><strong>Please ensure:</strong></p>
                                    <ul>
                                        <li>Backend server is running on port 5000</li>
                                        <li>Database table 'regional_allocations' exists</li>
                                        <li>Run: <code>cd backend && node server.cjs</code></li>
                                    </ul>
                                </div>
                                <button className="jo-incent-btn-retry" onClick={fetchAllocations}>
                                    🔄 Retry Connection
                                </button>
                            </div>
                        ) : allocations.length === 0 ? (
                            <div className="jo-incent-empty-state">
                                <div className="jo-incent-empty-icon">📦</div>
                                <h3>No Allocations Yet</h3>
                                <p>Create your first regional allocation to get started</p>
                            </div>
                        ) : (
                            <div className="jo-incent-grid">
                                {allocations.map((allocation) => (
                                    <div key={allocation.id} className="jo-incent-card">
                                        <div className="jo-incent-card-header">
                                            <div className="jo-incent-season-info">
                                                <h3>{formatSeasonName(allocation.season)}</h3>
                                                <span className="jo-incent-date">
                                                    {new Date(allocation.allocation_date).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="jo-incent-card-body">
                                            <div className="jo-incent-stat-row">
                                                <div className="jo-incent-stat-item">
                                                    <span className="jo-incent-stat-label">Total Fertilizer</span>
                                                    <span className="jo-incent-stat-value">{getTotalFertilizer(allocation).toLocaleString()} bags</span>
                                                </div>
                                                <div className="jo-incent-stat-item">
                                                    <span className="jo-incent-stat-label">Total Seeds</span>
                                                    <span className="jo-incent-stat-value">{getTotalSeeds(allocation).toFixed(2)} kg</span>
                                                </div>
                                            </div>
                                            <div className="jo-incent-stat-row">
                                                <div className="jo-incent-stat-item">
                                                    <span className="jo-incent-stat-label">Farmer Requests</span>
                                                    <span className="jo-incent-stat-value">{allocation.farmer_count || 0} farmers</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="jo-incent-card-actions">
                                            <button
                                                className="jo-incent-btn-action jo-incent-btn-view"
                                                onClick={() => navigate(`/jo-view-allocation/${allocation.id}`)}
                                                title="View Details"
                                            >
                                                👁️ View
                                            </button>
                                            <button
                                                className="jo-incent-btn-action jo-incent-btn-edit"
                                                onClick={() => handleEditAllocation(allocation)}
                                                title="Edit Allocation"
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                className="jo-incent-btn-action jo-incent-btn-add"
                                                onClick={() => navigate(`/jo-add-farmer-request/${allocation.id}`)}
                                                title="Add Farmer Request"
                                            >
                                                ➕ Add Request
                                            </button>
                                            <button
                                                className="jo-incent-btn-action jo-incent-btn-manage"
                                                onClick={() => navigate(`/jo-manage-requests/${allocation.id}`)}
                                                title="Manage Requests"
                                            >
                                                📋 Manage
                                            </button>
                                            <button
                                                className="jo-incent-btn-action jo-incent-btn-delete"
                                                onClick={() => handleDelete(allocation.id, allocation.season)}
                                                title="Delete"
                                            >
                                                🗑️
                                            </button>

                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Edit Allocation Modal */}
                        {editAllocationModal && editFormData && (
                            <div className="jo-incent-modal-overlay" onClick={() => setEditAllocationModal(null)}>
                                <div className="jo-incent-modal-content" onClick={(e) => e.stopPropagation()}>
                                    {/* Modal Header */}
                                    <div className="jo-incent-modal-header">
                                        <h2>✏️ Edit Regional Allocation</h2>
                                        <button
                                            onClick={() => setEditAllocationModal(null)}
                                            className="jo-incent-modal-close"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    {/* Modal Body */}
                                    <div className="jo-incent-modal-body">
                                        {requestCount > 0 && (
                                            <div className="jo-incent-modal-warning">
                                                ⚠️ <strong>Warning:</strong> This allocation has {requestCount} existing farmer request(s).
                                                Changes may affect these requests.
                                            </div>
                                        )}

                                        {/* Season Information */}
                                        <div style={{ marginBottom: '24px' }}>
                                            <h4 className="jo-incent-modal-section-title">Season Information</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                                                        Season <span style={{ color: '#ef4444' }}>*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="season"
                                                        value={editFormData.season}
                                                        onChange={handleEditInputChange}
                                                        disabled
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            border: '1px solid #d1d5db',
                                                            borderRadius: '6px',
                                                            fontSize: '14px',
                                                            backgroundColor: '#f3f4f6',
                                                            color: '#6b7280'
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                                                        Allocation Date
                                                    </label>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px' }}>
                                                        {/* Month Dropdown */}
                                                        <select
                                                            value={editFormData.allocation_date ? new Date(editFormData.allocation_date).getMonth() : new Date().getMonth()}
                                                            onChange={(e) => handleDateChange('month', e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '8px 12px',
                                                                border: '1px solid #d1d5db',
                                                                borderRadius: '6px',
                                                                fontSize: '14px',
                                                                backgroundColor: 'white',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <option value="0">January</option>
                                                            <option value="1">February</option>
                                                            <option value="2">March</option>
                                                            <option value="3">April</option>
                                                            <option value="4">May</option>
                                                            <option value="5">June</option>
                                                            <option value="6">July</option>
                                                            <option value="7">August</option>
                                                            <option value="8">September</option>
                                                            <option value="9">October</option>
                                                            <option value="10">November</option>
                                                            <option value="11">December</option>
                                                        </select>

                                                        {/* Day Dropdown */}
                                                        <select
                                                            value={editFormData.allocation_date ? new Date(editFormData.allocation_date).getDate() : new Date().getDate()}
                                                            onChange={(e) => handleDateChange('day', e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '8px 12px',
                                                                border: '1px solid #d1d5db',
                                                                borderRadius: '6px',
                                                                fontSize: '14px',
                                                                backgroundColor: 'white',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                                <option key={day} value={day}>{day}</option>
                                                            ))}
                                                        </select>

                                                        {/* Year Dropdown */}
                                                        <select
                                                            value={editFormData.allocation_date ? new Date(editFormData.allocation_date).getFullYear() : new Date().getFullYear()}
                                                            onChange={(e) => handleDateChange('year', e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '8px 12px',
                                                                border: '1px solid #d1d5db',
                                                                borderRadius: '6px',
                                                                fontSize: '14px',
                                                                backgroundColor: 'white',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {Array.from({ length: 76 }, (_, i) => 2025 + i).map(year => (
                                                                <option key={year} value={year}>{year}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fertilizers */}
                                        <div style={{ marginBottom: '24px' }}>
                                            <h4 className="jo-incent-modal-section-title">🌱 Fertilizer Allocation (bags)</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Urea (46-0-0)</label>
                                                    <input
                                                        type="number"
                                                        name="urea_46_0_0_bags"
                                                        value={editFormData.urea_46_0_0_bags || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Complete (14-14-14)</label>
                                                    <input
                                                        type="number"
                                                        name="complete_14_14_14_bags"
                                                        value={editFormData.complete_14_14_14_bags || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Complete (16-16-16)</label>
                                                    <input
                                                        type="number"
                                                        name="complete_16_16_16_bags"
                                                        value={editFormData.complete_16_16_16_bags || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Ammonium Sulfate (21-0-0)</label>
                                                    <input
                                                        type="number"
                                                        name="ammonium_sulfate_21_0_0_bags"
                                                        value={editFormData.ammonium_sulfate_21_0_0_bags || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Ammonium Phosphate (16-20-0)</label>
                                                    <input
                                                        type="number"
                                                        name="ammonium_phosphate_16_20_0_bags"
                                                        value={editFormData.ammonium_phosphate_16_20_0_bags || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Muriate of Potash (0-0-60)</label>
                                                    <input
                                                        type="number"
                                                        name="muriate_potash_0_0_60_bags"
                                                        value={editFormData.muriate_potash_0_0_60_bags || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Seeds */}
                                        <div style={{ marginBottom: '24px' }}>
                                            <h4 className="jo-incent-modal-section-title">🌾 Seed Allocation (kg)</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Jackpot</label>
                                                    <input
                                                        type="number"
                                                        name="jackpot_kg"
                                                        value={editFormData.jackpot_kg || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>US88</label>
                                                    <input
                                                        type="number"
                                                        name="us88_kg"
                                                        value={editFormData.us88_kg || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>TH82</label>
                                                    <input
                                                        type="number"
                                                        name="th82_kg"
                                                        value={editFormData.th82_kg || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>RH9000</label>
                                                    <input
                                                        type="number"
                                                        name="rh9000_kg"
                                                        value={editFormData.rh9000_kg || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Lumping143</label>
                                                    <input
                                                        type="number"
                                                        name="lumping143_kg"
                                                        value={editFormData.lumping143_kg || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>LP296</label>
                                                    <input
                                                        type="number"
                                                        name="lp296_kg"
                                                        value={editFormData.lp296_kg || 0}
                                                        onChange={handleEditInputChange}
                                                        min="0"
                                                        step="0.01"
                                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div style={{ marginBottom: '20px' }}>
                                            <h4 className="jo-incent-modal-section-title">📝 Notes</h4>
                                            <textarea
                                                name="notes"
                                                value={editFormData.notes || ''}
                                                onChange={handleEditInputChange}
                                                rows={3}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    fontFamily: 'inherit'
                                                }}
                                                placeholder="Add any notes or comments..."
                                            />
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="jo-incent-modal-actions">
                                            <button
                                                onClick={() => setEditAllocationModal(null)}
                                                className="jo-incent-modal-btn-cancel"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveEdit}
                                                disabled={savingEdit}
                                                className="jo-incent-modal-btn-save"
                                            >
                                                {savingEdit ? '💾 Saving...' : '✅ Save Changes'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >

    );
};

export default JoIncentives;
