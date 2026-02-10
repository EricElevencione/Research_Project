import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, Line, Area, AreaChart,
} from 'recharts';
import type { KPIStats, SeasonAllocation, ClaimRateTrend } from '../../hooks/useAdminDashboardStats';
import './AdminDashboardCharts.css';

// ─── KPI Cards ─────────────────────────────────────────────

interface KPICardsProps {
    kpi: KPIStats;
    currentSeason: string;
}

export const KPICards: React.FC<KPICardsProps> = ({ kpi }) => {
    const cards = [
        {
            label: 'Total Farmers',
            value: kpi.totalFarmers,
            icon: '👨‍🌾',
            color: '#16a34a',
            bgGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            borderColor: '#86efac',
            suffix: '',
        },
        {
            label: 'Total Hectares',
            value: kpi.totalHectares,
            icon: '🌾',
            color: '#0ea5e9',
            bgGradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            borderColor: '#7dd3fc',
            suffix: ' ha',
        },
        {
            label: 'Fulfillment Rate',
            value: kpi.fulfillmentRate,
            icon: '📦',
            color: '#8b5cf6',
            bgGradient: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)',
            borderColor: '#c4b5fd',
            suffix: '%',
        },
        {
            label: 'Claim Rate',
            value: kpi.claimRate,
            icon: '✅',
            color: '#f59e0b',
            bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            borderColor: '#fcd34d',
            suffix: '%',
        },
    ];

    return (
        <div className="admin-kpi-grid">
            {cards.map((card, idx) => (
                <div
                    key={idx}
                    className="admin-kpi-card"
                    style={{
                        background: card.bgGradient,
                        borderColor: card.borderColor,
                    }}
                >
                    <div className="admin-kpi-icon">{card.icon}</div>
                    <div className="admin-kpi-content">
                        <div className="admin-kpi-value" style={{ color: card.color }}>
                            {typeof card.value === 'number' && card.suffix !== '%' && card.suffix !== ' ha'
                                ? card.value.toLocaleString()
                                : card.value}
                            {card.suffix}
                        </div>
                        <div className="admin-kpi-label">{card.label}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─── Season Comparison Bar Chart ──────────────────────────

interface SeasonComparisonChartProps {
    data: SeasonAllocation[];
}

const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
        <div className="admin-chart-tooltip">
            <p className="admin-chart-tooltip-label">{label}</p>
            {payload.map((entry: any, idx: number) => (
                <p key={idx} style={{ color: entry.color, margin: '4px 0' }}>
                    {entry.name}: <strong>{entry.value.toLocaleString()}</strong>
                </p>
            ))}
        </div>
    );
};

export const SeasonComparisonChart: React.FC<SeasonComparisonChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="admin-chart-empty">
                <p>No season data available yet.</p>
            </div>
        );
    }

    return (
        <div className="admin-chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                    />
                    <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                        iconType="rect"
                    />
                    <Bar
                        dataKey="fertilizerAllocated"
                        name="Fertilizer Allocated (bags)"
                        fill="#16a34a"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                    />
                    <Bar
                        dataKey="fertilizerDistributed"
                        name="Fertilizer Distributed (bags)"
                        fill="#86efac"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                    />
                    <Bar
                        dataKey="seedsAllocated"
                        name="Seeds Allocated (kg)"
                        fill="#0ea5e9"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                    />
                    <Bar
                        dataKey="seedsDistributed"
                        name="Seeds Distributed (kg)"
                        fill="#7dd3fc"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// ─── Claim Rate Trend Line Chart ──────────────────────────

interface ClaimRateTrendChartProps {
    data: ClaimRateTrend[];
}

const CustomLineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
        <div className="admin-chart-tooltip">
            <p className="admin-chart-tooltip-label">Week of {label}</p>
            {payload.map((entry: any, idx: number) => (
                <p key={idx} style={{ color: entry.color, margin: '4px 0' }}>
                    {entry.name}: <strong>
                        {entry.name === 'Claim Rate' ? `${entry.value}%` : entry.value}
                    </strong>
                </p>
            ))}
        </div>
    );
};

export const ClaimRateTrendChart: React.FC<ClaimRateTrendChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="admin-chart-empty">
                <p>No distribution data available yet to show trends.</p>
            </div>
        );
    }

    return (
        <div className="admin-chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                        <linearGradient id="claimRateGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="distributedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="week"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                    />
                    <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                        label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                        label={{ value: 'Rate %', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#9ca3af' } }}
                    />
                    <Tooltip content={<CustomLineTooltip />} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                        iconType="circle"
                    />
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="distributed"
                        name="Distributed"
                        stroke="#16a34a"
                        fill="url(#distributedGrad)"
                        strokeWidth={2}
                    />
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="claimed"
                        name="Claimed"
                        stroke="#f59e0b"
                        fill="transparent"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="claimRate"
                        name="Claim Rate"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ r: 5, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
