/**
 * API key authentication middleware
 *
 * If API_KEY env var is set, requires Authorization: Bearer <key> header
 * on all /api/ routes except /api/health.
 * If API_KEY is not set, auth is skipped (backward compatibility for dev).
 */

import logger from '../utils/logger.js';

const API_KEY = process.env.API_KEY || null;

if (!API_KEY) {
    console.warn('WARNING: API_KEY environment variable is not set. API authentication is disabled.');
}

/**
 * Authentication middleware
 * Skips /api/health. If API_KEY is not configured, passes through.
 */
export function authMiddleware(req, res, next) {
    // Skip auth if no API_KEY is configured
    if (!API_KEY) {
        return next();
    }

    // Skip auth for health check endpoint
    if (req.path === '/api/health') {
        return next();
    }

    // Only enforce on /api/ routes
    if (!req.path.startsWith('/api/')) {
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);

    if (token !== API_KEY) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    next();
}

export default authMiddleware;
