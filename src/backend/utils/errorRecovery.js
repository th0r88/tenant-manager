/**
 * Graceful error recovery mechanisms
 * Provides circuit breaker, retry logic, and fallback strategies
 */

import logger from './logger.js';
import backupService from '../services/backupService.js';
// import alerting from './alerting.js';

export class ErrorRecovery {
    constructor() {
        this.circuitBreakers = new Map();
        this.retryAttempts = new Map();
        this.defaultRetryConfig = {
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            backoffMultiplier: 2
        };
    }

    /**
     * Circuit breaker implementation
     */
    createCircuitBreaker(name, config = {}) {
        const settings = {
            failureThreshold: config.failureThreshold || 5,
            timeoutThreshold: config.timeoutThreshold || 60000,
            resetTimeout: config.resetTimeout || 30000,
            monitoringPeriod: config.monitoringPeriod || 300000,
            ...config
        };

        const circuitBreaker = {
            name,
            state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
            failures: 0,
            lastFailureTime: null,
            lastSuccessTime: Date.now(),
            nextAttempt: null,
            settings
        };

        this.circuitBreakers.set(name, circuitBreaker);
        return circuitBreaker;
    }

    /**
     * Execute function with circuit breaker protection
     */
    async withCircuitBreaker(name, fn, fallback = null) {
        let breaker = this.circuitBreakers.get(name);
        if (!breaker) {
            breaker = this.createCircuitBreaker(name);
        }

        // Check circuit breaker state
        if (breaker.state === 'OPEN') {
            if (Date.now() < breaker.nextAttempt) {
                logger.warn('Circuit breaker is OPEN', { 
                    circuit: name,
                    nextAttempt: new Date(breaker.nextAttempt).toISOString()
                });
                
                if (fallback) {
                    return await fallback();
                }
                throw new Error(`Circuit breaker ${name} is OPEN`);
            } else {
                breaker.state = 'HALF_OPEN';
                logger.info('Circuit breaker moving to HALF_OPEN', { circuit: name });
            }
        }

        try {
            const result = await fn();
            this.onSuccess(breaker);
            return result;
        } catch (error) {
            this.onFailure(breaker, error);
            
            if (fallback && breaker.state === 'OPEN') {
                logger.info('Executing fallback due to circuit breaker', { 
                    circuit: name,
                    error: error.message 
                });
                return await fallback();
            }
            
            throw error;
        }
    }

    /**
     * Handle successful execution
     */
    onSuccess(breaker) {
        breaker.failures = 0;
        breaker.lastSuccessTime = Date.now();
        
        if (breaker.state === 'HALF_OPEN') {
            breaker.state = 'CLOSED';
            logger.info('Circuit breaker reset to CLOSED', { circuit: breaker.name });
        }
    }

    /**
     * Handle failed execution
     */
    onFailure(breaker, error) {
        breaker.failures++;
        breaker.lastFailureTime = Date.now();

        logger.warn('Circuit breaker failure recorded', {
            circuit: breaker.name,
            failures: breaker.failures,
            threshold: breaker.settings.failureThreshold,
            error: error.message
        });

        if (breaker.failures >= breaker.settings.failureThreshold) {
            breaker.state = 'OPEN';
            breaker.nextAttempt = Date.now() + breaker.settings.resetTimeout;
            
            logger.error('Circuit breaker OPENED', {
                circuit: breaker.name,
                failures: breaker.failures,
                nextAttempt: new Date(breaker.nextAttempt).toISOString()
            });

            // Send circuit breaker alert
            // try {
            //     alerting.circuitBreakerAlert(breaker.name, 'OPEN', {
            //         failures: breaker.failures,
            //         threshold: breaker.settings.failureThreshold,
            //         nextAttempt: new Date(breaker.nextAttempt).toISOString()
            //     });
            // } catch (alertError) {
            //     console.error('Failed to send circuit breaker alert:', alertError);
            // }
        }
    }

    /**
     * Retry mechanism with exponential backoff
     */
    async retry(fn, config = {}) {
        const retryConfig = { ...this.defaultRetryConfig, ...config };
        let lastError;

        for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
            try {
                const result = await fn();
                
                if (attempt > 1) {
                    logger.info('Retry successful', { 
                        attempt,
                        totalAttempts: retryConfig.maxAttempts 
                    });
                }
                
                return result;
            } catch (error) {
                lastError = error;
                
                if (attempt === retryConfig.maxAttempts) {
                    logger.error('All retry attempts failed', {
                        attempts: retryConfig.maxAttempts,
                        finalError: error.message
                    });
                    break;
                }

                // Calculate delay with exponential backoff
                const delay = Math.min(
                    retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
                    retryConfig.maxDelay
                );

                logger.warn('Retry attempt failed, waiting before next attempt', {
                    attempt,
                    totalAttempts: retryConfig.maxAttempts,
                    delay: `${delay}ms`,
                    error: error.message
                });

                await this.sleep(delay);
            }
        }

        throw lastError;
    }

    /**
     * Database operation with recovery
     */
    async withDatabaseRecovery(operation, fallback = null) {
        return this.withCircuitBreaker('database', async () => {
            return await this.retry(operation, {
                maxAttempts: 3,
                baseDelay: 500
            });
        }, fallback);
    }

    /**
     * File system operation with recovery
     */
    async withFileSystemRecovery(operation, fallback = null) {
        return this.withCircuitBreaker('filesystem', async () => {
            return await this.retry(operation, {
                maxAttempts: 2,
                baseDelay: 200
            });
        }, fallback);
    }

    /**
     * External service call with recovery
     */
    async withExternalServiceRecovery(serviceName, operation, fallback = null) {
        return this.withCircuitBreaker(`external_${serviceName}`, async () => {
            return await this.retry(operation, {
                maxAttempts: 3,
                baseDelay: 1000
            });
        }, fallback);
    }

    /**
     * Critical operation with backup fallback
     */
    async withBackupFallback(operation, context = {}) {
        try {
            return await operation();
        } catch (error) {
            logger.error('Critical operation failed, attempting backup fallback', {
                context,
                error: error.message
            });

            try {
                // Create emergency backup before any recovery attempts
                await backupService.createBackup();
                logger.info('Emergency backup created during error recovery');
            } catch (backupError) {
                logger.error('Emergency backup failed during recovery', {}, backupError);
            }

            // Attempt database integrity check
            try {
                await backupService.verifyDatabaseIntegrity();
                logger.info('Database integrity verified during recovery');
            } catch (integrityError) {
                await logger.emergency('Database corruption detected during recovery', {
                    originalError: error.message,
                    integrityError: integrityError.message
                });
                
                throw new Error('Critical system failure: Database corruption detected');
            }

            throw error;
        }
    }

    /**
     * Graceful shutdown handler
     */
    setupGracefulShutdown(server, cleanup = async () => {}) {
        const gracefulShutdown = async (signal) => {
            logger.info('Graceful shutdown initiated', { signal });

            // Stop accepting new connections
            server.close(async () => {
                try {
                    // Perform cleanup operations
                    await cleanup();
                    
                    // Create final backup
                    await backupService.createBackup();
                    logger.info('Final backup created during shutdown');
                    
                    logger.info('Graceful shutdown completed');
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during graceful shutdown', {}, error);
                    process.exit(1);
                }
            });

            // Force shutdown after timeout
            setTimeout(() => {
                logger.error('Forced shutdown due to timeout');
                process.exit(1);
            }, 30000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
    }

    /**
     * Handle uncaught exceptions
     */
    setupUncaughtExceptionHandler() {
        process.on('uncaughtException', async (error) => {
            await logger.emergency('Uncaught exception detected', {
                error: error.message,
                stack: error.stack
            });

            try {
                // Create emergency backup
                await backupService.createBackup();
            } catch (backupError) {
                await logger.emergency('Failed to create emergency backup after uncaught exception', {}, backupError);
            }

            // Give some time for logs to flush
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });

        process.on('unhandledRejection', async (reason, promise) => {
            await logger.emergency('Unhandled promise rejection', {
                reason: reason?.toString(),
                promise: promise?.toString()
            });

            try {
                await backupService.createBackup();
            } catch (backupError) {
                await logger.emergency('Failed to create emergency backup after unhandled rejection', {}, backupError);
            }
        });
    }

    /**
     * Memory monitoring and recovery
     */
    setupMemoryMonitoring() {
        const memoryThreshold = 500 * 1024 * 1024; // 500MB threshold
        
        setInterval(async () => {
            const usage = process.memoryUsage();
            
            if (usage.heapUsed > memoryThreshold) {
                logger.warn('High memory usage detected', {
                    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
                    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
                    external: `${Math.round(usage.external / 1024 / 1024)}MB`
                });

                // Send memory alert
                // try {
                //     await alerting.memoryAlert(usage);
                // } catch (alertError) {
                //     console.error('Failed to send memory alert:', alertError);
                // }

                // Trigger garbage collection if available
                if (global.gc) {
                    global.gc();
                    logger.info('Garbage collection triggered');
                }
            }
        }, 60000); // Check every minute
    }

    /**
     * Database connection recovery
     */
    async recoverDatabaseConnection() {
        return this.retry(async () => {
            // Attempt to verify database integrity
            await backupService.verifyDatabaseIntegrity();
            logger.info('Database connection recovered');
        }, {
            maxAttempts: 5,
            baseDelay: 2000
        });
    }

    /**
     * Sleep utility for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get circuit breaker status
     */
    getCircuitBreakerStatus() {
        const status = {};
        for (const [name, breaker] of this.circuitBreakers) {
            status[name] = {
                state: breaker.state,
                failures: breaker.failures,
                lastFailureTime: breaker.lastFailureTime,
                lastSuccessTime: breaker.lastSuccessTime,
                nextAttempt: breaker.nextAttempt
            };
        }
        return status;
    }
}

// Export singleton instance
export default new ErrorRecovery();