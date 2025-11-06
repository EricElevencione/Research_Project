/**
 * JWT Authentication & Authorization Middleware
 * Used by incentive routes to protect endpoints
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtUser } from '../types/incentive.types';

// ============================================================
// JWT Authentication Middleware
// ============================================================

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.status(401).json({
            success: false,
            error: 'No authorization token provided'
        });
        return;
    }

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;

    try {
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, secret) as JwtUser;

        // Attach user to request
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}

// ============================================================
// Role-Based Authorization Middleware
// ============================================================

export function requireRole(allowedRoles: Array<'encoder' | 'farmer' | 'lgu' | 'admin'>) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                error: `Access denied. Required roles: ${allowedRoles.join(', ')}`
            });
            return;
        }

        next();
    };
}

// ============================================================
// Optional: Rate Limiting Middleware (prevent abuse)
// ============================================================

interface RateLimitStore {
    [key: string]: { count: number; resetTime: number };
}

export function createRateLimiter(maxRequests: number, windowMs: number) {
    const store: RateLimitStore = {};

    return (req: Request, res: Response, next: NextFunction): void => {
        const key = req.user?.id ? `user_${req.user.id}` : req.ip || 'unknown';
        const now = Date.now();

        if (!store[key] || store[key].resetTime < now) {
            store[key] = {
                count: 1,
                resetTime: now + windowMs
            };
            next();
            return;
        }

        store[key].count++;

        if (store[key].count > maxRequests) {
            res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.'
            });
            return;
        }

        next();
    };
}

// ============================================================
// USAGE EXAMPLE
// ============================================================

/**
 * In your routes:
 * 
 * import { authenticateJWT, requireRole, createRateLimiter } from './middleware/auth.middleware';
 * 
 * // Protect route with authentication
 * router.get('/protected', authenticateJWT, handler);
 * 
 * // Require specific roles
 * router.post('/admin-only', authenticateJWT, requireRole(['admin']), handler);
 * 
 * // Add rate limiting (100 requests per 15 minutes)
 * const rateLimiter = createRateLimiter(100, 15 * 60 * 1000);
 * router.post('/api/incentives/log', rateLimiter, authenticateJWT, handler);
 */
