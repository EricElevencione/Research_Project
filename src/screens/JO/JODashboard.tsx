import React from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../components/layout/sidebarStyle.css';
import '../../assets/css/jo css/JoDashboardStyle.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import DashboardStats from '../../components/Dashboard/DashboardStats';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';

const JoDashboard: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="jo-dashboard-page-container">

            <div className="jo-dashboard-page">

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
                            className="sidebar-nav-item logout"
                            onClick={() => {
                                localStorage.removeItem('isAuthenticated');
                                navigate('/login');
                            }}
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
                <div className="jo-dashboard-main-content">
                    <div className="jo-dashboard-map-section">
                        <h2 className="jo-dashboard-page-title">Dashboard</h2>

                        <div className="jo-dashboard-map-area">
                            <FarmlandMap />
                        </div>

                        <div className="jo-dashboard-stats">
                            <div className="jo-dashboard-active-farmers"></div>
                            <div className="jo-dashboard-farmers"></div>
                        </div>
                    </div>

                    <div className="jo-dashboard-reports">
                        <div className='jo-dashboard-reports-1'></div>
                        <div className='jo-dashboard-reports-2'></div>
                        <div className='jo-dashboard-reports-3'></div>
                    </div>
                </div>
            </div>
        </div>

    );
};

export default JoDashboard;