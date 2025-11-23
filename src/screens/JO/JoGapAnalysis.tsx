import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import '../../assets/css/jo css/JoGapAnalysis.css';
import '../../assets/css/navigation/nav.css';

interface GapAnalysisData {
    season: string;
    allocation_date: string;
    fertilizers: {
        urea_46_0_0: GapItem;
        complete_14_14_14: GapItem;
        complete_16_16_16: GapItem;
        ammonium_sulfate_21_0_0: GapItem;
        ammonium_phosphate_16_20_0: GapItem;
        muriate_potash_0_0_60: GapItem;
    };
    seeds: {
        rice_nsic_rc160: GapItem;
        rice_nsic_rc222: GapItem;
        rice_nsic_rc440: GapItem;
        corn_hybrid: GapItem;
        corn_opm: GapItem;
        vegetable: GapItem;
    };
}

interface GapItem {
    allocated: number;
    requested: number;
    gap: number;
    fulfillment_rate: number;
}

const JoGapAnalysis: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [selectedSeason, setSelectedSeason] = useState('dry_2024');
    const [gapData, setGapData] = useState<GapAnalysisData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isActive = (path: string) => {
        return window.location.pathname === path;
    };

    useEffect(() => {
        fetchGapAnalysis();
    }, [selectedSeason]);

    const fetchGapAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/gap-analysis/${selectedSeason}`);
            if (response.ok) {
                const data = await response.json();
                setGapData(data);
            } else if (response.status === 404) {
                setError('No allocation data found for this season');
                setGapData(null);
            } else {
                setError('Failed to fetch gap analysis data');
                setGapData(null);
            }
        } catch (error) {
            console.error('Error fetching gap analysis:', error);
            setError('Error connecting to server');
            setGapData(null);
        } finally {
            setLoading(false);
        }
    };

    const getStatusClass = (gap: number) => {
        if (gap > 0) return 'status-surplus';
        if (gap < 0) return 'status-shortage';
        return 'status-balanced';
    };

    const getStatusLabel = (gap: number) => {
        if (gap > 0) return 'Surplus';
        if (gap < 0) return 'Shortage';
        return 'Balanced';
    };

    const formatNumber = (num: number) => {
        return Math.abs(num).toLocaleString();
    };

    const renderGapRow = (label: string, item: GapItem, unit: string) => {
        const statusClass = getStatusClass(item.gap);
        const statusLabel = getStatusLabel(item.gap);

        return (
            <tr key={label}>
                <td className="item-label">{label}</td>
                <td className="number-cell">{formatNumber(item.allocated)} {unit}</td>
                <td className="number-cell">{formatNumber(item.requested)} {unit}</td>
                <td className={`number-cell gap-cell ${statusClass}`}>
                    {item.gap > 0 && '+'}
                    {formatNumber(item.gap)} {unit}
                </td>
                <td className="number-cell">{item.fulfillment_rate.toFixed(1)}%</td>
                <td>
                    <span className={`status-badge ${statusClass}`}>
                        {statusLabel}
                    </span>
                </td>
            </tr>
        );
    };

    return (
        <div className="gap-analysis-container">
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

            {/* Main Content */}
            <div className="main-content gap-main-content">
                <div className="content-header gap-content-header">
                    <h2>Supply-Demand Gap Analysis</h2>
                    <p>Compare regional allocation vs farmer requests to identify shortages and surpluses</p>
                </div>

                {/* Season Selector */}
                <div className="season-selector">
                    <label>Select Season:</label>
                    <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(e.target.value)}
                        disabled={loading}
                    >
                        <option value="dry_2024">Dry Season 2024</option>
                        <option value="wet_2024">Wet Season 2024</option>
                        <option value="dry_2025">Dry Season 2025</option>
                        <option value="wet_2025">Wet Season 2025</option>
                        <option value="dry_2026">Dry Season 2026</option>
                        <option value="wet_2026">Wet Season 2026</option>
                    </select>
                    <button onClick={fetchGapAnalysis} disabled={loading} className="refresh-btn">
                        🔄 Refresh
                    </button>
                </div>

                {loading && (
                    <div className="loading-message">
                        Loading gap analysis data...
                    </div>
                )}

                {error && (
                    <div className="error-message">
                        ⚠️ {error}
                    </div>
                )}

                {!loading && !error && gapData && (
                    <>
                        {/* Summary Cards */}
                        <div className="summary-cards">
                            <div className="summary-card">
                                <h3>Allocation Date</h3>
                                <p className="summary-value">
                                    {new Date(gapData.allocation_date).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <div className="summary-card">
                                <h3>Season</h3>
                                <p className="summary-value">{gapData.season.replace('_', ' ').toUpperCase()}</p>
                            </div>
                        </div>

                        {/* Fertilizers Gap Analysis */}
                        <div className="gap-card">
                            <h3>Fertilizers (50kg bags)</h3>
                            <div className="table-container">
                                <table className="gap-table">
                                    <thead>
                                        <tr>
                                            <th>Fertilizer Type</th>
                                            <th>Allocated</th>
                                            <th>Requested</th>
                                            <th>Gap</th>
                                            <th>Fulfillment Rate</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {renderGapRow('Euria', gapData.fertilizers.urea_46_0_0, 'bags')}
                                        {renderGapRow('4600', gapData.fertilizers.complete_14_14_14, 'bags')}
                                        {renderGapRow('141414', gapData.fertilizers.complete_16_16_16, 'bags')}
                                        {renderGapRow('0060', gapData.fertilizers.ammonium_sulfate_21_0_0, 'bags')}
                                        {renderGapRow('Other Fertilizer 1', gapData.fertilizers.ammonium_phosphate_16_20_0, 'bags')}
                                        {renderGapRow('Other Fertilizer 2', gapData.fertilizers.muriate_potash_0_0_60, 'bags')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Seeds Gap Analysis */}
                        <div className="gap-card">
                            <h3>Seeds (kilograms)</h3>
                            <div className="table-container">
                                <table className="gap-table">
                                    <thead>
                                        <tr>
                                            <th>Seed Type</th>
                                            <th>Allocated</th>
                                            <th>Requested</th>
                                            <th>Gap</th>
                                            <th>Fulfillment Rate</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {renderGapRow('Jackpot', gapData.seeds.rice_nsic_rc160, 'kg')}
                                        {renderGapRow('US88', gapData.seeds.rice_nsic_rc222, 'kg')}
                                        {renderGapRow('TH82', gapData.seeds.rice_nsic_rc440, 'kg')}
                                        {renderGapRow('RH9000', gapData.seeds.corn_hybrid, 'kg')}
                                        {renderGapRow('Lumping143', gapData.seeds.corn_opm, 'kg')}
                                        {renderGapRow('LP296', gapData.seeds.vegetable, 'kg')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="legend-card">
                            <h4>Status Legend:</h4>
                            <div className="legend-items">
                                <div className="legend-item">
                                    <span className="status-badge status-shortage">Shortage</span>
                                    <span>Requests exceed allocation (need more supply)</span>
                                </div>
                                <div className="legend-item">
                                    <span className="status-badge status-balanced">Balanced</span>
                                    <span>Allocation matches requests exactly</span>
                                </div>
                                <div className="legend-item">
                                    <span className="status-badge status-surplus">Surplus</span>
                                    <span>Allocation exceeds requests (extra supply available)</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {!loading && !error && !gapData && (
                    <div className="no-data-message">
                        <p>📊 No data available for {selectedSeason}</p>
                        <p>Please ensure:</p>
                        <ul>
                            <li>Regional allocation has been entered</li>
                            <li>Farmer requests have been submitted</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JoGapAnalysis;
