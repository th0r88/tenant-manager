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
import { LanguageProvider } from './context/LanguageContext';
import LanguageSelector from './components/LanguageSelector';
import { useTranslation } from './hooks/useTranslation';
import './styles.css';

function AppContent() {
    const { t, getMonthNames, getUtilityTypes, formatCurrency } = useTranslation();
    const [properties, setProperties] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [utilities, setUtilities] = useState([]);
    const [editing, setEditing] = useState(null);
    const [editingUtility, setEditingUtility] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { error: apiError, isLoading: globalLoading, handleApiCall, clearError } = useApiErrorHandler();
    const [utilityFilter, setUtilityFilter] = useState({
        month: (new Date().getMonth() + 1).toString(),
        year: new Date().getFullYear().toString(),
        utility_type: ''
    });
    const [isPropertyDropdownOpen, setIsPropertyDropdownOpen] = useState(false);

    useEffect(() => {
        console.log('Environment variables:', {
            VITE_API_BASE: import.meta.env.VITE_API_BASE,
            all: import.meta.env
        });
        loadProperties();
    }, []);

    useEffect(() => {
        if (selectedProperty) {
            loadTenants();
            loadUtilities();
        }
    }, [selectedProperty]);

    const loadProperties = async () => {
        try {
            const data = await propertyApi.getAll();
            setProperties(data);
            if (data.length > 0 && !selectedProperty) {
                setSelectedProperty(data[0]);
            }
        } catch (err) {
            console.error('Error loading properties:', err);
            setError('Failed to load properties: ' + err.message);
        }
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
            } else {
                await utilityApi.create(utilityData);
                setSuccess(t('forms.successSaved'));
            }
            setEditingUtility(null);
            loadUtilities();
        } catch (err) {
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
        setActiveTab('tenants');
        clearMessages();
    };

    const handleDelete = async (id) => {
        try {
            clearMessages();
            await tenantApi.delete(id);
            setSuccess(t('forms.successDeleted'));
            loadTenants();
        } catch (err) {
            setError(t('forms.errorDeleting'));
        }
    };

    return (
        <div className="min-h-screen bg-base-200">
                <div className="navbar bg-base-100 shadow-lg">
                    <div className="container mx-auto px-4 flex justify-between items-center w-full max-w-5xl">
                        <div className="navbar-start">
                            <h1 className="text-3xl font-bold">{t('common.appTitle', 'Tenant Manager')}</h1>
                        </div>
                        <div className="navbar-end flex items-center space-x-4">
                            <LanguageSelector />
                            <div className="dropdown dropdown-end group">
                            <div 
                                tabIndex={0} 
                                role="button" 
                                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                onClick={(e) => {
                                    e.currentTarget.focus();
                                    setIsPropertyDropdownOpen(true);
                                }}
                                onFocus={() => setIsPropertyDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setIsPropertyDropdownOpen(false), 150)}
                            >
                                <span className="text-lg">🏠</span>
                                <span className="max-w-40 truncate">{selectedProperty ? `${selectedProperty.name}` : t('properties.selectProperty', 'Select Property')}</span>
                                <svg className={`w-4 h-4 transition-transform ${isPropertyDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                            <ul tabIndex={0} className="dropdown-content menu bg-white border border-gray-300 rounded-md shadow-lg z-[1] w-80 p-1">
                                {properties.map(property => (
                                    <li key={property.id}>
                                        <button
                                            onClick={() => {
                                                setSelectedProperty(property);
                                                setIsPropertyDropdownOpen(false);
                                            }}
                                            className={`flex flex-col items-start w-full px-4 py-3 text-sm text-left hover:bg-gray-100 rounded-md ${
                                                selectedProperty?.id === property.id
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-gray-700'
                                            }`}
                                        >
                                            <div className="font-semibold">{property.name}</div>
                                            <div className="text-xs text-gray-500 mt-1">{property.address}</div>
                                            {selectedProperty?.id === property.id && (
                                                <svg className="w-4 h-4 ml-auto text-blue-600 absolute right-2 top-1/2 transform -translate-y-1/2" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </button>
                                    </li>
                                ))}
                                <div className="border-t border-gray-200 my-1"></div>
                                <li>
                                    <button
                                        onClick={() => {
                                            setActiveTab('properties');
                                            setIsPropertyDropdownOpen(false);
                                        }}
                                        className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                                    >
                                        {t('properties.title')}
                                    </button>
                                </li>
                            </ul>
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
                    <div className="alert alert-success mb-4">
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
                
                <div className="flex space-x-4 mb-6" style={{marginLeft: 0, paddingLeft: 0}}>
                    <div className="tooltip" data-tip={t('dashboard.title')}>
                        <button 
                            className={`flex items-center space-x-2 text-sm font-medium rounded-md hover:bg-gray-50 focus:outline-none ${
                                activeTab === 'dashboard' 
                                    ? 'bg-white shadow-sm' 
                                    : 'bg-white text-gray-700'
                            }`}
                            style={{
                                padding: '10px 14px',
                                border: activeTab === 'dashboard' 
                                    ? '3px solid oklch(45% 0.24 277.023)' 
                                    : '3px solid #d1d5db',
                                color: activeTab === 'dashboard' 
                                    ? 'oklch(45% 0.24 277.023)' 
                                    : undefined
                            }}
                            onClick={() => setActiveTab('dashboard')}
                        >
                            <span>{t('navigation.dashboard')}</span>
                        </button>
                    </div>
                    <div className="tooltip" data-tip={!selectedProperty ? t('forms.selectProperty') : t('tenants.title')}>
                        <button 
                            className={`flex items-center space-x-2 text-sm font-medium rounded-md focus:outline-none ${
                                !selectedProperty 
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                    : activeTab === 'tenants'
                                        ? 'bg-white shadow-sm'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                            style={{
                                padding: '10px 14px',
                                border: !selectedProperty 
                                    ? '3px solid #d1d5db'
                                    : activeTab === 'tenants'
                                        ? '3px solid oklch(65% 0.241 354.308)'
                                        : '3px solid #d1d5db',
                                color: !selectedProperty 
                                    ? undefined
                                    : activeTab === 'tenants'
                                        ? 'oklch(65% 0.241 354.308)'
                                        : undefined
                            }}
                            onClick={() => selectedProperty && setActiveTab('tenants')}
                            disabled={!selectedProperty}
                        >
                            <span>{t('navigation.tenants')}</span>
                        </button>
                    </div>
                    <div className="tooltip" data-tip={!selectedProperty ? t('forms.selectProperty') : t('utilities.title')}>
                        <button 
                            className={`flex items-center space-x-2 text-sm font-medium rounded-md focus:outline-none ${
                                !selectedProperty 
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                    : activeTab === 'utilities'
                                        ? 'bg-white shadow-sm'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                            style={{
                                padding: '10px 14px',
                                border: !selectedProperty 
                                    ? '3px solid #d1d5db'
                                    : activeTab === 'utilities'
                                        ? '3px solid oklch(77% 0.152 181.912)'
                                        : '3px solid #d1d5db',
                                color: !selectedProperty 
                                    ? undefined
                                    : activeTab === 'utilities'
                                        ? 'oklch(77% 0.152 181.912)'
                                        : undefined
                            }}
                            onClick={() => selectedProperty && setActiveTab('utilities')}
                            disabled={!selectedProperty}
                        >
                            <span>{t('navigation.utilities')}</span>
                        </button>
                    </div>
                    <div className="tooltip" data-tip={!selectedProperty ? t('forms.selectProperty') : t('reports.title')}>
                        <button 
                            className={`flex items-center space-x-2 text-sm font-medium rounded-md focus:outline-none ${
                                !selectedProperty 
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                    : activeTab === 'reports'
                                        ? 'bg-white shadow-sm'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                            style={{
                                padding: '10px 14px',
                                border: !selectedProperty 
                                    ? '3px solid #d1d5db'
                                    : activeTab === 'reports'
                                        ? '3px solid oklch(76% 0.177 163.223)'
                                        : '3px solid #d1d5db',
                                color: !selectedProperty 
                                    ? undefined
                                    : activeTab === 'reports'
                                        ? 'oklch(76% 0.177 163.223)'
                                        : undefined
                            }}
                            onClick={() => selectedProperty && setActiveTab('reports')}
                            disabled={!selectedProperty}
                        >
                            <span>{t('navigation.reports')}</span>
                        </button>
                    </div>
                </div>
            
            {activeTab === 'dashboard' && <Dashboard />}
            
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
                                            <h3 className="card-title">{utility.utility_type}</h3>
                                            <div className="space-y-2">
                                                <p><span className="font-semibold">{t('utilities.period')}</span> {utility.month}/{utility.year}</p>
                                                <p><span className="font-semibold">{t('utilities.totalAmountLabel')}</span> {formatCurrency(utility.total_amount)}</p>
                                                <p><span className="font-semibold">{t('utilities.allocationLabel')}</span> {utility.allocation_method === 'per_person' ? t('utilities.perPerson') : (utility.allocation_method === 'per_square_meter' || utility.allocation_method === 'per_sqm') ? 'po m²' : utility.allocation_method}</p>
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
                    <ReportGenerator selectedProperty={selectedProperty} tenants={tenants} />
                </ErrorBoundary>
            )}
            
            {activeTab === 'properties' && (
                <ErrorBoundary>
                    <PropertyManager 
                        properties={properties}
                        onPropertyChange={loadProperties}
                        onError={setError}
                        onSuccess={setSuccess}
                    />
                </ErrorBoundary>
            )}
            </div>
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