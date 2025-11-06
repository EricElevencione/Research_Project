/**
 * LGUReport.tsx
 * Dashboard for LGU staff with statistics and CSV export
 * Shows summary cards, shortage breakdown, and filterable data
 */

import React, { useState, useEffect } from 'react';
import {
    TrendingUp,
    Users,
    AlertTriangle,
    CheckCircle2,
    Download,
    Calendar,
    BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    Card,
    Button,
    Input,
    Select,
    LoadingSpinner,
    Alert,
    Badge,
} from '../ui/UIComponents';
import { incentiveApi, exportToCSV, formatNumber } from '../../services/incentiveApi';
import { ReportSummary, INCENTIVE_TYPES } from '../../types/incentive';

// ============================================================
// Component
// ============================================================

export const LGUReport: React.FC = () => {
    const [summary, setSummary] = useState<ReportSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [period, setPeriod] = useState<{ start_date: string | null; end_date: string | null }>({ start_date: null, end_date: null });

    // Filters
    const [filters, setFilters] = useState({
        start_date: '',
        end_date: '',
        incentive_type: '',
    });

    // ============================================================
    // Load Data
    // ============================================================

    useEffect(() => {
        loadReport();
    }, []);

    const loadReport = async () => {
        setIsLoading(true);
        try {
            const response = await incentiveApi.getReport(
                filters.start_date || filters.end_date || filters.incentive_type
                    ? filters
                    : undefined
            );

            setSummary(response.summary);
            setPeriod(response.period);
        } catch (error: any) {
            console.error('Failed to load report:', error);
            toast.error(error.message || 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyFilters = () => {
        loadReport();
    };

    const handleResetFilters = () => {
        setFilters({
            start_date: '',
            end_date: '',
            incentive_type: '',
        });
        setTimeout(loadReport, 100);
    };

    // ============================================================
    // Export to CSV
    // ============================================================

    const handleExportCSV = () => {
        if (!summary) return;

        const csvData = summary.incentive_breakdown.map((item) => ({
            'Incentive Type': item.incentive_type,
            'Total Distributions': item.total_distributions,
            'Total Requested': formatNumber(item.total_requested),
            'Total Received': formatNumber(item.total_received),
            'Shortage Amount': formatNumber(item.shortage_amount),
            'Shortage %': formatNumber(item.shortage_pct) + '%',
        }));

        const filename = `incentive-report-${new Date().toISOString().split('T')[0]}.csv`;
        exportToCSV(csvData, filename);
        toast.success('Report exported successfully');
    };

    // ============================================================
    // Calculate Percentages
    // ============================================================

    const getPercentage = (value: number, total: number): string => {
        if (total === 0) return '0';
        return ((value / total) * 100).toFixed(1);
    };

    // ============================================================
    // Render
    // ============================================================

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto p-4 md:p-6">
                <Card>
                    <div className="flex items-center justify-center py-12">
                        <LoadingSpinner size="lg" />
                    </div>
                </Card>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="max-w-7xl mx-auto p-4 md:p-6">
                <Alert variant="danger">
                    <p className="font-medium">Failed to load report</p>
                    <p className="text-sm mt-1">Please try refreshing the page</p>
                </Alert>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Incentive Distribution Report</h1>
                    <p className="text-gray-600 mt-1">
                        {period.start_date && period.end_date
                            ? `${period.start_date} to ${period.end_date}`
                            : 'All Time'}
                    </p>
                </div>

                <Button
                    onClick={handleExportCSV}
                    variant="success"
                    className="flex items-center"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Export to CSV
                </Button>
            </div>

            {/* Filters */}
            <Card title="Filters">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                        type="date"
                        label="From Date"
                        value={filters.start_date}
                        onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                    />

                    <Input
                        type="date"
                        label="To Date"
                        value={filters.end_date}
                        onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                    />

                    <Select
                        label="Incentive Type"
                        value={filters.incentive_type}
                        onChange={(e) => setFilters({ ...filters, incentive_type: e.target.value })}
                        options={[
                            { value: '', label: 'All Types' },
                            ...INCENTIVE_TYPES.map((type) => ({ value: type, label: type })),
                        ]}
                    />
                </div>

                <div className="flex items-center justify-end space-x-3 mt-4">
                    <Button variant="secondary" onClick={handleResetFilters}>
                        Reset
                    </Button>
                    <Button onClick={handleApplyFilters}>Apply Filters</Button>
                </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Distributions */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Distributions</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{summary.total}</p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-full">
                            <Users className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>
                </div>

                {/* Fully Fulfilled */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Fully Fulfilled</p>
                            <p className="text-3xl font-bold text-green-600 mt-2">{summary.fully_fulfilled}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {getPercentage(summary.fully_fulfilled, summary.total)}%
                            </p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-full">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                </div>

                {/* Partially Fulfilled */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Partially Fulfilled</p>
                            <p className="text-3xl font-bold text-yellow-600 mt-2">{summary.partially}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {getPercentage(summary.partially, summary.total)}%
                            </p>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded-full">
                            <TrendingUp className="h-6 w-6 text-yellow-600" />
                        </div>
                    </div>
                </div>

                {/* Unfulfilled */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Unfulfilled</p>
                            <p className="text-3xl font-bold text-red-600 mt-2">{summary.unfulfilled}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {getPercentage(summary.unfulfilled, summary.total)}%
                            </p>
                        </div>
                        <div className="p-3 bg-red-100 rounded-full">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Shortage Alert */}
            {summary.top_shortage && (
                <Alert variant="warning">
                    <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        <div>
                            <p className="font-medium">Highest Shortage</p>
                            <p className="text-sm mt-1">{summary.top_shortage}</p>
                        </div>
                    </div>
                </Alert>
            )}

            {/* Breakdown Table */}
            <Card title="Breakdown by Incentive Type" subtitle="Detailed statistics for each incentive type">
                {summary.incentive_breakdown.length === 0 ? (
                    <Alert variant="info">
                        <p>No data available for the selected period</p>
                    </Alert>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Incentive Type
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Total Dist.
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Total Requested
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Total Received
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Shortage
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Shortage %
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {summary.incentive_breakdown.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                <div className="flex items-center">
                                                    <BarChart3 className="h-4 w-4 text-gray-400 mr-2" />
                                                    {item.incentive_type}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {item.total_distributions}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                {formatNumber(item.total_requested)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {formatNumber(item.total_received)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                                <span className={item.shortage_amount > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                                                    {formatNumber(item.shortage_amount)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                {item.shortage_pct > 0 ? (
                                                    <Badge variant="danger">{formatNumber(item.shortage_pct)}%</Badge>
                                                ) : (
                                                    <Badge variant="success">0%</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile/Tablet Cards */}
                        <div className="lg:hidden space-y-4">
                            {summary.incentive_breakdown.map((item, index) => (
                                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center font-medium text-gray-900">
                                            <BarChart3 className="h-4 w-4 text-gray-400 mr-2" />
                                            {item.incentive_type}
                                        </div>
                                        {item.shortage_pct > 0 ? (
                                            <Badge variant="danger">{formatNumber(item.shortage_pct)}%</Badge>
                                        ) : (
                                            <Badge variant="success">0%</Badge>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-600">Total Distributions:</span>
                                            <div className="font-medium text-gray-900">{item.total_distributions}</div>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Shortage:</span>
                                            <div className={`font-medium ${item.shortage_amount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                {formatNumber(item.shortage_amount)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm pt-3 border-t">
                                        <div>
                                            <span className="text-gray-600">Requested:</span>
                                            <div className="font-medium text-gray-900">{formatNumber(item.total_requested)}</div>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Received:</span>
                                            <div className="font-medium text-gray-900">{formatNumber(item.total_received)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Card>

            {/* Summary Footer */}
            <Card>
                <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>Last updated: {new Date().toLocaleString()}</span>
                    </div>
                    <div>
                        Total records: {summary.total}
                    </div>
                </div>
            </Card>
        </div>
    );
};
