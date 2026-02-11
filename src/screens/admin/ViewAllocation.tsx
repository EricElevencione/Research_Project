import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAllocations, getFarmerRequests } from '../../api';
import { UsageGauges, BarangayBreakdownTable, SeasonComparisonTable } from '../../components/Incentives/AllocationVisuals';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';
import '../../assets/css/admin css/AdminViewAllocation.css';
import '../../components/Incentives/RequestAnalytics.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';

// ─── Analytics Components ──────────────────────────────────────

interface ShortageItem {
    name: string;
    allocated: number;
    requested: number;
    remaining: number;
    pctUsed: number;
    unit: string;
    severity: 'critical' | 'warning' | 'ok';
}

const BarangayVolumeChart: React.FC<{ requests: any[] }> = ({ requests }) => {
    const data = useMemo(() => {
        const map = new Map<string, { fert: number; seed: number; count: number }>();

        requests.forEach((r: any) => {
            const brgy = r.barangay || 'Unknown';
            const existing = map.get(brgy) || { fert: 0, seed: 0, count: 0 };

            const fert =
                (Number(r.requested_urea_bags) || 0) +
                (Number(r.requested_complete_14_bags) || 0) +
                (Number(r.requested_ammonium_sulfate_bags) || 0) +
                (Number(r.requested_muriate_potash_bags) || 0);

            const seed =
                (Number(r.requested_jackpot_kg) || 0) +
                (Number(r.requested_us88_kg) || 0) +
                (Number(r.requested_th82_kg) || 0) +
                (Number(r.requested_rh9000_kg) || 0) +
                (Number(r.requested_lumping143_kg) || 0) +
                (Number(r.requested_lp296_kg) || 0);

            map.set(brgy, {
                fert: existing.fert + fert,
                seed: existing.seed + seed,
                count: existing.count + 1,
            });
        });

        const result: { barangay: string; fertilizer: number; seeds: number; count: number }[] = [];
        map.forEach((v, k) => {
            result.push({ barangay: k, fertilizer: v.fert, seeds: v.seed, count: v.count });
        });

        result.sort((a, b) => (b.fertilizer + b.seeds) - (a.fertilizer + a.seeds));
        return result;
    }, [requests]);

    if (data.length === 0) return null;

    return (
        <div className="req-analytics-card">
            <div className="req-analytics-card-header">
                <h3>Request Volume by Barangay</h3>
                <span className="req-analytics-subtitle">Ranked by total amount requested</span>
            </div>
            <div className="req-analytics-card-body">
                <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44 + 40)}>
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
                        <YAxis dataKey="barangay" type="category" tick={{ fill: '#374151', fontSize: 13, fontWeight: 500 }} width={100} />
                        <Tooltip
                            contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                            formatter={(value: number, name: string) => [
                                `${value.toFixed(1)} ${name === 'fertilizer' ? 'bags' : 'kg'}`,
                                name === 'fertilizer' ? 'Fertilizer' : 'Seeds',
                            ]}
                        />
                        <Bar dataKey="fertilizer" stackId="a" radius={[0, 0, 0, 0]} maxBarSize={28} fill="#16a34a" name="fertilizer" />
                        <Bar dataKey="seeds" stackId="a" radius={[0, 4, 4, 0]} maxBarSize={28} fill="#0ea5e9" name="seeds" />
                    </BarChart>
                </ResponsiveContainer>
                <div className="req-analytics-bar-legend">
                    <span><span className="req-legend-dot" style={{ background: '#16a34a' }} /> Fertilizer (bags)</span>
                    <span><span className="req-legend-dot" style={{ background: '#0ea5e9' }} /> Seeds (kg)</span>
                </div>
            </div>
        </div>
    );
};

const ApprovalRateCard: React.FC<{ requests: any[] }> = ({ requests }) => {
    const stats = useMemo(() => {
        const total = requests.length;
        const approved = requests.filter((r: any) => r.status === 'approved').length;
        const rejected = requests.filter((r: any) => r.status === 'rejected').length;
        const pending = requests.filter((r: any) => r.status === 'pending').length;
        const decided = approved + rejected;
        const approvalRate = decided > 0 ? (approved / decided) * 100 : 0;
        return { total, approved, rejected, pending, approvalRate };
    }, [requests]);

    const circumference = 2 * Math.PI * 52;
    const approvedOffset = circumference - (stats.approvalRate / 100) * circumference;

    return (
        <div className="req-analytics-card req-approval-card">
            <div className="req-analytics-card-header">
                <h3>Approval Rate</h3>
                <span className="req-analytics-subtitle">Approved vs. rejected requests</span>
            </div>
            <div className="req-approval-body">
                <div className="req-approval-gauge">
                    <svg width="120" height="120" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="#fee2e2" strokeWidth="12" />
                        <circle cx="60" cy="60" r="52" fill="none" stroke="#16a34a" strokeWidth="12"
                            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={approvedOffset}
                            transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                        <text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="700" fill="#16a34a">
                            {stats.approvalRate.toFixed(0)}%
                        </text>
                        <text x="60" y="73" textAnchor="middle" fontSize="10" fill="#9ca3af">approved</text>
                    </svg>
                </div>
                <div className="req-approval-stats">
                    <div className="req-approval-stat-row">
                        <span className="req-approval-dot approved" />
                        <span className="req-approval-label">Approved</span>
                        <span className="req-approval-value">{stats.approved}</span>
                    </div>
                    <div className="req-approval-stat-row">
                        <span className="req-approval-dot rejected" />
                        <span className="req-approval-label">Rejected</span>
                        <span className="req-approval-value">{stats.rejected}</span>
                    </div>
                    <div className="req-approval-stat-row">
                        <span className="req-approval-dot pending" />
                        <span className="req-approval-label">Pending</span>
                        <span className="req-approval-value">{stats.pending}</span>
                    </div>
                    <div className="req-approval-stat-total">
                        Total: <strong>{stats.total}</strong> requests
                    </div>
                </div>
            </div>
        </div>
    );
};

const ShortageAlertsPanel: React.FC<{ allocations: any[]; allRequests: Map<string, any[]> }> = ({ allocations, allRequests }) => {
    const shortages = useMemo(() => {
        const items: ShortageItem[] = [];

        const FERT_FIELDS = [
            { alloc: 'urea_46_0_0_bags', req: 'requested_urea_bags', label: 'Urea (46-0-0)', unit: 'bags' },
            { alloc: 'complete_14_14_14_bags', req: 'requested_complete_14_bags', label: 'Complete (14-14-14)', unit: 'bags' },
            { alloc: 'ammonium_sulfate_21_0_0_bags', req: 'requested_ammonium_sulfate_bags', label: 'Amm. Sulfate', unit: 'bags' },
            { alloc: 'muriate_potash_0_0_60_bags', req: 'requested_muriate_potash_bags', label: 'Muriate Potash', unit: 'bags' },
        ];

        const SEED_FIELDS = [
            { alloc: 'jackpot_kg', req: 'requested_jackpot_kg', label: 'Jackpot', unit: 'kg' },
            { alloc: 'us88_kg', req: 'requested_us88_kg', label: 'US88', unit: 'kg' },
            { alloc: 'th82_kg', req: 'requested_th82_kg', label: 'TH82', unit: 'kg' },
            { alloc: 'rh9000_kg', req: 'requested_rh9000_kg', label: 'RH9000', unit: 'kg' },
            { alloc: 'lumping143_kg', req: 'requested_lumping143_kg', label: 'Lumping143', unit: 'kg' },
            { alloc: 'lp296_kg', req: 'requested_lp296_kg', label: 'LP296', unit: 'kg' },
        ];

        const allFields = [...FERT_FIELDS, ...SEED_FIELDS];

        allFields.forEach((field) => {
            let totalAllocated = 0;
            let totalRequested = 0;

            allocations.forEach((alloc) => {
                totalAllocated += Number(alloc[field.alloc]) || 0;
                const seasonReqs = allRequests.get(alloc.season) || [];
                seasonReqs.forEach((r) => {
                    totalRequested += Number(r[field.req]) || 0;
                });
            });

            const remaining = totalAllocated - totalRequested;
            const pctUsed = totalAllocated > 0 ? (totalRequested / totalAllocated) * 100 : 0;

            let severity: 'critical' | 'warning' | 'ok' = 'ok';
            if (pctUsed >= 100 || remaining < 0) severity = 'critical';
            else if (pctUsed >= 75) severity = 'warning';

            items.push({ name: field.label, allocated: totalAllocated, requested: totalRequested, remaining, pctUsed, unit: field.unit, severity });
        });

        const order = { critical: 0, warning: 1, ok: 2 };
        items.sort((a, b) => order[a.severity] - order[b.severity]);
        return items;
    }, [allocations, allRequests]);

    const criticalCount = shortages.filter((s) => s.severity === 'critical').length;
    const warningCount = shortages.filter((s) => s.severity === 'warning').length;

    return (
        <div className="req-analytics-card req-shortage-card">
            <div className="req-analytics-card-header">
                <h3>System-Wide Shortage Alerts</h3>
                <span className="req-analytics-subtitle">Across all seasons &amp; allocations</span>
            </div>
            <div className="req-shortage-summary">
                {criticalCount > 0 && <span className="req-shortage-badge critical">{criticalCount} Critical</span>}
                {warningCount > 0 && <span className="req-shortage-badge warning">{warningCount} Warning</span>}
                {criticalCount === 0 && warningCount === 0 && <span className="req-shortage-badge ok">All items sufficient</span>}
            </div>
            <div className="req-shortage-list">
                {shortages.map((item) => (
                    <div key={item.name} className={`req-shortage-row ${item.severity}`}>
                        <div className="req-shortage-icon">
                            {item.severity === 'critical' ? '🔴' : item.severity === 'warning' ? '🟡' : '🟢'}
                        </div>
                        <div className="req-shortage-info">
                            <span className="req-shortage-name">{item.name}</span>
                            <span className="req-shortage-detail">
                                {item.requested.toFixed(1)} / {item.allocated.toFixed(1)} {item.unit} used
                            </span>
                        </div>
                        <div className="req-shortage-bar-wrap">
                            <div className={`req-shortage-bar-fill ${item.severity}`} style={{ width: `${Math.min(item.pctUsed, 100)}%` }} />
                        </div>
                        <div className="req-shortage-pct">
                            <span className={`req-shortage-pct-value ${item.severity}`}>{item.pctUsed.toFixed(0)}%</span>
                        </div>
                        <div className={`req-shortage-remaining ${item.remaining < 0 ? 'over' : ''}`}>
                            {item.remaining >= 0 ? `${item.remaining.toFixed(1)} left` : `${Math.abs(item.remaining).toFixed(1)} over`}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────

interface FarmerRequest {
    id: number;
    farmer_name: string;
    barangay: string;
    requested_urea_bags: number;
    requested_complete_14_bags: number;
    requested_ammonium_sulfate_bags: number;
    requested_muriate_potash_bags: number;
    requested_jackpot_kg: number;
    requested_us88_kg: number;
    requested_th82_kg: number;
    requested_rh9000_kg: number;
    requested_lumping143_kg: number;
    requested_lp296_kg: number;
    status: string;
}

interface AllocationDetails {
    id: number;
    season: string;
    allocation_date: string;
    urea_46_0_0_bags: number;
    complete_14_14_14_bags: number;
    ammonium_sulfate_21_0_0_bags: number;
    muriate_potash_0_0_60_bags: number;
    jackpot_kg: number;
    us88_kg: number;
    th82_kg: number;
    rh9000_kg: number;
    lumping143_kg: number;
    lp296_kg: number;
    notes: string;
}

const ViewAllocation: React.FC = () => {
    const navigate = useNavigate();
    const { allocationId } = useParams<{ allocationId: string }>();
    const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
    const [allAllocations, setAllAllocations] = useState<any[]>([]);
    const [requests, setRequests] = useState<FarmerRequest[]>([]);
    const [allSeasonRequests, setAllSeasonRequests] = useState<Map<string, any[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isActive = (path: string) => location.pathname === path;


    useEffect(() => {
        fetchAllocationData();
    }, [allocationId]);

    const fetchAllocationData = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔍 Fetching allocation with ID:', allocationId);

            // Fetch allocation details
            const allocationResponse = await getAllocations();
            if (allocationResponse.error) {
                throw new Error('Failed to fetch allocation');
            }
            const allocations = allocationResponse.data || [];
            console.log('📦 All allocations:', allocations);
            setAllAllocations(allocations);

            const currentAllocation = allocations.find((a: any) => a.id === parseInt(allocationId || '0'));
            console.log('🎯 Current allocation:', currentAllocation);

            if (!currentAllocation) {
                throw new Error('Allocation not found');
            }
            setAllocation(currentAllocation);

            // Fetch farmer requests for this season
            const requestsResponse = await getFarmerRequests(currentAllocation.season);
            if (!requestsResponse.error) {
                const requestsData = requestsResponse.data || [];
                setRequests(requestsData);

                // Fetch requests for ALL seasons (for shortage panel)
                const seasonMap = new Map<string, any[]>();
                seasonMap.set(currentAllocation.season, requestsData);
                for (const alloc of allocations) {
                    if (alloc.season !== currentAllocation.season) {
                        const sRes = await getFarmerRequests(alloc.season);
                        seasonMap.set(alloc.season, sRes.data || []);
                    }
                }
                setAllSeasonRequests(seasonMap);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    if (loading) {
        return (
            <div className="admin-viewalloc-page-container">
                <div className="admin-viewalloc-page">
                    <div className="admin-viewalloc-main-content">
                        <div className="admin-viewalloc-loading">Loading allocation details...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !allocation) {
        return (
            <div className="admin-viewalloc-page-container">
                <div className="admin-viewalloc-page">
                    <div className="admin-viewalloc-main-content">
                        <div className="admin-viewalloc-error-state">
                            <div className="admin-viewalloc-error-icon">⚠️</div>
                            <h3>Error Loading Allocation</h3>
                            <p>{error || 'Allocation not found'}</p>
                            <button className="admin-viewalloc-btn-back" onClick={() => navigate('/Allocations')}>
                                ← Back to Allocations
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-viewalloc-page-container">
            <div className="admin-viewalloc-page">
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

                {/* Main Content */}
                <div className="admin-viewalloc-main-content">
                    <div className="admin-viewalloc-header">
                        <h2 className="admin-viewalloc-title">View Allocation</h2>
                        <p className="admin-viewalloc-subtitle">Regional Allocation Details</p>
                    </div>
                    <div className="admin-viewalloc-header-actions">
                            <button
                                className="admin-viewalloc-btn-nav"
                                onClick={() => navigate(`/manage-requests/${allocationId}`)}
                            >
                                📋 View Requests
                            </button>
                            <button
                                className="admin-viewalloc-btn-nav"
                                onClick={() => navigate('/Incentives')}
                            >
                                ← Back to Allocations
                            </button>
                        </div>

                    {/* ── Analytics Charts ── */}
                    {!loading && !error && requests.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <div className="req-analytics-row">
                                <BarangayVolumeChart requests={requests} />
                                <ApprovalRateCard requests={requests} />
                            </div>
                            <ShortageAlertsPanel allocations={allAllocations} allRequests={allSeasonRequests} />
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

export default ViewAllocation;
