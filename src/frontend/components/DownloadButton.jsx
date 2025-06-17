import React, { useState, useEffect } from 'react';

export default function DownloadButton({ onDownload, isLoading, tenantName, variant = 'primary', size = 'sm' }) {
    const [animationState, setAnimationState] = useState('idle'); // idle, loading, success, error
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isLoading) {
            setAnimationState('loading');
            // Simulate progress for better UX
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) return prev;
                    return prev + Math.random() * 15;
                });
            }, 100);

            return () => clearInterval(interval);
        } else {
            if (animationState === 'loading') {
                setProgress(100);
                setAnimationState('success');
                setTimeout(() => {
                    setAnimationState('idle');
                    setProgress(0);
                }, 2000);
            }
        }
    }, [isLoading, animationState]);

    const handleClick = async () => {
        try {
            setProgress(0);
            await onDownload();
        } catch (error) {
            setAnimationState('error');
            setTimeout(() => {
                setAnimationState('idle');
                setProgress(0);
            }, 3000);
        }
    };

    const getButtonClasses = () => {
        const baseClasses = `btn btn-${size}`;
        const variantClasses = {
            primary: 'btn-primary',
            outline: 'btn-outline',
            success: 'btn-success',
            error: 'btn-error'
        };

        if (animationState === 'success') {
            return `${baseClasses} btn-success`;
        } else if (animationState === 'error') {
            return `${baseClasses} btn-error`;
        } else {
            return `${baseClasses} ${variantClasses[variant]}`;
        }
    };

    const getButtonContent = () => {
        switch (animationState) {
            case 'loading':
                return (
                    <div className="flex items-center gap-2">
                        <div className="loading loading-spinner loading-xs"></div>
                        <span className="hidden sm:inline">Generating...</span>
                        <div className="w-12 bg-base-300 rounded-full h-1 hidden sm:block">
                            <div 
                                className="bg-primary h-1 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                );
            case 'success':
                return (
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span className="hidden sm:inline">Downloaded!</span>
                    </div>
                );
            case 'error':
                return (
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                        <span className="hidden sm:inline">Failed</span>
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <span className="hidden sm:inline">Download PDF</span>
                    </div>
                );
        }
    };

    return (
        <div className="tooltip" data-tip={`Download detailed PDF report for ${tenantName}`}>
            <button 
                className={getButtonClasses()}
                onClick={handleClick}
                disabled={isLoading}
            >
                {getButtonContent()}
            </button>
        </div>
    );
}