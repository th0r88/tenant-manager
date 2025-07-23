import React, { useState, useEffect } from 'react';
import TenantForm from './components/TenantForm';
import TenantList from './components/TenantList';
import UtilityForm from './components/UtilityForm';
import ReportGenerator from './components/ReportGenerator';
import PropertyManager from './components/PropertyManager';
import Dashboard from './components/Dashboard';
import ErrorBoundary, { ReportGeneratorErrorFallback, NetworkErrorFallback } from './components/ErrorBoundary';
import { ErrorDisplay, useApiErrorHandler } from './hooks/useErrorHandler.jsx';
import { tenantApi, utilityApi, propertyApi } from './services/api';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import LanguageSelector from './components/LanguageSelector';
import { useTranslation } from './hooks/useTranslation';
import './styles.css';

function AppContent() {
    const { t, getMonthNames, getUtilityTypes, formatCurrency } = useTranslation();
    const { changeLanguage } = useLanguage();
    const [properties, setProperties] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [utilities, setUtilities] = useState([]);
    const [editing, setEditing] = useState(null);
    const [editingUtility, setEditingUtility] = useState(null);
    const [dashboardKey, setDashboardKey] = useState(0);
    const [activeTab, setActiveTab] = useState('dashboard');

    // Helper function to change tab with hash and localStorage persistence
    const changeTab = (tab) => {
        setActiveTab(tab);
        window.location.hash = tab;
        localStorage.setItem('activeTab', tab);
    };
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [successVisible, setSuccessVisible] = useState(false);
    const { error: apiError, isLoading: globalLoading, handleApiCall, clearError } = useApiErrorHandler();
    const [utilityFilter, setUtilityFilter] = useState(() => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, so add 1
        const currentYear = now.getFullYear();
        
        // Calculate previous month
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear = currentYear - 1;
        }
        
        return {
            month: prevMonth.toString(),
            year: prevYear.toString(),
            utility_type: ''
        };
    });
    const [isPropertyDropdownOpen, setIsPropertyDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        console.log('Environment variables:', {
            VITE_API_BASE: import.meta.env.VITE_API_BASE,
            all: import.meta.env
        });
        
        // Restore active tab from URL hash or localStorage
        const hash = window.location.hash.slice(1);
        const savedTab = localStorage.getItem('activeTab');
        const restoredTab = hash || savedTab || 'dashboard';
        
        // Validate tab exists
        const validTabs = ['dashboard', 'tenants', 'utilities', 'reports', 'properties'];
        if (validTabs.includes(restoredTab)) {
            setActiveTab(restoredTab);
            if (!hash && restoredTab !== 'dashboard') {
                window.location.hash = restoredTab;
            }
        }
        
        loadProperties();
    }, []);

    // Handle browser back/forward navigation
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.slice(1);
            const validTabs = ['dashboard', 'tenants', 'utilities', 'reports', 'properties'];
            if (validTabs.includes(hash)) {
                setActiveTab(hash);
                localStorage.setItem('activeTab', hash);
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    useEffect(() => {
        if (selectedProperty) {
            loadTenants();
            loadUtilities();
        }
    }, [selectedProperty]);

    // Auto-dismiss success notifications with fade animation
    useEffect(() => {
        if (success) {
            setSuccessVisible(true);
            const fadeTimer = setTimeout(() => {
                setSuccessVisible(false);
            }, 2700); // Start fade 300ms before clearing
            const clearTimer = setTimeout(() => {
                setSuccess('');
            }, 3000);
            return () => {
                clearTimeout(fadeTimer);
                clearTimeout(clearTimer);
            };
        } else {
            setSuccessVisible(false);
        }
    }, [success]);

    const loadProperties = async () => {
        try {
            const data = await propertyApi.getAll();
            setProperties(data);
            if (data.length > 0 && !selectedProperty) {
                // Try to restore saved property selection from localStorage
                const savedPropertyId = localStorage.getItem('selectedPropertyId');
                if (savedPropertyId) {
                    const savedProperty = data.find(prop => prop.id === parseInt(savedPropertyId));
                    if (savedProperty) {
                        setSelectedProperty(savedProperty);
                    } else {
                        // If saved property doesn't exist, select first property
                        setSelectedProperty(data[0]);
                        localStorage.setItem('selectedPropertyId', data[0].id.toString());
                    }
                } else {
                    // No saved selection, select first property
                    setSelectedProperty(data[0]);
                    localStorage.setItem('selectedPropertyId', data[0].id.toString());
                }
            }
        } catch (err) {
            console.error('Error loading properties:', err);
            setError('Failed to load properties: ' + err.message);
        }
    };

    const handlePropertyChange = async () => {
        await loadProperties();
        setDashboardKey(prevKey => prevKey + 1); // Force dashboard refresh
    };

    const loadTenants = async () => {
        if (!selectedProperty) return;
        try {
            console.log('Loading tenants from:', import.meta.env.VITE_API_BASE || '/api');
            const data = await tenantApi.getAll(selectedProperty.id);
            setTenants(data);
        } catch (err) {
            console.error('Error loading tenants:', err);
            setError('Failed to load tenants: ' + err.message);
        }
    };

    const loadUtilities = async () => {
        if (!selectedProperty) return;
        try {
            console.log('Loading utilities from:', import.meta.env.VITE_API_BASE || '/api');
            const data = await utilityApi.getAll(selectedProperty.id);
            setUtilities(data);
        } catch (err) {
            console.error('Error loading utilities:', err);
            setError('Failed to load utilities: ' + err.message);
        }
    };

    const clearMessages = () => {
        setError('');
        setSuccess('');
    };

    const handleTenantSubmit = async (tenantData) => {
        try {
            clearMessages();
            if (editing) {
                await tenantApi.update(editing.id, tenantData);
                setSuccess(t('forms.successSaved'));
            } else {
                await tenantApi.create(tenantData);
                setSuccess(t('forms.successSaved'));
            }
            setEditing(null);
            loadTenants();
            setDashboardKey(prevKey => prevKey + 1); // Refresh dashboard when tenants change
        } catch (err) {
            setError(t('forms.errorSaving'));
        }
    };

    const handleUtilitySubmit = async (utilityData) => {
        try {
            clearMessages();
            if (editingUtility) {
                await utilityApi.update(editingUtility.id, utilityData);
                setSuccess(t('forms.successSaved'));
                // Update filter to show the edited utility
                setUtilityFilter({
                    month: utilityData.month.toString(),
                    year: utilityData.year.toString(),
                    utility_type: ''
                });
            } else {
                await utilityApi.create(utilityData);
                setSuccess(t('forms.successSaved'));
                // Update filter to show the newly added utility
                setUtilityFilter({
                    month: utilityData.month.toString(),
                    year: utilityData.year.toString(),
                    utility_type: ''
                });
            }
            setEditingUtility(null);
            loadUtilities();
        } catch (err) {
            console.error('Error saving utility:', err);
            setError(t('forms.errorSaving'));
        }
    };

    const handleUtilityEdit = (utility) => {
        setEditingUtility(utility);
    };

    const handleUtilityDelete = async (id) => {
        try {
            clearMessages();
            await utilityApi.delete(id);
            setSuccess(t('forms.successDeleted'));
            loadUtilities();
        } catch (err) {
            setError(t('forms.errorDeleting'));
        }
    };

    const handleEdit = (tenant) => {
        setEditing(tenant);
        changeTab('tenants');
        clearMessages();
    };

    const handleDelete = async (id) => {
        try {
            clearMessages();
            await tenantApi.delete(id);
            setSuccess(t('forms.successDeleted'));
            loadTenants();
            setDashboardKey(prevKey => prevKey + 1); // Refresh dashboard when tenants change
        } catch (err) {
            setError(t('forms.errorDeleting'));
        }
    };

    return (
        <div className="min-h-screen bg-base-200">
                <div className="navbar bg-base-100 shadow-lg">
                    <div className="container mx-auto flex justify-between items-center w-full max-w-5xl" style={{paddingLeft: '1rem', paddingRight: '1rem'}}>
                        <div className="navbar-start" style={{width: '75%'}}>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold pr-4">{t('common.appTitle', 'Tenant Manager')}</h1>
                        </div>
                        <div className="navbar-end flex items-center space-x-4" style={{width: '25%'}}>
                            {/* Mobile Hamburger Menu Button */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="lg:hidden flex items-center justify-center w-10 h-10 bg-base-100 border border-base-300 rounded-md hover:bg-base-200 focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-200"
                                aria-label="Toggle mobile menu"
                                aria-expanded={isMobileMenuOpen}
                                aria-controls="mobile-menu"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                            
                            {/* Desktop Language and Property Selectors */}
                            <div className="hidden lg:flex items-center space-x-4">
                            <LanguageSelector />
                            <div className="relative">
                                <button
                                    onClick={() => setIsPropertyDropdownOpen(!isPropertyDropdownOpen)}
                                    className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-base-content bg-base-100 border border-base-300 rounded-md hover:bg-base-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                                >
                                    <span className="text-lg">🏠</span>
                                    <span className="max-w-40 truncate">{selectedProperty ? `${selectedProperty.name}` : t('properties.selectProperty', 'Select Property')}</span>
                                    <svg className={`w-4 h-4 transition-transform ${isPropertyDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                
                                {isPropertyDropdownOpen && (
                                    <>
                                        {/* Backdrop */}
                                        <div 
                                            className="fixed inset-0 z-10"
                                            onClick={() => setIsPropertyDropdownOpen(false)}
                                        />
                                        
                                        {/* Dropdown */}
                                        <div className="absolute right-0 z-20 mt-2 w-80 bg-base-100 border border-base-300 rounded-md shadow-lg">
                                            <div className="py-1">
                                                {properties.map(property => (
                                                    <button
                                                        key={property.id}
                                                        onClick={() => {
                                                            setSelectedProperty(property);
                                                            localStorage.setItem('selectedPropertyId', property.id.toString());
                                                            setIsPropertyDropdownOpen(false);
                                                        }}
                                                        className={`flex items-center w-full px-4 py-3 text-sm text-left hover:bg-base-200 ${
                                                            selectedProperty && selectedProperty.id === property.id
                                                                ? 'bg-primary/10 text-primary'
                                                                : 'text-base-content'
                                                        }`}
                                                    >
                                                        <div className="flex-1">
                                                            <div className="font-semibold">{property.name}</div>
                                                            <div className="text-xs text-base-content/70 mt-1">{property.address}</div>
                                                        </div>
                                                        {selectedProperty && selectedProperty.id === property.id && (
                                                            <svg className="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                ))}
                                                <div className="border-t border-base-300 my-1"></div>
                                                <button
                                                    onClick={() => {
                                                        changeTab('properties');
                                                        setIsPropertyDropdownOpen(false);
                                                    }}
                                                    className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-primary-content bg-primary hover:bg-primary/90 rounded-md mx-1"
                                                >
                                                    {t('properties.title')}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            </div>
                        </div>
                    </div>
                </div>

            <div className="container mx-auto px-4 py-6 max-w-5xl">
                {/* Global API Error Display */}
                <ErrorDisplay 
                    error={apiError} 
                    onRetry={() => window.location.reload()} 
                    onDismiss={clearError}
                    className="mb-4"
                />
                
                {error && (
                    <div className="alert alert-error mb-4">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        {error}
                    </div>
                )}
                {success && (
                    <div className={`alert alert-success mb-4 transition-opacity duration-300 ease-out ${
                        successVisible ? 'opacity-100' : 'opacity-0'
                    }`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {success}
                        <button 
                            className="btn btn-sm btn-circle btn-ghost ml-auto" 
                            onClick={() => setSuccess('')}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Desktop Navigation */}
                <div className="hidden lg:flex space-x-4 mb-6" style={{marginLeft: 0, paddingLeft: 0}}>
                    <div className="tooltip" data-tip={t('dashboard.title')}>
                        <button 
                            className={`flex items-center space-x-2 text-sm font-medium rounded-md hover:bg-base-200 focus:outline-none ${
                                activeTab === 'dashboard' 
                                    ? 'bg-base-100 shadow-sm text-primary border-primary' 
                                    : 'bg-base-100 text-base-content border-base-300'
                            }`}
                            style={{
                                padding: '10px 14px',
                                border: activeTab === 'dashboard' 
                                    ? '3px solid' 
                                    : '3px solid'
                            }}
                            onClick={() => changeTab('dashboard')}
                        >
                            <span>{t('navigation.dashboard')}</span>
                        </button>
                    </div>
                    <div className="tooltip" data-tip={!selectedProperty ? t('forms.selectProperty') : t('tenants.title')}>
                        <button 
                            className={`flex items-center space-x-2 text-sm font-medium rounded-md focus:outline-none ${
                                !selectedProperty 
                                    ? 'bg-base-200 text-base-content opacity-40 cursor-not-allowed' 
                                    : activeTab === 'tenants'
                                        ? 'bg-base-100 shadow-sm text-secondary border-secondary'
                                        : 'bg-base-100 text-base-content border-base-300 hover:bg-base-200'
                            }`}
                            style={{
                                padding: '10px 14px',
                                border: !selectedProperty 
                                    ? '3px solid'
                                    : activeTab === 'tenants'
                                        ? '3px solid'
                                        : '3px solid'
                            }}
                            onClick={() => selectedProperty && changeTab('tenants')}
                            disabled={!selectedProperty}
                        >
                            <span>{t('navigation.tenants')}</span>
                        </button>
                    </div>
                    <div className="tooltip" data-tip={!selectedProperty ? t('forms.selectProperty') : t('utilities.title')}>
                        <button 
                            className={`flex items-center space-x-2 text-sm font-medium rounded-md focus:outline-none ${
                                !selectedProperty 
                                    ? 'bg-base-200 text-base-content opacity-40 cursor-not-allowed' 
                                    : activeTab === 'utilities'
                                        ? 'bg-base-100 shadow-sm text-accent border-accent'
                                        : 'bg-base-100 text-base-content border-base-300 hover:bg-base-200'
                            }`}
                            style={{
                                padding: '10px 14px',
                                border: !selectedProperty 
                                    ? '3px solid'
                                    : activeTab === 'utilities'
                                        ? '3px solid'
                                        : '3px solid'
                            }}
                            onClick={() => selectedProperty && changeTab('utilities')}
                            disabled={!selectedProperty}
                        >
                            <span>{t('navigation.utilities')}</span>
                        </button>
                    </div>
                    <div className="tooltip" data-tip={!selectedProperty ? t('forms.selectProperty') : t('reports.title')}>
                        <button 
                            className={`flex items-center space-x-2 text-sm font-medium rounded-md focus:outline-none ${
                                !selectedProperty 
                                    ? 'bg-base-200 text-base-content opacity-40 cursor-not-allowed' 
                                    : activeTab === 'reports'
                                        ? 'bg-base-100 shadow-sm text-info border-info'
                                        : 'bg-base-100 text-base-content border-base-300 hover:bg-base-200'
                            }`}
                            style={{
                                padding: '10px 14px',
                                border: !selectedProperty 
                                    ? '3px solid'
                                    : activeTab === 'reports'
                                        ? '3px solid'
                                        : '3px solid'
                            }}
                            onClick={() => selectedProperty && changeTab('reports')}
                            disabled={!selectedProperty}
                        >
                            <span>{t('navigation.reports')}</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Overlay */}
                {isMobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <div 
                            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        
                        {/* Mobile Menu */}
                        <div 
                            id="mobile-menu"
                            className="fixed top-0 right-0 h-full w-80 bg-base-100 shadow-xl z-50 lg:hidden transform transition-transform duration-300 ease-in-out"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="mobile-menu-title"
                        >
                            <div className="p-6">
                                {/* Close Button */}
                                <div className="flex justify-between items-center mb-6">
                                    <h2 id="mobile-menu-title" className="text-xl font-bold">Menu</h2>
                                    <button
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="flex items-center justify-center w-8 h-8 bg-base-200 rounded-md hover:bg-base-300 transition-colors duration-200"
                                        aria-label="Close menu"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Navigation Items */}
                                <nav className="space-y-2" role="navigation" aria-label="Main navigation">
                                    {/* Dashboard */}
                                    <button
                                        onClick={() => {
                                            changeTab('dashboard');
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-left transition-colors duration-200 ${
                                            activeTab === 'dashboard' 
                                                ? 'bg-primary text-primary-content' 
                                                : 'hover:bg-base-200'
                                        }`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v3H8V5z" />
                                        </svg>
                                        <span>{t('navigation.dashboard')}</span>
                                    </button>

                                    {/* Tenants */}
                                    <button
                                        onClick={() => {
                                            if (selectedProperty) {
                                                changeTab('tenants');
                                                setIsMobileMenuOpen(false);
                                            }
                                        }}
                                        disabled={!selectedProperty}
                                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-left transition-colors duration-200 ${
                                            !selectedProperty
                                                ? 'opacity-40 cursor-not-allowed'
                                                : activeTab === 'tenants' 
                                                    ? 'bg-secondary text-secondary-content' 
                                                    : 'hover:bg-base-200'
                                        }`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <span>{t('navigation.tenants')}</span>
                                    </button>

                                    {/* Utilities */}
                                    <button
                                        onClick={() => {
                                            if (selectedProperty) {
                                                changeTab('utilities');
                                                setIsMobileMenuOpen(false);
                                            }
                                        }}
                                        disabled={!selectedProperty}
                                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-left transition-colors duration-200 ${
                                            !selectedProperty
                                                ? 'opacity-40 cursor-not-allowed'
                                                : activeTab === 'utilities' 
                                                    ? 'bg-accent text-accent-content' 
                                                    : 'hover:bg-base-200'
                                        }`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span>{t('navigation.utilities')}</span>
                                    </button>

                                    {/* Reports */}
                                    <button
                                        onClick={() => {
                                            if (selectedProperty) {
                                                changeTab('reports');
                                                setIsMobileMenuOpen(false);
                                            }
                                        }}
                                        disabled={!selectedProperty}
                                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-left transition-colors duration-200 ${
                                            !selectedProperty
                                                ? 'opacity-40 cursor-not-allowed'
                                                : activeTab === 'reports' 
                                                    ? 'bg-info text-info-content' 
                                                    : 'hover:bg-base-200'
                                        }`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>{t('navigation.reports')}</span>
                                    </button>

                                    {/* Properties */}
                                    <button
                                        onClick={() => {
                                            changeTab('properties');
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-left transition-colors duration-200 ${
                                            activeTab === 'properties' 
                                                ? 'bg-warning text-warning-content' 
                                                : 'hover:bg-base-200'
                                        }`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-8 0H3m2 0h6M7 3h2v4H7V3zm8 0h2v4h-2V3zm-4 0h2v4h-2V3z" />
                                        </svg>
                                        <span>{t('properties.title')}</span>
                                    </button>
                                </nav>

                                {/* Language & Property Selection */}
                                <div className="mt-8 pt-6 border-t border-base-300">
                                    {/* Language Flags */}
                                    <div className="mb-4">
                                        <div className="text-sm font-medium mb-2">{t('language.select')}</div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={async () => {
                                                    await changeLanguage('sl');
                                                }}
                                                className="flex items-center space-x-2 px-3 py-2 text-sm rounded-md bg-base-200 hover:bg-base-300 transition-colors duration-200"
                                            >
                                                <span className="text-lg">🇸🇮</span>
                                                <span>SL</span>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    await changeLanguage('en');
                                                }}
                                                className="flex items-center space-x-2 px-3 py-2 text-sm rounded-md bg-base-200 hover:bg-base-300 transition-colors duration-200"
                                            >
                                                <span className="text-lg">🇬🇧</span>
                                                <span>EN</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Property Selection */}
                                    <div className="mb-4">
                                        <div className="text-sm font-medium mb-2">{t('properties.selectProperty')}</div>
                                        <div className="space-y-2">
                                            {properties.map(property => (
                                                <button
                                                    key={property.id}
                                                    onClick={() => {
                                                        setSelectedProperty(property);
                                                        localStorage.setItem('selectedPropertyId', property.id.toString());
                                                        setIsMobileMenuOpen(false);
                                                    }}
                                                    className={`w-full flex items-start p-3 text-left rounded-md transition-colors duration-200 ${
                                                        selectedProperty && selectedProperty.id === property.id
                                                            ? 'bg-primary text-primary-content'
                                                            : 'bg-base-200 hover:bg-base-300'
                                                    }`}
                                                >
                                                    <div className="flex-1">
                                                        <div className="font-medium">{property.name}</div>
                                                        <div className="text-xs opacity-70 mt-1">{property.address}</div>
                                                    </div>
                                                    {selectedProperty && selectedProperty.id === property.id && (
                                                        <svg className="w-5 h-5 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            
            {activeTab === 'dashboard' && <Dashboard key={dashboardKey} />}
            
            {activeTab === 'tenants' && (
                <>
                    <TenantForm onSubmit={handleTenantSubmit} initialData={editing} onCancel={() => setEditing(null)} selectedProperty={selectedProperty} />
                    <TenantList tenants={tenants} onEdit={handleEdit} onDelete={handleDelete} />
                </>
            )}
            
            {activeTab === 'utilities' && (
                <>
                    <UtilityForm onSubmit={handleUtilitySubmit} initialData={editingUtility} onCancel={() => setEditingUtility(null)} selectedProperty={selectedProperty} />
                    <div>
                        <h2 className="text-2xl font-bold mb-4">{t('utilities.title')}</h2>
                        
                        {/* Filter Controls */}
                        <div className="card bg-base-100 shadow-md mb-4">
                            <div className="card-body p-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="form-control w-full">
                                        <select 
                                            value={utilityFilter.month} 
                                            onChange={(e) => setUtilityFilter({...utilityFilter, month: e.target.value})}
                                            className="select select-bordered w-full"
                                        >
                                            <option value="">{t('reports.allMonths')}</option>
                                            {getMonthNames().map((monthName, i) => (
                                                <option key={i + 1} value={i + 1}>
                                                    {monthName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-control w-full">
                                        <select 
                                            value={utilityFilter.utility_type} 
                                            onChange={(e) => setUtilityFilter({...utilityFilter, utility_type: e.target.value})}
                                            className="select select-bordered w-full"
                                        >
                                            <option value="">{t('utilities.allUtilityTypes')}</option>
                                            {getUtilityTypes().map(({ key, label }) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-control w-full">
                                        <select 
                                            value={utilityFilter.year} 
                                            onChange={(e) => setUtilityFilter({...utilityFilter, year: e.target.value})}
                                            className="select select-bordered w-full"
                                        >
                                            <option value="">{t('reports.allYears')}</option>
                                            {Array.from({ length: 26 }, (_, i) => 2025 + i)
                                                .sort((a, b) => b - a)
                                                .map(year => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                    <div className="form-control w-full">
                                        <button 
                                            className="btn btn-outline"
                                            onClick={() => setUtilityFilter({month: '', year: '', utility_type: ''})}
                                        >
                                            {t('utilities.clearFilters')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {utilities.length === 0 ? (
                            <div className="card bg-base-100 shadow-xl">
                                <div className="card-body">
                                    <p>{t('utilities.noUtilityEntries')}</p>
                                </div>
                            </div>
                        ) : (() => {
                            const filteredUtilities = utilities.filter(utility => {
                                const monthMatch = !utilityFilter.month || utility.month == utilityFilter.month;
                                const yearMatch = !utilityFilter.year || utility.year == utilityFilter.year;
                                const typeMatch = !utilityFilter.utility_type || utility.utility_type === utilityFilter.utility_type;
                                return monthMatch && yearMatch && typeMatch;
                            });

                            return filteredUtilities.length === 0 ? (
                                <div className="card bg-base-100 shadow-xl">
                                    <div className="card-body">
                                        <p>{t('utilities.noUtilityEntriesFiltered')}</p>
                                        <p className="text-sm opacity-70 mt-2">
                                            {t('utilities.adjustFilters')}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredUtilities.map((utility) => (
                                    <div key={utility.id} className="card bg-base-100 shadow-xl">
                                        <div className="card-body">
                                            <h3 className="card-title">{getUtilityTypes().find(type => type.key === utility.utility_type)?.label || utility.utility_type}</h3>
                                            <div className="space-y-2">
                                                <p><span className="font-semibold">{t('utilities.period')}</span> {utility.month}/{utility.year}</p>
                                                <p><span className="font-semibold">{t('utilities.totalAmountLabel')}</span> {formatCurrency(utility.total_amount)}</p>
                                                <p><span className="font-semibold">{t('utilities.allocationLabel')}</span> {utility.allocation_method === 'per_person' ? t('utilities.perPerson') : utility.allocation_method === 'per_sqm' ? 'po m²' : utility.allocation_method}</p>
                                            </div>
                                            <div className="card-actions justify-end mt-4">
                                                <div className="tooltip" data-tip={t('utilities.editUtilityTooltip')}>
                                                    <button className="btn btn-sm btn-outline" onClick={() => handleUtilityEdit(utility)}>{t('common.edit')}</button>
                                                </div>
                                                <div className="tooltip" data-tip={t('utilities.deleteUtilityTooltip')}>
                                                    <button className="btn btn-sm btn-error" onClick={() => handleUtilityDelete(utility.id)}>{t('common.delete')}</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </>
            )}
            
            {activeTab === 'reports' && (
                <ErrorBoundary fallback={ReportGeneratorErrorFallback}>
                    <ReportGenerator 
                        selectedProperty={selectedProperty} 
                        tenants={tenants} 
                        onSuccess={setSuccess}
                        onError={setError}
                    />
                </ErrorBoundary>
            )}
            
            {activeTab === 'properties' && (
                <ErrorBoundary>
                    <PropertyManager 
                        properties={properties}
                        onPropertyChange={handlePropertyChange}
                        onError={setError}
                        onSuccess={setSuccess}
                    />
                </ErrorBoundary>
            )}
            </div>
            
            {/* Footer */}
            <footer className="bg-base-200 py-4">
                <div className="container mx-auto px-4 text-center">
                    <div className="text-sm text-base-content/70">
                        <a 
                            href="https://jf.si" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-primary underline"
                        >
                            {t('footer.author')}
                        </a>
                        {' - '}
                        <a 
                            href="https://github.com/th0r88/tenant-manager" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-primary underline"
                        >
                            {t('footer.github')}
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default function App() {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    );
}