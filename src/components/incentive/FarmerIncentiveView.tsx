/**
 * FarmerIncentiveView.tsx
 * Read-only view of farmer's incentive distribution history
 * Shows all past distributions with status indicators
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Package, CheckCircle, X, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    Card,
    Button,
    Select,
    Input,
    LoadingSpinner,
    Alert,
} from '../ui/UIComponents';
import { incentiveApi, formatDate } from '../../services/incentiveApi';
import {
    IncentiveLog,
    FulfillmentStatus,
    getStatus,
    getStatusColor,
    INCENTIVE_TYPES,
} from '../../types/incentive';

// ============================================================
// Component Props
// ============================================================

interface FarmerIncentiveViewProps {
    farmerId: number;
    farmerName?: string;
}

// ============================================================
// Component
// ============================================================

export const FarmerIncentiveView: React.FC<FarmerIncentiveViewProps> = ({
    farmerId,
    farmerName,
}) => {
    const [logs, setLogs] = useState<IncentiveLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalDistributions, setTotalDistributions] = useState(0);

    // Filters
    const [filters, setFilters] = useState({
        start_date: '',
        end_date: '',
        incentive_type: '',
    });
    const [showFilters, setShowFilters] = useState(false);

    // ============================================================
    // Load Data
    // ============================================================

    useEffect(() => {
        loadLogs();
    }, [farmerId]);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const response = await incentiveApi.getFarmerLogs(
                farmerId,
                filters.start_date || filters.end_date || filters.incentive_type
                    ? filters
                    : undefined
            );

            setLogs(response.logs);
            setTotalDistributions(response.total_distributions);
        } catch (error: any) {
            console.error('Failed to load logs:', error);
            toast.error(error.message || 'Failed to load distribution history');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyFilters = () => {
        loadLogs();
    };

    const handleResetFilters = () => {
        setFilters({
            start_date: '',
            end_date: '',
            incentive_type: '',
        });
        setTimeout(loadLogs, 100);
    };

    // ============================================================
    // Render Status Badge
    // ============================================================

    const renderStatusBadge = (log: IncentiveLog) => {
        const status = getStatus(log.qty_requested, log.qty_received);
        const colorClass = getStatusColor(status);
        const labels = {
            [FulfillmentStatus.FULLY]: 'Fully Fulfilled',
            [FulfillmentStatus.PARTIAL]: 'Partial',
            [FulfillmentStatus.UNFULFILLED]: 'Unfulfilled',
        };

        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                {labels[status]}
            </span>
        );
    };

    // ============================================================
    // Render
    // ============================================================

    if (isLoading) {
        return (
            <div className="max-w-6xl mx-auto p-4 md:p-6">
                <Card>
                    <div className="flex items-center justify-center py-12">
                        <LoadingSpinner size="lg" />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header */}
            <Card>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            {farmerName ? `${farmerName}'s Distribution History` : 'Distribution History'}
                        </h2>
                        <p className="text-gray-600 mt-1">
                            Total: {totalDistributions} distribution{totalDistributions !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <Button
                        variant="secondary"
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center"
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </Button>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                    </div>
                )}
            </Card>

            {/* Table */}
            <Card>
                {logs.length === 0 ? (
                    <Alert variant="info">
                        <p className="font-medium">No distribution records found</p>
                        <p className="text-sm mt-1">
                            {filters.start_date || filters.end_date || filters.incentive_type
                                ? 'Try adjusting your filters'
                                : 'No distributions have been recorded for this farmer yet'}
                        </p>
                    </Alert>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Incentive Type
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Requested
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Received
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Signed
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div className="flex items-center">
                                                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                                                    {formatDate(log.event_date)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                <div className="flex items-center">
                                                    <Package className="h-4 w-4 text-gray-400 mr-2" />
                                                    {log.incentive_type}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                {log.qty_requested.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                                <span className={log.shortage > 0 ? 'text-red-600 font-medium' : 'text-gray-900'}>
                                                    {log.qty_received.toFixed(2)}
                                                </span>
                                                {log.shortage > 0 && (
                                                    <div className="text-xs text-red-500 mt-1">
                                                        -{log.shortage.toFixed(2)} short
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {renderStatusBadge(log)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {log.is_signed ? (
                                                    <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                                                ) : (
                                                    <X className="h-5 w-5 text-red-600 mx-auto" />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-4">
                            {logs.map((log) => (
                                <div key={log.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Calendar className="h-4 w-4 mr-1" />
                                            {formatDate(log.event_date)}
                                        </div>
                                        {renderStatusBadge(log)}
                                    </div>

                                    <div className="flex items-center text-gray-900 font-medium">
                                        <Package className="h-4 w-4 mr-2 text-gray-400" />
                                        {log.incentive_type}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-600">Requested:</span>
                                            <div className="font-medium text-gray-900">{log.qty_requested.toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Received:</span>
                                            <div className={`font-medium ${log.shortage > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                {log.qty_received.toFixed(2)}
                                            </div>
                                            {log.shortage > 0 && (
                                                <div className="text-xs text-red-500">-{log.shortage.toFixed(2)} short</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t">
                                        <span className="text-sm text-gray-600">Signed:</span>
                                        <div className="flex items-center">
                                            {log.is_signed ? (
                                                <>
                                                    <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                                                    <span className="text-sm text-green-600">Yes</span>
                                                </>
                                            ) : (
                                                <>
                                                    <X className="h-4 w-4 text-red-600 mr-1" />
                                                    <span className="text-sm text-red-600">No</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {log.note && (
                                        <div className="pt-3 border-t">
                                            <span className="text-xs text-gray-500 font-medium">Note:</span>
                                            <p className="text-sm text-gray-700 mt-1">{log.note}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
};
