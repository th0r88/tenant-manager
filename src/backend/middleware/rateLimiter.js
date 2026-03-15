/**
 * Rate limiting middleware
 *
 * General limiter: 100 requests per 15 minutes for all /api/ routes
 * Strict limiter: 20 requests per 15 minutes for POST/PUT/DELETE (write operations)
 *
 * Controlled by RATE_LIMIT_ENABLED env var (defaults to true via config).
 */

import rateLimit from 'express-rate-limit';
import config from '../config/environment.js';

const rateLimitConfig = config.get('security.rateLimit');

/**
 * General rate limiter - 100 requests per 15 minutes
 */
export const generalLimiter = rateLimit({
    windowMs: rateLimitConfig.windowMs || 900000,
    max: rateLimitConfig.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' }
});

/**
 * Strict rate limiter for write operations - 20 requests per 15 minutes
 */
export const strictLimiter = rateLimit({
    windowMs: rateLimitConfig.windowMs || 900000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many write requests, please try again later' }
});

/**
 * Middleware that applies strict limiter only to POST/PUT/DELETE methods
 */
export function writeMethodLimiter(req, res, next) {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        return strictLimiter(req, res, next);
    }
    next();
}

/**
 * Check if rate limiting is enabled
 */
export function isRateLimitEnabled() {
    return rateLimitConfig.enabled !== false;
}
