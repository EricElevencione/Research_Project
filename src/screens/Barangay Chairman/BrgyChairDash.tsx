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

                <div className="main-content">
                    <div className='dashboard-header'>
                        <h1 className="page-header">Dashboard</h1>
                    </div>
                    {activeTab === 'overview' && (
                        <div className="overview-section">
                            {/* <div className="stats-grid">
                                Data na gya 
                            </div> */}
                        </div>
                    )}
                </div>

                <div className="landowner-container">
                    <div className="landowners-name">
                        <h1 className="landowner-header">Landowners</h1>
                        <div className="search-bar">
                            <input type="text" placeholder="Search..." />
                            <button className="search-button">Search</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrgyChairDash;

