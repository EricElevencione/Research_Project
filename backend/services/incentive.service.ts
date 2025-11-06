/**
 * Service Layer for Incentive Distribution System
 * Handles business logic, validation, and database operations
 * NO stock management, approvals, or file uploads
 */

import { Pool, QueryResult } from 'pg';
import {
    CreateIncentiveLogRequest,
    IncentiveDistributionLog,
    FarmerLogEntry,
    IncentiveTypeStats,
    ReportSummary,
    GetFarmerLogsQuery,
    GetReportQuery,
    ValidationError
} from '../types/incentive.types';

export class IncentiveService {
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    // ============================================================
    // CREATE LOG ENTRY
    // ============================================================

    async createLog(
        data: CreateIncentiveLogRequest,
        encoder_id: number
    ): Promise<{ id: number; shortage: number }> {
        // Validate input
        const errors = this.validateCreateRequest(data);
        if (errors.length > 0) {
            throw new ValidationException(errors);
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify farmer exists
            const farmerCheck = await client.query(
                'SELECT id FROM masterlist WHERE id = $1',
                [data.farmer_id]
            );

            if (farmerCheck.rows.length === 0) {
                throw new NotFoundError(`Farmer with ID ${data.farmer_id} not found`);
            }

            // Insert log entry
            const result = await client.query<IncentiveDistributionLog>(
                `INSERT INTO incentive_distribution_log 
          (farmer_id, event_date, incentive_type, qty_requested, qty_received, 
           is_signed, note, encoder_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, qty_requested, qty_received`,
                [
                    data.farmer_id,
                    data.event_date,
                    data.incentive_type,
                    data.qty_requested,
                    data.qty_received,
                    data.is_signed,
                    data.note || null,
                    encoder_id
                ]
            );

            await client.query('COMMIT');

            const row = result.rows[0];
            return {
                id: row.id,
                shortage: Number(row.qty_requested) - Number(row.qty_received)
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ============================================================
    // GET FARMER LOGS
    // ============================================================

    async getFarmerLogs(
        farmer_id: number,
        query: GetFarmerLogsQuery = {}
    ): Promise<{ farmer_id: number; total_distributions: number; logs: FarmerLogEntry[] }> {
        let sql = `
      SELECT 
        id,
        event_date,
        incentive_type,
        qty_requested,
        qty_received,
        (qty_requested - qty_received) as shortage,
        is_signed,
        note,
        created_at
      FROM incentive_distribution_log
      WHERE farmer_id = $1
    `;

        const params: any[] = [farmer_id];
        let paramCount = 1;

        // Apply filters
        if (query.start_date) {
            paramCount++;
            sql += ` AND event_date >= $${paramCount}`;
            params.push(query.start_date);
        }

        if (query.end_date) {
            paramCount++;
            sql += ` AND event_date <= $${paramCount}`;
            params.push(query.end_date);
        }

        if (query.incentive_type) {
            paramCount++;
            sql += ` AND incentive_type = $${paramCount}`;
            params.push(query.incentive_type);
        }

        sql += ' ORDER BY event_date DESC, created_at DESC';

        const result = await this.pool.query(sql, params);

        return {
            farmer_id,
            total_distributions: result.rows.length,
            logs: result.rows.map(row => ({
                id: row.id,
                event_date: row.event_date,
                incentive_type: row.incentive_type,
                qty_requested: Number(row.qty_requested),
                qty_received: Number(row.qty_received),
                shortage: Number(row.shortage),
                is_signed: row.is_signed,
                note: row.note,
                created_at: row.created_at
            }))
        };
    }

    // ============================================================
    // GET REPORT (LGU ONLY)
    // ============================================================

    async getReport(query: GetReportQuery = {}): Promise<{
        period: { start_date: string | null; end_date: string | null };
        summary: ReportSummary;
    }> {
        let whereClause = '';
        const params: any[] = [];
        let paramCount = 0;

        if (query.start_date) {
            paramCount++;
            whereClause += `${whereClause ? ' AND' : ' WHERE'} event_date >= $${paramCount}`;
            params.push(query.start_date);
        }

        if (query.end_date) {
            paramCount++;
            whereClause += `${whereClause ? ' AND' : ' WHERE'} event_date <= $${paramCount}`;
            params.push(query.end_date);
        }

        if (query.incentive_type) {
            paramCount++;
            whereClause += `${whereClause ? ' AND' : ' WHERE'} incentive_type = $${paramCount}`;
            params.push(query.incentive_type);
        }

        // Get overall summary
        const summaryResult = await this.pool.query(
            `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN qty_received = qty_requested THEN 1 ELSE 0 END) as fully_fulfilled,
        SUM(CASE WHEN qty_received > 0 AND qty_received < qty_requested THEN 1 ELSE 0 END) as partially,
        SUM(CASE WHEN qty_received = 0 THEN 1 ELSE 0 END) as unfulfilled
      FROM incentive_distribution_log${whereClause}`,
            params
        );

        // Get breakdown by incentive type
        const breakdownResult = await this.pool.query<{
            incentive_type: string;
            total_distributions: string;
            total_requested: string;
            total_received: string;
            shortage_amount: string;
            shortage_pct: string;
        }>(
            `SELECT 
        incentive_type,
        COUNT(*) as total_distributions,
        SUM(qty_requested) as total_requested,
        SUM(qty_received) as total_received,
        SUM(qty_requested - qty_received) as shortage_amount,
        ROUND(
          (1 - SUM(qty_received) / NULLIF(SUM(qty_requested), 0)) * 100, 
          2
        ) as shortage_pct
      FROM incentive_distribution_log${whereClause}
      GROUP BY incentive_type
      ORDER BY shortage_pct DESC NULLS LAST`,
            params
        );

        const summaryRow = summaryResult.rows[0];
        const incentive_breakdown: IncentiveTypeStats[] = breakdownResult.rows.map(row => ({
            incentive_type: row.incentive_type,
            total_distributions: Number(row.total_distributions),
            total_requested: Number(row.total_requested),
            total_received: Number(row.total_received),
            shortage_amount: Number(row.shortage_amount),
            shortage_pct: Number(row.shortage_pct) || 0
        }));

        // Find top shortage
        let top_shortage: string | null = null;
        if (incentive_breakdown.length > 0 && incentive_breakdown[0].shortage_pct > 0) {
            const top = incentive_breakdown[0];
            top_shortage = `${top.incentive_type} (-${top.shortage_pct}%)`;
        }

        return {
            period: {
                start_date: query.start_date || null,
                end_date: query.end_date || null
            },
            summary: {
                total: Number(summaryRow.total),
                fully_fulfilled: Number(summaryRow.fully_fulfilled),
                partially: Number(summaryRow.partially),
                unfulfilled: Number(summaryRow.unfulfilled),
                top_shortage,
                incentive_breakdown
            }
        };
    }

    // ============================================================
    // VALIDATION
    // ============================================================

    private validateCreateRequest(data: CreateIncentiveLogRequest): ValidationError[] {
        const errors: ValidationError[] = [];

        // Required fields
        if (!data.farmer_id || !Number.isInteger(data.farmer_id) || data.farmer_id <= 0) {
            errors.push({ field: 'farmer_id', message: 'Must be a valid positive integer' });
        }

        if (!data.event_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.event_date)) {
            errors.push({ field: 'event_date', message: 'Must be in YYYY-MM-DD format' });
        } else {
            const eventDate = new Date(data.event_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (eventDate > today) {
                errors.push({ field: 'event_date', message: 'Cannot be in the future' });
            }
        }

        if (!data.incentive_type || data.incentive_type.trim().length === 0) {
            errors.push({ field: 'incentive_type', message: 'Cannot be empty' });
        } else if (data.incentive_type.length > 100) {
            errors.push({ field: 'incentive_type', message: 'Cannot exceed 100 characters' });
        }

        if (typeof data.qty_requested !== 'number' || data.qty_requested <= 0) {
            errors.push({ field: 'qty_requested', message: 'Must be greater than 0' });
        }

        if (typeof data.qty_received !== 'number' || data.qty_received < 0) {
            errors.push({ field: 'qty_received', message: 'Cannot be negative' });
        }

        if (data.qty_received > data.qty_requested) {
            errors.push({
                field: 'qty_received',
                message: 'Cannot exceed qty_requested'
            });
        }

        if (data.is_signed !== true) {
            errors.push({
                field: 'is_signed',
                message: 'Must be true. Farmer signature required before recording.'
            });
        }

        if (data.note && data.note.length > 1000) {
            errors.push({ field: 'note', message: 'Cannot exceed 1000 characters' });
        }

        return errors;
    }
}

// ============================================================
// Custom Errors
// ============================================================

export class ValidationException extends Error {
    public errors: ValidationError[];

    constructor(errors: ValidationError[]) {
        super('Validation failed');
        this.name = 'ValidationException';
        this.errors = errors;
    }
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class UnauthorizedError extends Error {
    constructor(message: string = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends Error {
    constructor(message: string = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}
