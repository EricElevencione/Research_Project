import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/navigation/nav.css';
import '../../assets/css/technician css/FarmerProfPage.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import FarmerIcon from '../../assets/images/farmer (1).png';
import IncentivesIcon from '../../assets/images/incentives.png';

interface FarmerRecord {
    id: string;
    referenceNumber: string;
    farmerName: string;
    lastName: string;
    barangay: string;
    status: string;
}

const TechFarmerProfPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [farmers, setFarmers] = useState<FarmerRecord[]>([]);
    const [filteredFarmers, setFilteredFarmers] = useState<FarmerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'lastName' | 'barangay' | 'ffrsId'>('lastName');

    const isActive = (path: string) => location.pathname === path;

    useEffect(() => {
        fetchAllFarmers();
    }, []);

    useEffect(() => {
        filterAndSortFarmers();
    }, [searchTerm, sortBy, farmers]);

    const fetchAllFarmers = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5000/api/rsbsa_submission');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Filter out farmers with 'No Parcels' status from the list view
            const filteredData = (Array.isArray(data) ? data : []).filter((item: any) => {
                const status = String(item.status ?? '').toLowerCase().trim();
                return status !== 'no parcels';
            });

            // Transform data to match our interface
            const transformedData: FarmerRecord[] = filteredData.map((record: any) => ({
                id: record.id,
                referenceNumber: record.referenceNumber || `RSBSA-${record.id}`,
                farmerName: record.farmerName || 'N/A',
                lastName: record.farmerName?.split(',')[0]?.trim() || '',
                barangay: record.farmLocation?.split(',')[0]?.trim() || record.farmerAddress?.split(',')[0]?.trim() || 'N/A',
                status: record.status || 'Not Active'
            }));

            setFarmers(transformedData);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching farmers:', err);
            setError('Failed to load farmers data');
        } finally {
            setLoading(false);
        }
    };

    const filterAndSortFarmers = () => {
        let filtered = [...farmers];

        // Apply search filter
        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(farmer =>
                farmer.farmerName.toLowerCase().includes(searchLower) ||
                farmer.referenceNumber.toLowerCase().includes(searchLower) ||
                farmer.referenceNumber.replace(/-/g, '').toLowerCase().includes(searchLower)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'lastName':
                    return a.lastName.localeCompare(b.lastName);
                case 'barangay':
                    return a.barangay.localeCompare(b.barangay);
                case 'ffrsId':
                    return a.referenceNumber.localeCompare(b.referenceNumber);
                default:
                    return 0;
            }
        });

        setFilteredFarmers(filtered);
    };

    const handleFarmerClick = (farmerId: string) => {
        navigate(`/technician-farmerprofile/${farmerId}`);
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
                <div className="main-content">
                    <h2>Farmer Profiles</h2>

                    <div className="content-card">
                        {loading ? (
                            <div className="loading-container">
                                <p>Loading farmers...</p>
                            </div>
                        ) : error ? (
                            <div className="error-container">
                                <p>Error: {error}</p>
                                <button onClick={fetchAllFarmers} className="retry-button">
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Search and Filter Section */}
                                <div className="controls-section">
                                    <div className="search-container">
                                        <input
                                            type="text"
                                            className="search-input"
                                            placeholder="Search by Name or FFRS ID..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    <div className="sort-container flex items-center gap-2">
                                        <label htmlFor="sort-select">Sort by:</label>
                                        <select
                                            id="sort-select"
                                            className="sort-select"
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value as 'lastName' | 'barangay' | 'ffrsId')}
                                        >
                                            <option value="lastName">Last Name</option>
                                            <option value="barangay">Barangay</option>
                                            <option value="ffrsId">FFRS ID</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Results Summary */}
                                <div className="results-summary">
                                    Showing {filteredFarmers.length} of {farmers.length} farmers
                                </div>

                                {/* Farmers List Table */}
                                <div className="table-container">
                                    <table className="farmers-table">
                                        <thead>
                                            <tr>
                                                <th>FFRS ID</th>
                                                <th>Farmer Name</th>
                                                <th>Barangay</th>
                                                <th>Status</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredFarmers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="no-data">
                                                        {searchTerm ? 'No matching farmers found' : 'No farmers found'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredFarmers.map((farmer) => (
                                                    <tr key={farmer.id} className="farmer-row">
                                                        <td className="ffrs-id">{farmer.referenceNumber}</td>
                                                        <td
                                                            className="farmer-name-cell clickable"
                                                            onClick={() => handleFarmerClick(farmer.id)}
                                                        >
                                                            {farmer.farmerName}
                                                        </td>
                                                        <td>{farmer.barangay}</td>
                                                        <td>
                                                            <span className={`status-badge ${farmer.status === 'Active Farmer' ? 'active' : 'inactive'}`}>
                                                                {farmer.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="view-profile-btn"
                                                                onClick={() => handleFarmerClick(farmer.id)}
                                                            >
                                                                View Profile
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>

    );
};

export default TechFarmerProfPage;