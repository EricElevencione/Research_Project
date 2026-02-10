import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/admin css/DashStyle.css';
import '../../components/layout/sidebarStyle.css';
import '../../components/Dashboard/AdminDashboardCharts.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import { KPICards, SeasonComparisonChart, ClaimRateTrendChart } from '../../components/Dashboard/AdminDashboardCharts';
import { useAdminDashboardStats, formatSeasonLabel } from '../../hooks/useAdminDashboardStats';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';


const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedSeason, setSelectedSeason] = useState<string>('');

    const dashData = useAdminDashboardStats(selectedSeason || undefined);

    const isActive = (path: string) => location.pathname === path;

    // Build farmer density map for the heatmap: barangay name -> farmer count
    const farmerDensityMap = useMemo(() => {
        const map: Record<string, number> = {};
        dashData.barangayDensity.forEach(b => {
            map[b.name] = b.farmerCount;
        });
        return map;
    }, [dashData.barangayDensity]);

    // Available seasons for the dropdown
    const availableSeasons = useMemo(() => {
        return dashData.seasonComparison.map(s => s.season);
    }, [dashData.seasonComparison]);

    // Heatmap legend items
    const heatmapLegend = [
        { color: '#ef4444', label: '0 farmers' },
        { color: '#f97316', label: '1' },
        { color: '#eab308', label: '2' },
        { color: '#84cc16', label: '3-4' },
        { color: '#22c55e', label: '5-8' },
        { color: '#14532d', label: '8+' },
    ];

    return (
        <div className="admin-page-container">

            <div className="admin-dashboard-page">

                {/* Sidebar starts here */}
                <div className="sidebar">
                    <nav className="sidebar-nav">
                        <div className='sidebar-logo'>
                            <img src={LogoImage} alt="Logo" />
                        </div>

                        <button
                            className={`sidebar-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
                            onClick={() => navigate('/dashboard')}
                        >
                            <span className="nav-icon">
                                <img src={HomeIcon} alt="Home" />
                            </span>
                            <span className="nav-text">Home</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/rsbsa') ? 'active' : ''}`}
                            onClick={() => navigate('/rsbsa')}
                        >
                            <span className="nav-icon">
                                <img src={RSBSAIcon} alt="RSBSA" />
                            </span>
                            <span className="nav-text">RSBSA</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/gap-analysis') ? 'active' : ''}`}
                            onClick={() => navigate('/gap-analysis')}
                        >
                            <span className="nav-icon">
                                <img src={IncentivesIcon} alt="Gap-analysis" />
                            </span>
                            <span className="nav-text">Gap Analysis</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/incentives') ? 'active' : ''}`}
                            onClick={() => navigate('/incentives')}
                        >
                            <span className="nav-icon">
                                <img src={IncentivesIcon} alt="Incentives" />
                            </span>
                            <span className="nav-text">Incentives</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/masterlist')}
                        >
                            <span className="nav-icon">
                                <img src={ApproveIcon} alt="Masterlist" />
                            </span>
                            <span className="nav-text">Masterlist</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/logout') ? 'active' : ''}`}
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
                <div className="admin-dashboard-main-content">

                    {/* Header with season selector */}
                    <div className="admin-dash-header">
                        <div>
                            <h1 className="admin-dash-title">JO Executive Dashboard</h1>
                            <p className="admin-dash-subtitle">
                                {formatSeasonLabel(selectedSeason || dashData.currentSeason)} &bull;
                                Last updated: {dashData.lastUpdated.toLocaleTimeString()}
                            </p>
                        </div>
                        <select
                            className="admin-dash-season-select"
                            value={selectedSeason}
                            onChange={(e) => setSelectedSeason(e.target.value)}
                        >
                            <option value="">Current Season</option>
                            {availableSeasons.map(s => (
                                <option key={s} value={s}>{formatSeasonLabel(s)}</option>
                            ))}
                        </select>
                    </div>

                    {dashData.loading ? (
                        <div className="admin-dash-loading">
                            <div className="spinner"></div>
                            <p>Loading dashboard data...</p>
                        </div>
                    ) : (
                        <>
                            {/* KPI Stat Cards */}
                            <KPICards kpi={dashData.kpi} currentSeason={dashData.currentSeason} />

                            {/* Barangay Coverage Heatmap */}
                            <div className="admin-dashboard-card admin-dashboard-map-section">
                                <div className="admin-dashboard-card-header">
                                    <div>
                                        <h3>🗺️ Barangay Farmer Coverage</h3>
                                        <p className="admin-dashboard-card-subtitle">
                                            Color-coded by farmer density — dark green = well-covered, red = zero farmers registered
                                        </p>
                                    </div>
                                </div>
                                <div className="admin-dashboard-map-container">
                                    <FarmlandMap farmerDensity={farmerDensityMap} />
                                </div>
                                <div className="admin-map-legend">
                                    <span className="admin-map-legend-title">Farmer Density:</span>
                                    {heatmapLegend.map((item, idx) => (
                                        <span key={idx} className="admin-map-legend-item">
                                            <span
                                                className="admin-map-legend-swatch"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            {item.label}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Charts Row: Season Comparison + Claim Rate Trend */}
                            <div className="admin-dashboard-charts-row">
                                <div className="admin-dashboard-card">
                                    <div className="admin-dashboard-card-header">
                                        <div>
                                            <h3>📊 Season-over-Season Comparison</h3>
                                            <p className="admin-dashboard-card-subtitle">
                                                Allocations vs. distributions by season
                                            </p>
                                        </div>
                                    </div>
                                    <SeasonComparisonChart data={dashData.seasonComparison} />
                                </div>

                                <div className="admin-dashboard-card">
                                    <div className="admin-dashboard-card-header">
                                        <div>
                                            <h3>📈 Claim Rate Trend</h3>
                                            <p className="admin-dashboard-card-subtitle">
                                                Weekly claim rate progression through the season
                                            </p>
                                        </div>
                                    </div>
                                    <ClaimRateTrendChart data={dashData.claimRateTrend} />
                                </div>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>

    );
};

export default Dashboard;