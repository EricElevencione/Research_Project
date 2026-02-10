import React, { useMemo } from 'react';
import './AllocationVisuals.css';

// ─── Types ─────────────────────────────────────────────────

interface GaugeItem {
    name: string;
    allocated: number;
    requested: number;
    unit: string;
}

interface BarangayRow {
    barangay: string;
    totalFertBags: number;
    totalSeedKg: number;
    farmerCount: number;
}

// ─── Radial Gauge (SVG) ────────────────────────────────────

interface RadialGaugeProps {
    label: string;
    allocated: number;
    used: number;
    unit: string;
    color: string;
    size?: number;
}

const RadialGauge: React.FC<RadialGaugeProps> = ({
    label, allocated, used, unit, color, size = 120,
}) => {
    const radius = (size - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = allocated > 0 ? Math.min((used / allocated) * 100, 100) : 0;
    const offset = circumference - (pct / 100) * circumference;

    const statusColor =
        pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : color;

    const remaining = allocated - used;

    return (
        <div className="alloc-gauge-item">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background ring */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="#e5e7eb" strokeWidth="10"
                />
                {/* Progress ring */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke={statusColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
                {/* Center text */}
                <text
                    x={size / 2} y={size / 2 - 6}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="18" fontWeight="700" fill={statusColor}
                >
                    {pct.toFixed(0)}%
                </text>
                <text
                    x={size / 2} y={size / 2 + 12}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="9" fill="#9ca3af"
                >
                    depleted
                </text>
            </svg>
            <div className="alloc-gauge-label">{label}</div>
            <div className="alloc-gauge-detail">
                <span style={{ color: statusColor, fontWeight: 600 }}>
                    {used.toFixed(1)}
                </span>
                <span className="alloc-gauge-slash"> / {allocated.toFixed(1)} {unit}</span>
            </div>
            <div className={`alloc-gauge-remaining ${remaining < 0 ? 'over' : ''}`}>
                {remaining >= 0
                    ? `${remaining.toFixed(1)} ${unit} left`
                    : `${Math.abs(remaining).toFixed(1)} ${unit} over`}
            </div>
        </div>
    );
};

// ─── Usage Gauges Section ──────────────────────────────────

interface UsageGaugesProps {
    fertilizers: GaugeItem[];
    seeds: GaugeItem[];
}

export const UsageGauges: React.FC<UsageGaugesProps> = ({ fertilizers, seeds }) => {
    return (
        <div className="alloc-gauges-section">
            {/* Fertilizers */}
            <div className="alloc-gauges-group">
                <div className="alloc-gauges-group-header">
                    <span className="alloc-gauges-icon">🌱</span>
                    <h3>Fertilizer Depletion</h3>
                </div>
                <div className="alloc-gauges-grid">
                    {fertilizers.map((f) => (
                        <RadialGauge
                            key={f.name}
                            label={f.name}
                            allocated={f.allocated}
                            used={f.requested}
                            unit={f.unit}
                            color="#16a34a"
                        />
                    ))}
                </div>
            </div>

            {/* Seeds */}
            <div className="alloc-gauges-group">
                <div className="alloc-gauges-group-header">
                    <span className="alloc-gauges-icon">🌾</span>
                    <h3>Seed Depletion</h3>
                </div>
                <div className="alloc-gauges-grid">
                    {seeds.map((s) => (
                        <RadialGauge
                            key={s.name}
                            label={s.name}
                            allocated={s.allocated}
                            used={s.requested}
                            unit={s.unit}
                            color="#0ea5e9"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Barangay Allocation Breakdown Table ───────────────────

interface BarangayBreakdownProps {
    requests: any[];
}

export const BarangayBreakdownTable: React.FC<BarangayBreakdownProps> = ({ requests }) => {
    const rows = useMemo(() => {
        const map = new Map<string, { totalFert: number; totalSeed: number; count: number }>();

        requests.forEach((r) => {
            const brgy = r.barangay || 'Unknown';
            const existing = map.get(brgy) || { totalFert: 0, totalSeed: 0, count: 0 };

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
                totalFert: existing.totalFert + fert,
                totalSeed: existing.totalSeed + seed,
                count: existing.count + 1,
            });
        });

        const result: BarangayRow[] = [];
        map.forEach((v, k) => {
            result.push({ barangay: k, totalFertBags: v.totalFert, totalSeedKg: v.totalSeed, farmerCount: v.count });
        });

        // Sort by total fertilizer descending
        result.sort((a, b) => b.totalFertBags - a.totalFertBags);
        return result;
    }, [requests]);

    const maxFert = Math.max(...rows.map((r) => r.totalFertBags), 1);
    const maxSeed = Math.max(...rows.map((r) => r.totalSeedKg), 1);

    return (
        <div className="alloc-brgy-section">
            <div className="alloc-brgy-header">
                <h3>Barangay-Level Allocation Breakdown</h3>
                <span className="alloc-brgy-subtitle">
                    Which barangays received the most / least
                </span>
            </div>
            <div className="alloc-brgy-table-wrap">
                <table className="alloc-brgy-table">
                    <thead>
                        <tr>
                            <th style={{ width: 40 }}>#</th>
                            <th>Barangay</th>
                            <th>Farmers</th>
                            <th>Fertilizer (bags)</th>
                            <th>Seeds (kg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="alloc-brgy-empty">
                                    No requests yet for this season
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => (
                                <tr key={row.barangay}>
                                    <td className="alloc-brgy-rank">{idx + 1}</td>
                                    <td className="alloc-brgy-name">{row.barangay}</td>
                                    <td className="alloc-brgy-count">{row.farmerCount}</td>
                                    <td>
                                        <div className="alloc-brgy-bar-wrap">
                                            <div
                                                className="alloc-brgy-bar fert"
                                                style={{ width: `${(row.totalFertBags / maxFert) * 100}%` }}
                                            />
                                            <span className="alloc-brgy-bar-value">
                                                {row.totalFertBags.toFixed(1)}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="alloc-brgy-bar-wrap">
                                            <div
                                                className="alloc-brgy-bar seed"
                                                style={{ width: `${(row.totalSeedKg / maxSeed) * 100}%` }}
                                            />
                                            <span className="alloc-brgy-bar-value">
                                                {row.totalSeedKg.toFixed(1)}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Season Comparison Table ───────────────────────────────

interface SeasonComparisonTableProps {
    allocations: any[];
}

const FERT_FIELDS = [
    { key: 'urea_46_0_0_bags', label: 'Urea (46-0-0)', unit: 'bags' },
    { key: 'complete_14_14_14_bags', label: 'Complete (14-14-14)', unit: 'bags' },
    { key: 'ammonium_sulfate_21_0_0_bags', label: 'Ammonium Sulfate', unit: 'bags' },
    { key: 'muriate_potash_0_0_60_bags', label: 'Muriate of Potash', unit: 'bags' },
];

const SEED_FIELDS = [
    { key: 'jackpot_kg', label: 'Jackpot', unit: 'kg' },
    { key: 'us88_kg', label: 'US88', unit: 'kg' },
    { key: 'th82_kg', label: 'TH82', unit: 'kg' },
    { key: 'rh9000_kg', label: 'RH9000', unit: 'kg' },
    { key: 'lumping143_kg', label: 'Lumping143', unit: 'kg' },
    { key: 'lp296_kg', label: 'LP296', unit: 'kg' },
];

const formatSeason = (season: string) => {
    const [type, year] = season.split('_');
    return `${type.charAt(0).toUpperCase() + type.slice(1)} ${year}`;
};

export const SeasonComparisonTable: React.FC<SeasonComparisonTableProps> = ({ allocations }) => {
    const seasons = useMemo(() => {
        return allocations
            .sort((a, b) => a.season.localeCompare(b.season))
            .map((a) => ({
                season: a.season,
                label: formatSeason(a.season),
                values: a as Record<string, number>,
            }));
    }, [allocations]);

    if (seasons.length === 0) return null;

    const renderRow = (field: { key: string; label: string; unit: string }) => {
        const vals = seasons.map((s) => Number(s.values[field.key]) || 0);
        const max = Math.max(...vals, 1);

        return (
            <tr key={field.key}>
                <td className="alloc-season-item-name">
                    {field.label}
                    <span className="alloc-season-unit">{field.unit}</span>
                </td>
                {seasons.map((s, i) => {
                    const val = vals[i];
                    return (
                        <td key={s.season} className="alloc-season-val-cell">
                            <div className="alloc-season-val-bar-wrap">
                                <div
                                    className="alloc-season-val-bar"
                                    style={{
                                        width: `${(val / max) * 100}%`,
                                        backgroundColor: i === 0 ? '#16a34a' : '#0ea5e9',
                                    }}
                                />
                            </div>
                            <span className="alloc-season-val">{val.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                        </td>
                    );
                })}
            </tr>
        );
    };

    return (
        <div className="alloc-season-section">
            <div className="alloc-season-header">
                <h3>Season-by-Season Comparison</h3>
                <span className="alloc-season-subtitle">Side-by-side allocation amounts</span>
            </div>
            <div className="alloc-season-table-wrap">
                <table className="alloc-season-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            {seasons.map((s) => (
                                <th key={s.season}>{s.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {/* Fertilizers group */}
                        <tr className="alloc-season-group-row">
                            <td colSpan={seasons.length + 1}>🌱 Fertilizers</td>
                        </tr>
                        {FERT_FIELDS.map(renderRow)}

                        {/* Seeds group */}
                        <tr className="alloc-season-group-row">
                            <td colSpan={seasons.length + 1}>🌾 Seeds</td>
                        </tr>
                        {SEED_FIELDS.map(renderRow)}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
