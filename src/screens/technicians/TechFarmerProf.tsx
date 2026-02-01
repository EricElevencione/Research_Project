import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { getRsbsaSubmissionById, getFarmParcels } from '../../api';
import '../../components/layout/sidebarStyle.css';
import '../../assets/css/technician css/FarmerProf.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import FarmerIcon from '../../assets/images/farmer (1).png';
import IncentivesIcon from '../../assets/images/incentives.png';

interface FarmerData {
    id: string;
    referenceNumber: string;
    farmerName: string;
    firstName: string;
    middleName: string;
    lastName: string;
    extName: string;
    gender: string;
    birthdate: string;
    age?: number | null;
    farmerAddress: string;
    farmLocation: string;
    parcelArea: string;
    status: string;
    dateSubmitted: string;
    ownershipType?: {
        registeredOwner: boolean;
        tenant: boolean;
        lessee: boolean;
    };
}

interface Parcel {
    id: string;
    parcel_number: string;
    farm_location_barangay: string;
    farm_location_municipality: string;
    total_farm_area_ha: number;
    within_ancestral_domain: string;
    ownership_document_no: string;
    agrarian_reform_beneficiary: string;
    ownership_type_registered_owner: boolean;
    ownership_type_tenant: boolean;
    ownership_type_lessee: boolean;
    tenant_land_owner_name: string;
    lessee_land_owner_name: string;
    ownership_others_specify: string;
}

const TechFarmerProf: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();

    const [farmer, setFarmer] = useState<FarmerData | null>(null);
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedParcel, setExpandedParcel] = useState<string | null>(null);

    const isActive = (path: string) => {
        if (path === '/technician-farmerprofile') {
            return location.pathname.startsWith('/technician-farmerprofile');
        }
        return location.pathname === path;
    };

    useEffect(() => {
        if (id) {
            fetchFarmerData(id);
            fetchParcels(id);
        }
    }, [id]);

    const fetchFarmerData = async (farmerId: string) => {
        try {
            const response = await getRsbsaSubmissionById(farmerId);
            if (response.error) throw new Error('Failed to fetch farmer data');
            const data = response.data;
            console.log('Fetched farmer data:', data); // Debug log
            setFarmer(data);
            setLoading(false);
        } catch (err: any) {
            setError(err.message || 'Error loading farmer data');
            setLoading(false);
        }
    };

    const fetchParcels = async (farmerId: string) => {
        try {
            const response = await getFarmParcels(farmerId);
            if (response.error) throw new Error('Failed to fetch parcels');
            const data = response.data || [];
            setParcels(data);
        } catch (err: any) {
            console.error('Error fetching parcels:', err);
        }
    };

    const toggleParcel = (parcelId: string) => {
        setExpandedParcel(expandedParcel === parcelId ? null : parcelId);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    const calculateAge = (birthdate: string) => {
        if (!birthdate) return 'N/A';
        const birth = new Date(birthdate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };

    const getDisplayAge = () => {
        // Use age from database if available, otherwise calculate from birthdate
        if (farmer?.age !== null && farmer?.age !== undefined) {
            return `${farmer.age} years old`;
        }
        const calculatedAge = calculateAge(farmer?.birthdate || '');
        return calculatedAge !== 'N/A' ? `${calculatedAge} years old` : 'N/A';
    };

    const getTotalArea = () => {
        if (!parcels || parcels.length === 0) return '0.00';
        const total = parcels.reduce((sum, parcel) => {
            const area = Number(parcel.total_farm_area_ha) || 0;
            return sum + area;
        }, 0);
        return total.toFixed(2);
    };

    const getOwnershipType = () => {
        if (!farmer?.ownershipType) return 'N/A';
        if (farmer.ownershipType.registeredOwner) return 'Registered Owner';
        if (farmer.ownershipType.tenant) return 'Tenant';
        if (farmer.ownershipType.lessee) return 'Lessee';
        return 'N/A';
    };

    const getProfileCompleteness = () => {
        if (!farmer) return 0;
        let completed = 0;
        let total = 10;

        if (farmer.farmerName) completed++;
        if (farmer.gender) completed++;
        if (farmer.birthdate) completed++;
        if (farmer.farmerAddress) completed++;
        if (farmer.farmLocation) completed++;
        if (farmer.referenceNumber) completed++;
        if (farmer.status) completed++;
        if (parcels && parcels.length > 0) completed++;
        if (farmer.ownershipType) completed++;
        if (farmer.dateSubmitted) completed++;

        return Math.round((completed / total) * 100);
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="page">
                    <div className="sidebar">
                        <nav className="sidebar-nav">
                            <div className='sidebar-logo'>
                                <img src={LogoImage} alt="Logo" />
                            </div>
                        </nav>
                    </div>
                    <div className="tech-prof-main-content">
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                            <p className="loading-text">Loading farmer profile...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !farmer) {
        return (
            <div className="page-container">
                <div className="page">
                    <div className="sidebar">
                        <nav className="sidebar-nav">
                            <div className='sidebar-logo'>
                                <img src={LogoImage} alt="Logo" />
                            </div>
                        </nav>
                    </div>
                    <div className="tech-prof-main-content">
                        <div className="error-container">
                            <p className="error-message">{error || 'Farmer not found'}</p>
                            <button onClick={() => navigate('/technician-farmerprofpage')} className="btn-back">
                                ← Back to List
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                            className={`sidebar-nav-item ${isActive('/technician-farmerprofpage') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-farmerprofpage')}
                        >
                            <span className="nav-icon">
                                <img src={FarmerIcon} alt="farmerProf" />
                            </span>
                            <span className="nav-text">Farmers Profile</span>
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
                <div className="tech-prof-main-content">
                    {/* Header Section */}
                    <div className="profile-header">
                        <div className="header-top">
                            <button onClick={() => navigate('/technician-farmerprofpage')} className="btn-back">
                                ← Back to List
                            </button>
                        </div>

                        <div className="profile-hero">
                            <div className="profile-avatar">
                                <div className="avatar-placeholder">
                                    {farmer?.farmerName?.charAt(0) || 'F'}
                                </div>
                            </div>
                            <div className="profile-hero-info">
                                <h1 className="farmer-name">{farmer.farmerName || 'N/A'}</h1>
                                <div className="ffrs-id-display">FFRS ID: <span>{farmer.referenceNumber || 'N/A'}</span></div>
                                <div className="status-badge-container">
                                    <span className={`status-badge ${farmer.status === 'Active Farmer' ? 'active' : 'inactive'}`}>
                                        {farmer.status || 'Not Active'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Grid */}
                    <div className="profile-content-grid">

                        {/* Left Column */}
                        <div className="profile-left-column">

                            {/* Personal Information Card */}
                            <div className="profile-card">
                                <h3 className="card-title">👤 Personal Information</h3>
                                <div className="card-content">
                                    <div className="info-row">
                                        <span className="info-label">Full Name:</span>
                                        <span className="info-value">{farmer.farmerName}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Gender:</span>
                                        <span className="info-value">{farmer.gender || 'N/A'}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Date of Birth:</span>
                                        <span className="info-value">{formatDate(farmer.birthdate)}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Age:</span>
                                        <span className="info-value">{getDisplayAge()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Address Information Card */}
                            <div className="profile-card">
                                <h3 className="card-title">📍 Address Information</h3>
                                <div className="card-content">
                                    <div className="info-row">
                                        <span className="info-label">Home Address:</span>
                                        <span className="info-value">{farmer.farmerAddress || 'N/A'}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Primary Farm Location:</span>
                                        <span className="info-value">{farmer.farmLocation || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Farm Ownership Summary Card */}
                            <div className="profile-card">
                                <h3 className="card-title">🌾 Farm Ownership Summary</h3>
                                <div className="card-content">
                                    <div className="info-row">
                                        <span className="info-label">Total Number of Parcels:</span>
                                        <span className="info-value highlight">{parcels.length}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Total Farm Area:</span>
                                        <span className="info-value highlight">{getTotalArea()} hectares</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Primary Ownership Type:</span>
                                        <span className="info-value">{getOwnershipType()}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Farmer Type:</span>
                                        <span className={`info-value ${farmer.status === 'Active Farmer' ? 'text-success' : 'text-danger'}`}>
                                            {farmer.status || 'Not Active'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Right Column */}
                        <div className="profile-right-column">

                            {/* Land Parcels Section */}
                            <div className="profile-card">
                                <h3 className="card-title">🏞️ Land Parcels ({parcels.length})</h3>
                                <div className="card-content">
                                    {parcels.length === 0 ? (
                                        <p className="no-data">No land parcels registered</p>
                                    ) : (
                                        <div className="parcels-list">
                                            {parcels.map((parcel, index) => (
                                                <div key={parcel.id} className="parcel-item">
                                                    <div
                                                        className="parcel-header"
                                                        onClick={() => toggleParcel(parcel.id)}
                                                    >
                                                        <div className="parcel-title">
                                                            <span className="parcel-number">Parcel #{index + 1}</span>
                                                            <span className="parcel-area">{parcel.total_farm_area_ha} ha</span>
                                                        </div>
                                                        <span className={`expand-icon ${expandedParcel === parcel.id ? 'expanded' : ''}`}>
                                                            ▼
                                                        </span>
                                                    </div>

                                                    {expandedParcel === parcel.id && (
                                                        <div className="parcel-details">
                                                            <div className="info-row">
                                                                <span className="info-label">Farm Location:</span>
                                                                <span className="info-value">
                                                                    {parcel.farm_location_barangay}, {parcel.farm_location_municipality}
                                                                </span>
                                                            </div>
                                                            <div className="info-row">
                                                                <span className="info-label">Parcel Area:</span>
                                                                <span className="info-value">{parcel.total_farm_area_ha} hectares</span>
                                                            </div>
                                                            <div className="info-row">
                                                                <span className="info-label">Ownership Type:</span>
                                                                <span className="info-value">
                                                                    {parcel.ownership_type_registered_owner ? 'Registered Owner' :
                                                                        parcel.ownership_type_tenant ? 'Tenant' :
                                                                            parcel.ownership_type_lessee ? 'Lessee' : 'N/A'}
                                                                </span>
                                                            </div>
                                                            {(parcel.tenant_land_owner_name || parcel.lessee_land_owner_name) && (
                                                                <div className="info-row">
                                                                    <span className="info-label">Land Owner Name:</span>
                                                                    <span className="info-value">
                                                                        {parcel.tenant_land_owner_name || parcel.lessee_land_owner_name}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="info-row">
                                                                <span className="info-label">Agrarian Reform Beneficiary:</span>
                                                                <span className="info-value">{parcel.agrarian_reform_beneficiary || 'N/A'}</span>
                                                            </div>
                                                            <div className="info-row">
                                                                <span className="info-label">Within Ancestral Domain:</span>
                                                                <span className="info-value">{parcel.within_ancestral_domain || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Registration Details Card */}
                            <div className="profile-card">
                                <h3 className="card-title">📋 Registration & Submission Details</h3>
                                <div className="card-content">
                                    <div className="info-row">
                                        <span className="info-label">Date Registered/Submitted:</span>
                                        <span className="info-value">{formatDate(farmer.dateSubmitted)}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Reference Number:</span>
                                        <span className="info-value">{farmer.referenceNumber}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Submission Status:</span>
                                        <span className="info-value">{farmer.status || 'Pending'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Activity Timeline Card */}
                            <div className="profile-card">
                                <h3 className="card-title">📅 Activity Timeline</h3>
                                <div className="card-content">
                                    <div className="timeline">
                                        <div className="timeline-item">
                                            <div className="timeline-dot"></div>
                                            <div className="timeline-content">
                                                <div className="timeline-title">Profile Created</div>
                                                <div className="timeline-date">{formatDate(farmer.dateSubmitted)}</div>
                                            </div>
                                        </div>
                                        {parcels.length > 0 && (
                                            <div className="timeline-item">
                                                <div className="timeline-dot"></div>
                                                <div className="timeline-content">
                                                    <div className="timeline-title">{parcels.length} Land Parcel(s) Registered</div>
                                                    <div className="timeline-date">{formatDate(farmer.dateSubmitted)}</div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="timeline-item">
                                            <div className="timeline-dot active"></div>
                                            <div className="timeline-content">
                                                <div className="timeline-title">Current Status: {farmer.status}</div>
                                                <div className="timeline-date">Active</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
};

export default TechFarmerProf;