/**
 * Environment configuration management
 * Homelab-optimized configuration with sensible defaults
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class EnvironmentConfig {
    constructor() {
        this.env = process.env.NODE_ENV || 'development';
        this.config = this.loadConfiguration();
    }

    /**
     * Load configuration with environment-specific overrides
     */
    loadConfiguration() {
        // Default configuration
        const defaultConfig = {
            server: {
                port: 5999,
                host: '0.0.0.0',
                cors: {
                    origin: true,
                    credentials: true
                }
            },
            database: {
                type: 'file', // 'file', 'http', or 'postgresql'
                path: 'tenant_manager.db',
                host: 'localhost',
                port: 5432,
                name: 'tenant_manager',
                user: 'tenant_user',
                password: 'tenant_pass',
                timeout: 30000,
                busyTimeout: 30000,
                retries: 3,
                retryDelay: 1000,
                pool: {
                    max: 20,
                    min: 5,
                    idle: 30000,
                    acquire: 60000
                },
                backup: {
                    enabled: false, // Temporarily disabled due to SIGSEGV
                    interval: 24, // hours
                    retention: 30, // days
                    directory: './backups'
                },
                postgresql: {
                    ssl: false,
                    connectionTimeoutMillis: 30000,
                    idleTimeoutMillis: 30000,
                    max: 20,
                    min: 5,
                    statement_timeout: 30000,
                    query_timeout: 30000,
                    application_name: 'tenant-manager',
                    keepAlive: true,
                    keepAliveInitialDelayMillis: 10000
                }
            },
            logging: {
                level: this.env === 'production' ? 'info' : 'debug',
                enableConsole: true,
                enableFile: false,
                maxFileSize: '10MB',
                maxFiles: 5
            },
            monitoring: {
                healthCheck: {
                    enabled: false, // Temporarily disabled due to SIGSEGV
                    interval: 1800000, // 30 minutes (much less aggressive)
                    timeout: 5000
                },
                metrics: {
                    enabled: false, // Simple homelab setup
                    port: 3002
                }
            },
            security: {
                requestTimeout: 30000,
                maxRequestSize: '10MB',
                rateLimit: {
                    enabled: false, // Trusted homelab network
                    windowMs: 900000, // 15 minutes
                    max: 1000
                }
            },
            errorRecovery: {
                circuitBreaker: {
                    failureThreshold: 5,
                    resetTimeout: 30000,
                    timeoutThreshold: 60000
                },
                retry: {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    maxDelay: 10000
                }
            },
            pdf: {
                timeout: 30000,
                maxConcurrent: 3,
                tempDirectory: './temp/pdf'
            }
        };

        // Load environment-specific overrides
        const envConfig = this.loadEnvironmentOverrides();
        
        // Load local configuration file if exists
        const localConfig = this.loadLocalConfig();

        // Merge configurations (local overrides env overrides default)
        return this.mergeConfigs(defaultConfig, envConfig, localConfig);
    }

    /**
     * Load environment-specific configuration from environment variables
     */
    loadEnvironmentOverrides() {
        const envConfig = {};

        // Server configuration
        if (process.env.PORT) {
            envConfig.server = { port: parseInt(process.env.PORT) };
        }
        if (process.env.HOST) {
            envConfig.server = { ...envConfig.server, host: process.env.HOST };
        }

        // Database configuration
        if (process.env.DATABASE_TYPE) {
            envConfig.database = { type: process.env.DATABASE_TYPE };
        }
        if (process.env.DATABASE_PATH) {
            envConfig.database = { ...envConfig.database, path: process.env.DATABASE_PATH };
        }
        if (process.env.DATABASE_HOST) {
            envConfig.database = { ...envConfig.database, host: process.env.DATABASE_HOST };
        }
        if (process.env.DATABASE_PORT) {
            envConfig.database = { ...envConfig.database, port: parseInt(process.env.DATABASE_PORT) };
        }
        if (process.env.DATABASE_NAME) {
            envConfig.database = { ...envConfig.database, name: process.env.DATABASE_NAME };
        }
        if (process.env.DATABASE_USER) {
            envConfig.database = { ...envConfig.database, user: process.env.DATABASE_USER };
        }
        if (process.env.DATABASE_PASSWORD) {
            envConfig.database = { ...envConfig.database, password: process.env.DATABASE_PASSWORD };
        }
        if (process.env.BACKUP_INTERVAL) {
            envConfig.database = { 
                ...envConfig.database, 
                backup: { interval: parseInt(process.env.BACKUP_INTERVAL) }
            };
        }

        // Logging configuration
        if (process.env.LOG_LEVEL) {
            envConfig.logging = { level: process.env.LOG_LEVEL };
        }
        if (process.env.LOG_TO_FILE === 'true') {
            envConfig.logging = { 
                ...envConfig.logging, 
                enableFile: true 
            };
        }

        // Monitoring configuration
        if (process.env.HEALTH_CHECK_INTERVAL) {
            envConfig.monitoring = {
                healthCheck: { 
                    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) 
                }
            };
        }

        return envConfig;
    }

    /**
     * Load local configuration file
     */
    loadLocalConfig() {
        const configPath = join(__dirname, '..', '..', '..', 'config.json');
        
        if (existsSync(configPath)) {
            try {
                const configFile = readFileSync(configPath, 'utf8');
                return JSON.parse(configFile);
            } catch (error) {
                console.warn('Failed to load local config file:', error.message);
            }
        }

        return {};
    }

    /**
     * Deep merge configuration objects
     */
    mergeConfigs(...configs) {
        const result = {};

        for (const config of configs) {
            this.deepMerge(result, config);
        }

        return result;
    }

    /**
     * Deep merge helper
     */
    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    /**
     * Get configuration value by path
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let current = this.config;

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }

        return current;
    }

    /**
     * Get server configuration
     */
    getServerConfig() {
        return this.config.server;
    }

    /**
     * Get database configuration
     */
    getDatabaseConfig() {
        return this.config.database;
    }

    /**
     * Get logging configuration
     */
    getLoggingConfig() {
        return this.config.logging;
    }

    /**
     * Get monitoring configuration
     */
    getMonitoringConfig() {
        return this.config.monitoring;
    }

    /**
     * Get security configuration
     */
    getSecurityConfig() {
        return this.config.security;
    }

    /**
     * Get error recovery configuration
     */
    getErrorRecoveryConfig() {
        return this.config.errorRecovery;
    }

    /**
     * Check if running in production
     */
    isProduction() {
        return this.env === 'production';
    }

    /**
     * Check if running in development
     */
    isDevelopment() {
        return this.env === 'development';
    }

    /**
     * Get environment name
     */
    getEnvironment() {
        return this.env;
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];

        // Validate server configuration
        if (!this.config.server.port || this.config.server.port < 1 || this.config.server.port > 65535) {
            errors.push('Invalid server port configuration');
        }

        // Validate database configuration
        if (!this.config.database.path) {
            errors.push('Database path is required');
        }

        // Validate backup configuration
        if (this.config.database.backup.enabled) {
            if (!this.config.database.backup.directory) {
                errors.push('Backup directory is required when backups are enabled');
            }
            if (this.config.database.backup.interval < 1) {
                errors.push('Backup interval must be at least 1 hour');
            }
        }

        // Validate logging configuration
        const validLogLevels = ['emergency', 'alert', 'critical', 'error', 'warn', 'notice', 'info', 'debug'];
        if (!validLogLevels.includes(this.config.logging.level)) {
            errors.push(`Invalid log level: ${this.config.logging.level}`);
        }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }

        return true;
    }

    /**
     * Get configuration summary for logging
     */
    getSummary() {
        return {
            environment: this.env,
            server: {
                port: this.config.server.port,
                host: this.config.server.host
            },
            database: {
                path: this.config.database.path,
                backupEnabled: this.config.database.backup.enabled
            },
            logging: {
                level: this.config.logging.level,
                fileEnabled: this.config.logging.enableFile
            },
            monitoring: {
                healthCheckEnabled: this.config.monitoring.healthCheck.enabled,
                healthCheckInterval: `${this.config.monitoring.healthCheck.interval / 1000}s`
            }
        };
    }
}

// Export singleton instance
export default new EnvironmentConfig();