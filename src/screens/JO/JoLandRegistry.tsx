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
    ffrs_code: string;
    farm_location_barangay: string;
    farm_location_municipality: string;
    total_farm_area_ha: number;
    land_owner_name: string;
    farmer_id: number;
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

interface TransferActorOption {
    farmerId: number;
    name: string;
    barangay: string;
    parcelIds: number[];
    parcelCount: number;
}

type TransferMode = 'voluntary' | 'inheritance';
type VoluntaryRole = 'registered_owner' | 'tenant' | 'lessee';

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
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [recipientSearch, setRecipientSearch] = useState('');
    const [filteredRecipients, setFilteredRecipients] = useState<Farmer[]>([]);
    const [selectedRecipient, setSelectedRecipient] = useState<Farmer | null>(null);
    const [transferMode, setTransferMode] = useState<TransferMode | ''>('');
    const [sourceRegisteredOwnerId, setSourceRegisteredOwnerId] = useState<number | ''>('');
    const [sourceLinkedLandOwnerName, setSourceLinkedLandOwnerName] = useState('');
    const [sourceTenantId, setSourceTenantId] = useState<number | ''>('');
    const [sourceLesseeId, setSourceLesseeId] = useState<number | ''>('');
    const [deceasedOwnerId, setDeceasedOwnerId] = useState<number | ''>('');
    const [confirmDeceased, setConfirmDeceased] = useState(false);
    const [selectedTransferParcelIds, setSelectedTransferParcelIds] = useState<number[]>([]);
    const [supportingDocs, setSupportingDocs] = useState<File[]>([]);
    const [transferReason, setTransferReason] = useState('');

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

    // Filter recipients based on search
    useEffect(() => {
        if (recipientSearch.trim().length < 2) {
            setFilteredRecipients([]);
            return;
        }
        const search = recipientSearch.toLowerCase();
        const filtered = farmers.filter(f =>
            f.name.toLowerCase().includes(search) ||
            f.barangay.toLowerCase().includes(search)
        ).slice(0, 10);
        setFilteredRecipients(filtered);
    }, [recipientSearch, farmers]);


    // Fetch all land parcels with current owners
   useEffect(() => {
    const fetchLandParcels = async () => {
        setLoading(true);
        try {
            // Step 1: Fetch current land history records
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
                    farmer_id,
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
                const parcels = data || [];

                // Step 2: Extract unique farmer IDs from parcels
                const farmerIds = [...new Set(parcels.map((p: any) => p.farmer_id).filter(Boolean))];
                let ffrsMap: Record<number, string> = {};

                // Step 3: Fetch FFRS codes from rsbsa_submission for all farmer IDs
                if (farmerIds.length > 0) {
                    const { data: ffrsData } = await supabase
                        .from('rsbsa_submission')
                        .select('id, "FFRS_CODE"')      // ← Fetch farmer ID and FFRS code
                        .in('id', farmerIds);            // Only for farmers in our parcels

                    if (ffrsData) {
                        // Step 4: Create a map of farmer_id → FFRS_CODE
                        ffrsMap = Object.fromEntries(
                            ffrsData.map((r: any) => [r.id, r.FFRS_CODE || ''])
                        );
                    }
                }

                // Step 5: Merge FFRS codes into parcel data
                const parcelsWithFfrs = parcels.map((p: any) => ({
                    ...p,
                    ffrs_code: ffrsMap[p.farmer_id] || ''  // ← Add FFRS code to each parcel
                }));

                setLandParcels(parcelsWithFfrs);
                console.log('✅ Loaded', parcelsWithFfrs.length, 'land parcels with FFRS codes');
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
    const filteredParcels = landParcels
        .filter(parcel => {
            const matchesSearch = searchTerm === '' ||
                parcel.parcel_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                parcel.ffrs_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                parcel.land_owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                parcel.farmer_name?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesBarangay = filterBarangay === '' ||
                parcel.farm_location_barangay === filterBarangay;

            return matchesSearch && matchesBarangay;
        })
        // Sort by period_start_date descending (most recent first)
        .sort((a, b) => {
            const aDate = a.period_start_date ? new Date(a.period_start_date).getTime() : 0;
            const bDate = b.period_start_date ? new Date(b.period_start_date).getTime() : 0;
            return bDate - aDate;
        });

    const buildTransferActorOptions = (parcels: LandParcel[]): TransferActorOption[] => {
        const byFarmer = new Map<number, TransferActorOption>();

        parcels.forEach((parcel) => {
            if (!parcel.farmer_id) return;

            const existing = byFarmer.get(parcel.farmer_id);
            if (existing) {
                if (!existing.parcelIds.includes(parcel.id)) {
                    existing.parcelIds.push(parcel.id);
                    existing.parcelCount = existing.parcelIds.length;
                }
                return;
            }

            byFarmer.set(parcel.farmer_id, {
                farmerId: parcel.farmer_id,
                name: parcel.farmer_name || parcel.land_owner_name || `Farmer #${parcel.farmer_id}`,
                barangay: parcel.farm_location_barangay || '',
                parcelIds: [parcel.id],
                parcelCount: 1
            });
        });

        return Array.from(byFarmer.values()).sort((a, b) => a.name.localeCompare(b.name));
    };

    const registeredOwnerParcels = landParcels.filter((p) => p.is_registered_owner);
    const registeredOwnerOptions = buildTransferActorOptions(registeredOwnerParcels);

    const linkedLandOwnerNames = Array.from(
        new Set(
            landParcels
                .filter((p) => p.is_tenant || p.is_lessee)
                .map((p) => (p.land_owner_name || '').trim())
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));

    const tenantCandidates = landParcels.filter(
        (p) => p.is_tenant && (sourceLinkedLandOwnerName ? (p.land_owner_name || '') === sourceLinkedLandOwnerName : true)
    );
    const lesseeCandidates = landParcels.filter(
        (p) => p.is_lessee && (sourceLinkedLandOwnerName ? (p.land_owner_name || '') === sourceLinkedLandOwnerName : true)
    );

    const tenantOptions = buildTransferActorOptions(tenantCandidates);
    const lesseeOptions = buildTransferActorOptions(lesseeCandidates);

    const selectedRegisteredOwner = registeredOwnerOptions.find((o) => o.farmerId === sourceRegisteredOwnerId) || null;
    const selectedTenant = tenantOptions.find((o) => o.farmerId === sourceTenantId) || null;
    const selectedLessee = lesseeOptions.find((o) => o.farmerId === sourceLesseeId) || null;
    const selectedDeceasedOwner = registeredOwnerOptions.find((o) => o.farmerId === deceasedOwnerId) || null;
    const fixedVoluntaryRole: VoluntaryRole = selectedParcel?.is_tenant
        ? 'tenant'
        : selectedParcel?.is_lessee
            ? 'lessee'
            : 'registered_owner';
    const fixedVoluntaryRoleLabel = fixedVoluntaryRole === 'registered_owner'
        ? 'Registered Land Owner'
        : fixedVoluntaryRole === 'tenant'
            ? 'Tenant'
            : 'Lessee';

    const selectedSource = (() => {
        if (transferMode === 'inheritance') return selectedDeceasedOwner;
        if (transferMode !== 'voluntary') return null;
        if (fixedVoluntaryRole === 'registered_owner') return selectedRegisteredOwner;
        if (fixedVoluntaryRole === 'tenant') return selectedTenant;
        return selectedLessee;
    })();

    const registeredOwnerTransferParcels = selectedRegisteredOwner
        ? registeredOwnerParcels.filter((p) => p.farmer_id === selectedRegisteredOwner.farmerId)
        : [];
    const tenantTransferParcels = selectedTenant
        ? tenantCandidates.filter((p) => p.farmer_id === selectedTenant.farmerId)
        : [];
    const lesseeTransferParcels = selectedLessee
        ? lesseeCandidates.filter((p) => p.farmer_id === selectedLessee.farmerId)
        : [];
    const inheritanceTransferParcels = selectedDeceasedOwner
        ? registeredOwnerParcels.filter((p) => p.farmer_id === selectedDeceasedOwner.farmerId)
        : [];

    const effectiveTransferParcels = (() => {
        if (transferMode === 'inheritance') return inheritanceTransferParcels;
        if (transferMode !== 'voluntary') return [];
        if (fixedVoluntaryRole === 'tenant') return tenantTransferParcels;
        if (fixedVoluntaryRole === 'lessee') return lesseeTransferParcels;
        return registeredOwnerTransferParcels.filter((p) => selectedTransferParcelIds.includes(p.id));
    })();

    const defaultReason = transferMode === 'inheritance'
        ? 'Inheritance'
        : transferMode === 'voluntary'
            ? 'Voluntary Transfer'
            : '';
    const finalReasonPreview = transferReason.trim() || defaultReason;
    const transferModeLabel = transferMode === 'inheritance'
        ? 'Inheritance'
        : transferMode === 'voluntary'
            ? 'Voluntary Transfer'
            : 'Not selected';
    const transferReadyForReview = (() => {
        if (!transferMode) return false;
        if (!selectedRecipient) return false;
        if (supportingDocs.length === 0) return false;

        if (transferMode === 'inheritance') {
            return Boolean(selectedDeceasedOwner && confirmDeceased && effectiveTransferParcels.length > 0);
        }

        if (fixedVoluntaryRole === 'registered_owner') {
            return Boolean(selectedRegisteredOwner && effectiveTransferParcels.length > 0);
        }

        if (fixedVoluntaryRole === 'tenant') {
            return Boolean(sourceLinkedLandOwnerName && selectedTenant && effectiveTransferParcels.length > 0);
        }

        return Boolean(sourceLinkedLandOwnerName && selectedLessee && effectiveTransferParcels.length > 0);
    })();

    const resetTransferWorkflow = () => {
        setRecipientSearch('');
        setFilteredRecipients([]);
        setSelectedRecipient(null);
        setTransferMode('');
        setSourceRegisteredOwnerId('');
        setSourceLinkedLandOwnerName('');
        setSourceTenantId('');
        setSourceLesseeId('');
        setDeceasedOwnerId('');
        setConfirmDeceased(false);
        setSelectedTransferParcelIds([]);
        setSupportingDocs([]);
        setTransferReason('');
    };

    const openTransferModal = () => {
        resetTransferWorkflow();
        setShowTransferModal(true);
    };

    const closeTransferModal = () => {
        setShowTransferModal(false);
        resetTransferWorkflow();
    };

    const handleDisplayOnlyConfirm = () => {
        window.alert('Display-only flow is ready. Backend transfer logic is not connected yet.');
        closeTransferModal();
    };

    const applyVoluntarySourceFromSelectedParcel = () => {
        if (!selectedParcel) return;

        const parsedFarmerId = Number(selectedParcel.farmer_id);
        const selectedFarmerId: number | '' = Number.isFinite(parsedFarmerId) && parsedFarmerId > 0 ? parsedFarmerId : '';

        if (selectedParcel.is_tenant) {
            setSourceRegisteredOwnerId('');
            setSourceLinkedLandOwnerName((selectedParcel.land_owner_name || '').trim());
            setSourceTenantId(selectedFarmerId);
            setSourceLesseeId('');
            setSelectedTransferParcelIds([]);
            return;
        }

        if (selectedParcel.is_lessee) {
            setSourceRegisteredOwnerId('');
            setSourceLinkedLandOwnerName((selectedParcel.land_owner_name || '').trim());
            setSourceTenantId('');
            setSourceLesseeId(selectedFarmerId);
            setSelectedTransferParcelIds([]);
            return;
        }

        setSourceLinkedLandOwnerName('');
        setSourceTenantId('');
        setSourceLesseeId('');

        if (selectedFarmerId === '') {
            setSourceRegisteredOwnerId('');
            setSelectedTransferParcelIds([]);
            return;
        }

        setSourceRegisteredOwnerId(selectedFarmerId);
        const owner = registeredOwnerOptions.find((option) => option.farmerId === selectedFarmerId);
        setSelectedTransferParcelIds(owner ? [...owner.parcelIds] : []);
    };

    const handleTransferModeChange = (mode: TransferMode) => {
        setTransferMode(mode);
        setSourceRegisteredOwnerId('');
        setSourceLinkedLandOwnerName('');
        setSourceTenantId('');
        setSourceLesseeId('');
        setDeceasedOwnerId('');
        setConfirmDeceased(false);
        setSelectedTransferParcelIds([]);
        if (mode === 'voluntary') {
            applyVoluntarySourceFromSelectedParcel();
        }
    };

    const handleRegisteredOwnerSelect = (value: string) => {
        const parsedId = Number(value);
        if (!Number.isFinite(parsedId) || parsedId <= 0) {
            setSourceRegisteredOwnerId('');
            setSelectedTransferParcelIds([]);
            return;
        }

        setSourceRegisteredOwnerId(parsedId);
        const owner = registeredOwnerOptions.find((option) => option.farmerId === parsedId);
        setSelectedTransferParcelIds(owner ? [...owner.parcelIds] : []);
    };

    const handleDocsSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const incomingFiles = Array.from(event.target.files || []);
        if (incomingFiles.length === 0) return;

        const validFiles = incomingFiles.filter((file) => (
            file.type === 'image/png' || file.type === 'image/jpeg'
        ));

        if (validFiles.length === 0) {
            event.target.value = '';
            return;
        }

        setSupportingDocs((prev) => {
            const merged = [...prev];
            validFiles.forEach((file) => {
                const duplicate = merged.some((existing) =>
                    existing.name === file.name &&
                    existing.size === file.size &&
                    existing.lastModified === file.lastModified
                );
                if (!duplicate) merged.push(file);
            });
            return merged;
        });

        event.target.value = '';
    };

    const removeDoc = (targetIndex: number) => {
        setSupportingDocs((prev) => prev.filter((_, index) => index !== targetIndex));
    };

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
                                        <th>FFRS Code</th>
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
                                            <td colSpan={7} className="jo-land-registry-loading-cell">
                                                Loading land parcels...
                                            </td>
                                        </tr>
                                    ) : filteredParcels.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="jo-land-registry-empty-cell">
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
                                                <td><strong>{parcel.ffrs_code || '—'}</strong></td>
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
                                        <div className="jo-land-registry-transfer-section" style={{padding: '0.25rem 0.5rem', backgroundColor: '#e3f2fd', borderRadius: '6px'}}>
                                        <button
                                            className="jo-land-registry-transfer-button" style={{cursor: 'pointer'}}
                                            onClick={openTransferModal}  >
                                            🔄 Transfer Ownership
                                            </button>
                                    </div>
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
                                            <span className="jo-land-registry-info-label">FFRS Code</span>
                                            <span className="jo-land-registry-info-value">
                                                {selectedParcel.ffrs_code || '—'}
                                            </span>
                                        </div>
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
                    <div className="jo-land-registry-modal-overlay" onClick={closeTransferModal}>
                        <div className="jo-land-registry-modal jo-land-registry-transfer-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="jo-land-registry-modal-header jo-land-registry-transfer-header">
                                <h3>Transfer Ownership (Display Preview)</h3>
                                <button className="jo-land-registry-close-button" onClick={closeTransferModal}>
                                    ×
                                </button>
                            </div>
                            <div className="jo-land-registry-modal-body">
                                <div className="jo-land-registry-transfer-flow">
                                    <div className="jo-land-registry-transfer-note">
                                        <strong>Scope:</strong> Frontend display only. No transfer data is saved yet.
                                    </div>

                                    <div className="jo-land-registry-transfer-section-card">
                                        <h4>Current Context</h4>
                                        <div className="jo-land-registry-transfer-kv">
                                            <span>Opened From Parcel</span>
                                            <strong>{selectedParcel.parcel_number || `#${selectedParcel.id}`}</strong>
                                        </div>
                                        <div className="jo-land-registry-transfer-kv">
                                            <span>Current Holder</span>
                                            <strong>{selectedParcel.farmer_name || selectedParcel.land_owner_name || 'Unknown'}</strong>
                                        </div>
                                    </div>

                                    <div className="jo-land-registry-transfer-section-card">
                                        <h4>Step 1: Transfer Type</h4>
                                        <div className="jo-land-registry-transfer-choice-grid">
                                            <button
                                                type="button"
                                                className={`jo-land-registry-transfer-choice ${transferMode === 'voluntary' ? 'active' : ''}`}
                                                onClick={() => handleTransferModeChange('voluntary')}
                                            >
                                                Voluntary Transfer
                                            </button>
                                            <button
                                                type="button"
                                                className={`jo-land-registry-transfer-choice ${transferMode === 'inheritance' ? 'active' : ''}`}
                                                onClick={() => handleTransferModeChange('inheritance')}
                                            >
                                                Inheritance
                                            </button>
                                        </div>
                                    </div>

                                    {transferMode === 'voluntary' && fixedVoluntaryRole === 'registered_owner' && (
                                        <div className="jo-land-registry-transfer-section-card">
                                            <h4>Step 2: Source Owner + Parcels</h4>
                                            <div className="jo-land-registry-transfer-mini-note">
                                                Workflow is auto-set to <strong>{fixedVoluntaryRoleLabel}</strong> based on current holder type.
                                            </div>
                                            <label className="jo-land-registry-transfer-label">Select Registered Land Owner</label>
                                            <select
                                                className="jo-land-registry-transfer-select"
                                                value={sourceRegisteredOwnerId}
                                                onChange={(e) => handleRegisteredOwnerSelect(e.target.value)}
                                            >
                                                <option value="">Choose owner...</option>
                                                {registeredOwnerOptions.map((owner) => (
                                                    <option key={owner.farmerId} value={owner.farmerId}>
                                                        {owner.name} ({owner.parcelCount} parcel{owner.parcelCount > 1 ? 's' : ''})
                                                    </option>
                                                ))}
                                            </select>

                                            {registeredOwnerTransferParcels.length > 0 && (
                                                <div className="jo-land-registry-transfer-parcel-box">
                                                    <div className="jo-land-registry-transfer-subheading">Select Parcels to Transfer (Multiple)</div>
                                                    {registeredOwnerTransferParcels.map((parcel) => (
                                                        <label key={parcel.id} className="jo-land-registry-transfer-checkbox-row">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedTransferParcelIds.includes(parcel.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedTransferParcelIds((prev) => [...prev, parcel.id]);
                                                                    } else {
                                                                        setSelectedTransferParcelIds((prev) => prev.filter((id) => id !== parcel.id));
                                                                    }
                                                                }}
                                                            />
                                                            <span>
                                                                {parcel.parcel_number || `#${parcel.id}`} - {parcel.farm_location_barangay} ({parcel.total_farm_area_ha.toFixed(2)} ha)
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {transferMode === 'voluntary' && (fixedVoluntaryRole === 'tenant' || fixedVoluntaryRole === 'lessee') && (
                                        <div className="jo-land-registry-transfer-section-card">
                                            <h4>Step 2: Select Linked Owner + Current {fixedVoluntaryRole === 'tenant' ? 'Tenant' : 'Lessee'}</h4>
                                            <div className="jo-land-registry-transfer-mini-note">
                                                Workflow is auto-set to <strong>{fixedVoluntaryRoleLabel}</strong> based on current holder type.
                                            </div>

                                            <label className="jo-land-registry-transfer-label">Linked Land Owner</label>
                                            <select
                                                className="jo-land-registry-transfer-select"
                                                value={sourceLinkedLandOwnerName}
                                                onChange={(e) => {
                                                    setSourceLinkedLandOwnerName(e.target.value);
                                                    setSourceTenantId('');
                                                    setSourceLesseeId('');
                                                }}
                                            >
                                                <option value="">Choose land owner...</option>
                                                {linkedLandOwnerNames.map((ownerName) => (
                                                    <option key={ownerName} value={ownerName}>{ownerName}</option>
                                                ))}
                                            </select>

                                            <label className="jo-land-registry-transfer-label">
                                                {fixedVoluntaryRole === 'tenant' ? 'Tenant' : 'Lessee'}
                                            </label>
                                            <select
                                                className="jo-land-registry-transfer-select"
                                                value={fixedVoluntaryRole === 'tenant' ? sourceTenantId : sourceLesseeId}
                                                onChange={(e) => {
                                                    const parsedId = Number(e.target.value);
                                                    if (fixedVoluntaryRole === 'tenant') {
                                                        setSourceTenantId(Number.isFinite(parsedId) && parsedId > 0 ? parsedId : '');
                                                    } else {
                                                        setSourceLesseeId(Number.isFinite(parsedId) && parsedId > 0 ? parsedId : '');
                                                    }
                                                }}
                                            >
                                                <option value="">Choose {fixedVoluntaryRole === 'tenant' ? 'tenant' : 'lessee'}...</option>
                                                {(fixedVoluntaryRole === 'tenant' ? tenantOptions : lesseeOptions).map((option) => (
                                                    <option key={option.farmerId} value={option.farmerId}>
                                                        {option.name} ({option.parcelCount} parcel{option.parcelCount > 1 ? 's' : ''})
                                                    </option>
                                                ))}
                                            </select>

                                            {effectiveTransferParcels.length > 0 && (
                                                <div className="jo-land-registry-transfer-parcel-box">
                                                    <div className="jo-land-registry-transfer-subheading">
                                                        Parcels to Transfer (all linked parcels)
                                                    </div>
                                                    <ul className="jo-land-registry-transfer-list">
                                                        {effectiveTransferParcels.map((parcel) => (
                                                            <li key={parcel.id}>
                                                                {parcel.parcel_number || `#${parcel.id}`} - {parcel.farm_location_barangay} ({parcel.total_farm_area_ha.toFixed(2)} ha)
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            <div className="jo-land-registry-transfer-mini-note">
                                                Recipient will be shown as a land owner after transfer (display intent).
                                            </div>
                                        </div>
                                    )}

                                    {transferMode === 'inheritance' && (
                                        <div className="jo-land-registry-transfer-section-card">
                                            <h4>Step 2: Select Deceased Land Owner</h4>
                                            <label className="jo-land-registry-transfer-label">Land Owner (Deceased)</label>
                                            <select
                                                className="jo-land-registry-transfer-select"
                                                value={deceasedOwnerId}
                                                onChange={(e) => {
                                                    const parsedId = Number(e.target.value);
                                                    setDeceasedOwnerId(Number.isFinite(parsedId) && parsedId > 0 ? parsedId : '');
                                                }}
                                            >
                                                <option value="">Choose land owner...</option>
                                                {registeredOwnerOptions.map((owner) => (
                                                    <option key={owner.farmerId} value={owner.farmerId}>
                                                        {owner.name} ({owner.parcelCount} parcel{owner.parcelCount > 1 ? 's' : ''})
                                                    </option>
                                                ))}
                                            </select>

                                            <div className="jo-land-registry-transfer-mini-note">
                                                If owner is alive, use Voluntary Transfer instead.
                                            </div>

                                            <label className="jo-land-registry-transfer-checkbox-row">
                                                <input
                                                    type="checkbox"
                                                    checked={confirmDeceased}
                                                    onChange={(e) => setConfirmDeceased(e.target.checked)}
                                                />
                                                <span>I confirm this selected land owner is deceased.</span>
                                            </label>

                                            {inheritanceTransferParcels.length > 0 && (
                                                <div className="jo-land-registry-transfer-parcel-box">
                                                    <div className="jo-land-registry-transfer-subheading">
                                                        Parcels to Transfer (all owned parcels)
                                                    </div>
                                                    <ul className="jo-land-registry-transfer-list">
                                                        {inheritanceTransferParcels.map((parcel) => (
                                                            <li key={parcel.id}>
                                                                {parcel.parcel_number || `#${parcel.id}`} - {parcel.farm_location_barangay} ({parcel.total_farm_area_ha.toFixed(2)} ha)
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(transferMode === 'voluntary' || transferMode === 'inheritance') && (
                                        <div className="jo-land-registry-transfer-section-card">
                                            <h4>{transferMode === 'voluntary' ? 'Step 3: Recipient' : 'Step 3: Recipient'}</h4>
                                            <label className="jo-land-registry-transfer-label">Search Recipient</label>
                                            <input
                                                type="text"
                                                className="jo-land-registry-transfer-input"
                                                placeholder="Type at least 2 characters..."
                                                value={recipientSearch}
                                                onChange={(e) => {
                                                    setRecipientSearch(e.target.value);
                                                    setSelectedRecipient(null);
                                                }}
                                            />

                                            {filteredRecipients.length > 0 && !selectedRecipient && (
                                                <div className="jo-land-registry-transfer-search-results">
                                                    {filteredRecipients
                                                        .filter((farmer) => !selectedSource || farmer.id !== selectedSource.farmerId)
                                                        .map((farmer) => (
                                                            <button
                                                                key={farmer.id}
                                                                type="button"
                                                                className="jo-land-registry-transfer-result-btn"
                                                                onClick={() => {
                                                                    setSelectedRecipient(farmer);
                                                                    setRecipientSearch(farmer.name);
                                                                }}
                                                            >
                                                                <strong>{farmer.name}</strong>
                                                                <span>{farmer.barangay || 'No barangay'}</span>
                                                            </button>
                                                        ))}
                                                </div>
                                            )}

                                            {selectedRecipient && (
                                                <div className="jo-land-registry-transfer-selected">
                                                    <div>
                                                        <strong>{selectedRecipient.name}</strong>
                                                        <span>{selectedRecipient.barangay || 'No barangay'}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedRecipient(null);
                                                            setRecipientSearch('');
                                                        }}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(transferMode === 'voluntary' || transferMode === 'inheritance') && (
                                        <div className="jo-land-registry-transfer-section-card">
                                            <h4>{transferMode === 'voluntary' ? 'Step 4: Supporting Documents' : 'Step 4: Supporting Documents'}</h4>
                                            <label className="jo-land-registry-transfer-label">
                                                Upload proof photo(s) - PNG/JPG (multiple)
                                            </label>
                                            <input
                                                type="file"
                                                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                                                multiple
                                                onChange={handleDocsSelected}
                                                className="jo-land-registry-transfer-file-input"
                                            />

                                            {supportingDocs.length > 0 && (
                                                <ul className="jo-land-registry-transfer-doc-list">
                                                    {supportingDocs.map((doc, index) => (
                                                        <li key={`${doc.name}-${doc.lastModified}-${index}`}>
                                                            <span>{doc.name} ({(doc.size / 1024).toFixed(1)} KB)</span>
                                                            <button type="button" onClick={() => removeDoc(index)}>Remove</button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}

                                    {(transferMode === 'voluntary' || transferMode === 'inheritance') && (
                                        <div className="jo-land-registry-transfer-section-card">
                                            <h4>{transferMode === 'voluntary' ? 'Step 5: Reason + Review' : 'Step 5: Reason + Review'}</h4>
                                            <label className="jo-land-registry-transfer-label">Reason (Optional)</label>
                                            <textarea
                                                className="jo-land-registry-transfer-textarea"
                                                placeholder="Add optional note..."
                                                value={transferReason}
                                                onChange={(e) => setTransferReason(e.target.value)}
                                            />

                                            <div className="jo-land-registry-transfer-mini-note">
                                                Applied reason preview: <strong>{finalReasonPreview || 'No reason yet'}</strong>
                                            </div>

                                            <div className="jo-land-registry-transfer-review">
                                                <div className="jo-land-registry-transfer-kv">
                                                    <span>Transfer Type</span>
                                                    <strong>{transferModeLabel}</strong>
                                                </div>
                                                <div className="jo-land-registry-transfer-kv">
                                                    <span>From</span>
                                                    <strong>{selectedSource?.name || 'Not selected'}</strong>
                                                </div>
                                                <div className="jo-land-registry-transfer-kv">
                                                    <span>To</span>
                                                    <strong>{selectedRecipient?.name || 'Not selected'}</strong>
                                                </div>
                                                <div className="jo-land-registry-transfer-kv">
                                                    <span>Parcels</span>
                                                    <strong>{effectiveTransferParcels.length}</strong>
                                                </div>
                                                <div className="jo-land-registry-transfer-kv">
                                                    <span>Effectivity</span>
                                                    <strong>Immediate</strong>
                                                </div>
                                                <div className="jo-land-registry-transfer-kv">
                                                    <span>Verification Queue</span>
                                                    <strong>None (admin can view docs directly)</strong>
                                                </div>
                                            </div>

                                            {effectiveTransferParcels.length > 0 && (
                                                <ul className="jo-land-registry-transfer-list">
                                                    {effectiveTransferParcels.map((parcel) => (
                                                        <li key={parcel.id}>
                                                            {parcel.parcel_number || `#${parcel.id}`} - {parcel.farm_location_barangay} ({parcel.total_farm_area_ha.toFixed(2)} ha)
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}

                                    <div className="jo-land-registry-transfer-actions">
                                        <button type="button" className="jo-land-registry-transfer-cancel" onClick={closeTransferModal}>
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="jo-land-registry-transfer-confirm"
                                            onClick={handleDisplayOnlyConfirm}
                                            disabled={!transferReadyForReview}
                                        >
                                            Confirm Transfer (Display Only)
                                        </button>
                                    </div>
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
