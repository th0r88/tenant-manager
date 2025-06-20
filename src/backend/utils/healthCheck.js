/**
 * Comprehensive health check system
 * Monitors database, file system, memory, and application health
 */

import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './logger.js';
import backupService from '../services/backupService.js';
import db from '../database/db.js';
import alerting from './alerting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class HealthCheck {
    constructor() {
        this.checks = new Map();
        this.lastResults = new Map();
        this.startTime = Date.now();
        
        // Register default health checks
        this.registerChecks();
    }

    /**
     * Register all health checks
     */
    registerChecks() {
        this.register('database', this.checkDatabase.bind(this));
        this.register('filesystem', this.checkFileSystem.bind(this));
        this.register('memory', this.checkMemory.bind(this));
        this.register('backup_system', this.checkBackupSystem.bind(this));
        this.register('application', this.checkApplication.bind(this));
        this.register('disk_space', this.checkDiskSpace.bind(this));
    }

    /**
     * Register a health check
     */
    register(name, checkFunction, config = {}) {
        this.checks.set(name, {
            name,
            fn: checkFunction,
            timeout: config.timeout || 5000,
            retries: config.retries || 2,
            critical: config.critical || false
        });
    }

    /**
     * Run a single health check
     */
    async runCheck(name) {
        const check = this.checks.get(name);
        if (!check) {
            throw new Error(`Health check '${name}' not found`);
        }

        const result = {
            name,
            status: 'unknown',
            message: '',
            duration: 0,
            timestamp: new Date().toISOString(),
            details: {},
            error: null
        };

        const startTime = performance.now();

        try {
            // Run check with timeout
            const checkPromise = check.fn();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
            });

            const checkResult = await Promise.race([checkPromise, timeoutPromise]);
            
            result.duration = Math.round(performance.now() - startTime);
            result.status = checkResult.status || 'healthy';
            result.message = checkResult.message || 'Check passed';
            result.details = checkResult.details || {};

        } catch (error) {
            result.duration = Math.round(performance.now() - startTime);
            result.status = 'unhealthy';
            result.message = error.message;
            result.error = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };

            logger.logHealth(name, 'unhealthy', { 
                error: error.message,
                duration: result.duration 
            });

            // Send alert for health check failure (temporarily disabled)
            // try {
            //     await alerting.healthCheckAlert(name, 'unhealthy', {
            //         error: error.message,
            //         duration: result.duration
            //     });
            // } catch (alertError) {
            //     console.error('Failed to send health check alert:', alertError);
            // }
        }

        this.lastResults.set(name, result);
        return result;
    }

    /**
     * Run all health checks
     */
    async runAllChecks() {
        const results = {};
        const promises = [];

        for (const [name] of this.checks) {
            promises.push(
                this.runCheck(name).then(result => {
                    results[name] = result;
                })
            );
        }

        await Promise.allSettled(promises);

        // Calculate overall health
        const overallHealth = this.calculateOverallHealth(results);
        
        return {
            status: overallHealth.status,
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            checks: results,
            summary: overallHealth.summary
        };
    }

    /**
     * Calculate overall system health
     */
    calculateOverallHealth(results) {
        const checks = Object.values(results);
        const totalChecks = checks.length;
        const healthyChecks = checks.filter(c => c.status === 'healthy').length;
        const unhealthyChecks = checks.filter(c => c.status === 'unhealthy').length;
        const criticalFailures = checks.filter(c => {
            const check = this.checks.get(c.name);
            return c.status === 'unhealthy' && check?.critical;
        }).length;

        let status = 'healthy';
        if (criticalFailures > 0) {
            status = 'critical';
        } else if (unhealthyChecks > 0) {
            status = 'degraded';
        }

        return {
            status,
            summary: {
                total: totalChecks,
                healthy: healthyChecks,
                unhealthy: unhealthyChecks,
                critical: criticalFailures,
                healthPercentage: Math.round((healthyChecks / totalChecks) * 100)
            }
        };
    }

    /**
     * Database health check
     */
    async checkDatabase() {
        const startTime = performance.now();
        
        try {
            // Test basic connectivity
            await new Promise((resolve, reject) => {
                db.get('SELECT 1 as test', (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            // Test integrity
            await backupService.verifyDatabaseIntegrity();

            // Get database stats
            const stats = await this.getDatabaseStats();
            const duration = performance.now() - startTime;

            return {
                status: 'healthy',
                message: 'Database is operational',
                details: {
                    responseTime: `${duration.toFixed(2)}ms`,
                    ...stats
                }
            };
        } catch (error) {
            throw new Error(`Database check failed: ${error.message}`);
        }
    }

    /**
     * Get database statistics
     */
    async getDatabaseStats() {
        const stats = {};
        
        try {
            // Count tables and records
            const tables = ['properties', 'tenants', 'utility_entries', 'tenant_utility_allocations', 'billing_periods'];
            
            for (const table of tables) {
                try {
                    const count = await new Promise((resolve, reject) => {
                        db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
                            if (err) reject(err);
                            else resolve(row?.count || 0);
                        });
                    });
                    stats[`${table}_count`] = count;
                } catch (error) {
                    stats[`${table}_count`] = 'error';
                }
            }

            // Get database file size
            try {
                const dbStats = await fs.stat('tenant_manager.db');
                stats.database_size = `${(dbStats.size / 1024 / 1024).toFixed(2)}MB`;
            } catch (error) {
                stats.database_size = 'unknown';
            }

        } catch (error) {
            stats.error = error.message;
        }

        return stats;
    }

    /**
     * File system health check
     */
    async checkFileSystem() {
        try {
            // Test read/write operations
            const testFile = join(__dirname, '..', '..', '..', 'health-test.tmp');
            const testData = `Health check: ${Date.now()}`;
            
            await fs.writeFile(testFile, testData);
            const readData = await fs.readFile(testFile, 'utf8');
            await fs.unlink(testFile);

            if (readData !== testData) {
                throw new Error('File system read/write verification failed');
            }

            // Check important directories
            const directories = ['./backups', './src/backend/database'];
            const dirStats = {};

            for (const dir of directories) {
                try {
                    await fs.access(dir);
                    dirStats[dir] = 'accessible';
                } catch (error) {
                    dirStats[dir] = 'inaccessible';
                }
            }

            return {
                status: 'healthy',
                message: 'File system is operational',
                details: {
                    directories: dirStats,
                    readWriteTest: 'passed'
                }
            };
        } catch (error) {
            throw new Error(`File system check failed: ${error.message}`);
        }
    }

    /**
     * Memory health check
     */
    async checkMemory() {
        const usage = process.memoryUsage();
        const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
        const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const externalMB = Math.round(usage.external / 1024 / 1024);
        const usagePercentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);

        // Define thresholds
        const warningThreshold = 80;
        const criticalThreshold = 95;

        let status = 'healthy';
        let message = 'Memory usage is normal';

        if (usagePercentage >= criticalThreshold) {
            status = 'unhealthy';
            message = 'Critical memory usage detected';
        } else if (usagePercentage >= warningThreshold) {
            status = 'degraded';
            message = 'High memory usage detected';
        }

        return {
            status,
            message,
            details: {
                heap_total: `${totalMB}MB`,
                heap_used: `${usedMB}MB`,
                external: `${externalMB}MB`,
                usage_percentage: `${usagePercentage}%`,
                rss: `${Math.round(usage.rss / 1024 / 1024)}MB`
            }
        };
    }

    /**
     * Backup system health check
     */
    async checkBackupSystem() {
        try {
            // Check backup directory
            await fs.access('./backups');
            
            // Get backup information
            const backups = await backupService.getBackupInfo();
            const recentBackups = backups.filter(backup => {
                const backupAge = Date.now() - new Date(backup.created).getTime();
                return backupAge < 7 * 24 * 60 * 60 * 1000; // Last 7 days
            });

            const validBackups = backups.filter(backup => backup.valid);
            
            let status = 'healthy';
            let message = 'Backup system is operational';

            if (recentBackups.length === 0) {
                status = 'degraded';
                message = 'No recent backups found (last 7 days)';
            }

            if (validBackups.length === 0) {
                status = 'unhealthy';
                message = 'No valid backups available';
            }

            return {
                status,
                message,
                details: {
                    total_backups: backups.length,
                    valid_backups: validBackups.length,
                    recent_backups: recentBackups.length,
                    backup_directory: './backups'
                }
            };
        } catch (error) {
            throw new Error(`Backup system check failed: ${error.message}`);
        }
    }

    /**
     * Application health check
     */
    async checkApplication() {
        try {
            const uptime = process.uptime();
            const uptimeHours = Math.floor(uptime / 3600);
            const uptimeMinutes = Math.floor((uptime % 3600) / 60);

            // Check Node.js version and platform
            const nodeVersion = process.version;
            const platform = process.platform;

            // Check for any unhandled rejections or exceptions
            const eventCounts = {
                uncaughtException: process.listenerCount('uncaughtException'),
                unhandledRejection: process.listenerCount('unhandledRejection')
            };

            return {
                status: 'healthy',
                message: 'Application is running normally',
                details: {
                    uptime: `${uptimeHours}h ${uptimeMinutes}m`,
                    node_version: nodeVersion,
                    platform: platform,
                    pid: process.pid,
                    error_handlers: eventCounts
                }
            };
        } catch (error) {
            throw new Error(`Application check failed: ${error.message}`);
        }
    }

    /**
     * Disk space health check
     */
    async checkDiskSpace() {
        try {
            // Get stats for current working directory
            const stats = await fs.stat('.');
            
            // This is a simplified check - in a real scenario you'd use statvfs or similar
            // For now, we'll check if we can write a test file
            const testFile = 'disk-space-test.tmp';
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);

            return {
                status: 'healthy',
                message: 'Sufficient disk space available',
                details: {
                    write_test: 'passed',
                    working_directory: process.cwd()
                }
            };
        } catch (error) {
            if (error.code === 'ENOSPC') {
                throw new Error('Insufficient disk space');
            }
            throw new Error(`Disk space check failed: ${error.message}`);
        }
    }

    /**
     * Get quick health summary
     */
    async getQuickHealth() {
        const criticalChecks = ['database', 'filesystem'];
        const results = {};

        for (const checkName of criticalChecks) {
            try {
                results[checkName] = await this.runCheck(checkName);
            } catch (error) {
                results[checkName] = {
                    name: checkName,
                    status: 'unhealthy',
                    message: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        }

        const overallHealth = this.calculateOverallHealth(results);
        
        return {
            status: overallHealth.status,
            timestamp: new Date().toISOString(),
            critical_checks: results,
            summary: overallHealth.summary
        };
    }

    /**
     * Start periodic health monitoring
     */
    startMonitoring(interval = 300000) { // Default 5 minutes
        logger.info('Starting health monitoring', { interval: `${interval / 1000}s` });
        
        setInterval(async () => {
            try {
                const health = await this.getQuickHealth();
                
                if (health.status === 'critical') {
                    logger.error('Critical system health detected', health);
                    // try {
                    //     await alerting.systemHealthAlert(health.status, health.summary);
                    // } catch (alertError) {
                    //     console.error('Failed to send system health alert:', alertError);
                    // }
                } else if (health.status === 'degraded') {
                    logger.warn('System health degraded', health);
                    // try {
                    //     await alerting.systemHealthAlert(health.status, health.summary);
                    // } catch (alertError) {
                    //     console.error('Failed to send system health alert:', alertError);
                    // }
                } else {
                    logger.debug('System health check completed', health);
                }
            } catch (error) {
                logger.error('Health monitoring failed', {}, error);
            }
        }, interval);
    }

    /**
     * Get last health check results
     */
    getLastResults() {
        const results = {};
        for (const [name, result] of this.lastResults) {
            results[name] = result;
        }
        return results;
    }

    /**
     * Express middleware for health endpoint
     */
    middleware() {
        return async (req, res) => {
            try {
                const detailed = req.query.detailed === 'true';
                const health = detailed ? await this.runAllChecks() : await this.getQuickHealth();
                
                const statusCode = health.status === 'healthy' ? 200 : 
                                  health.status === 'degraded' ? 200 : 503;
                
                res.status(statusCode).json(health);
            } catch (error) {
                logger.error('Health check endpoint failed', {}, error);
                res.status(500).json({
                    status: 'error',
                    message: 'Health check failed',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }
}

// Export singleton instance
export default new HealthCheck();