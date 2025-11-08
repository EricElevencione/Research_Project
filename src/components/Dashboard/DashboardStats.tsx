import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import './DashboardStats.css';

// Color palette for pie charts
const COLORS = [
    '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
    '#00BCD4', '#CDDC39', '#FF5722', '#3F51B5', '#8BC34A',
    '#FFC107', '#E91E63', '#009688', '#673AB7', '#795548',
    '#607D8B', '#FFEB3B', '#03A9F4', '#FF6F00', '#D32F2F'
];

interface CustomTooltipProps {
    active?: boolean;
    payload?: any[];
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        return (
            <div className="custom-tooltip">
                <p className="tooltip-label">{data.name}</p>
                <p className="tooltip-value">
                    {data.value} ({((data.value / data.payload.total) * 100).toFixed(1)}%)
                </p>
            </div>
        );
    }
    return null;
};

const DashboardStats: React.FC = () => {
    const { totalFarmers, totalLandowners, barangayStats, loading, error } = useDashboardStats();

    if (loading) {
        return (
            <div className="stats-loading">
                <div className="spinner"></div>
                <p>Loading statistics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="stats-error">
                <p>Error loading statistics: {error}</p>
            </div>
        );
    }

    // Prepare data for pie charts
    const farmersData = barangayStats
        .filter(stat => stat.farmers > 0)
        .map(stat => ({
            name: stat.name,
            value: stat.farmers,
            total: totalFarmers
        }));

    const landownersData = barangayStats
        .filter(stat => stat.landowners > 0)
        .map(stat => ({
            name: stat.name,
            value: stat.landowners,
            total: totalLandowners
        }));

    return (
        <div className="dashboard-stats-container">
            {/* Farmers Section */}
            <div className="stats-section">
                <div className="stats-header">
                    <h3 className="stats-title">Active Farmers</h3>
                    <div className="stats-total">{totalFarmers}</div>
                </div>
                <div className="stats-chart-container">
                    <h4 className="chart-subtitle">Distribution by Barangay</h4>
                    {farmersData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={farmersData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {farmersData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ fontSize: '12px', maxHeight: '100px', overflowY: 'auto' }}
                                    iconType="circle"
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="no-data">No active farmers data available</div>
                    )}
                </div>
            </div>

            {/* Landowners Section */}
            <div className="stats-section">
                <div className="stats-header">
                    <h3 className="stats-title">Registered Landowners</h3>
                    <div className="stats-total">{totalLandowners}</div>
                </div>
                <div className="stats-chart-container">
                    <h4 className="chart-subtitle">Distribution by Barangay</h4>
                    {landownersData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={landownersData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {landownersData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ fontSize: '12px', maxHeight: '100px', overflowY: 'auto' }}
                                    iconType="circle"
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="no-data">No landowners data available</div>
                    )}
                </div>
            </div>

            {/* Barangay Breakdown Table */}
            <div className="stats-section stats-table-section">
                <h3 className="stats-title">Barangay Breakdown</h3>
                <div className="stats-table-container">
                    <table className="stats-table">
                        <thead>
                            <tr>
                                <th>Barangay</th>
                                <th>Active Farmers</th>
                                <th>Landowners</th>
                            </tr>
                        </thead>
                        <tbody>
                            {barangayStats.map((stat, index) => (
                                <tr key={index}>
                                    <td>{stat.name}</td>
                                    <td>{stat.farmers}</td>
                                    <td>{stat.landowners}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td><strong>Total</strong></td>
                                <td><strong>{totalFarmers}</strong></td>
                                <td><strong>{totalLandowners}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DashboardStats;
