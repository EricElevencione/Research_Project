import React, { useState, useEffect } from 'react';
import '../../assets/css/BrgyChairDashStyle.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import PendingIcon from '../../assets/images/pending.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';

const BrgyChairDash: React.FC = () => {
    const [activeTab, setActiveTab] = useState('overview');

    return (
        <div className="brgy-chair-dashboard">

            <div className="dashboard-container">
                <div className="sidebar">
                    <nav className="sidebar-nav">

                        <div className='sidebar-logo'>
                            <img src={LogoImage} alt="Logo" />
                        </div>

                        <button
                            className={`sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <span className="nav-icon">
                                <img src={HomeIcon} alt="Home" />
                            </span>
                            <span className="nav-text">Home</span>
                        </button>
                        <button
                            className={`sidebar-nav-item ${activeTab === 'farmers' ? 'active' : ''}`}
                            onClick={() => setActiveTab('farmers')}
                        >
                            <span className="nav-icon">
                                <img src={RSBSAIcon} alt="RSBSA" />
                            </span>
                            <span className="nav-text">RSBSA</span>
                        </button>
                        <button
                            className={`sidebar-nav-item ${activeTab === 'land' ? 'active' : ''}`}
                            onClick={() => setActiveTab('land')}
                        >
                            <span className="nav-icon">
                                <img src={PendingIcon} alt="Pending" />
                            </span>
                            <span className="nav-text">Pending</span>
                        </button>
                        <button
                            className={`sidebar-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                            onClick={() => setActiveTab('reports')}
                        >
                            <span className="nav-icon">
                                <img src={ApproveIcon} alt="Approve" />
                            </span>
                            <span className="nav-text">Approve</span>
                        </button>
                        <button
                            className={`sidebar-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                            onClick={() => setActiveTab('reports')}
                        >
                            <span className="nav-icon">
                                <img src={LogoutIcon} alt="Logout" />
                            </span>
                            <span className="nav-text">Logout</span>
                        </button>
                    </nav>
                </div>

                {/* <div className="main-content">
                    {activeTab === 'overview' && (
                        <div className="overview-section">
                            <div className="stats-grid">
                                <div className="stat-card">
                                    <h3>Total Farmers</h3>
                                    <p className="stat-number">1,247</p>
                                </div>
                                <div className="stat-card">
                                    <h3>Total Land Area</h3>
                                    <p className="stat-number">2,456 ha</p>
                                </div>
                                <div className="stat-card">
                                    <h3>Active Plots</h3>
                                    <p className="stat-number">892</p>
                                </div>
                                <div className="stat-card">
                                    <h3>Pending Applications</h3>
                                    <p className="stat-number">23</p>
                                </div>
                            </div>

                            <div className="map-section">
                                <h3>Farmland Overview</h3>
                                <div className="map-container">
                                    <FarmlandMap />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'farmers' && (
                        <div className="farmers-section">
                            <h3>Farmer Management</h3>
                            <p>Farmer management tools will be implemented here.</p>
                        </div>
                    )}

                    {activeTab === 'land' && (
                        <div className="land-section">
                            <h3>Land Records</h3>
                            <p>Land record management tools will be implemented here.</p>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="reports-section">
                            <h3>Reports & Analytics</h3>
                            <p>Reporting and analytics tools will be implemented here.</p>
                        </div>
                    )}
                </div> */}
            </div>
        </div>
    );
};

export default BrgyChairDash;

