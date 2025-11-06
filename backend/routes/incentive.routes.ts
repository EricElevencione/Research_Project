/**
 * Routes for Incentive Distribution System
 * NO file uploads - removed all multer middleware
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { IncentiveService } from '../services/incentive.service';
import { IncentiveController } from '../controllers/incentive.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

// ============================================================
// Initialize Service & Controller
// ============================================================

export function createIncentiveRoutes(pool: Pool): Router {
    const router = Router();
    const service = new IncentiveService(pool);
    const controller = new IncentiveController(service);

    // ============================================================
    // ROUTES
    // ============================================================

    /**
     * @route   POST /api/incentives/log
     * @desc    Create a new distribution log entry
     * @access  Encoder, Admin
     * @body    {
     *            farmer_id: number,
     *            event_date: string (YYYY-MM-DD),
     *            incentive_type: string,
     *            qty_requested: number,
     *            qty_received: number,
     *            is_signed: boolean (must be true),
     *            note?: string
     *          }
     */
    router.post(
        '/log',
        authenticateJWT,
        requireRole(['encoder', 'admin']),
        (req, res) => controller.createLog(req, res)
    );

    /**
     * @route   GET /api/incentives/farmer/:id
     * @desc    Get all distribution logs for a specific farmer
     * @access  Encoder, Farmer (own data), LGU, Admin
     * @params  id: farmer ID
     * @query   start_date?: YYYY-MM-DD
     *          end_date?: YYYY-MM-DD
     *          incentive_type?: string
     */
    router.get(
        '/farmer/:id',
        authenticateJWT,
        (req, res) => controller.getFarmerLogs(req, res)
    );

    /**
     * @route   GET /api/incentives/report
     * @desc    Get summary statistics and breakdown by incentive type
     * @access  LGU, Admin
     * @query   start_date?: YYYY-MM-DD
     *          end_date?: YYYY-MM-DD
     *          incentive_type?: string
     */
    router.get(
        '/report',
        authenticateJWT,
        requireRole(['lgu', 'admin']),
        (req, res) => controller.getReport(req, res)
    );

    return router;
}

// ============================================================
// USAGE IN MAIN SERVER FILE
// ============================================================

/**
 * In your main server.ts or app.ts:
 * 
 * import { createIncentiveRoutes } from './routes/incentive.routes';
 * import { pool } from './config/database';
 * 
 * app.use('/api/incentives', createIncentiveRoutes(pool));
 */
