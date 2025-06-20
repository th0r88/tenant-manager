/**
 * Standardized API response formatting
 * Provides consistent response structure across all endpoints
 */

import logger from './logger.js';

export class ResponseFormatter {
    constructor() {
        this.version = '1.0.0';
    }

    /**
     * Format successful response
     */
    success(data = null, message = 'Success', meta = {}) {
        return {
            success: true,
            message,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                version: this.version,
                ...meta
            }
        };
    }

    /**
     * Format error response
     */
    error(message = 'An error occurred', code = 'INTERNAL_ERROR', details = null, statusCode = 500) {
        const response = {
            success: false,
            error: {
                message,
                code,
                timestamp: new Date().toISOString(),
                version: this.version
            }
        };

        if (details) {
            response.error.details = details;
        }

        return { response, statusCode };
    }

    /**
     * Format validation error response
     */
    validationError(errors, message = 'Validation failed') {
        return this.error(
            message,
            'VALIDATION_ERROR',
            { validation_errors: errors },
            400
        );
    }

    /**
     * Format not found response
     */
    notFound(resource = 'Resource', id = null) {
        const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
        return this.error(message, 'NOT_FOUND', null, 404);
    }

    /**
     * Format unauthorized response
     */
    unauthorized(message = 'Unauthorized access') {
        return this.error(message, 'UNAUTHORIZED', null, 401);
    }

    /**
     * Format forbidden response
     */
    forbidden(message = 'Access forbidden') {
        return this.error(message, 'FORBIDDEN', null, 403);
    }

    /**
     * Format conflict response
     */
    conflict(message = 'Resource conflict', details = null) {
        return this.error(message, 'CONFLICT', details, 409);
    }

    /**
     * Format rate limit response
     */
    rateLimit(message = 'Rate limit exceeded', retryAfter = null) {
        const details = retryAfter ? { retry_after: retryAfter } : null;
        return this.error(message, 'RATE_LIMIT_EXCEEDED', details, 429);
    }

    /**
     * Format server error response
     */
    serverError(message = 'Internal server error', details = null) {
        return this.error(message, 'INTERNAL_SERVER_ERROR', details, 500);
    }

    /**
     * Format service unavailable response
     */
    serviceUnavailable(message = 'Service temporarily unavailable', retryAfter = null) {
        const details = retryAfter ? { retry_after: retryAfter } : null;
        return this.error(message, 'SERVICE_UNAVAILABLE', details, 503);
    }

    /**
     * Format paginated response
     */
    paginated(data, pagination) {
        const meta = {
            pagination: {
                page: parseInt(pagination.page) || 1,
                limit: parseInt(pagination.limit) || 10,
                total: pagination.total || 0,
                pages: Math.ceil((pagination.total || 0) / (parseInt(pagination.limit) || 10)),
                has_next: pagination.hasNext || false,
                has_prev: pagination.hasPrev || false
            }
        };

        return this.success(data, 'Data retrieved successfully', meta);
    }

    /**
     * Format list response
     */
    list(items, count = null, message = 'Items retrieved successfully') {
        const meta = {
            count: count !== null ? count : (Array.isArray(items) ? items.length : 0)
        };

        return this.success(items, message, meta);
    }

    /**
     * Format created response
     */
    created(data, message = 'Resource created successfully') {
        return {
            response: this.success(data, message),
            statusCode: 201
        };
    }

    /**
     * Format updated response
     */
    updated(data, message = 'Resource updated successfully') {
        return this.success(data, message);
    }

    /**
     * Format deleted response
     */
    deleted(message = 'Resource deleted successfully', id = null) {
        const meta = id ? { deleted_id: id } : {};
        return this.success(null, message, meta);
    }

    /**
     * Format health check response
     */
    health(status, checks = {}, uptime = null) {
        const meta = {
            uptime: uptime || process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: this.version
        };

        return {
            status,
            checks,
            meta
        };
    }

    /**
     * Format file upload response
     */
    fileUploaded(fileName, filePath, fileSize, message = 'File uploaded successfully') {
        const data = {
            file_name: fileName,
            file_path: filePath,
            file_size: fileSize,
            upload_timestamp: new Date().toISOString()
        };

        return this.success(data, message);
    }

    /**
     * Format report generation response
     */
    reportGenerated(reportPath, reportType, parameters = {}) {
        const data = {
            report_path: reportPath,
            report_type: reportType,
            parameters,
            generated_at: new Date().toISOString()
        };

        return this.success(data, 'Report generated successfully');
    }

    /**
     * Format tenant operation response
     */
    tenantOperation(tenant, operation, additionalData = {}) {
        const data = {
            tenant,
            operation,
            ...additionalData
        };

        const messages = {
            created: 'Tenant created successfully',
            updated: 'Tenant updated successfully',
            deleted: 'Tenant deleted successfully',
            archived: 'Tenant archived successfully'
        };

        return this.success(data, messages[operation] || 'Tenant operation completed');
    }

    /**
     * Format utility allocation response
     */
    utilityAllocation(allocation, totals, method) {
        const data = {
            allocation,
            totals,
            allocation_method: method,
            calculated_at: new Date().toISOString()
        };

        return this.success(data, 'Utility costs allocated successfully');
    }

    /**
     * Format backup operation response
     */
    backupOperation(backupPath, operation, size = null) {
        const data = {
            backup_path: backupPath,
            operation,
            size,
            timestamp: new Date().toISOString()
        };

        const messages = {
            created: 'Backup created successfully',
            restored: 'Backup restored successfully',
            verified: 'Backup verified successfully',
            deleted: 'Backup deleted successfully'
        };

        return this.success(data, messages[operation] || 'Backup operation completed');
    }
}

/**
 * Express middleware for response formatting
 */
export function responseMiddleware() {
    return (req, res, next) => {
        const formatter = new ResponseFormatter();

        // Add formatter methods to response object
        res.apiSuccess = (data, message, meta) => {
            const response = formatter.success(data, message, meta);
            res.json(response);
        };

        res.apiError = (message, code, details, statusCode) => {
            const { response, statusCode: status } = formatter.error(message, code, details, statusCode);
            res.status(status).json(response);
        };

        res.apiValidationError = (errors, message) => {
            const { response, statusCode } = formatter.validationError(errors, message);
            res.status(statusCode).json(response);
        };

        res.apiNotFound = (resource, id) => {
            const { response, statusCode } = formatter.notFound(resource, id);
            res.status(statusCode).json(response);
        };

        res.apiCreated = (data, message) => {
            const { response, statusCode } = formatter.created(data, message);
            res.status(statusCode).json(response);
        };

        res.apiList = (items, count, message) => {
            const response = formatter.list(items, count, message);
            res.json(response);
        };

        res.apiPaginated = (data, pagination) => {
            const response = formatter.paginated(data, pagination);
            res.json(response);
        };

        res.apiDeleted = (message, id) => {
            const response = formatter.deleted(message, id);
            res.json(response);
        };

        res.apiConflict = (message, details) => {
            const { response, statusCode } = formatter.conflict(message, details);
            res.status(statusCode).json(response);
        };

        res.apiServerError = (message, details) => {
            const { response, statusCode } = formatter.serverError(message, details);
            res.status(statusCode).json(response);
        };

        next();
    };
}

/**
 * Error response middleware for unhandled errors
 */
export function errorResponseMiddleware() {
    return (error, req, res, next) => {
        const formatter = new ResponseFormatter();
        
        // Log the error
        logger.error('Unhandled error in API', {
            error: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method,
            correlationId: req.correlationId
        });

        // Determine error type and format response
        let response, statusCode;

        if (error.name === 'ValidationError') {
            ({ response, statusCode } = formatter.validationError(
                error.details || [],
                error.message
            ));
        } else if (error.name === 'NotFoundError') {
            ({ response, statusCode } = formatter.notFound(error.resource, error.id));
        } else if (error.statusCode) {
            ({ response, statusCode } = formatter.error(
                error.message,
                error.code || 'UNKNOWN_ERROR',
                error.details,
                error.statusCode
            ));
        } else {
            // Generic server error
            const isDevelopment = process.env.NODE_ENV === 'development';
            const details = isDevelopment ? { stack: error.stack } : null;
            
            ({ response, statusCode } = formatter.serverError(
                isDevelopment ? error.message : 'Internal server error',
                details
            ));
        }

        res.status(statusCode).json(response);
    };
}

// Export singleton instance
export default new ResponseFormatter();