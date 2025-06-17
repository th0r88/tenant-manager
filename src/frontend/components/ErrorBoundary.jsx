import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null,
            retryCount: 0
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        
        // Log error for debugging
        console.error('Error Boundary Caught:', error, errorInfo);
        
        // Optional: Send error to logging service
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState(prevState => ({
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: prevState.retryCount + 1
        }));
    };

    render() {
        if (this.state.hasError) {
            const { fallback: Fallback } = this.props;
            
            if (Fallback) {
                return <Fallback 
                    error={this.state.error}
                    errorInfo={this.state.errorInfo}
                    onRetry={this.handleRetry}
                    retryCount={this.state.retryCount}
                />;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-base-200">
                    <div className="card w-96 bg-base-100 shadow-xl">
                        <div className="card-body text-center">
                            <div className="text-6xl mb-4">⚠️</div>
                            <h2 className="card-title justify-center text-error">
                                Something went wrong
                            </h2>
                            <p className="text-base-content/70 mb-4">
                                An unexpected error occurred while rendering this component.
                            </p>
                            
                            {/* Error details - only show in development */}
                            {process.env.NODE_ENV === 'development' && (
                                <div className="bg-base-200 p-4 rounded-lg text-left text-xs font-mono max-h-40 overflow-auto mb-4">
                                    <div className="text-error font-bold mb-2">Error:</div>
                                    <div className="mb-2">{this.state.error?.toString()}</div>
                                    {this.state.errorInfo?.componentStack && (
                                        <>
                                            <div className="text-error font-bold mb-2">Component Stack:</div>
                                            <div className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</div>
                                        </>
                                    )}
                                </div>
                            )}
                            
                            <div className="card-actions justify-center">
                                <button 
                                    className="btn btn-primary"
                                    onClick={this.handleRetry}
                                >
                                    Try Again
                                </button>
                                <button 
                                    className="btn btn-outline"
                                    onClick={() => window.location.reload()}
                                >
                                    Reload Page
                                </button>
                            </div>
                            
                            {this.state.retryCount > 0 && (
                                <div className="text-xs text-base-content/50 mt-2">
                                    Retry attempts: {this.state.retryCount}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Custom error fallback component for specific use cases
export function ReportGeneratorErrorFallback({ error, errorInfo, onRetry, retryCount }) {
    return (
        <div className="card bg-base-100 shadow-xl">
            <div className="card-body text-center">
                <div className="text-4xl mb-4">📄💥</div>
                <h3 className="card-title justify-center text-error">
                    Report Generation Failed
                </h3>
                <p className="text-base-content/70 mb-4">
                    We couldn't generate your report. This might be due to:
                </p>
                
                <ul className="text-left text-sm space-y-1 mb-4">
                    <li>• Missing tenant or utility data</li>
                    <li>• Network connectivity issues</li>
                    <li>• Server processing errors</li>
                    <li>• Invalid date ranges</li>
                </ul>

                <div className="card-actions justify-center">
                    <button 
                        className="btn btn-primary btn-sm"
                        onClick={onRetry}
                    >
                        🔄 Retry Generation
                    </button>
                    <button 
                        className="btn btn-outline btn-sm"
                        onClick={() => window.location.reload()}
                    >
                        🔃 Refresh Page
                    </button>
                </div>
                
                {retryCount > 2 && (
                    <div className="alert alert-warning mt-4">
                        <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                            <h3 className="font-bold">Persistent Error</h3>
                            <div className="text-xs">Multiple retry attempts failed. Please contact support.</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Network error fallback
export function NetworkErrorFallback({ error, onRetry }) {
    return (
        <div className="alert alert-error">
            <svg className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
                <h3 className="font-bold">Connection Error</h3>
                <div className="text-xs">Unable to connect to the server. Check your internet connection.</div>
            </div>
            <button className="btn btn-sm btn-outline" onClick={onRetry}>
                Retry
            </button>
        </div>
    );
}

export default ErrorBoundary;