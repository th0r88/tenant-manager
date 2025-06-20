/**
 * Test file for error handling and recovery systems
 * Run with: npm test src/backend/tests/errorHandling.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import logger from '../utils/logger.js';
import errorRecovery from '../utils/errorRecovery.js';
import healthCheck from '../utils/healthCheck.js';

describe('Logger', () => {
    beforeEach(() => {
        // Mock console methods
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should generate correlation IDs', () => {
        const correlationId = logger.generateCorrelationId();
        expect(correlationId).toBeDefined();
        expect(typeof correlationId).toBe('string');
        expect(correlationId.length).toBeGreaterThan(0);
    });

    it('should create request context', () => {
        const mockReq = {
            method: 'GET',
            url: '/api/test',
            headers: { 'user-agent': 'test-agent' },
            ip: '127.0.0.1'
        };

        const context = logger.createContext(mockReq);
        
        expect(context.correlationId).toBeDefined();
        expect(context.method).toBe('GET');
        expect(context.url).toBe('/api/test');
        expect(context.userAgent).toBe('test-agent');
        expect(context.ip).toBe('127.0.0.1');
    });

    it('should format log messages correctly', () => {
        const message = 'Test message';
        const context = { testKey: 'testValue' };
        const error = new Error('Test error');

        const formatted = logger.formatMessage('info', message, context, error);
        const parsed = JSON.parse(formatted);

        expect(parsed.level).toBe('INFO');
        expect(parsed.message).toBe(message);
        expect(parsed.testKey).toBe('testValue');
        expect(parsed.error.message).toBe('Test error');
    });

    it('should respect log levels', () => {
        logger.logLevel = 'warn';
        
        expect(logger.shouldLog('error')).toBe(true);
        expect(logger.shouldLog('warn')).toBe(true);
        expect(logger.shouldLog('info')).toBe(false);
        expect(logger.shouldLog('debug')).toBe(false);
    });
});

describe('Error Recovery', () => {
    beforeEach(() => {
        // Clear any existing circuit breakers
        errorRecovery.circuitBreakers.clear();
    });

    it('should create circuit breaker with default settings', () => {
        const breaker = errorRecovery.createCircuitBreaker('test');
        
        expect(breaker.name).toBe('test');
        expect(breaker.state).toBe('CLOSED');
        expect(breaker.failures).toBe(0);
        expect(breaker.settings.failureThreshold).toBe(5);
    });

    it('should execute function successfully with circuit breaker', async () => {
        const mockFn = vi.fn().mockResolvedValue('success');
        
        const result = await errorRecovery.withCircuitBreaker('test', mockFn);
        
        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledOnce();
        
        const breaker = errorRecovery.circuitBreakers.get('test');
        expect(breaker.state).toBe('CLOSED');
        expect(breaker.failures).toBe(0);
    });

    it('should open circuit breaker after threshold failures', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
        const breaker = errorRecovery.createCircuitBreaker('test', { failureThreshold: 2 });
        
        // First failure
        await expect(errorRecovery.withCircuitBreaker('test', mockFn)).rejects.toThrow();
        expect(breaker.state).toBe('CLOSED');
        expect(breaker.failures).toBe(1);
        
        // Second failure - should open circuit
        await expect(errorRecovery.withCircuitBreaker('test', mockFn)).rejects.toThrow();
        expect(breaker.state).toBe('OPEN');
        expect(breaker.failures).toBe(2);
    });

    it('should execute fallback when circuit is open', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
        const fallback = vi.fn().mockResolvedValue('fallback result');
        
        const breaker = errorRecovery.createCircuitBreaker('test', { failureThreshold: 1 });
        
        // Trigger failure to open circuit
        await expect(errorRecovery.withCircuitBreaker('test', mockFn)).rejects.toThrow();
        expect(breaker.state).toBe('OPEN');
        
        // Should execute fallback
        const result = await errorRecovery.withCircuitBreaker('test', mockFn, fallback);
        expect(result).toBe('fallback result');
        expect(fallback).toHaveBeenCalledOnce();
    });

    it('should retry with exponential backoff', async () => {
        let callCount = 0;
        const mockFn = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount < 3) {
                throw new Error('Temporary failure');
            }
            return 'success';
        });

        const startTime = Date.now();
        const result = await errorRecovery.retry(mockFn, {
            maxAttempts: 3,
            baseDelay: 10,
            maxDelay: 100
        });
        const endTime = Date.now();

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(3);
        expect(endTime - startTime).toBeGreaterThan(20); // Should have some delay
    });

    it('should fail after max retry attempts', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('Persistent error'));

        await expect(errorRecovery.retry(mockFn, {
            maxAttempts: 2,
            baseDelay: 10
        })).rejects.toThrow('Persistent error');

        expect(mockFn).toHaveBeenCalledTimes(2);
    });
});

describe('Health Check', () => {
    it('should register health checks', () => {
        const mockCheck = vi.fn().mockResolvedValue({ status: 'healthy' });
        healthCheck.register('test_check', mockCheck);
        
        expect(healthCheck.checks.has('test_check')).toBe(true);
    });

    it('should run individual health check successfully', async () => {
        const mockCheck = vi.fn().mockResolvedValue({
            status: 'healthy',
            message: 'All good',
            details: { test: 'value' }
        });
        
        healthCheck.register('test_check', mockCheck);
        const result = await healthCheck.runCheck('test_check');
        
        expect(result.status).toBe('healthy');
        expect(result.message).toBe('All good');
        expect(result.details.test).toBe('value');
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(mockCheck).toHaveBeenCalledOnce();
    });

    it('should handle health check failures', async () => {
        const mockCheck = vi.fn().mockRejectedValue(new Error('Health check failed'));
        
        healthCheck.register('failing_check', mockCheck);
        const result = await healthCheck.runCheck('failing_check');
        
        expect(result.status).toBe('unhealthy');
        expect(result.message).toBe('Health check failed');
        expect(result.error).toBeDefined();
        expect(result.error.message).toBe('Health check failed');
    });

    it('should calculate overall health correctly', () => {
        const results = {
            check1: { status: 'healthy', name: 'check1' },
            check2: { status: 'healthy', name: 'check2' },
            check3: { status: 'unhealthy', name: 'check3' }
        };
        
        const overall = healthCheck.calculateOverallHealth(results);
        
        expect(overall.status).toBe('degraded');
        expect(overall.summary.total).toBe(3);
        expect(overall.summary.healthy).toBe(2);
        expect(overall.summary.unhealthy).toBe(1);
        expect(overall.summary.healthPercentage).toBe(67);
    });

    it('should handle critical failures', () => {
        // Mock a critical check
        healthCheck.register('critical_check', 
            vi.fn().mockResolvedValue({ status: 'unhealthy' }), 
            { critical: true }
        );
        
        const results = {
            critical_check: { status: 'unhealthy', name: 'critical_check' }
        };
        
        const overall = healthCheck.calculateOverallHealth(results);
        expect(overall.status).toBe('critical');
    });

    it('should provide quick health check', async () => {
        // Mock the critical checks
        const mockDbCheck = vi.fn().mockResolvedValue({ status: 'healthy' });
        const mockFsCheck = vi.fn().mockResolvedValue({ status: 'healthy' });
        
        healthCheck.register('database', mockDbCheck);
        healthCheck.register('filesystem', mockFsCheck);
        
        const quickHealth = await healthCheck.getQuickHealth();
        
        expect(quickHealth.status).toBeDefined();
        expect(quickHealth.critical_checks).toBeDefined();
        expect(quickHealth.critical_checks.database).toBeDefined();
        expect(quickHealth.critical_checks.filesystem).toBeDefined();
    });
});

describe('Integration Tests', () => {
    it('should handle database recovery with circuit breaker', async () => {
        let attemptCount = 0;
        const mockDbOperation = vi.fn().mockImplementation(() => {
            attemptCount++;
            if (attemptCount < 3) {
                throw new Error('Database temporarily unavailable');
            }
            return { success: true };
        });

        const result = await errorRecovery.withDatabaseRecovery(mockDbOperation);
        
        expect(result.success).toBe(true);
        expect(mockDbOperation).toHaveBeenCalledTimes(3);
    });

    it('should log errors with proper context', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        try {
            await errorRecovery.withCircuitBreaker('test', () => {
                throw new Error('Test error for logging');
            });
        } catch (error) {
            // Expected to throw
        }
        
        // Should have logged the error
        expect(consoleSpy).toHaveBeenCalled();
        
        consoleSpy.mockRestore();
    });

    it('should handle memory monitoring', () => {
        const initialUsage = process.memoryUsage();
        
        // This test mainly ensures the memory monitoring doesn't crash
        errorRecovery.setupMemoryMonitoring();
        
        const afterUsage = process.memoryUsage();
        expect(afterUsage.heapUsed).toBeGreaterThan(0);
    });
});