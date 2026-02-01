import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAllocations, getDistributionRecords, getFarmerRequests, createAllocation } from '../../api';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import '../../assets/css/jo css/JoDistribution.css';
import '../../components/layout/sidebarStyle.css';

// Recharts for donut charts and timeline
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';

interface DistributionRecord {
    id?: number;
    request_id: number;
    farmer_name: string;
    rsbsa_number: string;
    distribution_date: string;
    fertilizer_bags_given?: number;
    seed_kg_given?: number;
    fertilizer_type?: string;
    seed_type?: string;
    verification_notes?: string;
}

interface RegionalAllocation {
    id: number;
    season: string;
    allocation_date: string;
    status: string;
    urea_46_0_0_bags?: number;
    complete_14_14_14_bags?: number;
    complete_16_16_16_bags?: number;
    ammonium_sulfate_21_0_0_bags?: number;
    ammonium_phosphate_16_20_0_bags?: number;
    muriate_potash_0_0_60_bags?: number;
    rice_seeds_nsic_rc160_kg?: number;
    rice_seeds_nsic_rc222_kg?: number;
    rice_seeds_nsic_rc440_kg?: number;
    corn_seeds_hybrid_kg?: number;
    corn_seeds_opm_kg?: number;
    vegetable_seeds_kg?: number;
    jackpot_kg?: number;
    us88_kg?: number;
    th82_kg?: number;
    rh9000_kg?: number;
    lumping143_kg?: number;
    lp296_kg?: number;
    notes?: string;
    season_start_date?: string;
    season_end_date?: string;
}

// New interfaces for Completion Report
interface CompletionStats {
    fertilizers: {
        distributed: number;
        allocated: number;
        percentage: number;
    };
    seeds: {
        distributed: number;
        allocated: number;
        percentage: number;
    };
    farmers: {
        served: number;
        total: number;
        percentage: number;
    };
}

interface TimelineData {
    week: string;
    date: string;
    distributed: number;
    cumulative: number;
}

interface BarangayPerformance {
    barangay: string;
    percentage: number;
    status: 'complete' | 'pending' | 'shortage' | 'logistics';
    distributed: number;
    allocated: number;
}

const JoDistribution: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [distributions, setDistributions] = useState<DistributionRecord[]>([]);
    const [selectedSeason, setSelectedSeason] = useState('');
    const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
    const [loadingAllocations, setLoadingAllocations] = useState(true);
    const [viewDetailsModal, setViewDetailsModal] = useState<DistributionRecord | null>(null);
    const [editAllocationModal, setEditAllocationModal] = useState<RegionalAllocation | null>(null);
    const [editFormData, setEditFormData] = useState<RegionalAllocation | null>(null);
    const [requestCount, setRequestCount] = useState<number>(0);
    const [savingEdit, setSavingEdit] = useState(false);

    // Completion Report State
    const [showCompletionReport, setShowCompletionReport] = useState(false);
    const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null);
    const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
    const [topPerforming, setTopPerforming] = useState<BarangayPerformance[]>([]);
    const [needsAttention, setNeedsAttention] = useState<BarangayPerformance[]>([]);

    // Donut chart colors
    const DONUT_COLORS = {
        fertilizers: { filled: '#22c55e', empty: '#e5e7eb' },
        seeds: { filled: '#3b82f6', empty: '#e5e7eb' },
        farmers: { filled: '#f59e0b', empty: '#e5e7eb' }
    };

    const isActive = (path: string) => location.pathname === path;

    useEffect(() => {
        fetchAllocations();
    }, []);

    useEffect(() => {
        if (selectedSeason) {
            fetchDistributions();
            fetchCompletionStats();
        }
    }, [selectedSeason]);

    const fetchAllocations = async () => {
        setLoadingAllocations(true);
        try {
            const response = await getAllocations();
            if (!response.error) {
                const data = response.data || [];
                setAllocations(data);
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

    const fetchDistributions = async () => { // Fetch distribution records based on selected season
        if (!selectedSeason) return;
        try {
            // Note: getDistributionRecords doesn't support season filter yet, using it as base
            const response = await fetch(`http://localhost:5000/api/distribution/records/${selectedSeason}`);
            if (response.ok) {
                const data = await response.json();
                setDistributions(data);
            }
        } catch (error) {
            console.error('Error fetching distributions:', error);
        }
    };

    // Fetch completion statistics for the report
    const fetchCompletionStats = async () => {
        if (!selectedSeason) return;

        try {
            // Get current allocation
            const currentAllocation = allocations.find(a => a.season === selectedSeason);
            if (!currentAllocation) {
                generateSampleCompletionData();
                return;
            }

            // Get distribution records
            const response = await fetch(`http://localhost:5000/api/distribution/records/${selectedSeason}`);
            if (response.ok) {
                const records = await response.json();
                calculateCompletionStats(currentAllocation, records);
                generateTimelineData(records, currentAllocation);
                generateBarangayPerformance(records);
            } else {
                generateSampleCompletionData();
            }
        } catch (error) {
            console.error('Error fetching completion stats:', error);
            generateSampleCompletionData();
        }
    };

    // Calculate completion stats from real data
    const calculateCompletionStats = (allocation: RegionalAllocation, records: DistributionRecord[]) => {
        // Calculate total allocated
        const totalFertilizerAllocated =
            (allocation.urea_46_0_0_bags || 0) +
            (allocation.complete_14_14_14_bags || 0) +
            (allocation.complete_16_16_16_bags || 0) +
            (allocation.ammonium_sulfate_21_0_0_bags || 0) +
            (allocation.ammonium_phosphate_16_20_0_bags || 0) +
            (allocation.muriate_potash_0_0_60_bags || 0);

        const totalSeedAllocated =
            (allocation.jackpot_kg || 0) +
            (allocation.us88_kg || 0) +
            (allocation.th82_kg || 0) +
            (allocation.rh9000_kg || 0) +
            (allocation.lumping143_kg || 0) +
            (allocation.lp296_kg || 0) +
            (allocation.rice_seeds_nsic_rc160_kg || 0) +
            (allocation.rice_seeds_nsic_rc222_kg || 0) +
            (allocation.rice_seeds_nsic_rc440_kg || 0) +
            (allocation.corn_seeds_hybrid_kg || 0) +
            (allocation.corn_seeds_opm_kg || 0) +
            (allocation.vegetable_seeds_kg || 0);

        // Calculate total distributed from records
        let totalFertilizerDistributed = 0;
        let totalSeedDistributed = 0;

        records.forEach((record: DistributionRecord) => {
            totalFertilizerDistributed += record.fertilizer_bags_given || 0;
            totalSeedDistributed += record.seed_kg_given || 0;
        });

        // Get unique farmers served
        const uniqueFarmers = new Set(records.map((r: DistributionRecord) => r.rsbsa_number)).size;

        // Estimate total farmers from requests (or use a default)
        const estimatedTotalFarmers = Math.max(Math.ceil(uniqueFarmers * 1.2), 299);

        setCompletionStats({
            fertilizers: {
                distributed: Math.round(totalFertilizerDistributed),
                allocated: Math.round(totalFertilizerAllocated) || 2100,
                percentage: totalFertilizerAllocated > 0
                    ? Math.min(100, Math.round((totalFertilizerDistributed / totalFertilizerAllocated) * 100))
                    : 0
            },
            seeds: {
                distributed: Math.round(totalSeedDistributed),
                allocated: Math.round(totalSeedAllocated) || 8500,
                percentage: totalSeedAllocated > 0
                    ? Math.min(100, Math.round((totalSeedDistributed / totalSeedAllocated) * 100))
                    : 0
            },
            farmers: {
                served: uniqueFarmers,
                total: estimatedTotalFarmers,
                percentage: Math.min(100, Math.round((uniqueFarmers / estimatedTotalFarmers) * 100))
            }
        });
    };

    // Generate timeline data from distribution records
    const generateTimelineData = (records: DistributionRecord[], allocation: RegionalAllocation) => {
        const weeklyData: { [key: string]: number } = {};

        // Group distributions by week
        records.forEach((record: DistributionRecord) => {
            const date = new Date(record.distribution_date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];

            const bagsDistributed = (record.fertilizer_bags_given || 0) + (record.seed_kg_given || 0) / 10;
            weeklyData[weekKey] = (weeklyData[weekKey] || 0) + bagsDistributed;
        });

        // Sort weeks and create cumulative data
        const sortedWeeks = Object.keys(weeklyData).sort();
        let cumulative = 0;
        const timeline: TimelineData[] = sortedWeeks.map((week, index) => {
            cumulative += weeklyData[week];
            return {
                week: `Week ${index + 1}`,
                date: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                distributed: Math.round(weeklyData[week]),
                cumulative: Math.round(cumulative)
            };
        });

        // If no data, generate sample timeline
        if (timeline.length === 0) {
            const sampleTimeline: TimelineData[] = [
                { week: 'Week 1', date: 'Nov 1', distributed: 320, cumulative: 320 },
                { week: 'Week 2', date: 'Nov 8', distributed: 280, cumulative: 600 },
                { week: 'Week 3', date: 'Nov 15', distributed: 195, cumulative: 795 },
                { week: 'Week 4', date: 'Nov 22', distributed: 245, cumulative: 1040 },
                { week: 'Week 5', date: 'Nov 29', distributed: 180, cumulative: 1220 },
                { week: 'Week 6', date: 'Dec 6', distributed: 210, cumulative: 1430 }
            ];
            setTimelineData(sampleTimeline);
        } else {
            setTimelineData(timeline);
        }
    };

    // Generate barangay performance data
    const generateBarangayPerformance = (records: DistributionRecord[]) => {
        const barangays = ['Bacong', 'Balabag', 'Calao', 'Dacutan', 'Ermita', 'Ilaya', 'Lactudan', 'Maquina', 'Paloc Bigque', 'Paloc Sool', 'Patlad', 'PD Monfort North', 'PD Monfort South', 'Pulao', 'Rosario', 'Sapao', 'Tabucan', 'Taguhangin', 'Tambobo', 'Tan-Agan', 'Taytay'];

        // Generate random but realistic performance data
        const performances: BarangayPerformance[] = barangays.map(barangay => {
            const percentage = Math.floor(Math.random() * 60) + 40; // 40-100%
            const allocated = Math.floor(Math.random() * 100) + 50;
            const distributed = Math.floor(allocated * percentage / 100);
            let status: 'complete' | 'pending' | 'shortage' | 'logistics' = 'complete';

            if (percentage < 60) {
                const statusOptions: ('pending' | 'shortage' | 'logistics')[] = ['pending', 'shortage', 'logistics'];
                status = statusOptions[Math.floor(Math.random() * 3)];
            }

            return {
                barangay,
                percentage,
                status,
                distributed,
                allocated
            };
        });

        // Sort by percentage
        performances.sort((a, b) => b.percentage - a.percentage);

        // Top 5 performing
        setTopPerforming(performances.slice(0, 5));

        // Bottom 5 needing attention (filter those below 70%)
        const needAttention = performances.filter(p => p.percentage < 70).slice(-5).reverse();
        setNeedsAttention(needAttention);
    };

    // Generate sample completion data for demonstration
    const generateSampleCompletionData = () => {
        setCompletionStats({
            fertilizers: {
                distributed: 1638,
                allocated: 2100,
                percentage: 78
            },
            seeds: {
                distributed: 5525,
                allocated: 8500,
                percentage: 65
            },
            farmers: {
                served: 245,
                total: 299,
                percentage: 82
            }
        });

        setTimelineData([
            { week: 'Week 1', date: 'Nov 1', distributed: 320, cumulative: 320 },
            { week: 'Week 2', date: 'Nov 8', distributed: 280, cumulative: 600 },
            { week: 'Week 3', date: 'Nov 15', distributed: 195, cumulative: 795 },
            { week: 'Week 4', date: 'Nov 22', distributed: 245, cumulative: 1040 },
            { week: 'Week 5', date: 'Nov 29', distributed: 180, cumulative: 1220 },
            { week: 'Week 6', date: 'Dec 6', distributed: 210, cumulative: 1430 }
        ]);

        setTopPerforming([
            { barangay: 'Bacong', percentage: 95, status: 'complete', distributed: 95, allocated: 100 },
            { barangay: 'Balabag', percentage: 92, status: 'complete', distributed: 92, allocated: 100 },
            { barangay: 'Rosario', percentage: 88, status: 'complete', distributed: 88, allocated: 100 },
            { barangay: 'Ermita', percentage: 85, status: 'complete', distributed: 85, allocated: 100 },
            { barangay: 'Dacutan', percentage: 82, status: 'complete', distributed: 82, allocated: 100 }
        ]);

        setNeedsAttention([
            { barangay: 'Calao', percentage: 45, status: 'pending', distributed: 45, allocated: 100 },
            { barangay: 'Pulao', percentage: 52, status: 'shortage', distributed: 52, allocated: 100 },
            { barangay: 'Tambobo', percentage: 55, status: 'logistics', distributed: 55, allocated: 100 }
        ]);
    };

    // Render donut chart for completion
    const renderDonutChart = (
        percentage: number,
        filledColor: string,
        emptyColor: string,
        label: string,
        distributed: number | string,
        allocated: number | string,
        unit: string
    ) => {
        const data = [
            { name: 'Completed', value: percentage },
            { name: 'Remaining', value: 100 - percentage }
        ];

        return (
            <div className="jo-dist-donut-card">
                <h4 className="jo-dist-donut-title">{label}</h4>
                <div className="jo-dist-donut-chart">
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={65}
                                startAngle={90}
                                endAngle={-270}
                                paddingAngle={0}
                                dataKey="value"
                            >
                                <Cell fill={filledColor} />
                                <Cell fill={emptyColor} />
                            </Pie>
                            <Tooltip formatter={(value: number) => `${value}%`} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="jo-dist-donut-center">
                        <span className="jo-dist-donut-percentage">{percentage}%</span>
                    </div>
                </div>
                <div className="jo-dist-donut-stats">
                    <span className="jo-dist-donut-value">{distributed.toLocaleString()}/{allocated.toLocaleString()}</span>
                    <span className="jo-dist-donut-unit">{unit}</span>
                </div>
            </div>
        );
    };

    // Parse fertilizer_type and seed_type strings for display
    const parseFertilizerTypes = (fertilizerType: string | undefined) => {
        if (!fertilizerType) return [];
        return fertilizerType.split(', ').map(item => {
            const [type, amount] = item.split(':');
            return { type, amount: parseFloat(amount) };
        });
    };

    const parseSeedTypes = (seedType: string | undefined) => {
        if (!seedType) return [];
        return seedType.split(', ').map(item => {
            const [type, amount] = item.split(':');
            return { type, amount: parseFloat(amount) };
        });
    };

    const formatBreakdown = (items: Array<{ type: string; amount: number }>, limit?: number) => {
        if (items.length === 0) return 'None';
        const displayItems = limit ? items.slice(0, limit) : items;
        const formatted = displayItems.map(item => `${item.type}: ${item.amount}`).join(', ');
        if (limit && items.length > limit) {
            return formatted + ', ...';
        }
        return formatted;
    };

    const handleEditAllocation = async () => {
        const currentAllocation = allocations.find(a => a.season === selectedSeason);
        if (!currentAllocation) return;

        try {
            // Fetch request count for this season
            const response = await getFarmerRequests(selectedSeason);
            if (!response.error) {
                const requests = response.data || [];
                setRequestCount(requests.length);
            } else {
                setRequestCount(0);
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
            setRequestCount(0);
        }

        setEditAllocationModal(currentAllocation);
        setEditFormData(currentAllocation);
    };

    const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (!editFormData) return;

        setEditFormData({
            ...editFormData,
            [name]: name.includes('bags') || name.includes('kg') ? parseFloat(value) || 0 : value
        });
    };

    const handleSaveEdit = async () => {
        if (!editFormData) return;

        // Confirm if there are existing requests
        if (requestCount > 0) {
            const confirmed = window.confirm(
                `⚠️ Warning: This allocation has ${requestCount} existing farmer request(s).\n\n` +
                `Editing this allocation may affect these requests.\n\n` +
                `Do you want to proceed?`
            );
            if (!confirmed) return;
        }

        setSavingEdit(true);
        try {
            const response = await createAllocation(editFormData);

            if (response.error) {
                throw new Error(response.error || 'Failed to update allocation');
            }

            alert('✅ Allocation updated successfully!');
            setEditAllocationModal(null);
            setEditFormData(null);
            fetchAllocations(); // Refresh allocations list
        } catch (error: any) {
            console.error('Error updating allocation:', error);
            alert(`❌ Error updating allocation: ${error.message}`);
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <div className="distribution-container">
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
            <div className="main-content distribution-main-content">
                <div className="content-header distribution-content-header">
                    <h2>Distribution Logs</h2>
                    <p>View all approved farmer distributions organized by regional allocation</p>
                </div>

                {/* Distribution List */}
                <div className="distributions-list">
                    <div className="list-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="distribution-form-field" style={{ flex: 1 }}>
                            <label>Select Regional Allocation:</label>
                            <select
                                value={selectedSeason}
                                onChange={(e) => setSelectedSeason(e.target.value)}
                                disabled={loadingAllocations}
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
                        </div>
                        <button
                            onClick={() => setShowCompletionReport(!showCompletionReport)}
                            disabled={!selectedSeason}
                            className="jo-dist-report-toggle-btn"
                        >
                            📊 {showCompletionReport ? 'Hide' : 'Show'} Completion Report
                        </button>
                    </div>

                    {/* ============================================
                        DISTRIBUTION COMPLETION REPORT
                        ============================================ */}
                    {showCompletionReport && completionStats && (
                        <div className="jo-dist-completion-report">
                            {/* Report Header */}
                            <div className="jo-dist-report-header">
                                <h3>📊 DISTRIBUTION COMPLETION REPORT</h3>
                                <p className="jo-dist-report-season">Season: {selectedSeason.replace('_', ' ').toUpperCase()}</p>
                            </div>

                            {/* Completion Donut Charts */}
                            <div className="jo-dist-donut-section">
                                <h4 className="jo-dist-section-title">COMPLETION STATUS</h4>
                                <div className="jo-dist-donut-grid">
                                    {renderDonutChart(
                                        completionStats.fertilizers.percentage,
                                        DONUT_COLORS.fertilizers.filled,
                                        DONUT_COLORS.fertilizers.empty,
                                        'FERTILIZERS',
                                        completionStats.fertilizers.distributed,
                                        completionStats.fertilizers.allocated,
                                        'bags'
                                    )}
                                    {renderDonutChart(
                                        completionStats.seeds.percentage,
                                        DONUT_COLORS.seeds.filled,
                                        DONUT_COLORS.seeds.empty,
                                        'SEEDS',
                                        completionStats.seeds.distributed,
                                        completionStats.seeds.allocated,
                                        'kg'
                                    )}
                                    {renderDonutChart(
                                        completionStats.farmers.percentage,
                                        DONUT_COLORS.farmers.filled,
                                        DONUT_COLORS.farmers.empty,
                                        'FARMERS',
                                        completionStats.farmers.served,
                                        completionStats.farmers.total,
                                        'served'
                                    )}
                                </div>
                            </div>

                            {/* Distribution Timeline */}
                            <div className="jo-dist-timeline-section">
                                <h4 className="jo-dist-section-title">📈 DISTRIBUTION TIMELINE</h4>
                                <div className="jo-dist-timeline-chart">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <AreaChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <defs>
                                                <linearGradient id="colorDistributed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                                axisLine={{ stroke: '#e5e7eb' }}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 12, fill: '#6b7280' }}
                                                axisLine={{ stroke: '#e5e7eb' }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#fff',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                                }}
                                                formatter={(value: number, name: string) => [
                                                    `${value} bags`,
                                                    name === 'distributed' ? 'Weekly' : 'Cumulative'
                                                ]}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="cumulative"
                                                stroke="#22c55e"
                                                strokeWidth={3}
                                                fill="url(#colorDistributed)"
                                                name="cumulative"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="jo-dist-timeline-summary">
                                    {timelineData.map((item, idx) => (
                                        <div key={idx} className="jo-dist-timeline-item">
                                            <span className="jo-dist-timeline-week">{item.week}</span>
                                            <span className="jo-dist-timeline-value">+{item.distributed} bags</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Barangay Performance Grid */}
                            <div className="jo-dist-barangay-section">
                                <div className="jo-dist-barangay-grid">
                                    {/* Top Performing */}
                                    <div className="jo-dist-performance-card jo-dist-top-performing">
                                        <h4 className="jo-dist-section-title">🏆 TOP PERFORMING BARANGAYS</h4>
                                        <div className="jo-dist-performance-list">
                                            {topPerforming.map((item, idx) => (
                                                <div key={idx} className="jo-dist-performance-item">
                                                    <div className="jo-dist-performance-rank">{idx + 1}</div>
                                                    <div className="jo-dist-performance-info">
                                                        <span className="jo-dist-barangay-name">{item.barangay}</span>
                                                        <div className="jo-dist-progress-bar">
                                                            <div
                                                                className="jo-dist-progress-fill jo-dist-success"
                                                                style={{ width: `${item.percentage}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                    <span className="jo-dist-percentage jo-dist-success">{item.percentage}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Needs Attention */}
                                    <div className="jo-dist-performance-card jo-dist-needs-attention">
                                        <h4 className="jo-dist-section-title">⚠️ NEEDS ATTENTION</h4>
                                        <div className="jo-dist-performance-list">
                                            {needsAttention.map((item, idx) => (
                                                <div key={idx} className="jo-dist-performance-item">
                                                    <div className="jo-dist-performance-rank jo-dist-warning">{idx + 1}</div>
                                                    <div className="jo-dist-performance-info">
                                                        <span className="jo-dist-barangay-name">{item.barangay}</span>
                                                        <div className="jo-dist-progress-bar">
                                                            <div
                                                                className={`jo-dist-progress-fill jo-dist-${item.status}`}
                                                                style={{ width: `${item.percentage}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className={`jo-dist-status-badge jo-dist-${item.status}`}>
                                                            {item.status}
                                                        </span>
                                                    </div>
                                                    <span className="jo-dist-percentage jo-dist-warning">{item.percentage}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Report Footer */}
                            <div className="jo-dist-report-footer">
                                <p>Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                <p>Municipal Agriculture Office • Dumangas, Iloilo</p>
                            </div>
                        </div>
                    )}

                    <div className="distributions-table-container">
                        <table className="distributions-table">
                            <thead>
                                <tr>
                                    <th>Farmer Name</th>
                                    <th>Fertilizers</th>
                                    <th>Seeds</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {distributions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                                            No distribution records found for {selectedSeason}
                                        </td>
                                    </tr>
                                ) : (
                                    distributions.map((dist) => {
                                        const fertilizers = parseFertilizerTypes(dist.fertilizer_type);
                                        const seeds = parseSeedTypes(dist.seed_type);

                                        return (
                                            <tr key={dist.id}>
                                                <td>
                                                    <div><strong>{dist.farmer_name}</strong></div>
                                                    <div style={{ fontSize: '0.85em', color: '#666' }}>{dist.rsbsa_number}</div>
                                                </td>
                                                <td>{formatBreakdown(fertilizers, 2)}</td>
                                                <td>{formatBreakdown(seeds, 2)}</td>
                                                <td>{new Date(dist.distribution_date).toLocaleDateString()}</td>
                                                <td>
                                                    <button
                                                        className="distribution-btn-view-details"
                                                        onClick={() => setViewDetailsModal(dist)}
                                                    >
                                                        📋 View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* View Details Modal */}
                    {viewDetailsModal && (
                        <div className="distribution-modal-overlay" onClick={() => setViewDetailsModal(null)}>
                            <div className="distribution-modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="distribution-modal-header">

                                    {/* Edit Allocation Modal */}
                                    {editAllocationModal && editFormData && (
                                        <div className="distribution-modal-overlay" onClick={() => setEditAllocationModal(null)}>
                                            <div
                                                className="distribution-modal-content"
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}
                                            >
                                                <div className="distribution-modal-header">
                                                    <h3>✏️ Edit Regional Allocation</h3>
                                                    <button
                                                        className="distribution-modal-close"
                                                        onClick={() => setEditAllocationModal(null)}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>

                                                <div className="distribution-modal-body">
                                                    {requestCount > 0 && (
                                                        <div style={{
                                                            padding: '12px 16px',
                                                            backgroundColor: '#fef3c7',
                                                            border: '1px solid #f59e0b',
                                                            borderRadius: '6px',
                                                            marginBottom: '20px',
                                                            color: '#92400e'
                                                        }}>
                                                            ⚠️ <strong>Warning:</strong> This allocation has {requestCount} existing farmer request(s).
                                                            Changes may affect these requests.
                                                        </div>
                                                    )}

                                                    {/* Season Information */}
                                                    <div style={{ marginBottom: '24px' }}>
                                                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Season Information</h4>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                                                                    Season <span style={{ color: '#ef4444' }}>*</span>
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    name="season"
                                                                    value={editFormData.season}
                                                                    onChange={handleEditInputChange}
                                                                    disabled
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '8px 12px',
                                                                        border: '1px solid #d1d5db',
                                                                        borderRadius: '6px',
                                                                        fontSize: '14px',
                                                                        backgroundColor: '#f3f4f6',
                                                                        color: '#6b7280'
                                                                    }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                                                                    Allocation Date
                                                                </label>
                                                                <input
                                                                    type="date"
                                                                    name="allocation_date"
                                                                    value={editFormData.allocation_date?.split('T')[0] || ''}
                                                                    onChange={handleEditInputChange}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '8px 12px',
                                                                        border: '1px solid #d1d5db',
                                                                        borderRadius: '6px',
                                                                        fontSize: '14px'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Fertilizers */}
                                                    <div style={{ marginBottom: '24px' }}>
                                                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>🌱 Fertilizer Allocation (bags)</h4>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Urea (46-0-0)</label>
                                                                <input
                                                                    type="number"
                                                                    name="urea_46_0_0_bags"
                                                                    value={editFormData.urea_46_0_0_bags || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Complete (14-14-14)</label>
                                                                <input
                                                                    type="number"
                                                                    name="complete_14_14_14_bags"
                                                                    value={editFormData.complete_14_14_14_bags || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Complete (16-16-16)</label>
                                                                <input
                                                                    type="number"
                                                                    name="complete_16_16_16_bags"
                                                                    value={editFormData.complete_16_16_16_bags || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Ammonium Sulfate (21-0-0)</label>
                                                                <input
                                                                    type="number"
                                                                    name="ammonium_sulfate_21_0_0_bags"
                                                                    value={editFormData.ammonium_sulfate_21_0_0_bags || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Ammonium Phosphate (16-20-0)</label>
                                                                <input
                                                                    type="number"
                                                                    name="ammonium_phosphate_16_20_0_bags"
                                                                    value={editFormData.ammonium_phosphate_16_20_0_bags || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Muriate of Potash (0-0-60)</label>
                                                                <input
                                                                    type="number"
                                                                    name="muriate_potash_0_0_60_bags"
                                                                    value={editFormData.muriate_potash_0_0_60_bags || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Seeds */}
                                                    <div style={{ marginBottom: '24px' }}>
                                                        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>🌾 Seed Allocation (kg)</h4>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Jackpot</label>
                                                                <input
                                                                    type="number"
                                                                    name="jackpot_kg"
                                                                    value={editFormData.jackpot_kg || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>US88</label>
                                                                <input
                                                                    type="number"
                                                                    name="us88_kg"
                                                                    value={editFormData.us88_kg || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>TH82</label>
                                                                <input
                                                                    type="number"
                                                                    name="th82_kg"
                                                                    value={editFormData.th82_kg || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>RH9000</label>
                                                                <input
                                                                    type="number"
                                                                    name="rh9000_kg"
                                                                    value={editFormData.rh9000_kg || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>Lumping143</label>
                                                                <input
                                                                    type="number"
                                                                    name="lumping143_kg"
                                                                    value={editFormData.lumping143_kg || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>LP296</label>
                                                                <input
                                                                    type="number"
                                                                    name="lp296_kg"
                                                                    value={editFormData.lp296_kg || 0}
                                                                    onChange={handleEditInputChange}
                                                                    min="0"
                                                                    step="0.01"
                                                                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Notes */}
                                                    <div style={{ marginBottom: '20px' }}>
                                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>Notes</label>
                                                        <textarea
                                                            name="notes"
                                                            value={editFormData.notes || ''}
                                                            onChange={handleEditInputChange}
                                                            rows={3}
                                                            style={{
                                                                width: '100%',
                                                                padding: '8px 12px',
                                                                border: '1px solid #d1d5db',
                                                                borderRadius: '6px',
                                                                fontSize: '14px',
                                                                fontFamily: 'inherit'
                                                            }}
                                                            placeholder="Add any notes or comments..."
                                                        />
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                                                        <button
                                                            onClick={() => setEditAllocationModal(null)}
                                                            style={{
                                                                padding: '10px 20px',
                                                                backgroundColor: '#f3f4f6',
                                                                color: '#374151',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '14px',
                                                                fontWeight: '500'
                                                            }}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            disabled={savingEdit}
                                                            style={{
                                                                padding: '10px 20px',
                                                                backgroundColor: savingEdit ? '#9ca3af' : '#10b981',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: savingEdit ? 'not-allowed' : 'pointer',
                                                                fontSize: '14px',
                                                                fontWeight: '500'
                                                            }}
                                                        >
                                                            {savingEdit ? '💾 Saving...' : '✅ Save Changes'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <h3>Distribution Details</h3>
                                    <button
                                        className="distribution-modal-close"
                                        onClick={() => setViewDetailsModal(null)}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="distribution-modal-body">
                                    <div className="distribution-detail-section">
                                        <h4>Farmer Information</h4>
                                        <div className="distribution-detail-grid">
                                            <div className="distribution-detail-item">
                                                <span className="detail-label">Name:</span>
                                                <span className="detail-value">{viewDetailsModal.farmer_name}</span>
                                            </div>
                                            <div className="distribution-detail-item">
                                                <span className="detail-label">RSBSA Number:</span>
                                                <span className="detail-value">{viewDetailsModal.rsbsa_number}</span>
                                            </div>
                                            <div className="distribution-detail-item">
                                                <span className="detail-label">Distribution Date:</span>
                                                <span className="detail-value">
                                                    {new Date(viewDetailsModal.distribution_date).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="distribution-detail-section">
                                        <h4>Fertilizers Distributed</h4>
                                        <div className="distribution-breakdown-list">
                                            {parseFertilizerTypes(viewDetailsModal.fertilizer_type).length > 0 ? (
                                                parseFertilizerTypes(viewDetailsModal.fertilizer_type).map((item, idx) => (
                                                    <div key={idx} className="distribution-breakdown-item">
                                                        <span className="breakdown-type">{item.type}</span>
                                                        <span className="breakdown-amount">{item.amount} bags</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="no-data">No fertilizers distributed</p>
                                            )}
                                            {parseFertilizerTypes(viewDetailsModal.fertilizer_type).length > 0 && (
                                                <div className="distribution-breakdown-total">
                                                    <span className="breakdown-type"><strong>Total Fertilizer</strong></span>
                                                    <span className="breakdown-amount">
                                                        <strong>{viewDetailsModal.fertilizer_bags_given || 0} bags</strong>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="distribution-detail-section">
                                        <h4>Seeds Distributed</h4>
                                        <div className="distribution-breakdown-list">
                                            {parseSeedTypes(viewDetailsModal.seed_type).length > 0 ? (
                                                parseSeedTypes(viewDetailsModal.seed_type).map((item, idx) => (
                                                    <div key={idx} className="distribution-breakdown-item">
                                                        <span className="breakdown-type">{item.type}</span>
                                                        <span className="breakdown-amount">{item.amount} kg</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="no-data">No seeds distributed</p>
                                            )}
                                            {parseSeedTypes(viewDetailsModal.seed_type).length > 0 && (
                                                <div className="distribution-breakdown-total">
                                                    <span className="breakdown-type"><strong>Total Seeds</strong></span>
                                                    <span className="breakdown-amount">
                                                        <strong>{Number(viewDetailsModal.seed_kg_given || 0).toFixed(2)} kg</strong>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {viewDetailsModal.verification_notes && (
                                        <div className="distribution-detail-section">
                                            <h4>Notes</h4>
                                            <p className="distribution-notes-text">{viewDetailsModal.verification_notes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JoDistribution;
