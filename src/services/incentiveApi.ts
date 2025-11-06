/**
 * API Service for Incentive Distribution System
 * Handles all HTTP requests to the backend API
 */

import {
    CreateIncentiveRequest,
    CreateIncentiveResponse,
    FarmerLogsResponse,
    FarmerSearchResult,
    ReportResponse,
} from '../types/incentive';

// ============================================================
// Configuration
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const INCENTIVE_API = `${API_BASE_URL}/api/incentives`;

// ============================================================
// Helper: Get Auth Token
// ============================================================

const getAuthToken = (): string | null => {
    return localStorage.getItem('token');
};

const getAuthHeaders = (): HeadersInit => {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
};

// ============================================================
// Error Handling
// ============================================================

class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public errors?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
            errorData.error || 'An error occurred',
            response.status,
            errorData.errors
        );
    }
    return response.json();
}

// ============================================================
// Farmer API
// ============================================================

export const farmerApi = {
    /**
     * Search farmers by name or RSBSA
     */
    search: async (query: string): Promise<FarmerSearchResult[]> => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/farmers/search?q=${encodeURIComponent(query)}`,
                {
                    headers: getAuthHeaders(),
                }
            );
            const data = await handleResponse<{ success: boolean; farmers: any[] }>(response);

            // Transform to FarmerSearchResult format
            return data.farmers.map((f) => ({
                id: f.id,
                name: `${f.first_name} ${f.middle_name ? f.middle_name + ' ' : ''}${f.last_name}`,
                rsbsa_num: f.rsbsa_num,
                barangay: f.barangay,
            }));
        } catch (error) {
            console.error('Farmer search error:', error);
            throw error;
        }
    },

    /**
     * Get farmer by ID
     */
    getById: async (id: number): Promise<FarmerSearchResult> => {
        const response = await fetch(`${API_BASE_URL}/api/farmers/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================================
// Incentive API
// ============================================================

export const incentiveApi = {
    /**
     * Create new incentive distribution log (encoder only)
     */
    createLog: async (data: CreateIncentiveRequest): Promise<CreateIncentiveResponse> => {
        const response = await fetch(`${INCENTIVE_API}/log`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    /**
     * Get all logs for a specific farmer
     */
    getFarmerLogs: async (
        farmerId: number,
        filters?: {
            start_date?: string;
            end_date?: string;
            incentive_type?: string;
        }
    ): Promise<FarmerLogsResponse> => {
        const params = new URLSearchParams();
        if (filters?.start_date) params.append('start_date', filters.start_date);
        if (filters?.end_date) params.append('end_date', filters.end_date);
        if (filters?.incentive_type) params.append('incentive_type', filters.incentive_type);

        const url = `${INCENTIVE_API}/farmer/${farmerId}${params.toString() ? '?' + params.toString() : ''}`;

        const response = await fetch(url, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    /**
     * Get report summary (LGU only)
     */
    getReport: async (filters?: {
        start_date?: string;
        end_date?: string;
        incentive_type?: string;
    }): Promise<ReportResponse> => {
        const params = new URLSearchParams();
        if (filters?.start_date) params.append('start_date', filters.start_date);
        if (filters?.end_date) params.append('end_date', filters.end_date);
        if (filters?.incentive_type) params.append('incentive_type', filters.incentive_type);

        const url = `${INCENTIVE_API}/report${params.toString() ? '?' + params.toString() : ''}`;

        const response = await fetch(url, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================================
// Export Utilities
// ============================================================

export const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    // Get headers from first object
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
        headers.join(','), // Header row
        ...data.map((row) =>
            headers.map((header) => {
                const value = row[header];
                // Escape quotes and wrap in quotes if contains comma
                const stringValue = String(value ?? '');
                if (stringValue.includes(',') || stringValue.includes('"')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            }).join(',')
        ),
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ============================================================
// Format Utilities
// ============================================================

export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toFixed(decimals);
};

export { ApiError };
