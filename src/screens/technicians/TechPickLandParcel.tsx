import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from "react-router-dom";
import '../../assets/css/navigation/nav.css';
import '../../assets/css/technician css/PickLandStyle.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';

interface LandOwner {
  id: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  parcelArea?: string;
}

interface LandParcel {
  id: string;
  parcelNumber: string;
  farmLocationBarangay: string;
  farmLocationCityMunicipality: string;
  totalFarmArea: number;
  cropCommodity: string;
  farmSize: string;
  farmType: string;
  organicPractitioner: boolean;
  plotStatus: string;
  geometry?: any;
  ownershipTypeRegisteredOwner: boolean;
  ownershipTypeTenant: boolean;
  ownershipTypeLessee: boolean;
  createdAt: string;
  updatedAt: string;
}

const TechPicklandParcel: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { ownerId } = useParams<{ ownerId: string }>();

    const [landOwner, setLandOwner] = useState<LandOwner | null>(null);
    const [landParcels, setLandParcels] = useState<LandParcel[]>([]);
    const [selectedParcel, setSelectedParcel] = useState<LandParcel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isActive = (path: string) => location.pathname === path;

    // Fetch land owner information
    const fetchLandOwner = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/rsbsa_submission');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            const owner = data.find((record: any) => record.id === ownerId);
            
            if (owner) {
                setLandOwner({
                    id: owner.id,
                    farmerName: owner.farmerName,
                    farmerAddress: owner.farmerAddress,
                    farmLocation: owner.farmLocation,
                    parcelArea: owner.parcelArea
                });
            } else {
                setError('Land owner not found');
            }
        } catch (err: any) {
            console.error('Error fetching land owner:', err);
            setError('Failed to load land owner information');
        }
    };

    // Fetch land parcels for the specific owner
    const fetchLandParcels = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/farm-parcels/${ownerId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            setLandParcels(data);
        } catch (err: any) {
            console.error('Error fetching land parcels:', err);
            setError('Failed to load land parcels');
        }
    };

    // Load data on component mount
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchLandOwner(), fetchLandParcels()]);
            setLoading(false);
        };
        
        if (ownerId) {
            loadData();
        }
    }, [ownerId]);

    // Handle parcel selection
    const handleParcelSelect = (parcel: LandParcel) => {
        setSelectedParcel(parcel);
    };

    // Format date for display
    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

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
                            className={`sidebar-nav-item ${isActive('/technician-rsbsa') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-rsbsa')}
                        >
                            <span className="nav-icon">
                                <img src={RSBSAIcon} alt="RSBSA" />
                            </span>
                            <span className="nav-text">RSBSA</span>
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
                <div className="main-content jo-map-layout">
                    <div className="content-header">
                        <h2>Land Parcel Selection</h2>
                        {landOwner && (
                            <div className="land-owner-info">
                                <h3>Land Owner: {landOwner.farmerName}</h3>
                                <p><strong>Address:</strong> {landOwner.farmerAddress}</p>
                                <p><strong>Farm Location:</strong> {landOwner.farmLocation}</p>
                            </div>
                        )}
                    </div>

                    <div className="content-body">
                        {loading ? (
                            <div className="loading-container">
                                <p>Loading land parcels...</p>
                            </div>
                        ) : error ? (
                            <div className="error-container">
                                <p>Error: {error}</p>
                                <button onClick={() => window.location.reload()} className="retry-button">
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <div className="parcel-selection-container">
                                {/* Parcel List */}
                                <div className="parcel-list-section">
                                    <h3>Available Land Parcels</h3>
                                    {landParcels.length === 0 ? (
                                        <div className="no-parcels">
                                            <p>No land parcels found for this land owner.</p>
                                        </div>
                                    ) : (
                                        <div className="parcel-grid">
                                            {landParcels.map((parcel) => (
                                                <div 
                                                    key={parcel.id}
                                                    className={`parcel-card ${selectedParcel?.id === parcel.id ? 'selected' : ''}`}
                                                    onClick={() => handleParcelSelect(parcel)}
                                                >
                                                    <div className="parcel-header">
                                                        <h4>Parcel {parcel.parcelNumber}</h4>
                                                        <span className={`status-badge ${parcel.plotStatus.toLowerCase().replace(' ', '-')}`}>
                                                            {parcel.plotStatus}
                                                        </span>
                                                    </div>
                                                    <div className="parcel-details">
                                                        <p><strong>Location:</strong> {parcel.farmLocationBarangay}, {parcel.farmLocationCityMunicipality}</p>
                                                        <p><strong>Area:</strong> {parcel.totalFarmArea} hectares</p>
                                                        <p><strong>Crop:</strong> {parcel.cropCommodity || 'N/A'}</p>
                                                        <p><strong>Farm Type:</strong> {parcel.farmType || 'N/A'}</p>
                                                        <p><strong>Organic:</strong> {parcel.organicPractitioner ? 'Yes' : 'No'}</p>
                                                        <p><strong>Created:</strong> {formatDate(parcel.createdAt)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Map Section */}
                                <div className="map-section">
                                    <h3>Parcel Visualization</h3>
                                    {selectedParcel ? (
                                        <div className="map-container">
                                            <FarmlandMap 
                                                onLandPlotSelect={(properties) => {
                                                    console.log('Selected land plot:', properties);
                                                }}
                                            />
                                            <div className="selected-parcel-info">
                                                <h4>Selected: Parcel {selectedParcel.parcelNumber}</h4>
                                                <p><strong>Area:</strong> {selectedParcel.totalFarmArea} hectares</p>
                                                <p><strong>Location:</strong> {selectedParcel.farmLocationBarangay}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="no-selection">
                                            <p>Select a land parcel to view it on the map</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

    );
};

export default TechPicklandParcel;