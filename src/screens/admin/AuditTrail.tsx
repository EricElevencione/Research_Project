import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../components/layout/sidebarStyle.css';
import '../../assets/css/admin css/AuditTrail.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';

// Recharts for statistics
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area
} from 'recharts';

interface AuditLog {
    id: number;
    timestamp: string;
    formatted_timestamp: string;
    user_id: number | null;
    user_name: string;
    user_role: string;
    action: string;
    module: string;
    record_id: string | null;
    record_type: string | null;
    description: string;
    old_values: any;
    new_values: any;
    ip_address: string | null;
    session_id: string | null;
    metadata: any;
}

interface AuditStats {
    period: string;
    total: number;
    byAction: { action: string; count: number }[];
    byModule: { module: string; count: number }[];
    byUser: { user_name: string; user_role: string; count: number }[];
    timeline: { date: string; count: number }[];
    criticalActions: AuditLog[];
}

interface Pagination {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
}

const AuditTrail: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // State
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<AuditStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 25,
        totalCount: 0,
        totalPages: 0
    });

    // Filters
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        userName: '',
        userRole: '',
        action: '',
        module: '',
        search: ''
    });

    // Filter options
    const [actions, setActions] = useState<string[]>([]);
    const [modules, setModules] = useState<string[]>([]);

    // View state
    const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    // Colors for charts
    const ACTION_COLORS: { [key: string]: string } = {
        CREATE: '#22c55e',
        UPDATE: '#3b82f6',
        DELETE: '#ef4444',
        LOGIN: '#8b5cf6',
        LOGOUT: '#6366f1',
        LOGIN_FAILED: '#dc2626',
        APPROVE: '#10b981',
        REJECT: '#f59e0b',
        EXPORT: '#06b6d4',
        DISTRIBUTE: '#14b8a6'
    };

    const MODULE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

    // Fetch logs
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', pagination.page.toString());
            params.append('limit', pagination.limit.toString());

            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.userName) params.append('userName', filters.userName);
            if (filters.userRole) params.append('userRole', filters.userRole);
            if (filters.action) params.append('action', filters.action);
            if (filters.module) params.append('module', filters.module);
            if (filters.search) params.append('search', filters.search);

            const response = await fetch(`http://localhost:5000/api/audit/logs?${params}`);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.logs);
                setPagination(prev => ({
                    ...prev,
                    totalCount: data.pagination.totalCount,
                    totalPages: data.pagination.totalPages
                }));
            }
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, filters]);

    // Fetch stats
    const fetchStats = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/audit/stats?days=30');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching audit stats:', error);
        }
    };

    // Fetch filter options
    const fetchFilterOptions = async () => {
        try {
            const [actionsRes, modulesRes] = await Promise.all([
                fetch('http://localhost:5000/api/audit/actions'),
                fetch('http://localhost:5000/api/audit/modules')
            ]);

            if (actionsRes.ok) {
                const data = await actionsRes.json();
                setActions(data);
            }
            if (modulesRes.ok) {
                const data = await modulesRes.json();
                setModules(data);
            }
        } catch (error) {
            console.error('Error fetching filter options:', error);
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchFilterOptions();
    }, [fetchLogs]);

    useEffect(() => {
        if (viewMode === 'stats') {
            fetchStats();
        }
    }, [viewMode]);

    // Handle filter change
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Clear filters
    const clearFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            userName: '',
            userRole: '',
            action: '',
            module: '',
            search: ''
        });
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Export logs
    const handleExport = async (format: 'json' | 'csv') => {
        try {
            const params = new URLSearchParams();
            params.append('format', format);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            window.open(`http://localhost:5000/api/audit/export?${params}`, '_blank');
        } catch (error) {
            console.error('Error exporting logs:', error);
        }
    };

    // View log details
    const viewLogDetails = (log: AuditLog) => {
        setSelectedLog(log);
        setShowDetailsModal(true);
    };

    // Get action badge class
    const getActionBadgeClass = (action: string) => {
        switch (action) {
            case 'CREATE': return 'audit-badge-create';
            case 'UPDATE': return 'audit-badge-update';
            case 'DELETE': return 'audit-badge-delete';
            case 'LOGIN': return 'audit-badge-login';
            case 'LOGOUT': return 'audit-badge-logout';
            case 'LOGIN_FAILED': return 'audit-badge-failed';
            case 'APPROVE': return 'audit-badge-approve';
            case 'REJECT': return 'audit-badge-reject';
            case 'EXPORT': return 'audit-badge-export';
            case 'DISTRIBUTE': return 'audit-badge-distribute';
            default: return 'audit-badge-default';
        }
    };

    // Get action icon
    const getActionIcon = (action: string) => {
        switch (action) {
            case 'CREATE': return '➕';
            case 'UPDATE': return '✏️';
            case 'DELETE': return '🗑️';
            case 'LOGIN': return '🔓';
            case 'LOGOUT': return '🔒';
            case 'LOGIN_FAILED': return '❌';
            case 'APPROVE': return '✅';
            case 'REJECT': return '❌';
            case 'EXPORT': return '📤';
            case 'DISTRIBUTE': return '🚚';
            default: return '📋';
        }
    };

    // Format time ago
    const formatTimeAgo = (timestamp: string) => {
        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hrs ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        return then.toLocaleDateString();
    };

    return (
        <div className="page-container">
            <div className="page gap-10">
                {/* Sidebar */}
                <div className="sidebar">
                    <nav className="sidebar-nav">
                        <div className='sidebar-logo'>
                            <img src={LogoImage} alt="Logo" />
                        </div>

                        <button
                            className={`sidebar-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
                            onClick={() => navigate('/dashboard')}
                        >
                            <span className="nav-icon"><img src={HomeIcon} alt="Home" /></span>
                            <span className="nav-text">Home</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/rsbsa') ? 'active' : ''}`}
                            onClick={() => navigate('/rsbsa')}
                        >
                            <span className="nav-icon"><img src={RSBSAIcon} alt="RSBSA" /></span>
                            <span className="nav-text">RSBSA</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/gap-analysis') ? 'active' : ''}`}
                            onClick={() => navigate('/gap-analysis')}
                        >
                            <span className="nav-icon"><img src={IncentivesIcon} alt="Gap Analysis" /></span>
                            <span className="nav-text">Gap Analysis</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/incentives') ? 'active' : ''}`}
                            onClick={() => navigate('/incentives')}
                        >
                            <span className="nav-icon"><img src={IncentivesIcon} alt="Incentives" /></span>
                            <span className="nav-text">Incentives</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/masterlist')}
                        >
                            <span className="nav-icon"><img src={ApproveIcon} alt="Masterlist" /></span>
                            <span className="nav-text">Masterlist</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/audit-trail') ? 'active' : ''}`}
                            onClick={() => navigate('/audit-trail')}
                        >
                            <span className="nav-icon">📋</span>
                            <span className="nav-text">Audit Trail</span>
                        </button>

                        <button
                            className="sidebar-nav-item logout"
                            onClick={() => navigate('/')}
                        >
                            <span className="nav-icon"><img src={LogoutIcon} alt="Logout" /></span>
                            <span className="nav-text">Logout</span>
                        </button>
                    </nav>
                </div>

                {/* Main Content */}
                <div className="audit-main-content">
                    {/* Header */}
                    <div className="audit-header">
                        <div className="audit-header-left">
                            <h2>📋 System Audit Trail</h2>
                            <p>Track all system activities, changes, and user actions</p>
                        </div>
                        <div className="audit-header-right">
                            <div className="audit-view-toggle">
                                <button
                                    className={`audit-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                                    onClick={() => setViewMode('list')}
                                >
                                    📃 Log List
                                </button>
                                <button
                                    className={`audit-toggle-btn ${viewMode === 'stats' ? 'active' : ''}`}
                                    onClick={() => setViewMode('stats')}
                                >
                                    📊 Statistics
                                </button>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'list' ? (
                        <>
                            {/* Filters */}
                            <div className="audit-filters">
                                <div className="audit-filters-row">
                                    <div className="audit-filter-group">
                                        <label>Start Date</label>
                                        <input
                                            type="date"
                                            name="startDate"
                                            value={filters.startDate}
                                            onChange={handleFilterChange}
                                        />
                                    </div>
                                    <div className="audit-filter-group">
                                        <label>End Date</label>
                                        <input
                                            type="date"
                                            name="endDate"
                                            value={filters.endDate}
                                            onChange={handleFilterChange}
                                        />
                                    </div>
                                    <div className="audit-filter-group">
                                        <label>User</label>
                                        <input
                                            type="text"
                                            name="userName"
                                            value={filters.userName}
                                            onChange={handleFilterChange}
                                            placeholder="Search user..."
                                        />
                                    </div>
                                    <div className="audit-filter-group">
                                        <label>Role</label>
                                        <select name="userRole" value={filters.userRole} onChange={handleFilterChange}>
                                            <option value="">All Roles</option>
                                            <option value="admin">Admin</option>
                                            <option value="technician">Technician</option>
                                            <option value="jo">Job Order</option>
                                        </select>
                                    </div>
                                    <div className="audit-filter-group">
                                        <label>Action</label>
                                        <select name="action" value={filters.action} onChange={handleFilterChange}>
                                            <option value="">All Actions</option>
                                            {actions.map(a => (
                                                <option key={a} value={a}>{a}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="audit-filter-group">
                                        <label>Module</label>
                                        <select name="module" value={filters.module} onChange={handleFilterChange}>
                                            <option value="">All Modules</option>
                                            {modules.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="audit-filters-actions">
                                    <div className="audit-search-box">
                                        <input
                                            type="text"
                                            name="search"
                                            value={filters.search}
                                            onChange={handleFilterChange}
                                            placeholder="🔍 Search description, user, or record ID..."
                                        />
                                    </div>
                                    <button className="audit-btn audit-btn-secondary" onClick={clearFilters}>
                                        Clear Filters
                                    </button>
                                    <button className="audit-btn audit-btn-primary" onClick={() => fetchLogs()}>
                                        🔄 Refresh
                                    </button>
                                    <div className="audit-export-dropdown">
                                        <button className="audit-btn audit-btn-export">
                                            📤 Export
                                        </button>
                                        <div className="audit-export-menu">
                                            <button onClick={() => handleExport('json')}>Export JSON</button>
                                            <button onClick={() => handleExport('csv')}>Export CSV</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Summary */}
                            <div className="audit-stats-summary">
                                <div className="audit-stat-card">
                                    <span className="audit-stat-value">{pagination.totalCount}</span>
                                    <span className="audit-stat-label">Total Records</span>
                                </div>
                                <div className="audit-stat-card">
                                    <span className="audit-stat-value">{pagination.page}/{pagination.totalPages || 1}</span>
                                    <span className="audit-stat-label">Current Page</span>
                                </div>
                            </div>

                            {/* Logs Table */}
                            <div className="audit-table-container">
                                {loading ? (
                                    <div className="audit-loading">Loading audit logs...</div>
                                ) : logs.length === 0 ? (
                                    <div className="audit-empty">
                                        <p>📭 No audit logs found</p>
                                        <p>Adjust your filters or check back later</p>
                                    </div>
                                ) : (
                                    <table className="audit-table">
                                        <thead>
                                            <tr>
                                                <th>Timestamp</th>
                                                <th>User</th>
                                                <th>Action</th>
                                                <th>Module</th>
                                                <th>Description</th>
                                                <th>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map(log => (
                                                <tr key={log.id}>
                                                    <td className="audit-td-timestamp">
                                                        <div className="audit-timestamp">
                                                            <span className="audit-time-ago">{formatTimeAgo(log.timestamp)}</span>
                                                            <span className="audit-time-full">{log.formatted_timestamp}</span>
                                                        </div>
                                                    </td>
                                                    <td className="audit-td-user">
                                                        <div className="audit-user">
                                                            <span className="audit-username">{log.user_name}</span>
                                                            <span className={`audit-role-badge audit-role-${log.user_role}`}>
                                                                {log.user_role}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`audit-action-badge ${getActionBadgeClass(log.action)}`}>
                                                            {getActionIcon(log.action)} {log.action}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="audit-module-badge">{log.module}</span>
                                                    </td>
                                                    <td className="audit-td-description">
                                                        <span className="audit-description">{log.description}</span>
                                                        {log.record_id && (
                                                            <span className="audit-record-id">ID: {log.record_id}</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="audit-btn-details"
                                                            onClick={() => viewLogDetails(log)}
                                                        >
                                                            👁️ View
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Pagination */}
                            {pagination.totalPages > 1 && (
                                <div className="audit-pagination">
                                    <button
                                        disabled={pagination.page === 1}
                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                    >
                                        ← Previous
                                    </button>
                                    <span className="audit-page-info">
                                        Page {pagination.page} of {pagination.totalPages}
                                    </span>
                                    <button
                                        disabled={pagination.page === pagination.totalPages}
                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    >
                                        Next →
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Statistics View */
                        <div className="audit-stats-view">
                            {stats ? (
                                <>
                                    {/* Stats Cards */}
                                    <div className="audit-stats-cards">
                                        <div className="audit-stats-card audit-stats-total">
                                            <h3>Total Activity</h3>
                                            <p className="audit-stats-number">{stats.total}</p>
                                            <span>Last {stats.period}</span>
                                        </div>
                                    </div>

                                    {/* Charts Row */}
                                    <div className="audit-charts-row">
                                        {/* Activity Timeline */}
                                        <div className="audit-chart-card audit-chart-wide">
                                            <h4>📈 Activity Timeline</h4>
                                            <ResponsiveContainer width="100%" height={250}>
                                                <AreaChart data={stats.timeline}>
                                                    <defs>
                                                        <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#colorActivity)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="audit-charts-row">
                                        {/* Actions Distribution */}
                                        <div className="audit-chart-card">
                                            <h4>🎯 Actions Distribution</h4>
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie
                                                        data={stats.byAction}
                                                        dataKey="count"
                                                        nameKey="action"
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={80}
                                                        label={(props: Record<string, unknown>) => `${props.action} ${((props.percent as number) * 100).toFixed(0)}%`}
                                                    >
                                                        {stats.byAction.map((entry, index) => (
                                                            <Cell key={index} fill={ACTION_COLORS[entry.action] || '#64748b'} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Module Distribution */}
                                        <div className="audit-chart-card">
                                            <h4>📦 By Module</h4>
                                            <ResponsiveContainer width="100%" height={250}>
                                                <BarChart data={stats.byModule} layout="vertical">
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis type="number" />
                                                    <YAxis dataKey="module" type="category" width={100} />
                                                    <Tooltip />
                                                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                                        {stats.byModule.map((_, index) => (
                                                            <Cell key={index} fill={MODULE_COLORS[index % MODULE_COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Top Users */}
                                    <div className="audit-chart-card">
                                        <h4>👥 Most Active Users</h4>
                                        <div className="audit-top-users">
                                            {stats.byUser.map((user, idx) => (
                                                <div key={idx} className="audit-user-row">
                                                    <span className="audit-user-rank">{idx + 1}</span>
                                                    <span className="audit-user-name">{user.user_name}</span>
                                                    <span className={`audit-role-badge audit-role-${user.user_role}`}>
                                                        {user.user_role}
                                                    </span>
                                                    <span className="audit-user-count">{user.count} actions</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="audit-loading">Loading statistics...</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Details Modal */}
            {showDetailsModal && selectedLog && (
                <div className="audit-modal-overlay" onClick={() => setShowDetailsModal(false)}>
                    <div className="audit-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="audit-modal-header">
                            <h3>📋 Audit Log Details</h3>
                            <button className="audit-modal-close" onClick={() => setShowDetailsModal(false)}>✕</button>
                        </div>
                        <div className="audit-modal-body">
                            <div className="audit-detail-section">
                                <h4>General Information</h4>
                                <div className="audit-detail-grid">
                                    <div className="audit-detail-item">
                                        <span className="audit-detail-label">ID</span>
                                        <span className="audit-detail-value">{selectedLog.id}</span>
                                    </div>
                                    <div className="audit-detail-item">
                                        <span className="audit-detail-label">Timestamp</span>
                                        <span className="audit-detail-value">{selectedLog.formatted_timestamp}</span>
                                    </div>
                                    <div className="audit-detail-item">
                                        <span className="audit-detail-label">User</span>
                                        <span className="audit-detail-value">{selectedLog.user_name} ({selectedLog.user_role})</span>
                                    </div>
                                    <div className="audit-detail-item">
                                        <span className="audit-detail-label">IP Address</span>
                                        <span className="audit-detail-value">{selectedLog.ip_address || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="audit-detail-section">
                                <h4>Action Details</h4>
                                <div className="audit-detail-grid">
                                    <div className="audit-detail-item">
                                        <span className="audit-detail-label">Action</span>
                                        <span className={`audit-action-badge ${getActionBadgeClass(selectedLog.action)}`}>
                                            {getActionIcon(selectedLog.action)} {selectedLog.action}
                                        </span>
                                    </div>
                                    <div className="audit-detail-item">
                                        <span className="audit-detail-label">Module</span>
                                        <span className="audit-module-badge">{selectedLog.module}</span>
                                    </div>
                                    <div className="audit-detail-item">
                                        <span className="audit-detail-label">Record Type</span>
                                        <span className="audit-detail-value">{selectedLog.record_type || 'N/A'}</span>
                                    </div>
                                    <div className="audit-detail-item">
                                        <span className="audit-detail-label">Record ID</span>
                                        <span className="audit-detail-value">{selectedLog.record_id || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="audit-detail-section">
                                <h4>Description</h4>
                                <p className="audit-detail-description">{selectedLog.description}</p>
                            </div>

                            {selectedLog.old_values && (
                                <div className="audit-detail-section">
                                    <h4>Previous Values</h4>
                                    <pre className="audit-json-block">
                                        {JSON.stringify(selectedLog.old_values, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.new_values && (
                                <div className="audit-detail-section">
                                    <h4>New Values</h4>
                                    <pre className="audit-json-block">
                                        {JSON.stringify(selectedLog.new_values, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.metadata && (
                                <div className="audit-detail-section">
                                    <h4>Metadata</h4>
                                    <pre className="audit-json-block">
                                        {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditTrail;
