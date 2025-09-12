import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/navigation/nav.css';
import '../../assets/css/App.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import PendingIcon from '../../assets/images/pending.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import EmailIcon from '../../assets/images/email.png';
import IncentivesIcon from '../../assets/images/incentives.png';

const Incentives: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [activeTab, setActiveTab] = useState('overview');
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
                            className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                            onClick={() => navigate('/dashboard')}
                        >
                            <span className="nav-icon">
                                <img src={HomeIcon} alt="Home" />
                            </span>
                            <span className="nav-text">Home</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${activeTab === 'rsbsa' ? 'active' : ''}`}
                            onClick={() => navigate('/rsbsa')}
                        >
                            <span className="nav-icon">
                                <img src={RSBSAIcon} alt="RSBSA" />
                            </span>
                            <span className="nav-text">RSBSA</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${activeTab === 'incentives' ? 'active' : ''}`}
                            onClick={() => navigate('/incentives')}
                        >
                            <span className="nav-icon">
                                <img src={IncentivesIcon} alt="Incentives" />
                            </span>
                            <span className="nav-text">Incentives</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${activeTab === 'masterlist' ? 'active' : ''}`}
                            onClick={() => navigate('/masterlist')}
                        >
                            <span className="nav-icon">
                                <img src={ApproveIcon} alt="Masterlist" />
                            </span>
                            <span className="nav-text">Masterlist</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${activeTab === 'logout' ? 'active' : ''}`}
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
                    <div className="dashboard-header">
                        <h2 className="page-header">Dashboard</h2>
                    </div>
                    <div className="content-card">
                        <div className="dashboard-stats">
                            <div className="stat-card">
                                <h3>Farmers</h3>
                                <p className="stat-number">1,247</p>
                            </div>
                            <div className="stat-card">
                                <h3>Land Owners</h3>
                                <p className="stat-number">23</p>
                            </div>
                            <div className="stat-card">
                                <h3>Total Applications</h3>
                                <p className="stat-number">8</p>
                            </div>
                        </div>

                        <div className="map-container">
                            <FarmlandMap />
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
};

export default Incentives;
