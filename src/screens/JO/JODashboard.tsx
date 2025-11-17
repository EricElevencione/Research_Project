import React from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/navigation/nav.css';
import '../../assets/css/jo css/JoDashStyle.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import DashboardStats from '../../components/Dashboard/DashboardStats';
import DistributionIcon from '../../assets/images/distribution.png'
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import FarmerRequestIcon from '../../assets/images/request.png';

const JoDashboard: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

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
                <div className="main-content jo-map-layout">
                    <h2>Dashboard</h2>

                    {/* Distribution System Quick Access */}
                    <div className="quick-access-section">
                        <h3>Distribution Management System</h3>
                        <div className="quick-access-cards">
                            <div className="access-card" onClick={() => navigate('/jo-regional-allocation')}>
                                <div className="card-icon">📦</div>
                                <h4>Regional Allocation</h4>
                                <p>Input fertilizer & seed allocation from Regional Office</p>
                            </div>
                            <div className="access-card" onClick={() => navigate('/jo-farmer-requests')}>
                                <div className="card-icon">📋</div>
                                <h4>Farmer Requests</h4>
                                <p>Record farmer requests & view priority rankings</p>
                            </div>
                            <div className="access-card" onClick={() => navigate('/jo-gap-analysis')}>
                                <div className="card-icon">📊</div>
                                <h4>Gap Analysis</h4>
                                <p>Compare supply vs demand to identify shortages</p>
                            </div>
                            <div className="access-card" onClick={() => navigate('/jo-distribution')}>
                                <div className="card-icon">🚚</div>
                                <h4>Distribution Log</h4>
                                <p>Track actual distribution to farmers</p>
                            </div>
                        </div>
                    </div>

                    <div className="map-area">
                        <FarmlandMap />

                        {/* Statistics Section - Floating over map */}
                        <div className="floating-stats-panel">
                            <DashboardStats />
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
};

export default JoDashboard;