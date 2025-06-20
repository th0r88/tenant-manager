import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './database/db.js';
import backupService from './services/backupService.js';
import { errorHandler, validateRequest } from './middleware/errorHandler.js';
import { responseMiddleware, errorResponseMiddleware } from './utils/responseFormatter.js';
import config from './config/environment.js';
import logger from './utils/logger.js';
import errorRecovery from './utils/errorRecovery.js';
import healthCheck from './utils/healthCheck.js';
// import alerting from './utils/alerting.js';
import tenantsRouter from './routes/tenants.js';
import utilitiesRouter from './routes/utilities.js';
import reportsRouter from './routes/reports.js';
import propertiesRouter from './routes/properties.js';
import dashboardRouter from './routes/dashboard.js';
import billingPeriodsRouter from './routes/billingPeriods.js';
import occupancyTrackingRouter from './routes/occupancyTracking.js';

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Validate configuration on startup
config.validate();

// Use configuration for server settings
const serverConfig = config.getServerConfig();
const PORT = serverConfig.port;

app.use(cors(serverConfig.cors));
app.use(express.json({ 
    limit: config.get('security.maxRequestSize'),
    type: 'application/json',
    verify: (req, res, buf) => {
        // Ensure proper UTF-8 encoding
        if (buf && buf.length) {
            req.rawBody = buf.toString('utf8');
        }
    }
}));

// Add response formatting middleware
app.use(responseMiddleware());

// Add request logging middleware
app.use(logger.requestMiddleware());

// Add request validation middleware
app.use(validateRequest());

// Enhanced health check endpoint
app.get('/api/health', healthCheck.middleware());

// System status endpoint
app.get('/api/status', async (req, res) => {
    try {
        const health = await healthCheck.runAllChecks();
        const circuitBreakers = errorRecovery.getCircuitBreakerStatus();
        
        res.json({
            ...health,
            circuit_breakers: circuitBreakers,
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        logger.error('Status endpoint failed', {}, error);
        res.status(500).json({
            status: 'error',
            message: 'Status check failed',
            timestamp: new Date().toISOString()
        });
    }
});

// Backup management endpoints
app.post('/api/backup/create', async (req, res) => {
    try {
        const backupPath = await backupService.createBackup();
        res.apiSuccess({ backup_path: backupPath }, 'Backup created successfully');
    } catch (error) {
        res.apiServerError('Failed to create backup', { error: error.message });
    }
});

app.get('/api/backup/list', async (req, res) => {
    try {
        const backups = await backupService.getBackupInfo();
        res.apiList(backups, backups.length, 'Backups retrieved successfully');
    } catch (error) {
        res.apiServerError('Failed to retrieve backups', { error: error.message });
    }
});

app.post('/api/backup/verify', async (req, res) => {
    try {
        await backupService.verifyDatabaseIntegrity();
        res.apiSuccess(null, 'Database integrity verified');
    } catch (error) {
        res.apiServerError('Database integrity check failed', { error: error.message });
    }
});

app.use('/api/properties', propertiesRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/utilities', utilitiesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/billing-periods', billingPeriodsRouter);
app.use('/api/occupancy-tracking', occupancyTrackingRouter);

// Serve static files from the built frontend
const distPath = join(__dirname, '..', '..', 'dist');
app.use(express.static(distPath));

// Handle client-side routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    res.sendFile(join(distPath, 'index.html'));
});

// Alert management endpoints (disabled)
// app.get('/api/alerts', async (req, res) => {
//     try {
//         const limit = parseInt(req.query.limit) || 50;
//         const alerts = await alerting.getRecentAlerts(limit);
//         res.apiList(alerts, alerts.length, 'Recent alerts retrieved successfully');
//     } catch (error) {
//         res.apiServerError('Failed to retrieve alerts', { error: error.message });
//     }
// });

// app.get('/api/alerts/stats', async (req, res) => {
//     try {
//         const stats = alerting.getAlertStats();
//         res.apiSuccess(stats, 'Alert statistics retrieved successfully');
//     } catch (error) {
//         res.apiServerError('Failed to retrieve alert statistics', { error: error.message });
//     }
// });

// app.post('/api/alerts/test', async (req, res) => {
//     try {
//         await alerting.testAlert();
//         res.apiSuccess(null, 'Test alert sent successfully');
//     } catch (error) {
//         res.apiServerError('Failed to send test alert', { error: error.message });
//     }
// });

// Response error handler (before global error handler)
app.use(errorResponseMiddleware());

// Global error handler (must be last)
app.use(errorHandler);

async function startServer() {
    try {
        // Initialize database with error recovery
        await errorRecovery.withDatabaseRecovery(async () => {
            await initializeDatabase();
        });

        // Setup error handling
        errorRecovery.setupUncaughtExceptionHandler();
        // errorRecovery.setupMemoryMonitoring(); // Temporarily disabled

        // Start automatic backups using configuration
        const backupConfig = config.getDatabaseConfig().backup;
        if (backupConfig.enabled) {
            backupService.startAutomaticBackups(backupConfig.interval);
        }

        // Start health monitoring using configuration
        const monitoringConfig = config.getMonitoringConfig();
        if (monitoringConfig.healthCheck.enabled) {
            healthCheck.startMonitoring(monitoringConfig.healthCheck.interval);
        }

        const server = app.listen(PORT, serverConfig.host, () => {
            const configSummary = config.getSummary();
            logger.info('Server started successfully', {
                ...configSummary,
                nodeVersion: process.version,
                pid: process.pid
            });
            console.log(`🚀 Server running on http://${serverConfig.host}:${PORT}`);
            console.log(`📋 Environment: ${config.getEnvironment()}`);
            console.log(`✅ Automatic database backups: ${backupConfig.enabled ? 'enabled' : 'disabled'}`);
            console.log(`✅ Health monitoring: ${monitoringConfig.healthCheck.enabled ? 'active' : 'inactive'}`);
            console.log('✅ Error recovery systems online');
            console.log('✅ API response standardization active');
            // console.log('✅ Alert system initialized');
            console.log('🔗 Useful endpoints:');
            console.log(`   Health: http://${serverConfig.host}:${PORT}/api/health`);
            console.log(`   Status: http://${serverConfig.host}:${PORT}/api/status`);
            // console.log(`   Alerts: http://${serverConfig.host}:${PORT}/api/alerts`);
        });

        // Setup graceful shutdown
        errorRecovery.setupGracefulShutdown(server, async () => {
            logger.info('Performing cleanup operations');
            // Add any cleanup operations here
        });

    } catch (error) {
        await logger.emergency('Server startup failed', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

startServer();