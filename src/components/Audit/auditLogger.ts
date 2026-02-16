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
    includeRouteContext?: boolean;
}

export interface AuditLogOptions {
    metadata?: any;
    includeRouteContext?: boolean;
}

export interface FarmerRegistrationAuditDetails {
    ownershipCategory?: string;
    totalParcels?: number;
    totalFarmAreaHa?: number;
    farmLocation?: {
        barangay?: string | null;
        municipality?: string | null;
        province?: string | null;
    };
    selectedLandOwner?: {
        id?: string | number;
        name?: string;
        barangay?: string;
        municipality?: string;
    } | null;
    selectedParcelIds?: string[];
    farmActivities?: Record<string, any>;
    farmlandParcels?: Array<Record<string, any>>;
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
    private recentEventCache: Map<string, number>;

    constructor(supabase: SupabaseClient) {
        this.supabase = supabase;
        this.recentEventCache = new Map();
    }

    private isRecentDuplicate(eventKey: string, windowMs = 5000): boolean {
        const now = Date.now();
        const lastSeenAt = this.recentEventCache.get(eventKey);

        for (const [key, timestamp] of this.recentEventCache.entries()) {
            if (now - timestamp > windowMs) {
                this.recentEventCache.delete(key);
            }
        }

        if (lastSeenAt && now - lastSeenAt < windowMs) {
            return true;
        }

        this.recentEventCache.set(eventKey, now);
        return false;
    }

    private normalizeUserName(userName?: string | null): string {
        const normalized = (userName || '').trim();
        if (!normalized || normalized.toLowerCase() === 'unknown') {
            return 'Anonymous';
        }
        return normalized;
    }

    private normalizeUserRole(userRole?: string | null): string {
        const normalized = (userRole || '').trim();
        if (!normalized || normalized.toLowerCase() === 'unknown') {
            return 'anonymous';
        }
        return normalized;
    }

    private getRouteContext(): Record<string, string> | null {
        if (typeof window === 'undefined' || !window.location) {
            return null;
        }

        const { pathname, search, hash, href } = window.location;
        const fullPath = `${pathname || ''}${search || ''}${hash || ''}`;

        return {
            route_path: pathname || '',
            route_full_path: fullPath,
            route_url: href || ''
        };
    }

    /**
     * Log an audit event
     */
    async log(data: AuditLogData): Promise<void> {
        try {
            const routeContext = this.getRouteContext();
            let metadataToSave: any = data.metadata ?? null;
            const includeRouteContext = data.includeRouteContext !== false;

            if (includeRouteContext && routeContext) {
                if (metadataToSave && typeof metadataToSave === 'object' && !Array.isArray(metadataToSave)) {
                    metadataToSave = { ...metadataToSave, ...routeContext };
                } else if (metadataToSave !== null && metadataToSave !== undefined) {
                    metadataToSave = { ...routeContext, raw_metadata: metadataToSave };
                } else {
                    metadataToSave = routeContext;
                }
            }

            const { error } = await this.supabase
                .from('audit_logs')
                .insert({
                    user_id: data.userId,
                    user_name: this.normalizeUserName(data.userName),
                    user_role: this.normalizeUserRole(data.userRole),
                    action: data.action,
                    module: data.module,
                    record_id: data.recordId?.toString(),
                    record_type: data.recordType,
                    description: data.description,
                    old_values: data.oldValues,
                    new_values: data.newValues,
                    ip_address: data.ipAddress,
                    session_id: data.sessionId,
                    metadata: metadataToSave
                });

            if (error) {
                console.error('Failed to log audit event:', error.message, error.details, error.hint);
                console.error('Full error:', JSON.stringify(error));
            } else {
                console.log('Audit event logged successfully:', data.action, data.module, data.description);
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
        newValues?: any,
        options?: AuditLogOptions
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
            newValues,
            metadata: options?.metadata,
            includeRouteContext: options?.includeRouteContext
        });
    }

    /**
     * Log farmer registration
     */
    async logFarmerRegistration(
        user: { id?: number; name: string; role: string },
        farmerId: number,
        farmerName: string,
        details?: FarmerRegistrationAuditDetails
    ): Promise<void> {
        const dedupeKey = `farmer_registration:${user.id ?? 'anonymous'}:${farmerId}`;
        if (this.isRecentDuplicate(dedupeKey, 10000)) {
            console.warn('Skipped duplicate farmer registration audit event:', dedupeKey);
            return;
        }

        const farmDetails = details && Object.keys(details).length > 0 ? details : undefined;
        await this.log({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: AuditAction.CREATE,
            module: AuditModule.FARMERS,
            recordId: farmerId,
            recordType: 'farmer',
            description: `Registered new farmer: ${farmerName}`,
            newValues: farmDetails ? { farmerName, farmDetails } : undefined,
            metadata: farmDetails ? { farmDetails } : undefined
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
