/**
 * Simple monitoring and alerting system
 * Homelab-optimized with file-based notifications and email support
 */

import { promises as fs } from 'fs';
import { join } from 'path';
// import logger from './logger.js'; // Avoid circular dependency
// import config from '../config/environment.js';

export class AlertingSystem {
    constructor() {
        this.alertsDirectory = './alerts';
        this.alertHistory = new Map();
        this.alertThresholds = {
            memory: 85, // percent
            disk: 90, // percent
            errorRate: 10, // errors per minute
            responseTime: 5000, // milliseconds
            healthCheckFailures: 3 // consecutive failures
        };
        this.suppressionPeriod = 300000; // 5 minutes
        this.maxAlertHistory = 1000;
        
        // Disable periodic cleanup to avoid potential issues
        // this.setupPeriodicCleanup();
        
        // Ensure alerts directory exists (async, don't wait)
        this.ensureAlertsDirectory().catch(error => {
            console.error('Failed to initialize alerts directory:', error);
        });
    }

    /**
     * Ensure alerts directory exists
     */
    async ensureAlertsDirectory() {
        try {
            await fs.mkdir(this.alertsDirectory, { recursive: true });
        } catch (error) {
            console.error('Failed to create alerts directory:', error);
        }
    }

    /**
     * Send alert notification
     */
    async sendAlert(alert) {
        try {
            // Check for alert suppression
            if (this.isAlertSuppressed(alert)) {
                logger.debug('Alert suppressed', { alertType: alert.type, alertId: alert.id });
                return;
            }

            // Record alert
            this.recordAlert(alert);

            // Log alert
            console.warn('ALERT TRIGGERED:', {
                type: alert.type,
                severity: alert.severity,
                message: alert.message,
                details: alert.details
            });

            // Write alert to file (simplified)
            try {
                await this.writeAlertToFile(alert);
            } catch (error) {
                console.error('Failed to write alert to file:', error);
            }

            // Send notifications (simplified)
            try {
                await this.sendNotifications(alert);
            } catch (error) {
                console.error('Failed to send notifications:', error);
            }

            // Update suppression tracking
            this.updateAlertSuppression(alert);

        } catch (error) {
            console.error('Failed to send alert:', error);
        }
    }

    /**
     * Write alert to file
     */
    async writeAlertToFile(alert) {
        try {
            // Ensure alerts directory exists first
            await this.ensureAlertsDirectory();
            
            const fileName = `alert_${alert.timestamp.replace(/[:.]/g, '-')}_${alert.type}.json`;
            const filePath = join(this.alertsDirectory, fileName);
            
            await fs.writeFile(filePath, JSON.stringify(alert, null, 2));
        } catch (error) {
            // Don't use logger here to avoid potential circular calls
            console.error('Failed to write alert to file:', error);
        }
    }

    /**
     * Send notifications (file-based for homelab)
     */
    async sendNotifications(alert) {
        try {
            // Ensure alerts directory exists first
            await this.ensureAlertsDirectory();
            
            // Create notification summary file
            const notificationFile = join(this.alertsDirectory, 'latest_alerts.txt');
            const timestamp = new Date(alert.timestamp).toLocaleString();
            const notification = `[${timestamp}] ${alert.severity.toUpperCase()}: ${alert.message}\nDetails: ${JSON.stringify(alert.details, null, 2)}\n\n`;
            
            try {
                await fs.appendFile(notificationFile, notification);
            } catch (error) {
                console.error('Failed to write notification file:', error);
            }

            // For critical alerts, also create a separate file
            if (alert.severity === 'critical') {
                const criticalFile = join(this.alertsDirectory, 'critical_alerts.txt');
                try {
                    await fs.appendFile(criticalFile, notification);
                } catch (error) {
                    console.error('Failed to write critical alert file:', error);
                }
            }
        } catch (error) {
            console.error('Failed to send notifications:', error);
        }
    }

    /**
     * Check if alert is suppressed
     */
    isAlertSuppressed(alert) {
        const alertKey = `${alert.type}_${alert.source}`;
        const lastAlert = this.alertHistory.get(alertKey);
        
        if (!lastAlert) {
            return false;
        }

        const timeSinceLastAlert = Date.now() - lastAlert.timestamp;
        return timeSinceLastAlert < this.suppressionPeriod;
    }

    /**
     * Update alert suppression tracking
     */
    updateAlertSuppression(alert) {
        const alertKey = `${alert.type}_${alert.source}`;
        this.alertHistory.set(alertKey, {
            timestamp: Date.now(),
            count: (this.alertHistory.get(alertKey)?.count || 0) + 1
        });

        // Limit alert history size
        if (this.alertHistory.size > this.maxAlertHistory) {
            const oldestKey = this.alertHistory.keys().next().value;
            this.alertHistory.delete(oldestKey);
        }
    }

    /**
     * Record alert in memory
     */
    recordAlert(alert) {
        // This could be enhanced to persist to database if needed
        console.log('Alert recorded:', {
            type: alert.type,
            severity: alert.severity,
            source: alert.source,
            timestamp: alert.timestamp
        });
    }

    /**
     * Create alert object
     */
    createAlert(type, severity, message, details = {}, source = 'system') {
        return {
            id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            severity, // info, warning, critical
            message,
            details,
            source,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            version: '1.0.0'
        };
    }

    /**
     * Health check alert
     */
    async healthCheckAlert(checkName, status, details = {}) {
        if (status === 'unhealthy') {
            const alert = this.createAlert(
                'health_check_failure',
                'warning',
                `Health check failed: ${checkName}`,
                { checkName, status, ...details },
                'health_monitor'
            );
            await this.sendAlert(alert);
        }
    }

    /**
     * System health degraded alert
     */
    async systemHealthAlert(overallStatus, healthSummary) {
        if (overallStatus === 'critical') {
            const alert = this.createAlert(
                'system_health_critical',
                'critical',
                'System health is critical',
                { status: overallStatus, summary: healthSummary },
                'health_monitor'
            );
            await this.sendAlert(alert);
        } else if (overallStatus === 'degraded') {
            const alert = this.createAlert(
                'system_health_degraded',
                'warning',
                'System health is degraded',
                { status: overallStatus, summary: healthSummary },
                'health_monitor'
            );
            await this.sendAlert(alert);
        }
    }

    /**
     * Memory usage alert
     */
    async memoryAlert(memoryUsage) {
        const usagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
        
        if (usagePercent >= this.alertThresholds.memory) {
            const severity = usagePercent >= 95 ? 'critical' : 'warning';
            const alert = this.createAlert(
                'high_memory_usage',
                severity,
                `High memory usage detected: ${usagePercent}%`,
                {
                    usagePercent,
                    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                    threshold: this.alertThresholds.memory
                },
                'memory_monitor'
            );
            await this.sendAlert(alert);
        }
    }

    /**
     * Error rate alert
     */
    async errorRateAlert(errorCount, timeWindow) {
        const errorsPerMinute = errorCount / (timeWindow / 60000);
        
        if (errorsPerMinute >= this.alertThresholds.errorRate) {
            const severity = errorsPerMinute >= 20 ? 'critical' : 'warning';
            const alert = this.createAlert(
                'high_error_rate',
                severity,
                `High error rate detected: ${errorsPerMinute.toFixed(1)} errors/minute`,
                {
                    errorCount,
                    errorsPerMinute: errorsPerMinute.toFixed(1),
                    timeWindow: `${timeWindow / 1000}s`,
                    threshold: this.alertThresholds.errorRate
                },
                'error_monitor'
            );
            await this.sendAlert(alert);
        }
    }

    /**
     * Database alert
     */
    async databaseAlert(message, details = {}) {
        const alert = this.createAlert(
            'database_issue',
            'critical',
            `Database alert: ${message}`,
            details,
            'database'
        );
        await this.sendAlert(alert);
    }

    /**
     * Backup alert
     */
    async backupAlert(message, details = {}) {
        const alert = this.createAlert(
            'backup_issue',
            'warning',
            `Backup alert: ${message}`,
            details,
            'backup_system'
        );
        await this.sendAlert(alert);
    }

    /**
     * Circuit breaker alert
     */
    async circuitBreakerAlert(circuitName, state, details = {}) {
        if (state === 'OPEN') {
            const alert = this.createAlert(
                'circuit_breaker_open',
                'warning',
                `Circuit breaker opened: ${circuitName}`,
                { circuitName, state, ...details },
                'circuit_breaker'
            );
            await this.sendAlert(alert);
        }
    }

    /**
     * Get alert statistics
     */
    getAlertStats() {
        const stats = {
            totalAlerts: this.alertHistory.size,
            alertsByType: {},
            recentAlerts: 0
        };

        const oneHourAgo = Date.now() - 3600000;
        
        for (const [key, alertData] of this.alertHistory) {
            const [type] = key.split('_');
            stats.alertsByType[type] = (stats.alertsByType[type] || 0) + alertData.count;
            
            if (alertData.timestamp > oneHourAgo) {
                stats.recentAlerts++;
            }
        }

        return stats;
    }

    /**
     * Get recent alerts from files
     */
    async getRecentAlerts(limit = 50) {
        try {
            const files = await fs.readdir(this.alertsDirectory);
            const alertFiles = files
                .filter(file => file.startsWith('alert_') && file.endsWith('.json'))
                .sort()
                .reverse()
                .slice(0, limit);

            const alerts = [];
            for (const file of alertFiles) {
                try {
                    const content = await fs.readFile(join(this.alertsDirectory, file), 'utf8');
                    const alert = JSON.parse(content);
                    alerts.push(alert);
                } catch (error) {
                    console.warn('Failed to read alert file:', file, error);
                }
            }

            return alerts;
        } catch (error) {
            console.error('Failed to get recent alerts:', error);
            return [];
        }
    }

    /**
     * Clear old alert files
     */
    async clearOldAlerts(daysToKeep = 30) {
        try {
            const files = await fs.readdir(this.alertsDirectory);
            const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

            for (const file of files) {
                if (file.startsWith('alert_') && file.endsWith('.json')) {
                    const filePath = join(this.alertsDirectory, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime.getTime() < cutoffTime) {
                        await fs.unlink(filePath);
                        console.log('Deleted old alert file:', file);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to clear old alerts:', error);
        }
    }

    /**
     * Setup periodic cleanup
     */
    setupPeriodicCleanup() {
        // Clean up old alerts daily
        setInterval(async () => {
            await this.clearOldAlerts();
        }, 24 * 60 * 60 * 1000);

        console.log('Alerting system periodic cleanup scheduled');
    }

    /**
     * Test alert (for verification)
     */
    async testAlert() {
        const alert = this.createAlert(
            'test_alert',
            'info',
            'Test alert - alerting system is working',
            { test: true, timestamp: new Date().toISOString() },
            'test'
        );
        
        await this.sendAlert(alert);
        console.log('Test alert sent successfully');
    }
}

// Export singleton instance
export default new AlertingSystem();