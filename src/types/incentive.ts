/**
 * TypeScript Types for Incentive Distribution System
 */

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface ValidationError {
    field: string;
    message: string;
}

export interface ValidationErrorResponse {
    success: false;
    error: string;
    errors: ValidationError[];
}

// ============================================================
// Farmer Types
// ============================================================

export interface Farmer {
    id: number;
    first_name: string;
    last_name: string;
    middle_name?: string;
    rsbsa_num: string;
    barangay?: string;
    mobile_num?: string;
}

export interface FarmerSearchResult {
    id: number;
    name: string;
    rsbsa_num: string;
    barangay?: string;
}

// ============================================================
// Incentive Distribution Types
// ============================================================

export interface IncentiveLog {
    id: number;
    event_date: string; // YYYY-MM-DD
    incentive_type: string;
    qty_requested: number;
    qty_received: number;
    shortage: number;
    is_signed: boolean;
    note: string | null;
    created_at: string;
}

export interface CreateIncentiveRequest {
    farmer_id: number;
    event_date: string;
    incentive_type: string;
    qty_requested: number;
    qty_received: number;
    is_signed: boolean;
    note?: string;
}

export interface CreateIncentiveResponse {
    success: boolean;
    id: number;
    shortage: number;
    message: string;
}

export interface FarmerLogsResponse {
    success: boolean;
    farmer_id: number;
    total_distributions: number;
    logs: IncentiveLog[];
}

// ============================================================
// Report Types
// ============================================================

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
    top_shortage: string | null;
    incentive_breakdown: IncentiveTypeStats[];
}

export interface ReportResponse {
    success: boolean;
    period: {
        start_date: string | null;
        end_date: string | null;
    };
    summary: ReportSummary;
}

// ============================================================
// Form Types
// ============================================================

export interface IncentiveFormData {
    farmer_id: number;
    farmer_name?: string;
    event_date: string;
    incentive_type: string;
    qty_requested: string | number;
    qty_received: string | number;
    is_signed: boolean;
    note: string;
}

// ============================================================
// User/Auth Types
// ============================================================

export interface User {
    id: number;
    username: string;
    role: 'encoder' | 'farmer' | 'lgu' | 'admin';
    email?: string;
}

export interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

// ============================================================
// Incentive Type Options
// ============================================================

export const INCENTIVE_TYPES: string[] = [
    'Rice Seeds 20kg',
    'Corn Seeds 10kg',
    'Fertilizer 50kg',
    'Organic Fertilizer 25kg',
    'Bio-Fertilizer 10L',
    'Pesticide 1L',
    'Herbicide 1L',
    'Farm Tools',
    'Other'
];

export type IncentiveType = string;

// ============================================================
// Status Enums
// ============================================================

export enum FulfillmentStatus {
    FULLY = 'fully',
    PARTIAL = 'partial',
    UNFULFILLED = 'unfulfilled'
}

export const getStatus = (requested: number, received: number): FulfillmentStatus => {
    if (received === 0) return FulfillmentStatus.UNFULFILLED;
    if (received < requested) return FulfillmentStatus.PARTIAL;
    return FulfillmentStatus.FULLY;
};

export const getStatusColor = (status: FulfillmentStatus): string => {
    switch (status) {
        case FulfillmentStatus.FULLY:
            return 'bg-green-100 text-green-800 border-green-300';
        case FulfillmentStatus.PARTIAL:
            return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case FulfillmentStatus.UNFULFILLED:
            return 'bg-red-100 text-red-800 border-red-300';
    }
};
