import { useState, useCallback } from 'react';

export function useErrorHandler() {
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleAsync = useCallback(async (asyncFunction, options = {}) => {
        const { 
            onSuccess, 
            onError, 
            loadingMessage = 'Processing...',
            showErrorAlert = true,
            retries = 0
        } = options;

        setIsLoading(true);
        setError(null);

        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const result = await asyncFunction();
                setIsLoading(false);
                
                if (onSuccess) {
                    onSuccess(result);
                }
                
                return result;
            } catch (err) {
                lastError = err;
                
                // If this isn't the last attempt, wait before retrying
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }
                
                // Final attempt failed
                break;
            }
        }

        // Handle the final error
        const processedError = processError(lastError);
        setError(processedError);
        setIsLoading(false);

        if (onError) {
            onError(processedError);
        }

        if (showErrorAlert) {
            console.error('Operation failed:', processedError);
        }

        throw processedError;
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const retry = useCallback((asyncFunction, options = {}) => {
        return handleAsync(asyncFunction, options);
    }, [handleAsync]);

    return {
        error,
        isLoading,
        handleAsync,
        clearError,
        retry
    };
}

export function useApiErrorHandler() {
    const { error, isLoading, handleAsync, clearError, retry } = useErrorHandler();

    const handleApiCall = useCallback(async (apiCall, options = {}) => {
        const { 
            successMessage,
            errorMessage = 'Operation failed',
            retries = 1,
            ...otherOptions 
        } = options;

        return handleAsync(apiCall, {
            retries,
            onSuccess: (result) => {
                if (successMessage) {
                    console.log(successMessage);
                }
                if (options.onSuccess) {
                    options.onSuccess(result);
                }
            },
            onError: (error) => {
                console.error(errorMessage + ':', error.message);
                if (options.onError) {
                    options.onError(error);
                }
            },
            ...otherOptions
        });
    }, [handleAsync]);

    return {
        error,
        isLoading,
        handleApiCall,
        clearError,
        retry: (apiCall, options = {}) => handleApiCall(apiCall, options)
    };
}

function processError(error) {
    // Network errors
    if (!navigator.onLine) {
        return {
            type: 'network',
            message: 'No internet connection',
            details: 'Please check your network connection and try again.',
            recoverable: true
        };
    }

    // Fetch/Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
            type: 'network',
            message: 'Network request failed',
            details: 'Unable to connect to the server. Please try again.',
            recoverable: true
        };
    }

    // HTTP errors
    if (error.status) {
        switch (error.status) {
            case 400:
                return {
                    type: 'validation',
                    message: 'Invalid request',
                    details: error.message || 'Please check your input and try again.',
                    recoverable: true
                };
            case 401:
                return {
                    type: 'auth',
                    message: 'Unauthorized',
                    details: 'Your session has expired. Please refresh the page.',
                    recoverable: false
                };
            case 403:
                return {
                    type: 'auth',
                    message: 'Access denied',
                    details: 'You don\'t have permission to perform this action.',
                    recoverable: false
                };
            case 404:
                return {
                    type: 'notfound',
                    message: 'Resource not found',
                    details: 'The requested resource could not be found.',
                    recoverable: false
                };
            case 429:
                return {
                    type: 'ratelimit',
                    message: 'Too many requests',
                    details: 'Please wait a moment before trying again.',
                    recoverable: true
                };
            case 500:
            case 502:
            case 503:
            case 504:
                return {
                    type: 'server',
                    message: 'Server error',
                    details: 'The server is experiencing issues. Please try again later.',
                    recoverable: true
                };
            default:
                return {
                    type: 'http',
                    message: `HTTP ${error.status}`,
                    details: error.message || 'An unexpected error occurred.',
                    recoverable: true
                };
        }
    }

    // PDF generation specific errors
    if (error.message && error.message.includes('PDF')) {
        return {
            type: 'pdf',
            message: 'PDF generation failed',
            details: 'Unable to generate the PDF report. Please check your data and try again.',
            recoverable: true
        };
    }

    // Batch export specific errors
    if (error.message && error.message.includes('batch')) {
        return {
            type: 'batch',
            message: 'Batch export failed',
            details: 'Unable to export multiple reports. Try reducing the number of selected items.',
            recoverable: true
        };
    }

    // Generic errors
    return {
        type: 'generic',
        message: error.message || 'An unexpected error occurred',
        details: 'Please try again. If the problem persists, contact support.',
        recoverable: true
    };
}

export function ErrorDisplay({ error, onRetry, onDismiss, className = '' }) {
    if (!error) return null;

    const getAlertClass = () => {
        switch (error.type) {
            case 'network':
                return 'alert-warning';
            case 'auth':
                return 'alert-error';
            case 'validation':
                return 'alert-info';
            case 'server':
                return 'alert-error';
            default:
                return 'alert-error';
        }
    };

    const getIcon = () => {
        switch (error.type) {
            case 'network':
                return (
                    <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                );
            case 'auth':
                return (
                    <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                );
            default:
                return (
                    <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
        }
    };

    return (
        <div className={`alert ${getAlertClass()} ${className}`}>
            {getIcon()}
            <div className="flex-1">
                <h3 className="font-bold">{error.message}</h3>
                <div className="text-xs">{error.details}</div>
            </div>
            <div className="flex gap-2">
                {error.recoverable && onRetry && (
                    <button className="btn btn-sm btn-outline" onClick={onRetry}>
                        Retry
                    </button>
                )}
                {onDismiss && (
                    <button className="btn btn-sm btn-ghost" onClick={onDismiss}>
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}

export default {
    useErrorHandler,
    useApiErrorHandler,
    ErrorDisplay
};