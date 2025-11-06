import React from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/navigation/nav.css';
import '../../assets/css/jo css/JoDashStyle.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';


const Dashboard: React.FC = () => {
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
                            onClick={() => navigate('/dashboard')}
                        >
                            <span className="nav-icon">
                                <img src={HomeIcon} alt="Home" />
                            </span>
                            <span className="nav-text">Home</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-rsbsapage') ? 'active' : ''}`}
                            onClick={() => navigate('/rsbsa')}
                        >
                            <span className="nav-icon">
                                <img src={RSBSAIcon} alt="RSBSA" />
                            </span>
                            <span className="nav-text">RSBSA</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-incentives') ? 'active' : ''}`}
                            onClick={() => navigate('/incentives')}
                        >
                            <span className="nav-icon">
                                <img src={IncentivesIcon} alt="Incentives" />
                            </span>
                            <span className="nav-text">Incentives</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/masterlist')}
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
                <div className="main-content jo-map-layout">
                    <h2>Dashboard</h2>

                    <div className="map-area">
                        <FarmlandMap />
                    </div>

                    <aside className="floating-panel">
                        <div className="panel-section">
                            <div className="panel-header">
                                <h3 className="panel-title">Total Farmers <span className="muted">4</span></h3>
                            </div>
                            <div className="panel-body">
                                <div className="progress-row">
                                    <div className="progress-circle">54%</div>
                                    <div className="progress-text">
                                        <div className="row-caps">
                                            <span>3 Persons</span>
                                            <span>1 Person</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="panel-section">
                            <div className="panel-header with-bar">
                                <h3 className="panel-title">Land Owners<span className="muted">170</span></h3>
                            </div>
                            <div className="panel-body grid-2">
                                <div className="metric"><div className="metric-label">Phone Call</div><div className="metric-value">72</div></div>
                                <div className="metric"><div className="metric-label">Voice Mail</div><div className="metric-value">35</div></div>
                                <div className="metric"><div className="metric-label">Text Message</div><div className="metric-value">58</div></div>
                                <div className="metric"><div className="metric-label">Offer Letter</div><div className="metric-value">15</div></div>
                            </div>
                        </div>

                        <div className="panel-section">
                            <div className="panel-header">
                                <h3 className="panel-title">Total Registered Land Maps</h3>
                            </div>
                            <div className="panel-body grid-2">
                                <div className="metric"><div className="metric-label">Great results</div><div className="metric-value">58%</div></div>
                                <div className="metric"><div className="metric-label">Terrible results</div><div className="metric-value">10%</div></div>
                                <div className="metric"><div className="metric-label">Not great, not terrible</div><div className="metric-value">32%</div></div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>

    );
};

export default Dashboard;