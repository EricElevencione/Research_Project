import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/jo css/JoLandrecStyle.css';
import '../../assets/css/navigation/nav.css';
import LogoImage from '../../assets/images/Logo.png';
import DistributionIcon from '../../assets/images/distribution.png'
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import FarmerRequestIcon from '../../assets/images/request.png';

interface TenantLessee {
    id: string;
    name: string;
    type: 'Tenant' | 'Lessee';
    location: string;
    area: number;
    createdAt: string;
}

interface LandOwner {
    owner_id: string;
    owner_name: string;
    first_name: string;
    last_name: string;
    middle_name: string;
    tenants_lessees: TenantLessee[];
}

interface FarmerSearchResult {
    id: string;
    referenceNumber: string;
    farmerName: string;
    farmerAddress: string;
    ownershipTypes: {
        isOwner: boolean;
        isTenant: boolean;
        isLessee: boolean;
    };
}

interface Parcel {
    id: string;
    parcel_number: string;
    farm_location_barangay: string;
    total_farm_area_ha: number;
    ownership_type_registered_owner: boolean;
    ownership_type_tenant: boolean;
    ownership_type_lessee: boolean;
}

const JoLandrecords: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [landOwners, setLandOwners] = useState<LandOwner[]>([]);
    const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedOwnerHistory, setSelectedOwnerHistory] = useState<LandOwner | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Transfer Ownership States
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [selectedOwnerForTransfer, setSelectedOwnerForTransfer] = useState<LandOwner | null>(null);
    const [ownerParcels, setOwnerParcels] = useState<Parcel[]>([]);
    const [selectedParcelIds, setSelectedParcelIds] = useState<Set<string>>(new Set());
    const [loadingParcels, setLoadingParcels] = useState(false);
    const [transferReason, setTransferReason] = useState('');
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
    const [newOwnerOption, setNewOwnerOption] = useState<'existing' | 'new'>('existing');
    const [farmerSearchQuery, setFarmerSearchQuery] = useState('');
    const [farmerSearchResults, setFarmerSearchResults] = useState<FarmerSearchResult[]>([]);
    const [selectedNewOwner, setSelectedNewOwner] = useState<FarmerSearchResult | null>(null);
    const [newFarmerData, setNewFarmerData] = useState({
        firstName: '',
        lastName: '',
        middleName: '',
        extensionName: '',
        barangay: '',
        municipality: 'Dumangas',
        province: 'Iloilo',
        birthdate: '',
        gender: 'Male'
    });
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [transferProcessing, setTransferProcessing] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    useEffect(() => {
        fetchLandOwnersData();
    }, []);

    const fetchLandOwnersData = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5000/api/land-owners-with-tenants');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setLandOwners(data);
            setLoading(false);
        } catch (err: any) {
            setError(err.message ?? 'Failed to load land owners data');
            setLoading(false);
        }
    };

    const toggleOwnerExpansion = (ownerId: string) => {
        setExpandedOwners(prev => {
            const newSet = new Set(prev);
            if (newSet.has(ownerId)) {
                newSet.delete(ownerId);
            } else {
                newSet.add(ownerId);
            }
            return newSet;
        });
    };

    const openHistoryModal = (owner: LandOwner) => {
        setSelectedOwnerHistory(owner);
        setShowHistoryModal(true);
    };

    const closeHistoryModal = () => {
        setShowHistoryModal(false);
        setSelectedOwnerHistory(null);
    };

    const openTransferModal = async (owner: LandOwner) => {
        setSelectedOwnerForTransfer(owner);
        setShowTransferModal(true);
        setTransferReason('');
        setTransferDate(new Date().toISOString().split('T')[0]);
        setNewOwnerOption('existing');
        setFarmerSearchQuery('');
        setFarmerSearchResults([]);
        setSelectedNewOwner(null);
        setSelectedParcelIds(new Set());
        setNewFarmerData({
            firstName: '',
            lastName: '',
            middleName: '',
            extensionName: '',
            barangay: '',
            municipality: 'Dumangas',
            province: 'Iloilo',
            birthdate: '',
            gender: 'Male'
        });

        // Fetch parcels for this owner
        setLoadingParcels(true);
        try {
            const response = await fetch(`http://localhost:5000/api/rsbsa_submission/${owner.owner_id}/parcels`);
            if (response.ok) {
                const parcels = await response.json();
                setOwnerParcels(parcels);
                // Select all parcels by default
                setSelectedParcelIds(new Set(parcels.map((p: Parcel) => p.id)));
            } else {
                setOwnerParcels([]);
            }
        } catch (error) {
            console.error('Error fetching parcels:', error);
            setOwnerParcels([]);
        } finally {
            setLoadingParcels(false);
        }
    };

    const closeTransferModal = () => {
        setShowTransferModal(false);
        setSelectedOwnerForTransfer(null);
        setOwnerParcels([]);
        setSelectedParcelIds(new Set());
        setShowConfirmDialog(false);
        setTransferProcessing(false);
    };

    const toggleParcelSelection = (parcelId: string) => {
        setSelectedParcelIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(parcelId)) {
                newSet.delete(parcelId);
            } else {
                newSet.add(parcelId);
            }
            return newSet;
        });
    };

    const toggleSelectAllParcels = () => {
        if (selectedParcelIds.size === ownerParcels.length) {
            setSelectedParcelIds(new Set());
        } else {
            setSelectedParcelIds(new Set(ownerParcels.map(p => p.id)));
        }
    };

    const searchFarmers = async (query: string) => {
        if (!query.trim() || query.length < 2) {
            setFarmerSearchResults([]);
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/rsbsa_submission?search=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Failed to search farmers');
            const data = await response.json();

            const results: FarmerSearchResult[] = data
                .filter((farmer: any) => farmer.id !== selectedOwnerForTransfer?.owner_id)
                .map((farmer: any) => ({
                    id: farmer.id,
                    referenceNumber: farmer.referenceNumber || `RSBSA-${farmer.id}`,
                    farmerName: farmer.farmerName || 'N/A',
                    farmerAddress: farmer.farmerAddress || 'N/A',
                    ownershipTypes: {
                        isOwner: farmer.ownershipType?.registeredOwner || false,
                        isTenant: farmer.ownershipType?.tenant || false,
                        isLessee: farmer.ownershipType?.lessee || false
                    }
                }))
                .slice(0, 10);

            setFarmerSearchResults(results);
        } catch (err) {
            console.error('Error searching farmers:', err);
            setFarmerSearchResults([]);
        }
    };

    const handleFarmerSearch = (query: string) => {
        setFarmerSearchQuery(query);
        searchFarmers(query);
    };

    const selectExistingFarmer = (farmer: FarmerSearchResult) => {
        setSelectedNewOwner(farmer);
        setFarmerSearchQuery(farmer.farmerName);
        setFarmerSearchResults([]);
    };

    const validateTransferForm = (): boolean => {
        if (!transferReason.trim()) {
            alert('Please provide a reason for the transfer');
            return false;
        }
        if (!transferDate) {
            alert('Please select a transfer date');
            return false;
        }
        if (selectedParcelIds.size === 0) {
            alert('Please select at least one parcel to transfer');
            return false;
        }
        if (newOwnerOption === 'existing') {
            if (!selectedNewOwner) {
                alert('Please select a farmer from the search results');
                return false;
            }
        } else {
            if (!newFarmerData.firstName.trim() || !newFarmerData.lastName.trim()) {
                alert('Please provide at least first name and last name for the new owner');
                return false;
            }
            if (!newFarmerData.birthdate) {
                alert('Please provide birthdate for the new owner');
                return false;
            }
            if (!newFarmerData.barangay.trim()) {
                alert('Please provide barangay for the new owner');
                return false;
            }
        }
        return true;
    };

    const handleTransferSubmit = () => {
        if (!validateTransferForm()) return;
        setShowConfirmDialog(true);
    };

    const processTransfer = async () => {
        if (!selectedOwnerForTransfer) return;

        setTransferProcessing(true);
        try {
            const transferData = {
                oldOwnerId: selectedOwnerForTransfer.owner_id,
                selectedParcelIds: Array.from(selectedParcelIds),
                transferReason,
                transferDate,
                newOwnerOption,
                // If existing farmer
                newOwnerId: newOwnerOption === 'existing' ? selectedNewOwner?.id : null,
                // If new farmer
                newFarmerData: newOwnerOption === 'new' ? newFarmerData : null
            };

            const response = await fetch('http://localhost:5000/api/transfer-ownership', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(transferData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to transfer ownership');
            }

            const result = await response.json();

            // Refresh land owners data
            await fetchLandOwnersData();

            // Close modals and reset
            closeTransferModal();

            alert(`Ownership transferred successfully! ${result.message || ''}`);
        } catch (err: any) {
            alert(`Failed to transfer ownership: ${err.message}`);
            setTransferProcessing(false);
            setShowConfirmDialog(false);
        }
    };

    const filteredLandOwners = landOwners.filter(owner => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            owner.owner_name.toLowerCase().includes(query) ||
            owner.first_name?.toLowerCase().includes(query) ||
            owner.last_name?.toLowerCase().includes(query) ||
            owner.tenants_lessees.some(tl =>
                tl.name.toLowerCase().includes(query) ||
                tl.location?.toLowerCase().includes(query)
            )
        );
    });

    return (
        <div className="page-container">

            <div className="page">

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

                        <div
                            className={`sidebar-nav-item ${isActive('/jo-regional-allocation') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-regional-allocation')}
                        >
                            <div className="nav-icon">
                                <img src={DistributionIcon} alt="Distribution" />
                            </div>
                            <span className="nav-text">Regional Allocation</span>
                        </div>

                        <div
                            className={`sidebar-nav-item ${isActive('/jo-farmer-requests') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-farmer-requests')}
                        >
                            <div className="nav-icon">
                                <img src={FarmerRequestIcon} alt="FarmerRequest" />
                            </div>
                            <span className="nav-text">Farmer Request</span>
                        </div>

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
                                <img src={LandRecsIcon} alt="Masterlist" />
                            </span>
                            <span className="nav-text">Land Records</span>
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
                <div className="main-content">
                    <h2>Land Records</h2>
                    <div className="content-card">
                        <div className="filters-section">
                            <div className="search-filter">
                                <input
                                    type="text"
                                    placeholder="Search by land owner or tenant name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="search-input"
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="loading-container">
                                <p>Loading land records...</p>
                            </div>
                        ) : error ? (
                            <div className="error-container">
                                <p>Error: {error}</p>
                            </div>
                        ) : (
                            <div className="land-owners-container">
                                {filteredLandOwners.length === 0 ? (
                                    <div className="no-data">
                                        {searchQuery ? 'No results found for your search' : 'No land owners found'}
                                    </div>
                                ) : (
                                    filteredLandOwners.map((owner) => {
                                        const isExpanded = expandedOwners.has(owner.owner_id);
                                        const tenantsToShow = isExpanded
                                            ? owner.tenants_lessees.slice(0, 4)
                                            : owner.tenants_lessees.slice(0, 1);

                                        return (
                                            <div key={owner.owner_id} className="land-owner-card">
                                                {/* Land Owner Header */}
                                                <div className="owner-header">
                                                    <div
                                                        className="owner-name-section"
                                                        onClick={() => toggleOwnerExpansion(owner.owner_id)}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <h3>{owner.owner_name}</h3>
                                                        <span className="tenant-count">
                                                            {owner.tenants_lessees.length} Tenant{owner.tenants_lessees.length !== 1 ? 's' : ''}/Lessee{owner.tenants_lessees.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                    <div className="owner-actions">
                                                        <button
                                                            className="transfer-ownership-btn"
                                                            onClick={() => openTransferModal(owner)}
                                                        >
                                                            Transfer Ownership
                                                        </button>
                                                        <button
                                                            className="full-history-btn"
                                                            onClick={() => openHistoryModal(owner)}
                                                        >
                                                            Full History
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Tenants/Lessees List */}
                                                {tenantsToShow.length > 0 && (
                                                    <div className="tenants-list">
                                                        {tenantsToShow.map((tenant, index) => (
                                                            <div
                                                                key={tenant.id}
                                                                className={`tenant-item ${index === 0 && !isExpanded ? 'preview-item' : ''}`}
                                                            >
                                                                <div className="tenant-type-badge">
                                                                    {tenant.type}
                                                                </div>
                                                                <div className="tenant-info">
                                                                    <span className="tenant-name">{tenant.name}</span>
                                                                    <span className="tenant-location">{tenant.location}</span>
                                                                </div>
                                                                <div className="tenant-date">
                                                                    {new Date(tenant.createdAt).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {owner.tenants_lessees.length > 4 && isExpanded && (
                                                            <div className="more-tenants-notice">
                                                                +{owner.tenants_lessees.length - 4} more... Click "Full History" to see all
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {owner.tenants_lessees.length === 0 && (
                                                    <div className="no-tenants">
                                                        No tenants or lessees currently
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* Full History Modal */}
                    {showHistoryModal && selectedOwnerHistory && (
                        <div className="modal-overlay" onClick={closeHistoryModal}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2>Full History - {selectedOwnerHistory.owner_name}</h2>
                                    <button className="modal-close" onClick={closeHistoryModal}>×</button>
                                </div>
                                <div className="modal-body">
                                    {selectedOwnerHistory.tenants_lessees.length === 0 ? (
                                        <p className="no-history">No tenant or lessee history available</p>
                                    ) : (
                                        <div className="history-list">
                                            {selectedOwnerHistory.tenants_lessees.map((tenant, index) => (
                                                <div key={tenant.id} className="history-item">
                                                    <div className="history-number">{index + 1}</div>
                                                    <div className="history-type-badge">{tenant.type}</div>
                                                    <div className="history-details">
                                                        <div className="history-name">{tenant.name}</div>
                                                        <div className="history-meta">
                                                            <span>Location: {tenant.location}</span>
                                                            <span>Area: {tenant.area} ha</span>
                                                            <span>Date: {new Date(tenant.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Transfer Ownership Modal */}
                    {showTransferModal && selectedOwnerForTransfer && (
                        <div className="modal-overlay" onClick={() => !transferProcessing && closeTransferModal()}>
                            <div className="modal-content transfer-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2>🔄 Transfer Land Ownership</h2>
                                    <button className="modal-close" onClick={closeTransferModal} disabled={transferProcessing}>×</button>
                                </div>
                                <div className="modal-body">
                                    {/* Current Owner Info */}
                                    <div className="transfer-section">
                                        <h3>Current Owner Information</h3>
                                        <div className="current-owner-info">
                                            <p><strong>Name:</strong> {selectedOwnerForTransfer.owner_name}</p>
                                            <p><strong>Owner ID:</strong> {selectedOwnerForTransfer.owner_id}</p>
                                            <p><strong>Tenants/Lessees:</strong> {selectedOwnerForTransfer.tenants_lessees.length}</p>
                                        </div>
                                    </div>

                                    {/* Parcel Selection */}
                                    <div className="transfer-section">
                                        <h3>Select Parcels to Transfer</h3>
                                        {loadingParcels ? (
                                            <p>Loading parcels...</p>
                                        ) : ownerParcels.length === 0 ? (
                                            <p className="no-parcels">No parcels found for this owner</p>
                                        ) : (
                                            <>
                                                <div className="parcel-select-all">
                                                    <label className="checkbox-label">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedParcelIds.size === ownerParcels.length}
                                                            onChange={toggleSelectAllParcels}
                                                            disabled={transferProcessing}
                                                        />
                                                        <span>Select All Parcels ({ownerParcels.length})</span>
                                                    </label>
                                                </div>
                                                <div className="parcels-list">
                                                    {ownerParcels.map((parcel) => (
                                                        <div key={parcel.id} className="parcel-checkbox-item">
                                                            <label className="checkbox-label">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedParcelIds.has(parcel.id)}
                                                                    onChange={() => toggleParcelSelection(parcel.id)}
                                                                    disabled={transferProcessing}
                                                                />
                                                                <div className="parcel-details">
                                                                    <span className="parcel-location">
                                                                        {parcel.farm_location_barangay || 'Unknown Location'}
                                                                    </span>
                                                                    <span className="parcel-area">
                                                                        {parcel.total_farm_area_ha} ha
                                                                    </span>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="selected-count">
                                                    Selected: {selectedParcelIds.size} of {ownerParcels.length} parcels
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Transfer Details */}
                                    <div className="transfer-section">
                                        <h3>Transfer Details</h3>
                                        <div className="form-group">
                                            <label>Reason for Transfer *</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="e.g., Death/Inheritance, Sale, Donation, etc."
                                                value={transferReason}
                                                onChange={(e) => setTransferReason(e.target.value)}
                                                disabled={transferProcessing}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Transfer Date *</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={transferDate}
                                                onChange={(e) => setTransferDate(e.target.value)}
                                                disabled={transferProcessing}
                                            />
                                        </div>
                                    </div>

                                    {/* New Owner Selection */}
                                    <div className="transfer-section">
                                        <h3>New Owner</h3>
                                        <div className="radio-group">
                                            <label className="radio-option">
                                                <input
                                                    type="radio"
                                                    name="ownerOption"
                                                    value="existing"
                                                    checked={newOwnerOption === 'existing'}
                                                    onChange={() => setNewOwnerOption('existing')}
                                                    disabled={transferProcessing}
                                                />
                                                <span>Select Existing Farmer</span>
                                            </label>
                                            <label className="radio-option">
                                                <input
                                                    type="radio"
                                                    name="ownerOption"
                                                    value="new"
                                                    checked={newOwnerOption === 'new'}
                                                    onChange={() => setNewOwnerOption('new')}
                                                    disabled={transferProcessing}
                                                />
                                                <span>Register New Farmer</span>
                                            </label>
                                        </div>

                                        {/* Existing Farmer Search */}
                                        {newOwnerOption === 'existing' && (
                                            <div className="form-group">
                                                <label>Search Farmer by Name or FFRS ID *</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Type to search..."
                                                    value={farmerSearchQuery}
                                                    onChange={(e) => handleFarmerSearch(e.target.value)}
                                                    disabled={transferProcessing}
                                                />
                                                {farmerSearchResults.length > 0 && (
                                                    <div className="search-results">
                                                        {farmerSearchResults.map((farmer) => {
                                                            const badges = [];
                                                            if (farmer.ownershipTypes.isOwner) badges.push('Owner');
                                                            if (farmer.ownershipTypes.isTenant) badges.push('Tenant');
                                                            if (farmer.ownershipTypes.isLessee) badges.push('Lessee');

                                                            return (
                                                                <div
                                                                    key={farmer.id}
                                                                    className="search-result-item"
                                                                    onClick={() => selectExistingFarmer(farmer)}
                                                                >
                                                                    <div className="result-header">
                                                                        <div className="result-name">{farmer.farmerName}</div>
                                                                        <div className="result-badges">
                                                                            {badges.map((badge, index) => (
                                                                                <span
                                                                                    key={index}
                                                                                    className={`ownership-badge ${badge.toLowerCase()}`}
                                                                                >
                                                                                    {badge}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div className="result-details">
                                                                        <span>{farmer.referenceNumber}</span>
                                                                        <span>{farmer.farmerAddress}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {selectedNewOwner && (
                                                    <div className="selected-farmer">
                                                        ✓ Selected: <strong>{selectedNewOwner.farmerName}</strong> ({selectedNewOwner.referenceNumber})
                                                        {selectedNewOwner.ownershipTypes && (
                                                            <>
                                                                {selectedNewOwner.ownershipTypes.isOwner && <span className="ownership-badge owner">Owner</span>}
                                                                {selectedNewOwner.ownershipTypes.isTenant && <span className="ownership-badge tenant">Tenant</span>}
                                                                {selectedNewOwner.ownershipTypes.isLessee && <span className="ownership-badge lessee">Lessee</span>}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* New Farmer Form */}
                                        {newOwnerOption === 'new' && (
                                            <div className="new-farmer-form">
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label>First Name *</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            value={newFarmerData.firstName}
                                                            onChange={(e) => setNewFarmerData({ ...newFarmerData, firstName: e.target.value })}
                                                            disabled={transferProcessing}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Last Name *</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            value={newFarmerData.lastName}
                                                            onChange={(e) => setNewFarmerData({ ...newFarmerData, lastName: e.target.value })}
                                                            disabled={transferProcessing}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label>Middle Name</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            value={newFarmerData.middleName}
                                                            onChange={(e) => setNewFarmerData({ ...newFarmerData, middleName: e.target.value })}
                                                            disabled={transferProcessing}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Extension Name</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="Jr., Sr., III, etc."
                                                            value={newFarmerData.extensionName}
                                                            onChange={(e) => setNewFarmerData({ ...newFarmerData, extensionName: e.target.value })}
                                                            disabled={transferProcessing}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label>Birthdate *</label>
                                                        <input
                                                            type="date"
                                                            className="form-input"
                                                            value={newFarmerData.birthdate}
                                                            onChange={(e) => setNewFarmerData({ ...newFarmerData, birthdate: e.target.value })}
                                                            disabled={transferProcessing}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Gender *</label>
                                                        <select
                                                            className="form-input"
                                                            value={newFarmerData.gender}
                                                            onChange={(e) => setNewFarmerData({ ...newFarmerData, gender: e.target.value })}
                                                            disabled={transferProcessing}
                                                        >
                                                            <option value="Male">Male</option>
                                                            <option value="Female">Female</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label>Barangay *</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={newFarmerData.barangay}
                                                        onChange={(e) => setNewFarmerData({ ...newFarmerData, barangay: e.target.value })}
                                                        disabled={transferProcessing}
                                                    />
                                                </div>
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label>Municipality</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            value={newFarmerData.municipality}
                                                            onChange={(e) => setNewFarmerData({ ...newFarmerData, municipality: e.target.value })}
                                                            disabled={transferProcessing}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Province</label>
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            value={newFarmerData.province}
                                                            onChange={(e) => setNewFarmerData({ ...newFarmerData, province: e.target.value })}
                                                            disabled={transferProcessing}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        className="btn-cancel"
                                        onClick={closeTransferModal}
                                        disabled={transferProcessing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn-transfer"
                                        onClick={handleTransferSubmit}
                                        disabled={transferProcessing}
                                    >
                                        {transferProcessing ? 'Processing...' : 'Transfer Ownership'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Confirmation Dialog */}
                    {showConfirmDialog && (
                        <div className="modal-overlay" onClick={() => !transferProcessing && setShowConfirmDialog(false)}>
                            <div className="modal-content confirm-dialog" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2>⚠️ Confirm Ownership Transfer</h2>
                                </div>
                                <div className="modal-body">
                                    <p className="confirm-message">
                                        Are you sure you want to transfer ownership from <strong>{selectedOwnerForTransfer?.owner_name}</strong>
                                        {newOwnerOption === 'existing' && selectedNewOwner && (
                                            <> to <strong>{selectedNewOwner.farmerName}</strong></>
                                        )}
                                        {newOwnerOption === 'new' && (
                                            <> to <strong>{newFarmerData.firstName} {newFarmerData.lastName}</strong></>
                                        )}?
                                    </p>
                                    <p className="confirm-warning">
                                        This action will:
                                    </p>
                                    <ul className="confirm-list">
                                        <li>Transfer <strong>{selectedParcelIds.size}</strong> selected parcel{selectedParcelIds.size !== 1 ? 's' : ''}</li>
                                        <li>Remove the current owner from the active land records list (if all parcels transferred)</li>
                                        <li>Update all tenant/lessee records associated with transferred parcels</li>
                                        {newOwnerOption === 'existing' && selectedNewOwner?.ownershipTypes.isTenant && (
                                            <li>Remove tenant status from the new owner (they will become owner only)</li>
                                        )}
                                        {newOwnerOption === 'existing' && selectedNewOwner?.ownershipTypes.isLessee && (
                                            <li>Remove lessee status from the new owner (they will become owner only)</li>
                                        )}
                                        <li>Keep the transfer history for auditing purposes</li>
                                    </ul>
                                    <p className="confirm-note">This action cannot be easily undone.</p>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        className="btn-cancel"
                                        onClick={() => setShowConfirmDialog(false)}
                                        disabled={transferProcessing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn-confirm"
                                        onClick={processTransfer}
                                        disabled={transferProcessing}
                                    >
                                        {transferProcessing ? 'Processing...' : 'Yes, Transfer Ownership'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}; export default JoLandrecords;