import backupService from '../services/backupService.js';

// Database error types that indicate potential corruption
const CORRUPTION_INDICATORS = [
    'database disk image is malformed',
    'database is locked',
    'database schema has changed',
    'no such table',
    'no such column',
    'constraint failed'
];

// Transaction wrapper to ensure data consistency
export function withTransaction(db, callback) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    reject(new Error(`Failed to start transaction: ${err.message}`));
                    return;
                }

                Promise.resolve(callback(db))
                    .then((result) => {
                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                reject(new Error(`Failed to commit transaction: ${commitErr.message}`));
                            } else {
                                resolve(result);
                            }
                        });
                    })
                    .catch((error) => {
                        db.run('ROLLBACK', () => {
                            reject(error);
                        });
                    });
            });
        });
    });
}

// Enhanced error handler middleware
export function errorHandler(err, req, res, next) {
    console.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Check for database corruption indicators
    const errorMessage = err.message.toLowerCase();
    const isCorruptionError = CORRUPTION_INDICATORS.some(indicator => 
        errorMessage.includes(indicator)
    );

    if (isCorruptionError) {
        console.error('🚨 POTENTIAL DATABASE CORRUPTION DETECTED 🚨');
        console.error('Error:', err.message);
        
        // Attempt to verify database integrity
        backupService.verifyDatabaseIntegrity()
            .then(() => {
                console.log('✅ Database integrity check passed - error may be transient');
            })
            .catch((integrityError) => {
                console.error('❌ Database integrity check failed:', integrityError.message);
                console.error('Consider restoring from backup immediately');
            });
    }

    // Determine error type and response
    let statusCode = 500;
    let errorType = 'INTERNAL_ERROR';
    let message = 'An internal server error occurred';
    let details = null;

    // Validation errors
    if (err.message.includes('constraint failed') || err.message.includes('must be')) {
        statusCode = 400;
        errorType = 'VALIDATION_ERROR';
        message = 'Invalid data provided';
        details = err.message;
    }
    // Database constraint violations
    else if (err.message.includes('UNIQUE constraint failed')) {
        statusCode = 409;
        errorType = 'DUPLICATE_ERROR';
        message = 'Resource already exists';
        details = extractConstraintDetails(err.message);
    }
    // Foreign key violations
    else if (err.message.includes('FOREIGN KEY constraint failed')) {
        statusCode = 400;
        errorType = 'REFERENCE_ERROR';
        message = 'Referenced resource does not exist';
    }
    // Database corruption or serious errors
    else if (isCorruptionError) {
        statusCode = 503;
        errorType = 'DATABASE_ERROR';
        message = 'Database service temporarily unavailable';
    }
    // File system errors
    else if (err.code === 'ENOENT') {
        statusCode = 404;
        errorType = 'NOT_FOUND';
        message = 'Resource not found';
    }
    // Permission errors
    else if (err.code === 'EACCES' || err.code === 'EPERM') {
        statusCode = 503;
        errorType = 'PERMISSION_ERROR';
        message = 'Service temporarily unavailable due to permissions';
    }

    const errorResponse = {
        success: false,
        error: {
            type: errorType,
            message: message,
            timestamp: new Date().toISOString()
        }
    };

    // Include details in development mode
    if (process.env.NODE_ENV !== 'production' && details) {
        errorResponse.error.details = details;
    }

    res.status(statusCode).json(errorResponse);
}

// Extract meaningful constraint details from error messages
function extractConstraintDetails(message) {
    if (message.includes('tenants.emso')) {
        return 'EMŠO already exists for another tenant';
    }
    if (message.includes('utility_entries')) {
        return 'Utility entry already exists for this period';
    }
    if (message.includes('billing_periods')) {
        return 'Billing period already exists';
    }
    return 'Duplicate entry detected';
}

// Request validation middleware
export function validateRequest(schema) {
    return (req, res, next) => {
        try {
            // Basic input sanitization
            if (req.body) {
                sanitizeInput(req.body);
            }
            if (req.query) {
                sanitizeInput(req.query);
            }
            if (req.params) {
                sanitizeInput(req.params);
            }

            next();
        } catch (error) {
            next(new Error(`Request validation failed: ${error.message}`));
        }
    };
}

// Basic input sanitization
function sanitizeInput(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            // Remove null bytes and control characters
            obj[key] = obj[key].replace(/\0/g, '').trim();
            
            // Basic SQL injection protection
            if (obj[key].toLowerCase().includes('drop table') ||
                obj[key].toLowerCase().includes('delete from') ||
                obj[key].toLowerCase().includes('insert into') ||
                obj[key].toLowerCase().includes('update ')) {
                throw new Error(`Potentially harmful input detected in ${key}`);
            }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeInput(obj[key]);
        }
    }
}

// Database operation wrapper with error handling
export async function safeDbOperation(operation, context = 'database operation') {
    try {
        return await operation();
    } catch (error) {
        console.error(`Error in ${context}:`, error);
        
        // Check for corruption
        const errorMessage = error.message.toLowerCase();
        const isCorruption = CORRUPTION_INDICATORS.some(indicator => 
            errorMessage.includes(indicator)
        );
        
        if (isCorruption) {
            throw new Error(`Database integrity issue detected during ${context}: ${error.message}`);
        }
        
        throw error;
    }
}