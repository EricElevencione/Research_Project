/**
 * Type Definitions for Municipal Incentive Distribution System
 * NO online requests, approvals, printing, or stock management
 * Record-only system for physical distribution events
 */

// ============================================================
// Database Entity
// ============================================================
export interface IncentiveDistributionLog {
    id: number;
    farmer_id: number;
    event_date: string; // ISO date string
    incentive_type: string;
    qty_requested: number;
    qty_received: number;
    is_signed: boolean;
    note: string | null;
    encoder_id: number;
    created_at: string; // ISO timestamp
    updated_at: string; // ISO timestamp
}

// ============================================================
// Request DTOs
// ============================================================

export interface CreateIncentiveLogRequest {
    farmer_id: number;
    event_date: string; // YYYY-MM-DD
    incentive_type: string;
    qty_requested: number;
    qty_received: number;
    is_signed: boolean;
    note?: string;
}

export interface GetFarmerLogsQuery {
    start_date?: string; // YYYY-MM-DD (optional filter)
    end_date?: string;   // YYYY-MM-DD (optional filter)
    incentive_type?: string; // optional filter
}

export interface GetReportQuery {
    start_date?: string;
    end_date?: string;
    incentive_type?: string;
}

// ============================================================
// Response DTOs
// ============================================================

export interface CreateIncentiveLogResponse {
    success: boolean;
    id: number;
    shortage: number; // qty_requested - qty_received
    message: string;
}

export interface FarmerLogEntry {
    id: number;
    event_date: string;
    incentive_type: string;
    qty_requested: number;
    qty_received: number;
    shortage: number;
    is_signed: boolean;
    note: string | null;
    created_at: string;
}

export interface GetFarmerLogsResponse {
    success: boolean;
    farmer_id: number;
    total_distributions: number;
    logs: FarmerLogEntry[];
}

export interface IncentiveTypeStats {
    incentive_type: string;
    total_distributions: number;
    total_requested: number;
    total_received: number;
    shortage_amount: number;
    shortage_pct: number;
}

export interface ReportSummary {
    total: number;
    fully_fulfilled: number;
    partially: number;
    unfulfilled: number;
    top_shortage: string | null; // e.g., "Rice Seeds (-28%)"
    incentive_breakdown: IncentiveTypeStats[];
}

export interface GetReportResponse {
    success: boolean;
    period: {
        start_date: string | null;
        end_date: string | null;
    };
    summary: ReportSummary;
}

// ============================================================
// Error Response
// ============================================================

export interface ErrorResponse {
    success: false;
    error: string;
    details?: any;
}

// ============================================================
// Validation Error Details
// ============================================================

export interface ValidationError {
    field: string;
    message: string;
}

export interface ValidationErrorResponse extends ErrorResponse {
    errors: ValidationError[];
}

// ============================================================
// JWT User Payload (from existing auth system)
// ============================================================

export interface JwtUser {
    id: number;
    username: string;
    role: 'encoder' | 'farmer' | 'lgu' | 'admin';
}

// ============================================================
// Express Request Extension
// ============================================================

declare global {
    namespace Express {
        interface Request {
            user?: JwtUser;
        }
    }
}
