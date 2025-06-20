/**
 * Structured logging utility for debugging and monitoring
 * Provides contextual logging with correlation IDs and performance tracking
 */

import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';

export class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    /**
     * Generate correlation ID for request tracking
     */
    generateCorrelationId() {
        return randomUUID();
    }

    /**
     * Create logger context for request
     */
    createContext(req) {
        const correlationId = req.headers['x-correlation-id'] || this.generateCorrelationId();
        req.correlationId = correlationId;
        
        return {
            correlationId,
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent'],
            ip: req.ip || req.connection.remoteAddress,
            timestamp: new Date().toISOString(),
            requestId: correlationId
        };
    }

    /**
     * Format log message with context
     */
    formatMessage(level, message, context = {}, error = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message,
            ...context
        };

        if (error) {
            logEntry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code
            };
        }

        return JSON.stringify(logEntry, null, 2);
    }

    /**
     * Check if log level should be output
     */
    shouldLog(level) {
        return this.logLevels[level] <= this.logLevels[this.logLevel];
    }

    /**
     * Log error with context
     */
    error(message, context = {}, error = null) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, context, error));
        }
    }

    /**
     * Log warning with context
     */
    warn(message, context = {}) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, context));
        }
    }

    /**
     * Log info with context
     */
    info(message, context = {}) {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, context));
        }
    }

    /**
     * Log debug with context
     */
    debug(message, context = {}) {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, context));
        }
    }

    /**
     * Log HTTP request
     */
    logRequest(req, res, startTime) {
        const duration = performance.now() - startTime;
        const context = this.createContext(req);
        
        const requestLog = {
            ...context,
            statusCode: res.statusCode,
            responseTime: `${duration.toFixed(2)}ms`,
            contentLength: res.get('content-length') || 0
        };

        if (res.statusCode >= 400) {
            this.warn('HTTP Request Failed', requestLog);
        } else {
            this.info('HTTP Request', requestLog);
        }
    }

    /**
     * Log database operation
     */
    logDbOperation(operation, table, context = {}, startTime = null) {
        const logContext = {
            operation,
            table,
            ...context
        };

        if (startTime) {
            logContext.duration = `${(performance.now() - startTime).toFixed(2)}ms`;
        }

        this.debug('Database Operation', logContext);
    }

    /**
     * Log performance metric
     */
    logPerformance(metric, value, context = {}) {
        this.info('Performance Metric', {
            metric,
            value,
            unit: context.unit || 'ms',
            ...context
        });
    }

    /**
     * Log security event
     */
    logSecurity(event, severity, context = {}) {
        const securityLog = {
            securityEvent: event,
            severity,
            ...context
        };

        if (severity === 'critical' || severity === 'high') {
            this.error(`Security Event: ${event}`, securityLog);
        } else {
            this.warn(`Security Event: ${event}`, securityLog);
        }
    }

    /**
     * Log business event
     */
    logBusiness(event, context = {}) {
        this.info(`Business Event: ${event}`, {
            businessEvent: event,
            ...context
        });
    }

    /**
     * Log system health
     */
    logHealth(component, status, metrics = {}) {
        const healthLog = {
            component,
            status,
            metrics,
            checkTime: new Date().toISOString()
        };

        if (status === 'unhealthy') {
            this.error(`Health Check Failed: ${component}`, healthLog);
        } else {
            this.info(`Health Check: ${component}`, healthLog);
        }
    }

    /**
     * Log backup operation
     */
    logBackup(operation, result, context = {}) {
        const backupLog = {
            backupOperation: operation,
            result,
            ...context
        };

        if (result === 'success') {
            this.info(`Backup ${operation} completed`, backupLog);
        } else {
            this.error(`Backup ${operation} failed`, backupLog);
        }
    }

    /**
     * Create request logging middleware
     */
    requestMiddleware() {
        return (req, res, next) => {
            const startTime = performance.now();
            
            // Add correlation ID to request
            const context = this.createContext(req);
            req.logger = {
                correlationId: context.correlationId,
                log: (level, message, extraContext = {}) => {
                    this[level](message, { ...context, ...extraContext });
                }
            };

            // Log request completion
            res.on('finish', () => {
                this.logRequest(req, res, startTime);
            });

            next();
        };
    }

    /**
     * Performance monitoring wrapper
     */
    withPerformanceLogging(fn, name) {
        return async (...args) => {
            const startTime = performance.now();
            try {
                const result = await fn(...args);
                const duration = performance.now() - startTime;
                this.logPerformance(name, duration);
                return result;
            } catch (error) {
                const duration = performance.now() - startTime;
                this.error(`Performance: ${name} failed`, { 
                    duration: `${duration.toFixed(2)}ms`,
                    functionName: name 
                }, error);
                throw error;
            }
        };
    }

    /**
     * Database operation wrapper with logging
     */
    withDbLogging(operation, table) {
        return (fn) => {
            return async (...args) => {
                const startTime = performance.now();
                try {
                    const result = await fn(...args);
                    this.logDbOperation(operation, table, { success: true }, startTime);
                    return result;
                } catch (error) {
                    this.logDbOperation(operation, table, { 
                        success: false, 
                        error: error.message 
                    }, startTime);
                    throw error;
                }
            };
        };
    }

    /**
     * Emergency logging for critical errors
     */
    async emergency(message, context = {}, error = null) {
        const emergencyLog = {
            level: 'EMERGENCY',
            timestamp: new Date().toISOString(),
            message,
            context,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : null,
            processInfo: {
                pid: process.pid,
                platform: process.platform,
                nodeVersion: process.version,
                uptime: process.uptime()
            }
        };

        // Always output emergency logs regardless of log level
        console.error('🚨 EMERGENCY 🚨', JSON.stringify(emergencyLog, null, 2));
        
        // Also try to write to a dedicated emergency log file
        try {
            await fs.appendFile('emergency.log', JSON.stringify(emergencyLog) + '\n');
        } catch (writeError) {
            console.error('Failed to write emergency log to file:', writeError);
        }
    }
}

// Export singleton instance
export default new Logger();