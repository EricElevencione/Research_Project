import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/jo css/JoIncentStyle.css';
import '../../assets/css/navigation/nav.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';

interface RegionalAllocation {
    id: number;
    season: string;
    allocation_date: string;
    urea_46_0_0_bags: number;
    complete_14_14_14_bags: number;
    complete_16_16_16_bags: number;
    ammonium_sulfate_21_0_0_bags: number;
    ammonium_phosphate_16_20_0_bags: number;
    muriate_potash_0_0_60_bags: number;
    rice_seeds_nsic_rc160_kg: number;
    rice_seeds_nsic_rc222_kg: number;
    rice_seeds_nsic_rc440_kg: number;
    corn_seeds_hybrid_kg: number;
    corn_seeds_opm_kg: number;
    vegetable_seeds_kg: number;
    farmer_count?: number;
}

const JoIncentives: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            (Number(allocation.complete_16_16_16_bags) || 0) +
            (Number(allocation.ammonium_sulfate_21_0_0_bags) || 0) +
            (Number(allocation.ammonium_phosphate_16_20_0_bags) || 0) +
            (Number(allocation.muriate_potash_0_0_60_bags) || 0);
        return isNaN(total) ? 0 : total;
    };

    const getTotalSeeds = (allocation: RegionalAllocation) => {
        const total = (Number(allocation.rice_seeds_nsic_rc160_kg) || 0) +
            (Number(allocation.rice_seeds_nsic_rc222_kg) || 0) +
            (Number(allocation.rice_seeds_nsic_rc440_kg) || 0) +
            (Number(allocation.corn_seeds_hybrid_kg) || 0) +
            (Number(allocation.corn_seeds_opm_kg) || 0) +
            (Number(allocation.vegetable_seeds_kg) || 0);
        return isNaN(total) ? 0 : total;
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

                    <div className="dashboard-header-incent">
                        <h2 className="page-header">🎯 Distribution Management</h2>
                        <p className="page-subtitle">Manage regional allocations and farmer requests</p>
                    </div>

                    <div className="content-card-incent">
                        <div className="action-header">
                            <button
                                className="btn-create-allocation"
                                onClick={() => {
                                    console.log('Button clicked! Navigating to /jo-create-allocation');
                                    navigate('/jo-create-allocation');
                                }}
                            >
                                ➕ New Regional Allocation
                            </button>
                        </div>

                        {loading ? (
                            <div className="loading-message">Loading allocations...</div>
                        ) : error ? (
                            <div className="error-state">
                                <div className="error-icon">⚠️</div>
                                <h3>Unable to Connect to Server</h3>
                                <p>{error}</p>
                                <div className="error-help">
                                    <p><strong>Please ensure:</strong></p>
                                    <ul>
                                        <li>Backend server is running on port 5000</li>
                                        <li>Database table 'regional_allocations' exists</li>
                                        <li>Run: <code>cd backend && node server.cjs</code></li>
                                    </ul>
                                </div>
                                <button className="btn-retry" onClick={fetchAllocations}>
                                    🔄 Retry Connection
                                </button>
                            </div>
                        ) : allocations.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📦</div>
                                <h3>No Allocations Yet</h3>
                                <p>Create your first regional allocation to get started</p>
                            </div>
                        ) : (
                            <div className="allocations-grid">
                                {allocations.map((allocation) => (
                                    <div key={allocation.id} className="allocation-card">
                                        <div className="card-header">
                                            <div className="season-info">
                                                <h3>{formatSeasonName(allocation.season)}</h3>
                                                <span className="allocation-date">
                                                    {new Date(allocation.allocation_date).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="card-body">
                                            <div className="stat-row">
                                                <div className="stat-item">
                                                    <span className="stat-label">Total Fertilizer</span>
                                                    <span className="stat-value">{getTotalFertilizer(allocation).toLocaleString()} bags</span>
                                                </div>
                                                <div className="stat-item">
                                                    <span className="stat-label">Total Seeds</span>
                                                    <span className="stat-value">{getTotalSeeds(allocation).toFixed(2)} kg</span>
                                                </div>
                                            </div>
                                            <div className="stat-row">
                                                <div className="stat-item">
                                                    <span className="stat-label">Farmer Requests</span>
                                                    <span className="stat-value">{allocation.farmer_count || 0} farmers</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="card-actions">
                                            <button
                                                className="btn-action btn-view"
                                                onClick={() => navigate(`/jo-view-allocation/${allocation.id}`)}
                                                title="View Details"
                                            >
                                                👁️ View
                                            </button>
                                            <button
                                                className="btn-action btn-add-request"
                                                onClick={() => navigate(`/jo-add-farmer-request/${allocation.id}`)}
                                                title="Add Farmer Request"
                                            >
                                                ➕ Add Request
                                            </button>
                                            <button
                                                className="btn-action btn-manage"
                                                onClick={() => navigate(`/jo-manage-requests/${allocation.id}`)}
                                                title="Manage Requests"
                                            >
                                                📋 Manage
                                            </button>
                                            <button
                                                className="btn-action btn-delete"
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
                </div>
            </div>
        </div>

    );
};

export default JoIncentives;
