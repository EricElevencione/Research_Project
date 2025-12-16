import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import '../../assets/css/jo css/JoDistribution.css';
import '../../components/layout/sidebarStyle.css';

interface DistributionRecord {
    id?: number;
    request_id: number;
    farmer_name: string;
    rsbsa_number: string;
    distribution_date: string;
    fertilizer_bags_given?: number;
    seed_kg_given?: number;
    fertilizer_type?: string;
    seed_type?: string;
    verification_notes?: string;
}

interface RegionalAllocation {
    id: number;
    season: string;
    allocation_date: string;
    status: string;
    urea_46_0_0_bags?: number;
    complete_14_14_14_bags?: number;
    complete_16_16_16_bags?: number;
    ammonium_sulfate_21_0_0_bags?: number;
    ammonium_phosphate_16_20_0_bags?: number;
    muriate_potash_0_0_60_bags?: number;
    rice_seeds_nsic_rc160_kg?: number;
    rice_seeds_nsic_rc222_kg?: number;
    rice_seeds_nsic_rc440_kg?: number;
    corn_seeds_hybrid_kg?: number;
    corn_seeds_opm_kg?: number;
    vegetable_seeds_kg?: number;
    jackpot_kg?: number;
    us88_kg?: number;
    th82_kg?: number;
    rh9000_kg?: number;
    lumping143_kg?: number;
    lp296_kg?: number;
    notes?: string;
    season_start_date?: string;
    season_end_date?: string;
}

const JoDistribution: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [distributions, setDistributions] = useState<DistributionRecord[]>([]);
    const [selectedSeason, setSelectedSeason] = useState('');
    const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
    const [loadingAllocations, setLoadingAllocations] = useState(true);
    const [viewDetailsModal, setViewDetailsModal] = useState<DistributionRecord | null>(null);
    const [editAllocationModal, setEditAllocationModal] = useState<RegionalAllocation | null>(null);
    const [editFormData, setEditFormData] = useState<RegionalAllocation | null>(null);
    const [requestCount, setRequestCount] = useState<number>(0);
    const [savingEdit, setSavingEdit] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    useEffect(() => {
        fetchAllocations();
    }, []);

    useEffect(() => {
        if (selectedSeason) {
            fetchDistributions();
        }
    }, [selectedSeason]);

    const fetchAllocations = async () => {
        setLoadingAllocations(true);
        try {
            const response = await fetch('http://localhost:5000/api/distribution/allocations');
            if (response.ok) {
                const data = await response.json();
                setAllocations(data);
                if (data.length > 0) {
                    const mostRecent = data.sort((a: RegionalAllocation, b: RegionalAllocation) =>
                        new Date(b.allocation_date).getTime() - new Date(a.allocation_date).getTime()
                    )[0];
                    setSelectedSeason(mostRecent.season);
                }
            }
        } catch (error) {
            console.error('Error fetching allocations:', error);
        } finally {
            setLoadingAllocations(false);
        }
    };

    const fetchDistributions = async () => { // Fetch distribution records based on selected season
        if (!selectedSeason) return;
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/records/${selectedSeason}`);
            if (response.ok) {
                const data = await response.json();
                setDistributions(data);
            }
        } catch (error) {
            console.error('Error fetching distributions:', error);
        }
    };

    // Parse fertilizer_type and seed_type strings for display
    const parseFertilizerTypes = (fertilizerType: string | undefined) => {
        if (!fertilizerType) return [];
        return fertilizerType.split(', ').map(item => {
            const [type, amount] = item.split(':');
            return { type, amount: parseFloat(amount) };
        });
    };

    const parseSeedTypes = (seedType: string | undefined) => {
        if (!seedType) return [];
        return seedType.split(', ').map(item => {
            const [type, amount] = item.split(':');
            return { type, amount: parseFloat(amount) };
        });
    };

    const formatBreakdown = (items: Array<{ type: string; amount: number }>, limit?: number) => {
        if (items.length === 0) return 'None';
        const displayItems = limit ? items.slice(0, limit) : items;
        const formatted = displayItems.map(item => `${item.type}: ${item.amount}`).join(', ');
        if (limit && items.length > limit) {
            return formatted + ', ...';
        }
        return formatted;
    };

    const handleEditAllocation = async () => {
        const currentAllocation = allocations.find(a => a.season === selectedSeason);
        if (!currentAllocation) return;

        try {
            // Fetch request count for this season
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${selectedSeason}`);
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

        setEditAllocationModal(currentAllocation);
        setEditFormData(currentAllocation);
    };

    const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (!editFormData) return;

        setEditFormData({
            ...editFormData,
            [name]: name.includes('bags') || name.includes('kg') ? parseFloat(value) || 0 : value
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
        <div className="distribution-container">
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

            {/* Main Content */}
            <div className="main-content distribution-main-content">
                <div className="content-header distribution-content-header">
                    <h2>Distribution Logs</h2>
                    <p>View all approved farmer distributions organized by regional allocation</p>
                </div>

                {/* Distribution List */}
                <div className="distributions-list">
                    <div className="list-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="distribution-form-field" style={{ flex: 1 }}>
                            <label>Select Regional Allocation:</label>
                            <select
                                value={selectedSeason}
                                onChange={(e) => setSelectedSeason(e.target.value)}
                                disabled={loadingAllocations}
                            >
                                {loadingAllocations ? (
                                    <option value="">Loading allocations...</option>
                                ) : allocations.length === 0 ? (
                                    <option value="">No allocations found</option>
                                ) : (
                                    <>
                                        <option value="">-- Select an allocation --</option>
                                        {allocations.map((alloc) => (
                                            <option key={alloc.id} value={alloc.season}>
                                                {alloc.season.replace('_', ' ').toUpperCase()} - {new Date(alloc.allocation_date).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })} ({alloc.status})
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                    <div className="distributions-table-container">
                        <table className="distributions-table">
                            <thead>
                                <tr>
                                    <th>Farmer Name</th>
                                    <th>Fertilizers</th>
                                    <th>Seeds</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {distributions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                                            No distribution records found for {selectedSeason}
                                        </td>
                                    </tr>
                                ) : (
                                    distributions.map((dist) => {
                                        const fertilizers = parseFertilizerTypes(dist.fertilizer_type);
                                        const seeds = parseSeedTypes(dist.seed_type);

                                        return (
                                            <tr key={dist.id}>
                                                <td>
                                                    <div><strong>{dist.farmer_name}</strong></div>
                                                    <div style={{ fontSize: '0.85em', color: '#666' }}>{dist.rsbsa_number}</div>
                                                </td>
                                                <td>{formatBreakdown(fertilizers, 2)}</td>
                                                <td>{formatBreakdown(seeds, 2)}</td>
                                                <td>{new Date(dist.distribution_date).toLocaleDateString()}</td>
                                                <td>
                                                    <button
                                                        className="distribution-btn-view-details"
                                                        onClick={() => setViewDetailsModal(dist)}
                                                    >
                                                        📋 View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* View Details Modal */}
                    {viewDetailsModal && (
                        <div className="distribution-modal-overlay" onClick={() => setViewDetailsModal(null)}>
                            <div className="distribution-modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="distribution-modal-header">

                                    {/* Edit Allocation Modal */}
                                    {editAllocationModal && editFormData && (
                                        <div className="distribution-modal-overlay" onClick={() => setEditAllocationModal(null)}>
                                            <div
                                                className="distribution-modal-content"
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}
                                            >
                                                <div className="distribution-modal-header">
                                                    <h3>✏️ Edit Regional Allocation</h3>
                                                    <button
                                                        className="distribution-modal-close"
                                                        onClick={() => setEditAllocationModal(null)}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>

                                                <div className="distribution-modal-body">
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
                                    <h3>Distribution Details</h3>
                                    <button
                                        className="distribution-modal-close"
                                        onClick={() => setViewDetailsModal(null)}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="distribution-modal-body">
                                    <div className="distribution-detail-section">
                                        <h4>Farmer Information</h4>
                                        <div className="distribution-detail-grid">
                                            <div className="distribution-detail-item">
                                                <span className="detail-label">Name:</span>
                                                <span className="detail-value">{viewDetailsModal.farmer_name}</span>
                                            </div>
                                            <div className="distribution-detail-item">
                                                <span className="detail-label">RSBSA Number:</span>
                                                <span className="detail-value">{viewDetailsModal.rsbsa_number}</span>
                                            </div>
                                            <div className="distribution-detail-item">
                                                <span className="detail-label">Distribution Date:</span>
                                                <span className="detail-value">
                                                    {new Date(viewDetailsModal.distribution_date).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="distribution-detail-section">
                                        <h4>Fertilizers Distributed</h4>
                                        <div className="distribution-breakdown-list">
                                            {parseFertilizerTypes(viewDetailsModal.fertilizer_type).length > 0 ? (
                                                parseFertilizerTypes(viewDetailsModal.fertilizer_type).map((item, idx) => (
                                                    <div key={idx} className="distribution-breakdown-item">
                                                        <span className="breakdown-type">{item.type}</span>
                                                        <span className="breakdown-amount">{item.amount} bags</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="no-data">No fertilizers distributed</p>
                                            )}
                                            {parseFertilizerTypes(viewDetailsModal.fertilizer_type).length > 0 && (
                                                <div className="distribution-breakdown-total">
                                                    <span className="breakdown-type"><strong>Total Fertilizer</strong></span>
                                                    <span className="breakdown-amount">
                                                        <strong>{viewDetailsModal.fertilizer_bags_given || 0} bags</strong>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="distribution-detail-section">
                                        <h4>Seeds Distributed</h4>
                                        <div className="distribution-breakdown-list">
                                            {parseSeedTypes(viewDetailsModal.seed_type).length > 0 ? (
                                                parseSeedTypes(viewDetailsModal.seed_type).map((item, idx) => (
                                                    <div key={idx} className="distribution-breakdown-item">
                                                        <span className="breakdown-type">{item.type}</span>
                                                        <span className="breakdown-amount">{item.amount} kg</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="no-data">No seeds distributed</p>
                                            )}
                                            {parseSeedTypes(viewDetailsModal.seed_type).length > 0 && (
                                                <div className="distribution-breakdown-total">
                                                    <span className="breakdown-type"><strong>Total Seeds</strong></span>
                                                    <span className="breakdown-amount">
                                                        <strong>{Number(viewDetailsModal.seed_kg_given || 0).toFixed(2)} kg</strong>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {viewDetailsModal.verification_notes && (
                                        <div className="distribution-detail-section">
                                            <h4>Notes</h4>
                                            <p className="distribution-notes-text">{viewDetailsModal.verification_notes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JoDistribution;
