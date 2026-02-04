import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from '../../supabase';
import '../../components/layout/sidebarStyle.css';
import '../../assets/css/jo css/JoLandRegistryStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';

// Interfaces
interface LandParcel {
    id: number;
    land_parcel_id: number;
    parcel_number: string;
    farm_location_barangay: string;
    farm_location_municipality: string;
    total_farm_area_ha: number;
    land_owner_name: string;
    farmer_name: string;
    is_registered_owner: boolean;
    is_tenant: boolean;
    is_lessee: boolean;
    is_current: boolean;
    period_start_date: string;
}

interface LandHistoryRecord {
    id: number;
    land_parcel_id: number;
    parcel_number: string;
    farm_location_barangay: string;
    total_farm_area_ha: number;
    land_owner_name: string;
    farmer_name: string;
    farmer_ffrs_code: string;
    is_registered_owner: boolean;
    is_tenant: boolean;
    is_lessee: boolean;
    period_start_date: string;
    period_end_date: string | null;
    is_current: boolean;
    change_type: string;
    change_reason: string;
    previous_history_id: number | null;
}

// Interface for farmers (for transfer ownership dropdown)
interface Farmer {
    id: number;
    name: string;
    barangay: string;
}

const JoLandRegistry: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // State
    const [landParcels, setLandParcels] = useState<LandParcel[]>([]);
    const [selectedParcel, setSelectedParcel] = useState<LandParcel | null>(null);
    const [parcelHistory, setParcelHistory] = useState<LandHistoryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBarangay, setFilterBarangay] = useState('');
    const [showModal, setShowModal] = useState(false);

    // Transfer Ownership State
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferSearch, setTransferSearch] = useState('');
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [filteredFarmers, setFilteredFarmers] = useState<Farmer[]>([]);
    const [selectedNewOwner, setSelectedNewOwner] = useState<Farmer | null>(null);
    const [transferType, setTransferType] = useState<'owner' | 'tenant' | 'lessee'>('owner');
    const [transferReason, setTransferReason] = useState('');
    const [isTransferring, setIsTransferring] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    // Fetch farmers for transfer dropdown
    useEffect(() => {
        const fetchFarmers = async () => {
            try {
                const { data, error } = await supabase
                    .from('rsbsa_submission')
                    .select('id, "FIRST NAME", "LAST NAME", "MIDDLE NAME", "BARANGAY"')
                    .order('"LAST NAME"', { ascending: true })
                    .limit(500);

                if (!error && data) {
                    const farmerList = data.map((f: any) => ({
                        id: f.id,
                        name: `${f['FIRST NAME'] || ''} ${f['MIDDLE NAME'] || ''} ${f['LAST NAME'] || ''}`.trim(),
                        barangay: f['BARANGAY'] || ''
                    }));
                    setFarmers(farmerList);
                }
            } catch (err) {
                console.error('Error fetching farmers:', err);
            }
        };
        fetchFarmers();
    }, []);

    // Filter farmers based on search
    useEffect(() => {
        if (transferSearch.length < 2) {
            setFilteredFarmers([]);
            return;
        }
        const search = transferSearch.toLowerCase();
        const filtered = farmers.filter(f =>
            f.name.toLowerCase().includes(search) ||
            f.barangay.toLowerCase().includes(search)
        ).slice(0, 10);
        setFilteredFarmers(filtered);
    }, [transferSearch, farmers]);

    // Handle ownership transfer
    const handleTransferOwnership = async () => {
        if (!selectedParcel || !selectedNewOwner) {
            alert('Please select a new owner');
            return;
        }

        setIsTransferring(true);
        try {
            // Close current holder's record
            const { error: updateError } = await supabase
                .from('land_history')
                .update({
                    is_current: false,
                    period_end_date: new Date().toISOString().split('T')[0]
                })
                .eq('id', selectedParcel.id);

            if (updateError) {
                throw new Error('Failed to close current holder record');
            }

            // Create new ownership record
            const { error: insertError } = await supabase
                .from('land_history')
                .insert({
                    land_parcel_id: selectedParcel.land_parcel_id,
                    parcel_number: selectedParcel.parcel_number,
                    farm_location_barangay: selectedParcel.farm_location_barangay,
                    farm_location_municipality: selectedParcel.farm_location_municipality || 'Dumangas',
                    total_farm_area_ha: selectedParcel.total_farm_area_ha,
                    farmer_id: selectedNewOwner.id,
                    farmer_name: selectedNewOwner.name,
                    is_registered_owner: transferType === 'owner',
                    is_tenant: transferType === 'tenant',
                    is_lessee: transferType === 'lessee',
                    land_owner_id: transferType === 'owner' ? selectedNewOwner.id : selectedParcel.id,
                    land_owner_name: transferType === 'owner' ? selectedNewOwner.name : selectedParcel.farmer_name,
                    is_current: true,
                    period_start_date: new Date().toISOString().split('T')[0],
                    change_type: 'TRANSFER',
                    change_reason: transferReason || `Ownership transfer to ${selectedNewOwner.name}`,
                    previous_history_id: selectedParcel.id
                });

            if (insertError) {
                throw new Error('Failed to create new ownership record');
            }

            alert('✅ Ownership transferred successfully!');
            setShowTransferModal(false);
            setShowModal(false);
            setSelectedNewOwner(null);
            setTransferSearch('');
            setTransferReason('');

            // Refresh the parcel list
            window.location.reload();
        } catch (err: any) {
            console.error('Transfer error:', err);
            alert('Error: ' + (err.message || 'Failed to transfer ownership'));
        } finally {
            setIsTransferring(false);
        }
    };

    // Fetch all land parcels with current owners
    useEffect(() => {
        const fetchLandParcels = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('land_history')
                    .select(`
                        id,
                        land_parcel_id,
                        parcel_number,
                        farm_location_barangay,
                        farm_location_municipality,
                        total_farm_area_ha,
                        land_owner_name,
                        farmer_name,
                        is_registered_owner,
                        is_tenant,
                        is_lessee,
                        is_current,
                        period_start_date
                    `)
                    .eq('is_current', true)
                    .order('parcel_number', { ascending: true });

                if (error) {
                    console.error('Error fetching land parcels:', error);
                } else {
                    setLandParcels(data || []);
                    console.log('✅ Loaded', data?.length, 'land parcels');
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLandParcels();
    }, []);

    // Fetch history when a parcel is selected (using land_parcel_id for reliable linking)
    const fetchParcelHistory = async (landParcelId: number, parcelNumber: string) => {
        setHistoryLoading(true);
        try {
            // Use land_parcel_id if available, fallback to parcel_number
            let query = supabase
                .from('land_history')
                .select('*');

            if (landParcelId) {
                query = query.eq('land_parcel_id', landParcelId);
            } else {
                query = query.eq('parcel_number', parcelNumber);
            }

            const { data, error } = await query.order('period_start_date', { ascending: false });

            if (error) {
                console.error('Error fetching parcel history:', error);
            } else {
                setParcelHistory(data || []);
                console.log('✅ Loaded', data?.length, 'history records for parcel ID:', landParcelId);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Handle parcel selection
    const handleParcelSelect = (parcel: LandParcel) => {
        setSelectedParcel(parcel);
        fetchParcelHistory(parcel.land_parcel_id, parcel.parcel_number);
        setShowModal(true);
    };

    // Get ownership type label
    const getOwnershipType = (record: LandParcel | LandHistoryRecord) => {
        if (record.is_registered_owner) return 'Owner';
        if (record.is_tenant) return 'Tenant';
        if (record.is_lessee) return 'Lessee';
        return 'Unknown';
    };

    // Get ownership type icon
    const getOwnershipIcon = (record: LandParcel | LandHistoryRecord) => {
        if (record.is_registered_owner) return '👤';
        if (record.is_tenant) return '🏠';
        if (record.is_lessee) return '📋';
        return '❓';
    };

    // Get ownership class
    const getOwnershipClass = (record: LandParcel | LandHistoryRecord) => {
        if (record.is_registered_owner) return 'owner';
        if (record.is_tenant) return 'tenant';
        if (record.is_lessee) return 'lessee';
        return '';
    };

    // Format date
    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Present';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Get unique barangays for filter
    const uniqueBarangays = [...new Set(landParcels.map(p => p.farm_location_barangay).filter(Boolean))].sort();

    // Filter parcels
    const filteredParcels = landParcels.filter(parcel => {
        const matchesSearch = searchTerm === '' ||
            parcel.parcel_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            parcel.land_owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            parcel.farmer_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesBarangay = filterBarangay === '' ||
            parcel.farm_location_barangay === filterBarangay;

        return matchesSearch && matchesBarangay;
    });

    return (
        <div className="jo-land-registry-page-container">
            <div className="jo-land-registry-page">
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

                        <div
                            className={`sidebar-nav-item ${isActive('/jo-land-registry') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-land-registry')}
                        >
                            <div className="nav-icon">🗺️</div>
                            <span className="nav-text">Land Registry</span>
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

                {/* Main Content */}
                <div className="jo-land-registry-main-content">
                    {/* Header */}
                    <div className="jo-land-registry-dashboard-header">
                        <h1 className="jo-land-registry-page-title">🗺️ Land Registry</h1>
                        <p className="jo-land-registry-page-subtitle">View land parcels and ownership history</p>
                    </div>

                    {/* Stats */}
                    <div className="jo-land-registry-stats">
                        <div className="jo-land-registry-stat-card">
                            <h3>Total Parcels</h3>
                            <p className="jo-land-registry-stat-number">{landParcels.length}</p>
                        </div>
                        <div className="jo-land-registry-stat-card">
                            <h3>Barangays</h3>
                            <p className="jo-land-registry-stat-number">{uniqueBarangays.length}</p>
                        </div>
                        <div className="jo-land-registry-stat-card">
                            <h3>Owners</h3>
                            <p className="jo-land-registry-stat-number">
                                {landParcels.filter(p => p.is_registered_owner).length}
                            </p>
                        </div>
                        <div className="jo-land-registry-stat-card">
                            <h3>Tenants/Lessees</h3>
                            <p className="jo-land-registry-stat-number">
                                {landParcels.filter(p => p.is_tenant || p.is_lessee).length}
                            </p>
                        </div>
                    </div>

                    {/* Content Card */}
                    <div className="jo-land-registry-content-card">
                        {/* Filters */}
                        <div className="jo-land-registry-filters-section">
                            <div className="jo-land-registry-search-filter">
                                <input
                                    type="text"
                                    className="jo-land-registry-search-input"
                                    placeholder="🔍 Search by parcel number, owner name, or farmer name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="jo-land-registry-barangay-filter">
                                <select
                                    className="jo-land-registry-barangay-select"
                                    value={filterBarangay}
                                    onChange={(e) => setFilterBarangay(e.target.value)}
                                >
                                    <option value="">All Barangays</option>
                                    {uniqueBarangays.map(brgy => (
                                        <option key={brgy} value={brgy}>{brgy}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="jo-land-registry-table-container">
                            <table className="jo-land-registry-table">
                                <thead>
                                    <tr>
                                        <th>Parcel #</th>
                                        <th>Current Holder</th>
                                        <th>Ownership Type</th>
                                        <th>Barangay</th>
                                        <th>Area (ha)</th>
                                        <th>Since</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="jo-land-registry-loading-cell">
                                                Loading land parcels...
                                            </td>
                                        </tr>
                                    ) : filteredParcels.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="jo-land-registry-empty-cell">
                                                {searchTerm || filterBarangay
                                                    ? 'No parcels match your search criteria'
                                                    : 'No land parcels registered yet'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredParcels.map(parcel => (
                                            <tr
                                                key={parcel.id}
                                                onClick={() => handleParcelSelect(parcel)}
                                                className={selectedParcel?.id === parcel.id ? 'selected' : ''}
                                            >
                                                <td><strong>{parcel.parcel_number || `#${parcel.id}`}</strong></td>
                                                <td>{parcel.farmer_name || parcel.land_owner_name || '—'}</td>
                                                <td>
                                                    <span className={`jo-land-registry-ownership-pill jo-land-registry-ownership-${getOwnershipClass(parcel)}`}>
                                                        {getOwnershipType(parcel)}
                                                    </span>
                                                </td>
                                                <td>{parcel.farm_location_barangay || '—'}</td>
                                                <td>{parcel.total_farm_area_ha?.toFixed(2) || '0'}</td>
                                                <td>{formatDate(parcel.period_start_date)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Detail Modal */}
                {showModal && selectedParcel && (
                    <div className="jo-land-registry-modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="jo-land-registry-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="jo-land-registry-modal-header">
                                <h3>📋 Land Parcel Details</h3>
                                <button
                                    className="jo-land-registry-close-button"
                                    onClick={() => setShowModal(false)}
                                >
                                    ×
                                </button>
                            </div>
                            <div className="jo-land-registry-modal-body">
                                {/* Current Owner Section */}
                                <div className="jo-land-registry-detail-section">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h4 style={{ margin: 0 }}>👤 Current Holder</h4>
                                        <button
                                            onClick={() => setShowTransferModal(true)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                backgroundColor: '#2196F3',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            🔄 Transfer Ownership
                                        </button>
                                    </div>
                                    <div className="jo-land-registry-owner-card">
                                        <div className="jo-land-registry-owner-avatar">
                                            {getOwnershipIcon(selectedParcel)}
                                        </div>
                                        <div className="jo-land-registry-owner-details">
                                            <h4>{selectedParcel.farmer_name || selectedParcel.land_owner_name || 'Unknown'}</h4>
                                            <span className="jo-land-registry-owner-type">
                                                {getOwnershipType(selectedParcel)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="jo-land-registry-info-grid">
                                        <div className="jo-land-registry-info-item">
                                            <span className="jo-land-registry-info-label">Parcel Number</span>
                                            <span className="jo-land-registry-info-value">
                                                {selectedParcel.parcel_number || `#${selectedParcel.id}`}
                                            </span>
                                        </div>
                                        <div className="jo-land-registry-info-item">
                                            <span className="jo-land-registry-info-label">Total Area</span>
                                            <span className="jo-land-registry-info-value">
                                                {selectedParcel.total_farm_area_ha?.toFixed(2) || '0'} hectares
                                            </span>
                                        </div>
                                        <div className="jo-land-registry-info-item">
                                            <span className="jo-land-registry-info-label">Barangay</span>
                                            <span className="jo-land-registry-info-value">
                                                {selectedParcel.farm_location_barangay || '—'}
                                            </span>
                                        </div>
                                        <div className="jo-land-registry-info-item">
                                            <span className="jo-land-registry-info-label">Municipality</span>
                                            <span className="jo-land-registry-info-value">
                                                {selectedParcel.farm_location_municipality || 'Dumangas'}
                                            </span>
                                        </div>
                                        <div className="jo-land-registry-info-item">
                                            <span className="jo-land-registry-info-label">Effective Since</span>
                                            <span className="jo-land-registry-info-value">
                                                {formatDate(selectedParcel.period_start_date)}
                                            </span>
                                        </div>
                                        {selectedParcel.land_owner_name && !selectedParcel.is_registered_owner && (
                                            <div className="jo-land-registry-info-item">
                                                <span className="jo-land-registry-info-label">Land Owner</span>
                                                <span className="jo-land-registry-info-value">
                                                    {selectedParcel.land_owner_name}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* History Section */}
                                <div className="jo-land-registry-detail-section">
                                    <h4>📜 Ownership History</h4>
                                    {historyLoading ? (
                                        <div className="jo-land-registry-no-history">Loading history...</div>
                                    ) : parcelHistory.length === 0 ? (
                                        <div className="jo-land-registry-no-history">No history records found</div>
                                    ) : (
                                        <div className="jo-land-registry-history-list">
                                            {parcelHistory.map((record, index) => (
                                                <div
                                                    key={record.id}
                                                    className={`jo-land-registry-history-item ${record.is_current ? 'current' : ''}`}
                                                >
                                                    <div className="jo-land-registry-history-number">
                                                        {index + 1}
                                                    </div>
                                                    <div className={`jo-land-registry-history-badge ${getOwnershipClass(record)}`}>
                                                        {getOwnershipType(record)}
                                                    </div>
                                                    <div className="jo-land-registry-history-details">
                                                        <span className="jo-land-registry-history-name">
                                                            {record.farmer_name || record.land_owner_name || 'Unknown'}
                                                            {record.is_current && (
                                                                <span className="jo-land-registry-current-tag">Current</span>
                                                            )}
                                                        </span>
                                                        <span className="jo-land-registry-history-meta">
                                                            <span>📅 {formatDate(record.period_start_date)} - {formatDate(record.period_end_date)}</span>
                                                            {record.change_reason && (
                                                                <span>📝 {record.change_reason}</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Info Note */}
                                <div className="jo-land-registry-info-note">
                                    <span className="jo-land-registry-note-icon">ℹ️</span>
                                    <span className="jo-land-registry-note-text">
                                        Ownership changes are recorded through RSBSA registrations.
                                        For official land transfers, please contact the Municipal Agriculture Office.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Transfer Ownership Modal */}
                {showTransferModal && selectedParcel && (
                    <div className="jo-land-registry-modal-overlay" onClick={() => setShowTransferModal(false)}>
                        <div
                            className="jo-land-registry-modal"
                            onClick={(e) => e.stopPropagation()}
                            style={{ maxWidth: '500px' }}
                        >
                            <div className="jo-land-registry-modal-header" style={{ backgroundColor: '#2196F3' }}>
                                <h3>🔄 Transfer Ownership</h3>
                                <button
                                    className="jo-land-registry-close-button"
                                    onClick={() => setShowTransferModal(false)}
                                >
                                    ×
                                </button>
                            </div>
                            <div className="jo-land-registry-modal-body">
                                {/* Current Parcel Info */}
                                <div style={{
                                    padding: '1rem',
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '8px',
                                    marginBottom: '1.5rem'
                                }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                        📍 {selectedParcel.parcel_number}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                                        Current: {selectedParcel.farmer_name} ({getOwnershipType(selectedParcel)})
                                    </div>
                                </div>

                                {/* Transfer Type Selection */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                                        Transfer Type
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {(['owner', 'tenant', 'lessee'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setTransferType(type)}
                                                style={{
                                                    flex: 1,
                                                    padding: '0.75rem',
                                                    border: transferType === type ? '2px solid #2196F3' : '1px solid #dee2e6',
                                                    backgroundColor: transferType === type ? '#e3f2fd' : 'white',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontWeight: transferType === type ? 'bold' : 'normal'
                                                }}
                                            >
                                                {type === 'owner' ? '👤 Owner' : type === 'tenant' ? '🏠 Tenant' : '📋 Lessee'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* New Owner Search */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                                        Search New {transferType === 'owner' ? 'Owner' : transferType === 'tenant' ? 'Tenant' : 'Lessee'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Search by name..."
                                        value={transferSearch}
                                        onChange={(e) => {
                                            setTransferSearch(e.target.value);
                                            setSelectedNewOwner(null);
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid #dee2e6',
                                            borderRadius: '6px',
                                            fontSize: '1rem'
                                        }}
                                    />

                                    {/* Search Results */}
                                    {filteredFarmers.length > 0 && !selectedNewOwner && (
                                        <div style={{
                                            border: '1px solid #dee2e6',
                                            borderRadius: '6px',
                                            marginTop: '0.5rem',
                                            maxHeight: '200px',
                                            overflowY: 'auto'
                                        }}>
                                            {filteredFarmers.map((farmer) => (
                                                <div
                                                    key={farmer.id}
                                                    onClick={() => {
                                                        setSelectedNewOwner(farmer);
                                                        setTransferSearch(farmer.name);
                                                    }}
                                                    style={{
                                                        padding: '0.75rem 1rem',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #f0f0f0'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                                >
                                                    <div style={{ fontWeight: 'bold' }}>{farmer.name}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                                        {farmer.barangay}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Selected Farmer */}
                                    {selectedNewOwner && (
                                        <div style={{
                                            marginTop: '0.5rem',
                                            padding: '0.75rem',
                                            backgroundColor: '#e8f5e9',
                                            borderRadius: '6px',
                                            border: '2px solid #4caf50'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                                        ✓ {selectedNewOwner.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                                                        {selectedNewOwner.barangay}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedNewOwner(null);
                                                        setTransferSearch('');
                                                    }}
                                                    style={{
                                                        padding: '0.25rem 0.5rem',
                                                        backgroundColor: '#dc3545',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Transfer Reason */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                                        Reason for Transfer (Optional)
                                    </label>
                                    <textarea
                                        placeholder="e.g., Sale of property, Inheritance, Lease agreement..."
                                        value={transferReason}
                                        onChange={(e) => setTransferReason(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid #dee2e6',
                                            borderRadius: '6px',
                                            fontSize: '1rem',
                                            minHeight: '80px',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setShowTransferModal(false)}
                                        style={{
                                            padding: '0.75rem 1.5rem',
                                            backgroundColor: '#6c757d',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '1rem'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleTransferOwnership}
                                        disabled={!selectedNewOwner || isTransferring}
                                        style={{
                                            padding: '0.75rem 1.5rem',
                                            backgroundColor: selectedNewOwner ? '#4caf50' : '#ccc',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: selectedNewOwner ? 'pointer' : 'not-allowed',
                                            fontSize: '1rem'
                                        }}
                                    >
                                        {isTransferring ? 'Transferring...' : '✓ Confirm Transfer'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JoLandRegistry;
