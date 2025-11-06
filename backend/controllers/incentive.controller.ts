/**
 * Controller Layer for Incentive Distribution System
 * Handles HTTP requests/responses, authentication, and authorization
 * NO file uploads, online requests, approvals, or printing
 */

import { Request, Response } from 'express';
import {
    IncentiveService,
    ValidationException,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError
} from '../services/incentive.service';
import {
    CreateIncentiveLogRequest,
    CreateIncentiveLogResponse,
    GetFarmerLogsResponse,
    GetReportResponse,
    ErrorResponse,
    ValidationErrorResponse
} from '../types/incentive.types';

export class IncentiveController {
    private service: IncentiveService;

    constructor(service: IncentiveService) {
        this.service = service;
    }

    // ============================================================
    // POST /api/incentives/log
    // Role: encoder only
    // ============================================================

    async createLog(req: Request, res: Response): Promise<void> {
        try {
            // Authorization check
            if (!req.user) {
                throw new UnauthorizedError('Authentication required');
            }

            if (req.user.role !== 'encoder' && req.user.role !== 'admin') {
                throw new ForbiddenError('Only encoders can create distribution logs');
            }

            // Extract and sanitize input
            const data: CreateIncentiveLogRequest = {
                farmer_id: parseInt(req.body.farmer_id),
                event_date: String(req.body.event_date).trim(),
                incentive_type: String(req.body.incentive_type).trim(),
                qty_requested: parseFloat(req.body.qty_requested),
                qty_received: parseFloat(req.body.qty_received),
                is_signed: Boolean(req.body.is_signed),
                note: req.body.note ? String(req.body.note).trim() : undefined
            };

            // Create log entry
            const result = await this.service.createLog(data, req.user.id);

            // Success response
            const response: CreateIncentiveLogResponse = {
                success: true,
                id: result.id,
                shortage: result.shortage,
                message:
                    result.shortage === 0
                        ? 'Distribution recorded successfully - fully fulfilled'
                        : `Distribution recorded with shortage of ${result.shortage.toFixed(2)} units`
            };

            res.status(201).json(response);
        } catch (error) {
            this.handleError(error, res);
        }
    }

    // ============================================================
    // GET /api/incentives/farmer/:id
    // Role: encoder, farmer (own data), lgu, admin
    // ============================================================

    async getFarmerLogs(req: Request, res: Response): Promise<void> {
        try {
            // Authorization check
            if (!req.user) {
                throw new UnauthorizedError('Authentication required');
            }

            const farmer_id = parseInt(req.params.id);

            if (isNaN(farmer_id) || farmer_id <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid farmer ID'
                } as ErrorResponse);
                return;
            }

            // Farmers can only view their own data
            if (req.user.role === 'farmer' && req.user.id !== farmer_id) {
                throw new ForbiddenError('You can only view your own distribution logs');
            }

            // Extract query params
            const query = {
                start_date: req.query.start_date as string | undefined,
                end_date: req.query.end_date as string | undefined,
                incentive_type: req.query.incentive_type as string | undefined
            };

            // Get logs
            const result = await this.service.getFarmerLogs(farmer_id, query);

            const response: GetFarmerLogsResponse = {
                success: true,
                ...result
            };

            res.status(200).json(response);
        } catch (error) {
            this.handleError(error, res);
        }
    }

    // ============================================================
    // GET /api/incentives/report
    // Role: lgu, admin only
    // ============================================================

    async getReport(req: Request, res: Response): Promise<void> {
        try {
            // Authorization check
            if (!req.user) {
                throw new UnauthorizedError('Authentication required');
            }

            if (req.user.role !== 'lgu' && req.user.role !== 'admin') {
                throw new ForbiddenError('Only LGU staff can access reports');
            }

            // Extract query params
            const query = {
                start_date: req.query.start_date as string | undefined,
                end_date: req.query.end_date as string | undefined,
                incentive_type: req.query.incentive_type as string | undefined
            };

            // Get report
            const result = await this.service.getReport(query);

            const response: GetReportResponse = {
                success: true,
                ...result
            };

            res.status(200).json(response);
        } catch (error) {
            this.handleError(error, res);
        }
    }

    // ============================================================
    // ERROR HANDLER
    // ============================================================

    private handleError(error: unknown, res: Response): void {
        console.error('Controller error:', error);

        if (error instanceof ValidationException) {
            const response: ValidationErrorResponse = {
                success: false,
                error: 'Validation failed',
                errors: error.errors
            };
            res.status(400).json(response);
            return;
        }

        if (error instanceof NotFoundError) {
            const response: ErrorResponse = {
                success: false,
                error: error.message
            };
            res.status(404).json(response);
            return;
        }

        if (error instanceof UnauthorizedError) {
            const response: ErrorResponse = {
                success: false,
                error: error.message
            };
            res.status(401).json(response);
            return;
        }

        if (error instanceof ForbiddenError) {
            const response: ErrorResponse = {
                success: false,
                error: error.message
            };
            res.status(403).json(response);
            return;
        }

        // Database errors
        if (error instanceof Error) {
            // PostgreSQL constraint violations
            if ('code' in error) {
                const pgError = error as any;

                if (pgError.code === '23503') {
                    // Foreign key violation
                    const response: ErrorResponse = {
                        success: false,
                        error: 'Referenced record not found',
                        details: pgError.detail
                    };
                    res.status(400).json(response);
                    return;
                }

                if (pgError.code === '23514') {
                    // Check constraint violation
                    const response: ErrorResponse = {
                        success: false,
                        error: 'Data validation failed',
                        details: pgError.detail || 'Check constraint violation'
                    };
                    res.status(400).json(response);
                    return;
                }
            }
        }

        // Generic error
        const response: ErrorResponse = {
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development'
                ? (error instanceof Error ? error.message : String(error))
                : undefined
        };
        res.status(500).json(response);
    }
}

// ============================================================
// Factory Function (for dependency injection)
// ============================================================

export function createIncentiveController(service: IncentiveService): IncentiveController {
    return new IncentiveController(service);
}
