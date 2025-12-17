import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/technician css/TechIncentStyle.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import FarmerIcon from '../../assets/images/farmer (1).png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';


interface RegionalAllocation {
    id: number;
    season: string;
    allocation_date: string;
    urea_46_0_0_bags: number;
    complete_14_14_14_bags: number;
    ammonium_sulfate_21_0_0_bags: number;
    muriate_potash_0_0_60_bags: number;
    rice_seeds_nsic_rc160_kg: number;
    rice_seeds_nsic_rc222_kg: number;
    rice_seeds_nsic_rc440_kg: number;
    corn_seeds_hybrid_kg: number;
    corn_seeds_opm_kg: number;
    vegetable_seeds_kg: number;
    farmer_count?: number;
}

const TechIncentives: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editAllocationModal, setEditAllocationModal] = useState<RegionalAllocation | null>(null);
    const [editFormData, setEditFormData] = useState<RegionalAllocation | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [requestCount, setRequestCount] = useState<number>(0);

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

            if (response.ok) {
                alert('✅ Allocation updated successfully');
                setEditAllocationModal(null);
                setEditFormData(null);
                fetchAllocations();
            } else {
                alert('❌ Failed to update allocation');
            }
        } catch (error) {
            console.error('Error updating allocation:', error);
            alert('❌ Error updating allocation');
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <div className="tech-incent-page-container">

            <div className="tech-incent-page">

                {/* Sidebar starts here */}
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
                            className={`sidebar-nav-item ${isActive('/technician-rsbsapage') ? 'active' : ''}`}
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
                <div className="tech-incent-main-content">

                    <div className="tech-incent-dashboard-header">
                        <div>
                            <h2 className="tech-incent-page-header">Farmer Incentive Requests</h2>
                            <p className="tech-incent-page-subtitle">Add farmer requests to available regional allocations</p>
                        </div>
                        <button
                            className="tech-incent-btn-create"
                            onClick={() => navigate('/technician-create-allocation')}
                            style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                padding: '12px 24px',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '15px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            ➕ Create New Allocation
                        </button>
                    </div>

                    <div className="tech-incent-content-card">
                        {loading ? (
                            <div className="tech-incent-loading">Loading allocations...</div>
                        ) : error ? (
                            <div className="tech-incent-error-state">
                                <div className="tech-incent-error-icon">⚠️</div>
                                <h3>Unable to Connect to Server</h3>
                                <p>{error}</p>
                                <div className="tech-incent-error-help">
                                    <p><strong>Please ensure:</strong></p>
                                    <ul>
                                        <li>Backend server is running on port 5000</li>
                                        <li>Database table 'regional_allocations' exists</li>
                                        <li>Run: <code>cd backend && node server.cjs</code></li>
                                    </ul>
                                </div>
                                <button className="tech-incent-btn-retry" onClick={fetchAllocations}>
                                    🔄 Retry Connection
                                </button>
                            </div>
                        ) : allocations.length === 0 ? (
                            <div className="tech-incent-empty-state">
                                <div className="tech-incent-empty-icon">📦</div>
                                <h3>No Allocations Available</h3>
                                <p>Contact the JO officer to create regional allocations</p>
                            </div>
                        ) : (
                            <div className="tech-incent-grid">
                                {allocations.map((allocation) => (
                                    <div key={allocation.id} className="tech-incent-card">
                                        <div className="tech-incent-card-header">
                                            <div className="tech-incent-season-info">
                                                <h3>{formatSeasonName(allocation.season)}</h3>
                                                <span className="tech-incent-date">
                                                    {new Date(allocation.allocation_date).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="tech-incent-card-body">
                                            <div className="tech-incent-stat-row">
                                                <div className="tech-incent-stat-item">
                                                    <span className="tech-incent-stat-label">Total Fertilizer</span>
                                                    <span className="tech-incent-stat-value">{getTotalFertilizer(allocation).toLocaleString()} bags</span>
                                                </div>
                                                <div className="tech-incent-stat-item">
                                                    <span className="tech-incent-stat-label">Total Seeds</span>
                                                    <span className="tech-incent-stat-value">{getTotalSeeds(allocation).toFixed(2)} kg</span>
                                                </div>
                                            </div>
                                            <div className="tech-incent-stat-row">
                                                <div className="tech-incent-stat-item">
                                                    <span className="tech-incent-stat-label">Farmer Requests</span>
                                                    <span className="tech-incent-stat-value">{allocation.farmer_count || 0} farmers</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="tech-incent-card-actions">
                                            <button
                                                className="tech-incent-btn-action tech-incent-btn-view"
                                                onClick={() => navigate(`/technician-view-allocation/${allocation.id}`)}
                                                title="View Details"
                                            >
                                                👁️ View
                                            </button>
                                            <button
                                                className="tech-incent-btn-action tech-incent-btn-edit"
                                                onClick={() => handleEditAllocation(allocation)}
                                                title="Edit Allocation"
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                className="tech-incent-btn-action tech-incent-btn-add"
                                                onClick={() => navigate(`/technician-add-farmer-request/${allocation.id}`)}
                                                title="Add Farmer Request"
                                            >
                                                ➕ Add Farmer

                                            </button>
                                            <button
                                                className="tech-incent-btn-action tech-incent-btn-manage"
                                                onClick={() => navigate(`/technician-manage-requests/${allocation.id}`)}
                                                title="Manage Request"
                                            >
                                                📋 Manage
                                            </button>
                                            <button
                                                className="tech-incent-btn-action tech-incent-btn-delete"
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
                    </div>

                    {/* Edit Allocation Modal */}
                    {editAllocationModal && editFormData && (
                        <div className="tech-incent-modal-overlay" onClick={() => setEditAllocationModal(null)} style={{
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
                            <div className="tech-incent-modal-content" onClick={(e) => e.stopPropagation()} style={{
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                padding: '24px',
                                maxWidth: '800px',
                                width: '90%',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                            }}>
                                <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>Edit Regional Allocation</h2>
                                {requestCount > 0 && (
                                    <div style={{
                                        backgroundColor: '#fef3c7',
                                        border: '1px solid #fbbf24',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        marginBottom: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span>⚠️</span>
                                        <span style={{ fontSize: '14px', color: '#92400e' }}>
                                            This allocation has <strong>{requestCount} existing farmer request(s)</strong>. Editing may affect these requests.
                                        </span>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Season</label>
                                        <input
                                            type="text"
                                            value={formatSeasonName(editFormData.season)}
                                            disabled
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db',
                                                backgroundColor: '#f3f4f6',
                                                cursor: 'not-allowed'
                                            }}
                                        />
                                    </div>

                                    <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                                        <h3 style={{ color: '#059669', marginBottom: '12px' }}>Fertilizers (Bags)</h3>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Urea (46-0-0)</label>
                                        <input
                                            type="number"
                                            name="urea_46_0_0_bags"
                                            value={editFormData.urea_46_0_0_bags}
                                            onChange={handleEditInputChange}
                                            min="0"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Complete (14-14-14)</label>
                                        <input
                                            type="number"
                                            name="complete_14_14_14_bags"
                                            value={editFormData.complete_14_14_14_bags}
                                            onChange={handleEditInputChange}
                                            min="0"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Ammonium Sulfate (21-0-0)</label>
                                        <input
                                            type="number"
                                            name="ammonium_sulfate_21_0_0_bags"
                                            value={editFormData.ammonium_sulfate_21_0_0_bags}
                                            onChange={handleEditInputChange}
                                            min="0"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Muriate of Potash (0-0-60)</label>
                                        <input
                                            type="number"
                                            name="muriate_potash_0_0_60_bags"
                                            value={editFormData.muriate_potash_0_0_60_bags}
                                            onChange={handleEditInputChange}
                                            min="0"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db'
                                            }}
                                        />
                                    </div>

                                    <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                                        <h3 style={{ color: '#059669', marginBottom: '12px' }}>Seeds (kg)</h3>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Rice Seeds NSIC RC160</label>
                                        <input
                                            type="number"
                                            name="rice_seeds_nsic_rc160_kg"
                                            value={editFormData.rice_seeds_nsic_rc160_kg}
                                            onChange={handleEditInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Rice Seeds NSIC RC222</label>
                                        <input
                                            type="number"
                                            name="rice_seeds_nsic_rc222_kg"
                                            value={editFormData.rice_seeds_nsic_rc222_kg}
                                            onChange={handleEditInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Rice Seeds NSIC RC440</label>
                                        <input
                                            type="number"
                                            name="rice_seeds_nsic_rc440_kg"
                                            value={editFormData.rice_seeds_nsic_rc440_kg}
                                            onChange={handleEditInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Corn Seeds (Hybrid)</label>
                                        <input
                                            type="number"
                                            name="corn_seeds_hybrid_kg"
                                            value={editFormData.corn_seeds_hybrid_kg}
                                            onChange={handleEditInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Corn Seeds (OPM)</label>
                                        <input
                                            type="number"
                                            name="corn_seeds_opm_kg"
                                            value={editFormData.corn_seeds_opm_kg}
                                            onChange={handleEditInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Vegetable Seeds</label>
                                        <input
                                            type="number"
                                            name="vegetable_seeds_kg"
                                            value={editFormData.vegetable_seeds_kg}
                                            onChange={handleEditInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setEditAllocationModal(null)}
                                        disabled={savingEdit}
                                        style={{
                                            padding: '10px 24px',
                                            borderRadius: '6px',
                                            border: '1px solid #d1d5db',
                                            backgroundColor: 'white',
                                            color: '#374151',
                                            cursor: savingEdit ? 'not-allowed' : 'pointer',
                                            fontWeight: '500'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={savingEdit}
                                        style={{
                                            padding: '10px 24px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            backgroundColor: '#10b981',
                                            color: 'white',
                                            cursor: savingEdit ? 'not-allowed' : 'pointer',
                                            fontWeight: '500',
                                            opacity: savingEdit ? 0.6 : 1
                                        }}
                                    >
                                        {savingEdit ? 'Saving...' : 'Save Changes'}
                                    </button>
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
