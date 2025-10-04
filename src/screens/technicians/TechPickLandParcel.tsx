import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
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
    submissionId?: string; // Add submissionId to LandOwner interface
}

interface FarmParcel {
    id: string;
    submissionId: string;
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

const TechPickLandParcel: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { ownerId } = useParams<{ ownerId: string }>();

    const [landOwner, setLandOwner] = useState<LandOwner | null>(null);
    const [landParcels, setLandParcels] = useState<FarmParcel[]>([]);
    const [selectedParcel, setSelectedParcel] = useState<FarmParcel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isActive = (path: string) => location.pathname === path;

    // Fetch land owner information
    const fetchLandOwner = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/rsbsa_submission');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            console.log('RSBSA submission API response:', data); // Log the full response
            const owner = data.find((record: any) => record.id === ownerId);

            if (owner) {
                const ownerData = {
                    id: owner.id,
                    farmerName: owner.farmerName,
                    farmerAddress: owner.farmerAddress,
                    farmLocation: owner.farmLocation,
                    parcelArea: owner.parcelArea,
                    submissionId: owner.id, // Confirm this is the correct field
                };
                console.log('Land owner data:', ownerData); // Log owner data
                setLandOwner(ownerData);
                return ownerData;
            } else {
                setError('Land owner not found');
                return null;
            }
        } catch (err: any) {
            console.error('Error fetching land owner:', err);
            setError('Failed to load land owner information');
            return null;
        }
    };
    // Fetch land parcels for the specific submission
    const fetchLandParcels = async (submissionId: string) => {
        try {
            console.log('Fetching parcels for submissionId:', submissionId);
            const response = await fetch(`http://localhost:5000/api/rsbsa_submission/${submissionId}/parcels`);
            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers));

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Raw parcels data:', data);

            const mappedParcels: FarmParcel[] = data.map((parcel: any) => ({
                id: parcel.id,
                submissionId: parcel.submission_id,
                parcelNumber: parcel.parcel_number || 'N/A',
                farmLocationBarangay: parcel.farm_location_barangay || 'N/A',
                farmLocationCityMunicipality: parcel.farm_location_municipality || 'N/A',
                totalFarmArea: parseFloat(parcel.total_farm_area_ha) || 0,
                cropCommodity: parcel.crop_commodity || 'N/A',
                farmSize: parcel.total_farm_area_ha ? `${parcel.total_farm_area_ha} ha` : 'N/A',
                farmType: parcel.farm_type || 'N/A',
                organicPractitioner: parcel.organic_practitioner || false,
                plotStatus: parcel.plot_status || 'N/A',
                geometry: parcel.geometry || null,
                ownershipTypeRegisteredOwner: parcel.ownership_type_registered_owner || false,
                ownershipTypeTenant: parcel.ownership_type_tenant || false,
                ownershipTypeLessee: parcel.ownership_type_lessee || false,
                createdAt: parcel.created_at || new Date().toISOString(),
                updatedAt: parcel.updated_at || new Date().toISOString(),
            }));

            console.log('Mapped parcels:', mappedParcels);
            setLandParcels(mappedParcels);
        } catch (err: any) {
            console.error('Error fetching land parcels:', err);
            setError(`Failed to load land parcels: ${err.message}`);
        }
    };

    // Load data on component mount
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const owner = await fetchLandOwner();
                console.log('Fetched owner:', owner); // Debug log
                if (owner?.submissionId) {
                    await fetchLandParcels(owner.submissionId);
                } else {
                    setError('No submission ID found for this land owner');
                }
            } catch (err: any) {
                setError('Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        if (ownerId) {
            loadData();
        }
    }, [ownerId]);

    // Handle parcel selection
    const handleParcelSelect = (parcel: FarmParcel) => {
        setSelectedParcel(parcel);
    };

    // Format date for display
    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
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
                        <div className="sidebar-logo">
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
                                <p>
                                    <strong>Address:</strong> {landOwner.farmerAddress}
                                </p>
                                <p>
                                    <strong>Farm Location:</strong> {landOwner.farmLocation}
                                </p>
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
                                                        <span
                                                            className={`status-badge ${parcel.plotStatus
                                                                .toLowerCase()
                                                                .replace(' ', '-')}`}
                                                        >
                                                            {parcel.plotStatus}
                                                        </span>
                                                    </div>
                                                    <div className="parcel-details">
                                                        <p>
                                                            <strong>Location:</strong> {parcel.farmLocationBarangay},{' '}
                                                            {parcel.farmLocationCityMunicipality}
                                                        </p>
                                                        <p>
                                                            <strong>Area:</strong> {parcel.totalFarmArea} hectares
                                                        </p>
                                                        <p>
                                                            <strong>Crop:</strong> {parcel.cropCommodity || 'N/A'}
                                                        </p>
                                                        <p>
                                                            <strong>Farm Type:</strong> {parcel.farmType || 'N/A'}
                                                        </p>
                                                        <p>
                                                            <strong>Organic:</strong>{' '}
                                                            {parcel.organicPractitioner ? 'Yes' : 'No'}
                                                        </p>
                                                        <p>
                                                            <strong>Created:</strong> {formatDate(parcel.createdAt)}
                                                        </p>
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
                                                <p>
                                                    <strong>Area:</strong> {selectedParcel.totalFarmArea} hectares
                                                </p>
                                                <p>
                                                    <strong>Location:</strong> {selectedParcel.farmLocationBarangay}
                                                </p>
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

export default TechPickLandParcel;