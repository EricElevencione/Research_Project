import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/jo css/JoLandrecStyle.css';
import '../../assets/css/navigation/nav.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';

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

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-masterlist')}
                        >
                            <span className="nav-icon">
                                <img src={ApproveIcon} alt="Masterlist" />
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
                                                    <button
                                                        className="full-history-btn"
                                                        onClick={() => openHistoryModal(owner)}
                                                    >
                                                        Full History
                                                    </button>
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
                </div>
            </div>
        </div>
    );
}; export default JoLandrecords;