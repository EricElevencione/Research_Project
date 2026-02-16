import { SupabaseClient } from '@supabase/supabase-js';

export interface AuditLogFilters {
    startDate?: string;
    endDate?: string;
    userName?: string;
    userRole?: string;
    action?: string;
    module?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface AuditStatsParams {
    period?: '7d' | '30d' | '90d' | 'all';
}

export class AuditAPI {
    private supabase: SupabaseClient;

    constructor(supabase: SupabaseClient) {
        this.supabase = supabase;
    }

    /**
     * Fetch audit logs with filters and pagination
     */
    async getLogs(filters: AuditLogFilters = {}) {
        const {
            startDate,
            endDate,
            userName,
            userRole,
            action,
            module,
            search,
            page = 1,
            limit = 25
        } = filters;

        let query = this.supabase
            .from('audit_logs')
            .select('*', { count: 'exact' });

        // Apply filters
        if (startDate) {
            query = query.gte('timestamp', startDate);
        }
        if (endDate) {
            query = query.lte('timestamp', endDate);
        }
        if (userName) {
            query = query.ilike('user_name', `%${userName}%`);
        }
        if (userRole) {
            query = query.eq('user_role', userRole);
        }
        if (action) {
            query = query.eq('action', action);
        }
        if (module) {
            query = query.eq('module', module);
        }
        if (search) {
            query = query.or(`description.ilike.%${search}%,module.ilike.%${search}%,record_type.ilike.%${search}%,record_id.ilike.%${search}%`);
        }

        // Pagination
        const offset = (page - 1) * limit;
        query = query
            .order('timestamp', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            throw error;
        }

        // Format timestamps
        const formattedData = data?.map(log => ({
            ...log,
            formatted_timestamp: new Date(log.timestamp).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })
        }));

        return {
            data: formattedData,
            pagination: {
                page,
                limit,
                totalCount: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        };
    }

    /**
     * Get audit statistics
     */
    async getStats(params: AuditStatsParams = {}) {
        const { period = '30d' } = params;

        // Calculate date range
        const now = new Date();
        const startDate = new Date();
        switch (period) {
            case '7d':
                startDate.setDate(now.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(now.getDate() - 90);
                break;
            case 'all':
                startDate.setFullYear(2000);
                break;
        }

        // Get total count
        const { count: total } = await this.supabase
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .gte('timestamp', startDate.toISOString());

        // Get actions distribution
        const { data: actionData } = await this.supabase
            .from('audit_logs')
            .select('action')
            .gte('timestamp', startDate.toISOString());

        const byAction = this.groupAndCount(actionData || [], 'action');

        // Get module distribution
        const { data: moduleData } = await this.supabase
            .from('audit_logs')
            .select('module')
            .gte('timestamp', startDate.toISOString());

        const byModule = this.groupAndCount(moduleData || [], 'module');

        // Get user activity
        const { data: userData } = await this.supabase
            .from('audit_logs')
            .select('user_name, user_role')
            .gte('timestamp', startDate.toISOString());

        const userGroups = (userData || []).reduce((acc: any, log: any) => {
            const key = `${log.user_name}|${log.user_role}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        const byUser = Object.entries(userGroups)
            .map(([key, count]) => {
                const [user_name, user_role] = key.split('|');
                return { user_name, user_role, count: count as number };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Get timeline data
        const { data: timelineData } = await this.supabase
            .from('audit_logs')
            .select('timestamp')
            .gte('timestamp', startDate.toISOString())
            .order('timestamp', { ascending: true });

        const timeline = this.generateTimeline(timelineData || [], period);

        // Get critical actions
        const criticalActions = ['DELETE', 'LOGIN_FAILED', 'REJECT', 'BULK_DELETE'];
        const { data: criticalData } = await this.supabase
            .from('audit_logs')
            .select('*')
            .in('action', criticalActions)
            .gte('timestamp', startDate.toISOString())
            .order('timestamp', { ascending: false })
            .limit(10);

        return {
            period,
            total: total || 0,
            byAction,
            byModule,
            byUser,
            timeline,
            criticalActions: criticalData || []
        };
    }

    /**
     * Get filter options
     */
    async getFilterOptions() {
        // Get unique actions
        const { data: actionData } = await this.supabase
            .from('audit_logs')
            .select('action')
            .order('action');

        const actions = [...new Set(actionData?.map(d => d.action) || [])];

        // Get unique modules
        const { data: moduleData } = await this.supabase
            .from('audit_logs')
            .select('module')
            .order('module');

        const modules = [...new Set(moduleData?.map(d => d.module) || [])];

        return { actions, modules };
    }

    /**
     * Export logs
     */
    async exportLogs(filters: AuditLogFilters, format: 'json' | 'csv') {
        // Get all logs matching filters (no pagination)
        const { data } = await this.getLogs({ ...filters, limit: 10000 });

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else {
            // Convert to CSV
            if (!data || data.length === 0) return '';

            const headers = [
                'ID', 'Timestamp', 'User', 'Role', 'Action', 'Module',
                'Record ID', 'Record Type', 'Description', 'IP Address'
            ];

            const rows = data.map(log => [
                log.id,
                log.formatted_timestamp,
                log.user_name,
                log.user_role,
                log.action,
                log.module,
                log.record_id || '',
                log.record_type || '',
                log.description,
                log.ip_address || ''
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            return csvContent;
        }
    }

    // Helper methods
    private groupAndCount(data: any[], key: string): { [k: string]: any; count: number }[] {
        const groups: Record<string, number> = data.reduce((acc, item) => {
            acc[item[key]] = (acc[item[key]] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(groups)
            .map(([name, count]) => ({ [key]: name, count }))
            .sort((a, b) => b.count - a.count);
    }

    private generateTimeline(data: any[], period: string) {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
        const timeline: { date: string; count: number }[] = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const count = data.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= date && logDate < nextDate;
            }).length;

            timeline.push({
                date: date.toISOString().split('T')[0],
                count
            });
        }

        return timeline;
    }
}
