import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import type {
    AgeBracket,
    CropDistribution,
    FarmSizeCategory,
    OwnershipBreakdown,
} from '../../hooks/useRSBSADemographics';
import './RSBSADemographics.css';

// ─── Age Distribution Histogram ─────────────────────────

interface AgeHistogramProps {
    data: AgeBracket[];
}

export const AgeDistributionChart: React.FC<AgeHistogramProps> = ({ data }) => {
    const barColors = ['#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'];

    return (
        <div className="rsbsa-chart-card">
            <div className="rsbsa-chart-header">
                <h3>Age Distribution</h3>
                <span className="rsbsa-chart-subtitle">Farmer count by age bracket</span>
            </div>
            <div className="rsbsa-chart-body">
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="bracket"
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            axisLine={{ stroke: '#d1d5db' }}
                        />
                        <YAxis
                            allowDecimals={false}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            axisLine={{ stroke: '#d1d5db' }}
                        />
                        <Tooltip
                            contentStyle={{
                                background: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            }}
                            formatter={(value: number) => [`${value} farmer${value !== 1 ? 's' : ''}`, 'Count']}
                        />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                            {data.map((_entry, idx) => (
                                <Cell key={idx} fill={barColors[idx % barColors.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ─── Crop Type Distribution ─────────────────────────────

interface CropChartProps {
    data: CropDistribution[];
}

export const CropDistributionChart: React.FC<CropChartProps> = ({ data }) => {
    return (
        <div className="rsbsa-chart-card">
            <div className="rsbsa-chart-header">
                <h3>Crop Type Distribution</h3>
                <span className="rsbsa-chart-subtitle">Types of farming activities</span>
            </div>
            <div className="rsbsa-chart-body">
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                        <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                        />
                        <YAxis
                            dataKey="crop"
                            type="category"
                            tick={{ fill: '#374151', fontSize: 13, fontWeight: 500 }}
                            width={100}
                        />
                        <Tooltip
                            contentStyle={{
                                background: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            }}
                            formatter={(value: number, _name: string, props: any) => [
                                `${value} (${props.payload.percentage}%)`,
                                props.payload.crop,
                            ]}
                        />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={32}>
                            {data.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ─── Farm Size Distribution Cards ───────────────────────

interface FarmSizeProps {
    data: FarmSizeCategory[];
    total: number;
}

export const FarmSizeCards: React.FC<FarmSizeProps> = ({ data, total }) => {
    return (
        <div className="rsbsa-farm-size-section">
            <div className="rsbsa-section-header">
                <h3>Farm Size Distribution</h3>
                <span className="rsbsa-section-subtitle">Categorized by total farm area</span>
            </div>
            <div className="rsbsa-farm-size-grid">
                {data.map((cat) => (
                    <div
                        key={cat.label}
                        className="rsbsa-farm-size-card"
                        style={{ background: cat.bgGradient, borderColor: cat.color + '40' }}
                    >
                        <div className="rsbsa-farm-size-icon">{cat.icon}</div>
                        <div className="rsbsa-farm-size-info">
                            <span className="rsbsa-farm-size-label">{cat.label}</span>
                            <span className="rsbsa-farm-size-desc">{cat.description}</span>
                        </div>
                        <div className="rsbsa-farm-size-stats">
                            <span className="rsbsa-farm-size-count" style={{ color: cat.color }}>
                                {cat.count}
                            </span>
                            <span className="rsbsa-farm-size-pct">
                                {cat.percentage}% of {total}
                            </span>
                        </div>
                        {/* Progress bar */}
                        <div className="rsbsa-farm-size-bar-bg">
                            <div
                                className="rsbsa-farm-size-bar-fill"
                                style={{
                                    width: `${cat.percentage}%`,
                                    backgroundColor: cat.color,
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Ownership Type Breakdown ───────────────────────────

interface OwnershipProps {
    data: OwnershipBreakdown[];
    total: number;
}

export const OwnershipBreakdownChart: React.FC<OwnershipProps> = ({ data, total }) => {
    // Filter out zero-count for pie chart
    const pieData = data.filter((d) => d.count > 0).map(d => ({
        ...d,
        [Symbol.for('x')]: undefined, // satisfy ChartDataInput index signature
    } as any));

    return (
        <div className="rsbsa-chart-card">
            <div className="rsbsa-chart-header">
                <h3>Ownership Type</h3>
                <span className="rsbsa-chart-subtitle">Registered Owner vs Tenant vs Lessee</span>
            </div>
            <div className="rsbsa-ownership-body">
                {/* Pie Chart */}
                <div className="rsbsa-ownership-pie">
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                dataKey="count"
                                nameKey="type"
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={85}
                                paddingAngle={3}
                                stroke="none"
                            >
                                {pieData.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    background: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                }}
                                formatter={(value: number) => [`${value} farmer${value !== 1 ? 's' : ''}`, '']}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                {/* Legend list */}
                <div className="rsbsa-ownership-legend">
                    {data.map((item) => (
                        <div key={item.type} className="rsbsa-ownership-legend-item">
                            <div className="rsbsa-ownership-dot" style={{ backgroundColor: item.color }} />
                            <div className="rsbsa-ownership-legend-info">
                                <span className="rsbsa-ownership-type">{item.type}</span>
                                <span className="rsbsa-ownership-count">
                                    {item.count} ({item.percentage}%)
                                </span>
                            </div>
                            {/* Mini bar */}
                            <div className="rsbsa-ownership-bar-bg">
                                <div
                                    className="rsbsa-ownership-bar-fill"
                                    style={{
                                        width: `${item.percentage}%`,
                                        backgroundColor: item.color,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                    <div className="rsbsa-ownership-total">
                        Total: <strong>{total}</strong> farmers
                    </div>
                </div>
            </div>
        </div>
    );
};
