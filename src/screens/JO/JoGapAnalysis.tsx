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
import '../../components/layout/sidebarStyle.css';

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

interface RegionalAllocation {
    id: number;
    season: string;
    allocation_date: string;
    status: string;
}

const JoGapAnalysis: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [selectedSeason, setSelectedSeason] = useState('');
    const [gapData, setGapData] = useState<GapAnalysisData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Available allocations from database
    const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
    const [loadingAllocations, setLoadingAllocations] = useState(true);

    // DSS Feature: Recommendations
    const [recommendations, setRecommendations] = useState<any>(null);
    const [loadingRecs, setLoadingRecs] = useState(false);
    const [showRecommendations, setShowRecommendations] = useState(true);

    const isActive = (path: string) => {
        return window.location.pathname === path;
    };

    // Fetch available allocations on mount
    useEffect(() => {
        fetchAllocations();
    }, []);

    // Fetch gap analysis when season changes
    useEffect(() => {
        if (selectedSeason) {
            fetchGapAnalysis();
            fetchRecommendations();
        }
    }, [selectedSeason]);

    const fetchAllocations = async () => {
        setLoadingAllocations(true);
        try {
            const response = await fetch('http://localhost:5000/api/distribution/allocations');
            if (response.ok) {
                const data = await response.json();
                setAllocations(data);
                // Auto-select the most recent allocation
                if (data.length > 0) {
                    const mostRecent = data.sort((a: RegionalAllocation, b: RegionalAllocation) =>
                        new Date(b.allocation_date).getTime() - new Date(a.allocation_date).getTime()
                    )[0];
                    setSelectedSeason(mostRecent.season);
                }
            }
        } catch (error) {
            console.error('Error fetching allocations:', error);
        } finally {
            setLoadingAllocations(false);
        }
    };

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

    // DSS Feature: Fetch recommendations
    const fetchRecommendations = async () => {
        setLoadingRecs(true);
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/recommendations/${selectedSeason}`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Recommendations loaded:', data);
                setRecommendations(data);
            } else {
                console.log('No recommendations available');
                setRecommendations(null);
            }
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            setRecommendations(null);
        } finally {
            setLoadingRecs(false);
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

    const renderGapRow = (label: string, item: any, unit: string) => {
        // Safety check: return empty row if item is undefined
        if (!item) {
            return (
                <tr key={label}>
                    <td className="item-label">{label}</td>
                    <td className="number-cell" colSpan={5}>No data available</td>
                </tr>
            );
        }

        const statusClass = getStatusClass(item.gap);
        const statusLabel = getStatusLabel(item.gap);

        return (
            <tr key={label}>
                <td className="item-label">{label}</td>
                <td className="number-cell">{formatNumber(item.allocated)} {unit}</td>
                <td className="number-cell">{formatNumber(item.requested || item.estimated || 0)} {unit}</td>
                <td className={`number-cell gap-cell ${statusClass}`}>
                    {item.gap > 0 && '+'}
                    {formatNumber(item.gap)} {unit}
                </td>
                <td className="number-cell">{(parseFloat(item.percentage) || 0).toFixed(1)}%</td>
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

                {/* Season Selector - From Regional Allocations */}
                <div className="season-selector">
                    <label>Select Regional Allocation:</label>
                    <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(e.target.value)}
                        disabled={loading || loadingAllocations}
                    >
                        {loadingAllocations ? (
                            <option value="">Loading allocations...</option>
                        ) : allocations.length === 0 ? (
                            <option value="">No allocations found</option>
                        ) : (
                            <>
                                <option value="">-- Select an allocation --</option>
                                {allocations.map((alloc) => (
                                    <option key={alloc.id} value={alloc.season}>
                                        {alloc.season.replace('_', ' ').toUpperCase()} - {new Date(alloc.allocation_date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })} ({alloc.status})
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                    <button
                        onClick={() => {
                            fetchGapAnalysis();
                            fetchRecommendations();
                        }}
                        disabled={loading || !selectedSeason}
                        className="refresh-btn"
                    >
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

                        {/* DSS Feature: Smart Recommendations */}
                        {recommendations && recommendations.recommendations.length > 0 && showRecommendations && (
                            <div className="gap-card" style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '2px solid #0ea5e9' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ margin: 0, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        🤖 Smart Recommendations ({recommendations.summary.total_recommendations})
                                    </h3>
                                    <button
                                        onClick={() => setShowRecommendations(false)}
                                        style={{
                                            padding: '6px 12px',
                                            background: '#64748b',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Hide
                                    </button>
                                </div>

                                {/* Summary Stats */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                                    {recommendations.summary.critical_issues > 0 && (
                                        <div style={{ padding: '12px', background: '#fee2e2', borderRadius: '6px', border: '1px solid #dc2626' }}>
                                            <div style={{ fontSize: '12px', color: '#991b1b' }}>🔴 Critical</div>
                                            <div style={{ fontSize: '24px', fontWeight: '600', color: '#991b1b' }}>{recommendations.summary.critical_issues}</div>
                                        </div>
                                    )}
                                    {recommendations.summary.high_priority_issues > 0 && (
                                        <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '6px', border: '1px solid #f59e0b' }}>
                                            <div style={{ fontSize: '12px', color: '#92400e' }}>🟠 High Priority</div>
                                            <div style={{ fontSize: '24px', fontWeight: '600', color: '#92400e' }}>{recommendations.summary.high_priority_issues}</div>
                                        </div>
                                    )}
                                    <div style={{ padding: '12px', background: '#fee2e2', borderRadius: '6px', border: '1px solid #ef4444' }}>
                                        <div style={{ fontSize: '12px', color: '#991b1b' }}>Shortages</div>
                                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#991b1b' }}>{recommendations.summary.shortages}</div>
                                    </div>
                                    <div style={{ padding: '12px', background: '#d1fae5', borderRadius: '6px', border: '1px solid #10b981' }}>
                                        <div style={{ fontSize: '12px', color: '#065f46' }}>Opportunities</div>
                                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#065f46' }}>{recommendations.summary.opportunities}</div>
                                    </div>
                                </div>

                                {/* Recommendations List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {recommendations.recommendations.slice(0, 5).map((rec: any) => (
                                        <div key={rec.id} style={{
                                            background: 'white',
                                            padding: '16px',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb',
                                            borderLeft: `4px solid ${rec.priority === 'CRITICAL' ? '#dc2626' : rec.priority === 'HIGH' ? '#f59e0b' : rec.priority === 'MEDIUM' ? '#3b82f6' : '#10b981'}`
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                                <h4 style={{ margin: 0, fontSize: '16px', color: '#1f2937' }}>
                                                    {rec.priority === 'CRITICAL' && '🔴'}
                                                    {rec.priority === 'HIGH' && '🟠'}
                                                    {rec.priority === 'MEDIUM' && '🔵'}
                                                    {rec.priority === 'LOW' && '🟢'}
                                                    {' '}{rec.title}
                                                </h4>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    background: rec.type === 'SHORTAGE' ? '#fee2e2' : rec.type === 'OPPORTUNITY' ? '#d1fae5' : '#fef3c7',
                                                    color: rec.type === 'SHORTAGE' ? '#991b1b' : rec.type === 'OPPORTUNITY' ? '#065f46' : '#92400e'
                                                }}>
                                                    {rec.type.replace('_', ' ')}
                                                </span>
                                            </div>

                                            <p style={{ margin: '8px 0', fontSize: '14px', color: '#4b5563' }}>
                                                {rec.description}
                                            </p>

                                            {rec.actions && rec.actions.length > 0 && (
                                                <details style={{ marginTop: '12px' }}>
                                                    <summary style={{ cursor: 'pointer', color: '#0369a1', fontSize: '13px', fontWeight: '600' }}>
                                                        View {rec.actions.length} Recommended Action{rec.actions.length > 1 ? 's' : ''}
                                                    </summary>
                                                    <div style={{ marginTop: '8px', paddingLeft: '16px' }}>
                                                        {rec.actions.map((action: any, actIdx: number) => (
                                                            <div key={actIdx} style={{
                                                                marginBottom: '12px',
                                                                paddingBottom: '12px',
                                                                borderBottom: actIdx < rec.actions.length - 1 ? '1px solid #e5e7eb' : 'none'
                                                            }}>
                                                                <div style={{ fontWeight: '600', fontSize: '13px', color: '#059669', marginBottom: '4px' }}>
                                                                    ✓ {action.action}
                                                                </div>
                                                                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                                                                    <strong>Why:</strong> {action.rationale}
                                                                </div>
                                                                {action.implementation && (
                                                                    <div style={{ fontSize: '12px', color: '#4b5563' }}>
                                                                        <strong>How:</strong> {action.implementation}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {recommendations.recommendations.length > 5 && (
                                    <div style={{ marginTop: '12px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                                        Showing top 5 of {recommendations.recommendations.length} recommendations
                                    </div>
                                )}
                            </div>
                        )}

                        {!showRecommendations && recommendations && (
                            <button
                                onClick={() => setShowRecommendations(true)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    marginBottom: '20px'
                                }}
                            >
                                🤖 Show Smart Recommendations ({recommendations.recommendations.length})
                            </button>
                        )}

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
                                        {renderGapRow('Urea 46-0-0', (gapData as any).fertilizer_gap?.urea, 'bags')}
                                        {renderGapRow('Complete 14-14-14', (gapData as any).fertilizer_gap?.complete_14_14_14, 'bags')}
                                        {renderGapRow('Ammonium Sulfate 21-0-0', (gapData as any).fertilizer_gap?.ammonium_sulfate, 'bags')}
                                        {renderGapRow('Muriate of Potash 0-0-60', (gapData as any).fertilizer_gap?.muriate_potash, 'bags')}
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
                                        {renderGapRow('Rice Seeds', (gapData as any).seeds_gap?.rice_seeds, 'kg')}
                                        {renderGapRow('Corn Seeds', (gapData as any).seeds_gap?.corn_seeds, 'kg')}
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
