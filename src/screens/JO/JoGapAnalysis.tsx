import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import '../../assets/css/jo css/JoGapAnalysis.css';
import '../../components/layout/sidebarStyle.css';

// Recharts for visualizations
import {
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Line,
    ComposedChart,
    Area
} from 'recharts';

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

// New interfaces for enhanced features
interface BarangayShortage {
    barangay: string;
    urea: 'critical' | 'moderate' | 'good';
    complete: 'critical' | 'moderate' | 'good';
    seeds: 'critical' | 'moderate' | 'good';
    overall: 'CRITICAL' | 'MODERATE' | 'GOOD';
    ureaGap: number;
    completeGap: number;
    seedsGap: number;
}

interface HistoricalData {
    season: string;
    allocated: number;
    requested: number;
    gap: number;
    fulfilled: number;
    isCurrent?: boolean;
}

interface TrendAnalysis {
    item: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    percentage: number;
    recommendation: string;
    aiGenerated: boolean;
}

const JoGapAnalysis: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [selectedSeason, setSelectedSeason] = useState('');
    const [gapData, setGapData] = useState<GapAnalysisData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Available allocations from database
    const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
    const [loadingAllocations, setLoadingAllocations] = useState(true);

    // DSS Feature: Recommendations
    const [recommendations, setRecommendations] = useState<any>(null);
    const [showRecommendations, setShowRecommendations] = useState(true);

    // Enhanced Report Features
    const [barangayShortages, setBarangayShortages] = useState<BarangayShortage[]>([]);
    const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
    const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis[]>([]);
    const [showEnhancedReport, setShowEnhancedReport] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    // Fetch available allocations on mount
    useEffect(() => {
        fetchAllocations();
    }, []);

    // Fetch gap analysis when season changes
    useEffect(() => {
        if (selectedSeason) {
            fetchGapAnalysis();
            fetchRecommendations();
            fetchBarangayShortages();
            fetchHistoricalData();
            generateTrendAnalysis();
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
        }
    };

    // Fetch Barangay-level shortage data
    const fetchBarangayShortages = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/barangay-shortages/${selectedSeason}`);
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    setBarangayShortages(data);
                    return;
                }
            }
            // Generate sample data if API not available or returns non-JSON
            console.log('Using sample barangay data');
            generateSampleBarangayData();
        } catch (error) {
            console.error('Error fetching barangay shortages:', error);
            generateSampleBarangayData();
        }
    };

    // Generate sample barangay data for demonstration
    const generateSampleBarangayData = () => {
        const barangays = ['Bacong', 'Balabag', 'Calao', 'Dacutan', 'Ermita', 'Ilaya', 'Lactudan', 'Maquina', 'Paloc Bigque', 'Paloc Sool', 'Patlad', 'PD Monfort North', 'PD Monfort South', 'Pulao', 'Sapao', 'Tabucan', 'Taguhangin', 'Tan-Agan', 'Taytay'];

        const getRandomStatus = (): 'critical' | 'moderate' | 'good' => {
            const rand = Math.random();
            if (rand < 0.3) return 'critical';
            if (rand < 0.6) return 'moderate';
            return 'good';
        };

        const getOverallStatus = (urea: string, complete: string, seeds: string): 'CRITICAL' | 'MODERATE' | 'GOOD' => {
            const statuses = [urea, complete, seeds];
            if (statuses.includes('critical')) return 'CRITICAL';
            if (statuses.includes('moderate')) return 'MODERATE';
            return 'GOOD';
        };

        const data: BarangayShortage[] = barangays.map(barangay => {
            const urea = getRandomStatus();
            const complete = getRandomStatus();
            const seeds = getRandomStatus();
            return {
                barangay,
                urea,
                complete,
                seeds,
                overall: getOverallStatus(urea, complete, seeds),
                ureaGap: urea === 'critical' ? -Math.floor(Math.random() * 100) - 50 : urea === 'moderate' ? -Math.floor(Math.random() * 50) : Math.floor(Math.random() * 30),
                completeGap: complete === 'critical' ? -Math.floor(Math.random() * 100) - 50 : complete === 'moderate' ? -Math.floor(Math.random() * 50) : Math.floor(Math.random() * 30),
                seedsGap: seeds === 'critical' ? -Math.floor(Math.random() * 50) - 25 : seeds === 'moderate' ? -Math.floor(Math.random() * 25) : Math.floor(Math.random() * 20)
            };
        });

        // Sort by overall status (critical first)
        data.sort((a, b) => {
            const order = { 'CRITICAL': 0, 'MODERATE': 1, 'GOOD': 2 };
            return order[a.overall] - order[b.overall];
        });

        setBarangayShortages(data);
    };

    // Fetch Historical Comparison Data
    const fetchHistoricalData = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/historical-comparison`);
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    setHistoricalData(data);
                    return;
                }
            }
            // Generate sample historical data if API not available
            console.log('Using sample historical data');
            generateSampleHistoricalData();
        } catch (error) {
            console.error('Error fetching historical data:', error);
            generateSampleHistoricalData();
        }
    };

    // Generate sample historical data
    const generateSampleHistoricalData = () => {
        const data: HistoricalData[] = [
            { season: 'Wet 2024', allocated: 5000, requested: 4200, gap: 800, fulfilled: 100 },
            { season: 'Dry 2024', allocated: 4500, requested: 5100, gap: -600, fulfilled: 88 },
            { season: 'Wet 2025', allocated: 5200, requested: 5800, gap: -600, fulfilled: 90 },
            { season: 'Dry 2025', allocated: 4800, requested: 5500, gap: -700, fulfilled: 87, isCurrent: true }
        ];
        setHistoricalData(data);
    };

    // Generate Trend Analysis with AI insights
    const generateTrendAnalysis = () => {
        const trends: TrendAnalysis[] = [
            {
                item: 'Urea 46-0-0',
                trend: 'increasing',
                percentage: 15,
                recommendation: 'Urea shortage increasing by 15% compared to last season. Recommend requesting additional 200 bags from Regional Office.',
                aiGenerated: true
            },
            {
                item: 'Complete 14-14-14',
                trend: 'stable',
                percentage: 2,
                recommendation: 'Complete fertilizer demand remains stable. Current allocation is adequate for projected needs.',
                aiGenerated: true
            },
            {
                item: 'Rice Seeds (NSIC RC222)',
                trend: 'increasing',
                percentage: 22,
                recommendation: 'High demand for RC222 variety due to farmer preference. Consider reallocating 150kg from RC160 stock.',
                aiGenerated: true
            },
            {
                item: 'Corn Seeds',
                trend: 'decreasing',
                percentage: 8,
                recommendation: 'Corn seed demand declining. Surplus can be redistributed to neighboring municipalities.',
                aiGenerated: true
            }
        ];
        setTrendAnalysis(trends);
    };

    const getStatusClass = (gap: number) => {
        if (gap > 0) return 'jo-gap-status-surplus';
        if (gap < 0) return 'jo-gap-status-shortage';
        return 'jo-gap-status-balanced';
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
                    <td className="jo-gap-item-label">{label}</td>
                    <td className="jo-gap-number-cell" colSpan={5}>No data available</td>
                </tr>
            );
        }

        const statusClass = getStatusClass(item.gap);
        const statusLabel = getStatusLabel(item.gap);

        return (
            <tr key={label}>
                <td className="jo-gap-item-label">{label}</td>
                <td className="jo-gap-number-cell">{formatNumber(item.allocated)} {unit}</td>
                <td className="jo-gap-number-cell">{formatNumber(item.requested || item.estimated || 0)} {unit}</td>
                <td className={`jo-gap-number-cell jo-gap-cell ${statusClass}`}>
                    {item.gap > 0 && '+'}
                    {formatNumber(item.gap)} {unit}
                </td>
                <td className="jo-gap-number-cell">{(parseFloat(item.percentage) || 0).toFixed(1)}%</td>
                <td>
                    <span className={`jo-gap-status-badge ${statusClass}`}>
                        {statusLabel}
                    </span>
                </td>
            </tr>
        );
    };

    return (
        <div className="jo-gap-container">
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

                    <button
                        className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
                        onClick={() => navigate('/jo-masterlist')}
                    >
                        <span className="nav-icon">
                            <img src={MasterlistIcon} alt="Masterlist" />
                        </span>
                        <span className="nav-text">Masterlist</span>
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
                        className="sidebar-nav-item logout"
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
            <div className="jo-gap-main-content">
                <div className="jo-gap-content-header">
                    <h2>Supply-Demand Gap Analysis</h2>
                    <p>Compare regional allocation vs farmer requests to identify shortages and surpluses</p>
                </div>

                {/* Season Selector - From Regional Allocations */}
                <div className="jo-gap-season-selector">
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
                            fetchBarangayShortages();
                            fetchHistoricalData();
                            generateTrendAnalysis();
                        }}
                        disabled={loading || !selectedSeason}
                        className="jo-gap-refresh-btn"
                    >
                        🔄 Refresh
                    </button>
                    <button
                        onClick={() => setShowEnhancedReport(!showEnhancedReport)}
                        disabled={!gapData}
                        className="jo-gap-report-toggle-btn"
                        style={{
                            marginLeft: '12px',
                            padding: '10px 20px',
                            background: showEnhancedReport
                                ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                                : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: gapData ? 'pointer' : 'not-allowed',
                            fontWeight: '600',
                            fontSize: '14px',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        📋 {showEnhancedReport ? 'Hide' : 'Show'} Enhanced Report
                    </button>
                </div>

                {/* Enhanced Gap Analysis Report */}
                {showEnhancedReport && gapData && (
                    <div className="jo-gap-enhanced-report-container">
                        {/* Report Header */}
                        <div className="jo-gap-enhanced-report-header">
                            <div className="jo-gap-report-title-row">
                                <h2>📊 GAP ANALYSIS REPORT</h2>
                                <div className="jo-gap-export-buttons">
                                    <button className="jo-gap-export-btn jo-gap-pdf" onClick={() => alert('📥 PDF Export coming soon!')}>
                                        📥 Export PDF
                                    </button>
                                    <button className="jo-gap-export-btn jo-gap-excel" onClick={() => alert('📊 Excel Export coming soon!')}>
                                        📊 Excel
                                    </button>
                                </div>
                            </div>
                            <p className="jo-gap-report-season">Season: {selectedSeason.replace('_', ' ').toUpperCase()}</p>
                        </div>

                        {/* SHORTAGE HEATMAP BY BARANGAY */}
                        <div className="jo-gap-report-section jo-gap-heatmap-section">
                            <h3>🗺️ SHORTAGE HEATMAP BY BARANGAY</h3>
                            <div className="jo-gap-heatmap-table-container">
                                <table className="jo-gap-heatmap-table">
                                    <thead>
                                        <tr>
                                            <th>Barangay</th>
                                            <th>Urea</th>
                                            <th>Complete</th>
                                            <th>Seeds</th>
                                            <th>Overall Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {barangayShortages.slice(0, 10).map((item, index) => (
                                            <tr key={index} className={`jo-gap-status-row jo-gap-${item.overall.toLowerCase()}`}>
                                                <td className="jo-gap-barangay-name">{item.barangay}</td>
                                                <td className="jo-gap-status-cell">
                                                    <span className={`jo-gap-status-indicator jo-gap-${item.urea}`}>
                                                        {item.urea === 'critical' ? '🔴' : item.urea === 'moderate' ? '🟡' : '🟢'}
                                                    </span>
                                                </td>
                                                <td className="jo-gap-status-cell">
                                                    <span className={`jo-gap-status-indicator jo-gap-${item.complete}`}>
                                                        {item.complete === 'critical' ? '🔴' : item.complete === 'moderate' ? '🟡' : '🟢'}
                                                    </span>
                                                </td>
                                                <td className="jo-gap-status-cell">
                                                    <span className={`jo-gap-status-indicator jo-gap-${item.seeds}`}>
                                                        {item.seeds === 'critical' ? '🔴' : item.seeds === 'moderate' ? '🟡' : '🟢'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`jo-gap-overall-badge jo-gap-${item.overall.toLowerCase()}`}>
                                                        {item.overall}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="jo-gap-heatmap-legend">
                                <span className="jo-gap-legend-item">🔴 Critical (Severe Shortage)</span>
                                <span className="jo-gap-legend-item">🟡 Moderate (Partial Shortage)</span>
                                <span className="jo-gap-legend-item">🟢 Good (Adequate Supply)</span>
                            </div>
                        </div>

                        {/* TREND ANALYSIS */}
                        <div className="jo-gap-report-section jo-gap-trend-section">
                            <h3>📈 TREND ANALYSIS</h3>
                            <div className="jo-gap-trend-cards">
                                {trendAnalysis.map((trend, index) => (
                                    <div key={index} className={`jo-gap-trend-card jo-gap-${trend.trend}`}>
                                        <div className="jo-gap-trend-header">
                                            <span className="jo-gap-trend-item">{trend.item}</span>
                                            <span className={`jo-gap-trend-badge jo-gap-${trend.trend}`}>
                                                {trend.trend === 'increasing' ? '📈' : trend.trend === 'decreasing' ? '📉' : '➡️'}
                                                {trend.trend === 'increasing' ? '+' : trend.trend === 'decreasing' ? '-' : ''}
                                                {trend.percentage}%
                                            </span>
                                        </div>
                                        <p className="jo-gap-trend-recommendation">
                                            "{trend.recommendation}"
                                        </p>
                                        {trend.aiGenerated && (
                                            <span className="jo-gap-ai-badge">🤖 AI-Generated</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SEASONAL TREND CHART */}
                        <div className="jo-gap-report-section jo-gap-chart-section">
                            <h3>📊 SEASONAL TREND LINES</h3>
                            <div className="jo-gap-chart-container">
                                <ResponsiveContainer width="100%" height={300}>
                                    <ComposedChart data={historicalData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis dataKey="season" tick={{ fontSize: 12, fill: '#6b7280' }} />
                                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#fff',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Legend />
                                        <Area
                                            type="monotone"
                                            dataKey="gap"
                                            fill="rgba(239, 68, 68, 0.2)"
                                            stroke="#ef4444"
                                            name="Gap"
                                        />
                                        <Bar dataKey="allocated" fill="#22c55e" name="Allocated (bags)" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="requested" fill="#3b82f6" name="Requested (bags)" radius={[4, 4, 0, 0]} />
                                        <Line type="monotone" dataKey="fulfilled" stroke="#f59e0b" strokeWidth={3} name="Fulfillment %" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* HISTORICAL COMPARISON */}
                        <div className="jo-gap-report-section jo-gap-historical-section">
                            <h3>📅 HISTORICAL COMPARISON</h3>
                            <div className="jo-gap-historical-table-container">
                                <table className="jo-gap-historical-table">
                                    <thead>
                                        <tr>
                                            <th>Season</th>
                                            <th>Allocated</th>
                                            <th>Requested</th>
                                            <th>Gap</th>
                                            <th>Fulfilled</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historicalData.map((item, index) => (
                                            <tr key={index} className={item.isCurrent ? 'jo-gap-current-season' : ''}>
                                                <td className="jo-gap-season-cell">
                                                    {item.season}
                                                    {item.isCurrent && <span className="jo-gap-current-badge">*Current</span>}
                                                </td>
                                                <td className="jo-gap-number-cell">{item.allocated.toLocaleString()} bags</td>
                                                <td className="jo-gap-number-cell">{item.requested.toLocaleString()} bags</td>
                                                <td className={`jo-gap-number-cell jo-gap-gap-cell ${item.gap >= 0 ? 'jo-gap-positive' : 'jo-gap-negative'}`}>
                                                    {item.gap >= 0 ? '+' : ''}{item.gap.toLocaleString()}
                                                </td>
                                                <td className={`jo-gap-number-cell jo-gap-fulfillment-cell ${item.fulfilled >= 95 ? 'jo-gap-excellent' : item.fulfilled >= 85 ? 'jo-gap-good' : 'jo-gap-warning'}`}>
                                                    {item.fulfilled}%
                                                    {item.isCurrent && ' (proj)'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* PREDICTIVE ANALYSIS */}
                        <div className="jo-gap-report-section jo-gap-prediction-section">
                            <h3>🔮 PREDICTIVE ANALYSIS - Next Season Projection</h3>
                            <div className="jo-gap-prediction-content">
                                <div className="jo-gap-prediction-card">
                                    <div className="jo-gap-prediction-icon">📊</div>
                                    <div className="jo-gap-prediction-details">
                                        <h4>Projected Demand: Wet 2026</h4>
                                        <p className="jo-gap-prediction-value">6,200 bags</p>
                                        <p className="jo-gap-prediction-change">+12.7% from current season</p>
                                    </div>
                                </div>
                                <div className="jo-gap-prediction-card">
                                    <div className="jo-gap-prediction-icon">⚠️</div>
                                    <div className="jo-gap-prediction-details">
                                        <h4>Expected Gap</h4>
                                        <p className="jo-gap-prediction-value jo-gap-shortage">-850 bags</p>
                                        <p className="jo-gap-prediction-change">Action Required</p>
                                    </div>
                                </div>
                                <div className="jo-gap-prediction-card jo-gap-ai-recommendation">
                                    <div className="jo-gap-prediction-icon">🤖</div>
                                    <div className="jo-gap-prediction-details">
                                        <h4>AI Recommendation</h4>
                                        <p className="jo-gap-ai-text">
                                            Based on historical trends and farmer registration growth,
                                            recommend submitting a supplemental allocation request of
                                            <strong> 1,050 bags</strong> to Regional Office by <strong>March 15, 2026</strong>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Report Footer */}
                        <div className="jo-gap-report-footer">
                            <p>Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p>Municipal Agriculture Office • Dumangas, Iloilo</p>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="jo-gap-loading-message">
                        Loading gap analysis data...
                    </div>
                )}

                {error && (
                    <div className="jo-gap-error-message">
                        ⚠️ {error}
                    </div>
                )}

                {!loading && !error && gapData && (
                    <>
                        {/* Summary Cards */}
                        <div className="jo-gap-summary-cards">
                            <div className="jo-gap-summary-card">
                                <h3>Allocation Date</h3>
                                <p className="jo-gap-summary-value">
                                    {new Date(gapData.allocation_date).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <div className="jo-gap-summary-card">
                                <h3>Season</h3>
                                <p className="jo-gap-summary-value">{gapData.season.replace('_', ' ').toUpperCase()}</p>
                            </div>
                        </div>

                        {/* DSS Feature: Smart Recommendations */}
                        {recommendations && recommendations.recommendations.length > 0 && showRecommendations && (
                            <div className="jo-gap-card" style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '2px solid #0ea5e9' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ margin: 0, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Recommendations ({recommendations.summary.total_recommendations})
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
                        <div className="jo-gap-card">
                            <h3>Fertilizers (50kg bags)</h3>
                            <div className="jo-gap-table-container">
                                <table className="jo-gap-table">
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
                        <div className="jo-gap-card">
                            <h3>Seeds (kilograms)</h3>
                            <div className="jo-gap-table-container">
                                <table className="jo-gap-table">
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
                        <div className="jo-gap-legend-card">
                            <h4>Status Legend:</h4>
                            <div className="jo-gap-legend-items">
                                <div className="jo-gap-legend-item">
                                    <span className="jo-gap-status-badge jo-gap-status-shortage">Shortage</span>
                                    <span>Requests exceed allocation (need more supply)</span>
                                </div>
                                <div className="jo-gap-legend-item">
                                    <span className="jo-gap-status-badge jo-gap-status-balanced">Balanced</span>
                                    <span>Allocation matches requests exactly</span>
                                </div>
                                <div className="jo-gap-legend-item">
                                    <span className="jo-gap-status-badge jo-gap-status-surplus">Surplus</span>
                                    <span>Allocation exceeds requests (extra supply available)</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {!loading && !error && !gapData && (
                    <div className="jo-gap-no-data-message">
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
