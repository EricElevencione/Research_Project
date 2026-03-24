import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../components/layout/sidebarStyle.css';
import '../../assets/css/technician css/TechnicianDashboardStyle.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import { getTechDashboardData } from '../../api';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';

interface BarangayRow {
    barangay: string;
    farmerCount: number;
    plottedParcels: number;
    plottedFarmers: number;
    isComplete: boolean;
}

interface DashboardData {
    totalFarmers: number;
    totalPlotted: number;
    totalUnplotted: number;
    barangayChecklist: BarangayRow[];
    unplottedByBarangay: Record<string, number>;
}

const TechnicianDashboard: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [checklistFilter, setChecklistFilter] = useState<'all' | 'incomplete' | 'complete'>('all');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await getTechDashboardData();
                if (!res.error && res.data) {
                    setDashboardData(res.data);
                }
            } catch (err) {
                console.error('Error loading tech dashboard:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredChecklist = dashboardData?.barangayChecklist?.filter(row => {
        if (checklistFilter === 'incomplete') return !row.isComplete;
        if (checklistFilter === 'complete') return row.isComplete;
        return true;
    }) || [];

    const completedCount = dashboardData?.barangayChecklist?.filter(r => r.isComplete).length || 0;
    const totalBarangays = dashboardData?.barangayChecklist?.length || 0;

    return (
        <div className="tech-dashboard-page-container">
            <div className="tech-dashboard-page">

                {/* Sidebar */}
                <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
                    <nav className="sidebar-nav">
                        <div className='sidebar-logo'>
                            <img src={LogoImage} alt="Logo" />
                        </div>
                        <button
                            className={`sidebar-nav-item ${isActive('/technician-dashboard') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-dashboard')}
                        >
                            <span className="nav-icon"><img src={HomeIcon} alt="Home" /></span>
                            <span className="nav-text">Home</span>
                        </button>
                        <button
                            className={`sidebar-nav-item ${isActive('/technician-rsbsapage') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-rsbsa')}
                        >
                            <span className="nav-icon"><img src={RSBSAIcon} alt="RSBSA" /></span>
                            <span className="nav-text">RSBSA</span>
                        </button>
                        <button
                            className={`sidebar-nav-item ${isActive('/technician-incentives') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-incentives')}
                        >
                            <span className="nav-icon"><img src={IncentivesIcon} alt="Incentives" /></span>
                            <span className="nav-text">Incentives</span>
                        </button>
                        <button
                            className={`sidebar-nav-item ${isActive('/technician-masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-masterlist')}
                        >
                            <span className="nav-icon"><img src={ApproveIcon} alt="Masterlist" /></span>
                            <span className="nav-text">Masterlist</span>
                        </button>
                        <button
                            className={`sidebar-nav-item ${isActive('/') ? 'active' : ''}`}
                            onClick={() => navigate('/')}
                        >
                            <span className="nav-icon"><img src={LogoutIcon} alt="Logout" /></span>
                            <span className="nav-text">Logout</span>
                        </button>
                    </nav>
                </div>

                <div className={`tech-incent-sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

                {/* Main content */}
                <div className="tech-dashboard-main-content">
                    <div className="tech-incent-mobile-header">
                        <button className="tech-incent-hamburger" onClick={() => setSidebarOpen(prev => !prev)}>☰</button>
                        <div className="tech-incent-mobile-title">Dashboard</div>
                    </div>
                    <h2 className="tech-dashboard-page-title">Data Quality Dashboard</h2>

                    {/* Stat cards */}
                    <div className="tech-dashboard-stats-row">
                        <div className="tech-stat-card">
                            <div className="tech-stat-icon total">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                            </div>
                            <div className="tech-stat-info">
                                <span className="tech-stat-value">{loading ? '...' : dashboardData?.totalFarmers ?? 0}</span>
                                <span className="tech-stat-label">Total Farmers</span>
                            </div>
                        </div>

                        <div className="tech-stat-card">
                            <div className="tech-stat-icon plotted">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                    <polyline points="22 4 12 14.01 9 11.01"/>
                                </svg>
                            </div>
                            <div className="tech-stat-info">
                                <span className="tech-stat-value">{loading ? '...' : dashboardData?.totalPlotted ?? 0}</span>
                                <span className="tech-stat-label">Plotted Farmers</span>
                            </div>
                        </div>

                        <div className="tech-stat-card">
                            <div className="tech-stat-icon unplotted">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                            </div>
                            <div className="tech-stat-info">
                                <span className="tech-stat-value">{loading ? '...' : dashboardData?.totalUnplotted ?? 0}</span>
                                <span className="tech-stat-label">Unplotted Farmers</span>
                            </div>
                        </div>

                        <div className="tech-stat-card">
                            <div className="tech-stat-icon progress">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20V10"/>
                                    <path d="M18 20V4"/>
                                    <path d="M6 20v-4"/>
                                </svg>
                            </div>
                            <div className="tech-stat-info">
                                <span className="tech-stat-value">{loading ? '...' : `${completedCount}/${totalBarangays}`}</span>
                                <span className="tech-stat-label">Barangays Complete</span>
                            </div>
                        </div>
                    </div>

                    {/* Content: Checklist + Map side by side */}
                    <div className="tech-dashboard-content-row">
                        {/* Barangay checklist panel */}
                        <div className="tech-dashboard-checklist-panel">
                            <div className="tech-checklist-header">
                                <h3>Barangay Completion</h3>
                                <select
                                    className="tech-checklist-filter"
                                    value={checklistFilter}
                                    onChange={e => setChecklistFilter(e.target.value as 'all' | 'incomplete' | 'complete')}
                                >
                                    <option value="all">All</option>
                                    <option value="incomplete">Incomplete</option>
                                    <option value="complete">Complete</option>
                                </select>
                            </div>
                            <div className="tech-checklist-table-wrapper">
                                <table className="tech-checklist-table">
                                    <thead>
                                        <tr>
                                            <th>Barangay</th>
                                            <th>Farmers</th>
                                            <th>Plots</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={4} className="tech-checklist-loading">Loading...</td></tr>
                                        ) : filteredChecklist.length === 0 ? (
                                            <tr><td colSpan={4} className="tech-checklist-empty">No barangays found</td></tr>
                                        ) : filteredChecklist.map(row => (
                                            <tr key={row.barangay} className={row.isComplete ? 'row-complete' : ''}>
                                                <td className="brgy-name">{row.barangay}</td>
                                                <td className="brgy-count">{row.farmerCount}</td>
                                                <td className="brgy-count">
                                                    <span className={`plot-ratio ${row.isComplete ? 'complete' : row.plottedFarmers > 0 ? 'partial' : 'none'}`}>
                                                        {row.plottedFarmers}/{row.farmerCount}
                                                    </span>
                                                </td>
                                                <td className="brgy-status">
                                                    {row.isComplete ? (
                                                        <span className="status-check" title="Complete">&#10003;</span>
                                                    ) : (
                                                        <span className="status-pending" title={`${row.farmerCount - row.plottedFarmers} remaining`}>
                                                            {row.farmerCount - row.plottedFarmers}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Map area */}
                        <div className="tech-dashboard-map-area">
                            <FarmlandMap
                                dashboardMode
                                unplottedByBarangay={dashboardData?.unplottedByBarangay}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TechnicianDashboard;
