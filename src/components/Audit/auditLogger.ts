import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase';

export interface AuditLogData {
    userId?: number | null;
    userName: string;
    userRole: string;
    action: AuditAction;
    module: AuditModule;
    recordId?: string | number | null;
    recordType?: string | null;
    description: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string | null;
    sessionId?: string | null;
    metadata?: any;
}

export enum AuditAction {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    LOGIN = 'LOGIN',
    LOGOUT = 'LOGOUT',
    LOGIN_FAILED = 'LOGIN_FAILED',
    APPROVE = 'APPROVE',
    REJECT = 'REJECT',
    EXPORT = 'EXPORT',
    DISTRIBUTE = 'DISTRIBUTE',
    VIEW = 'VIEW',
    IMPORT = 'IMPORT',
    BULK_UPDATE = 'BULK_UPDATE',
    BULK_DELETE = 'BULK_DELETE'
}

export enum AuditModule {
    AUTH = 'AUTH',
    USERS = 'USERS',
    RSBSA = 'RSBSA',
    FARMERS = 'FARMERS',
    DISTRIBUTION = 'DISTRIBUTION',
    INCENTIVES = 'INCENTIVES',
    LAND_PLOTS = 'LAND_PLOTS',
    LAND_HISTORY = 'LAND_HISTORY',
    REPORTS = 'REPORTS',
    SYSTEM = 'SYSTEM',
    ALLOCATIONS = 'ALLOCATIONS',
    REQUESTS = 'REQUESTS'
}

export class AuditLogger {
    private supabase: SupabaseClient;

    constructor(supabase: SupabaseClient) {
        this.supabase = supabase;
    }

    /**
     * Log an audit event
     */
    async log(data: AuditLogData): Promise<void> {
        try {
            const { error } = await this.supabase
                .from('audit_logs')
                .insert({
                    user_id: data.userId,
                    user_name: data.userName,
                    user_role: data.userRole,
                    action: data.action,
                    module: data.module,
                    record_id: data.recordId?.toString(),
                    record_type: data.recordType,
                    description: data.description,
                    old_values: data.oldValues,
                    new_values: data.newValues,
                    ip_address: data.ipAddress,
                    session_id: data.sessionId,
                    metadata: data.metadata
                });

            if (error) {
                console.error('Failed to log audit event:', error);
            }
        } catch (err) {
            console.error('Error logging audit event:', err);
        }
    }

    /**
     * Log user authentication
     */
    async logAuth(
        userName: string,
        userRole: string,
        action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED',
        ipAddress?: string,
        metadata?: any
    ): Promise<void> {
        await this.log({
            userName,
            userRole,
            action: AuditAction[action],
            module: AuditModule.AUTH,
            description: `User ${action.toLowerCase().replace('_', ' ')}`,
            ipAddress,
            metadata
        });
    }

    /**
     * Log CRUD operations
     */
    async logCRUD(
        user: { id?: number; name: string; role: string },
        action: 'CREATE' | 'UPDATE' | 'DELETE',
        module: AuditModule,
        recordType: string,
        recordId: string | number,
        description: string,
        oldValues?: any,
        newValues?: any
    ): Promise<void> {
        await this.log({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: AuditAction[action],
            module,
            recordType,
            recordId,
            description,
            oldValues,
            newValues
        });
    }

    /**
     * Log farmer registration
     */
    async logFarmerRegistration(
        user: { id?: number; name: string; role: string },
        farmerId: number,
        farmerName: string
    ): Promise<void> {
        await this.log({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: AuditAction.CREATE,
            module: AuditModule.FARMERS,
            recordId: farmerId,
            recordType: 'farmer',
            description: `Registered new farmer: ${farmerName}`
        });
    }

    /**
     * Log RSBSA approval/rejection
     */
    async logRSBSAStatus(
        user: { id?: number; name: string; role: string },
        action: 'APPROVE' | 'REJECT',
        rsbsaId: number,
        farmerName: string,
        reason?: string
    ): Promise<void> {
        await this.log({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: AuditAction[action],
            module: AuditModule.RSBSA,
            recordId: rsbsaId,
            recordType: 'rsbsa_form',
            description: `${action === 'APPROVE' ? 'Approved' : 'Rejected'} RSBSA for ${farmerName}${reason ? ': ' + reason : ''}`,
            metadata: reason ? { reason } : undefined
        });
    }

    /**
     * Log distribution
     */
    async logDistribution(
        user: { id?: number; name: string; role: string },
        distributionId: number,
        farmerName: string,
        items: { type: string; quantity: number }[]
    ): Promise<void> {
        await this.log({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: AuditAction.DISTRIBUTE,
            module: AuditModule.DISTRIBUTION,
            recordId: distributionId,
            recordType: 'distribution',
            description: `Distributed resources to ${farmerName}`,
            newValues: { items }
        });
    }

    /**
     * Log data export
     */
    async logExport(
        user: { id?: number; name: string; role: string },
        module: AuditModule,
        exportType: string,
        recordCount: number
    ): Promise<void> {
        await this.log({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: AuditAction.EXPORT,
            module,
            description: `Exported ${recordCount} records as ${exportType}`,
            metadata: { exportType, recordCount }
        });
    }
}

// Singleton instance - auto-initialized with shared Supabase client
let auditLogger: AuditLogger | null = null;

export const initializeAuditLogger = (supabaseClient?: SupabaseClient): AuditLogger => {
    auditLogger = new AuditLogger(supabaseClient || supabase);
    return auditLogger;
};

export const getAuditLogger = (): AuditLogger => {
    if (!auditLogger) {
        // Auto-initialize with shared Supabase client
        auditLogger = new AuditLogger(supabase);
    }
    return auditLogger;
};