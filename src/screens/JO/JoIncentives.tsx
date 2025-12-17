import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
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

            const response = await fetch('http://localhost:5000/api/distribution/allocations');

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server did not return JSON. Backend server may not be running.');
            }

            const data = await response.json();

            // Fetch farmer count for each allocation
            const allocationsWithCounts = await Promise.all(
                data.map(async (allocation: RegionalAllocation) => {
                    try {
                        const requestsResponse = await fetch(
                            `http://localhost:5000/api/distribution/requests/${allocation.season}`
                        );
                        if (requestsResponse.ok) {
                            const requests = await requestsResponse.json();
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
            const response = await fetch(`http://localhost:5000/api/distribution/allocations/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
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
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${allocation.season}`);
            if (response.ok) {
                const requests = await response.json();
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
            const response = await fetch('http://localhost:5000/api/distribution/allocations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editFormData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update allocation');
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
                            className={`sidebar-nav-item ${isActive('/') ? 'active' : ''}`}
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
                        <h2 className="jo-incent-page-header">Distribution Management</h2>
                    </div>

                    <div className="jo-incent-content-card">
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
                            <div className="jo-incent-modal-overlay" onClick={() => setEditAllocationModal(null)} style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1000
                            }}>
                                <div
                                    className="jo-incent-modal-content"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        backgroundColor: 'white',
                                        borderRadius: '8px',
                                        maxWidth: '800px',
                                        width: '90%',
                                        maxHeight: '90vh',
                                        overflowY: 'auto',
                                        padding: '0'
                                    }}
                                >
                                    <div style={{
                                        padding: '20px 24px',
                                        borderBottom: '1px solid #e5e7eb',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>✏️ Edit Regional Allocation</h3>
                                        <button
                                            onClick={() => setEditAllocationModal(null)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                fontSize: '24px',
                                                cursor: 'pointer',
                                                color: '#6b7280',
                                                padding: '0',
                                                width: '32px',
                                                height: '32px'
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div style={{ padding: '24px' }}>
                                        {requestCount > 0 && (
                                            <div style={{
                                                padding: '12px 16px',
                                                backgroundColor: '#fef3c7',
                                                border: '1px solid #f59e0b',
                                                borderRadius: '6px',
                                                marginBottom: '20px',
                                                color: '#92400e'
                                            }}>
                                                ⚠️ <strong>Warning:</strong> This allocation has {requestCount} existing farmer request(s).
                                                Changes may affect these requests.
                                            </div>
                                        )}

                                        {/* Season Information */}
                                        <div style={{ marginBottom: '24px' }}>
                                            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Season Information</h4>
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
                                                    <input
                                                        type="date"
                                                        name="allocation_date"
                                                        value={editFormData.allocation_date?.split('T')[0] || ''}
                                                        onChange={handleEditInputChange}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 12px',
                                                            border: '1px solid #d1d5db',
                                                            borderRadius: '6px',
                                                            fontSize: '14px'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fertilizers */}
                                        <div style={{ marginBottom: '24px' }}>
                                            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>🌱 Fertilizer Allocation (bags)</h4>
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
                                            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>🌾 Seed Allocation (kg)</h4>
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
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Notes</label>
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
                                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                                            <button
                                                onClick={() => setEditAllocationModal(null)}
                                                style={{
                                                    padding: '10px 20px',
                                                    backgroundColor: '#f3f4f6',
                                                    color: '#374151',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveEdit}
                                                disabled={savingEdit}
                                                style={{
                                                    padding: '10px 20px',
                                                    backgroundColor: savingEdit ? '#9ca3af' : '#10b981',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: savingEdit ? 'not-allowed' : 'pointer',
                                                    fontSize: '14px',
                                                    fontWeight: '500'
                                                }}
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
