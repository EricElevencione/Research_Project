/**
 * Standalone Incentive Distribution API Server
 * Run independently from main server using TypeScript
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { createIncentiveRoutes } from './routes/incentive.routes';

dotenv.config();

const app = express();
const port = process.env.INCENTIVE_PORT || process.env.PORT || 3001;

// ============================================================
// Database Connection
// ============================================================

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Alternative: Use connection string
    // connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('Check your .env file and database credentials');
        process.exit(1);
    }
    console.log('✅ Database connected successfully');
    console.log('   Time:', res.rows[0].now);
});

// ============================================================
// Middleware
// ============================================================

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (development only)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
}

// ============================================================
// Routes
// ============================================================

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'incentive-distribution-api',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

// API documentation endpoint
app.get('/api', (req: Request, res: Response) => {
    res.json({
        name: 'Municipal Incentive Distribution API',
        version: '1.0.0',
        description: 'Record-only system for physical seed distribution events',
        endpoints: {
            health: 'GET /health',
            createLog: 'POST /api/incentives/log (encoder/admin)',
            farmerLogs: 'GET /api/incentives/farmer/:id',
            report: 'GET /api/incentives/report (lgu/admin)'
        },
        documentation: '/api/docs',
        authentication: 'JWT Bearer token required'
    });
});

// Incentive routes
app.use('/api/incentives', createIncentiveRoutes(pool));

// ============================================================
// Error Handlers
// ============================================================

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        suggestion: 'Check /api for available endpoints'
    });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Server error:', err);

    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// Server Startup
// ============================================================

const server = app.listen(port, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🚀 Incentive Distribution API Server');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📡 Server URL: http://localhost:${port}`);
    console.log(`🏥 Health Check: http://localhost:${port}/health`);
    console.log(`📖 API Info: http://localhost:${port}/api`);
    console.log('');
    console.log('📝 Available Endpoints:');
    console.log(`   POST   http://localhost:${port}/api/incentives/log`);
    console.log(`   GET    http://localhost:${port}/api/incentives/farmer/:id`);
    console.log(`   GET    http://localhost:${port}/api/incentives/report`);
    console.log('');
    console.log(`🔐 Auth: JWT Bearer token required`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
});

// ============================================================
// Graceful Shutdown
// ============================================================

const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received, closing server gracefully...`);

    server.close(async () => {
        console.log('✅ HTTP server closed');

        try {
            await pool.end();
            console.log('✅ Database pool closed');
            process.exit(0);
        } catch (err) {
            console.error('❌ Error during shutdown:', err);
            process.exit(1);
        }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('⚠️ Forcing shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit in production, just log
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

export default app;
