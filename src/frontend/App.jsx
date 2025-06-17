import React, { useState, useEffect } from 'react';
import TenantForm from './components/TenantForm';
import TenantList from './components/TenantList';
import UtilityForm from './components/UtilityForm';
import ReportGenerator from './components/ReportGenerator';
import PropertyManager from './components/PropertyManager';
import Dashboard from './components/Dashboard';
import { tenantApi, utilityApi, propertyApi } from './services/api';
import './styles.css';

export default function App() {
    const [properties, setProperties] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [utilities, setUtilities] = useState([]);
    const [editing, setEditing] = useState(null);
    const [editingUtility, setEditingUtility] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [utilityFilter, setUtilityFilter] = useState({
        month: (new Date().getMonth() + 1).toString(),
        year: new Date().getFullYear().toString(),
        utility_type: ''
    });

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
                setSuccess('Tenant updated successfully');
            } else {
                await tenantApi.create(tenantData);
                setSuccess('Tenant created successfully');
            }
            setEditing(null);
            loadTenants();
        } catch (err) {
            setError('Failed to save tenant');
        }
    };

    const handleUtilitySubmit = async (utilityData) => {
        try {
            clearMessages();
            if (editingUtility) {
                await utilityApi.update(editingUtility.id, utilityData);
                setSuccess('Utility cost updated successfully');
            } else {
                await utilityApi.create(utilityData);
                setSuccess('Utility cost added and allocated successfully');
            }
            setEditingUtility(null);
            loadUtilities();
        } catch (err) {
            setError('Failed to save utility cost');
        }
    };

    const handleUtilityEdit = (utility) => {
        setEditingUtility(utility);
    };

    const handleUtilityDelete = async (id) => {
        try {
            clearMessages();
            await utilityApi.delete(id);
            setSuccess('Utility cost deleted successfully');
            loadUtilities();
        } catch (err) {
            setError('Failed to delete utility cost');
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
            setSuccess('Tenant deleted successfully');
            loadTenants();
        } catch (err) {
            setError('Failed to delete tenant');
        }
    };

    return (
        <div className="min-h-screen bg-base-200">
            <div className="navbar bg-base-100 shadow-lg">
                <div className="navbar-start">
                    <h1 className="text-xl font-bold">Tenant Manager</h1>
                </div>
                <div className="navbar-end">
                    <div className="dropdown dropdown-end">
                        <div tabIndex={0} role="button" className="btn btn-ghost">
                            {selectedProperty ? `${selectedProperty.name}` : 'Select Property'}
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-80 p-2 shadow">
                            {properties.map(property => (
                                <li key={property.id}>
                                    <a onClick={() => setSelectedProperty(property)}>
                                        <div>
                                            <div className="font-semibold">{property.name}</div>
                                            <div className="text-sm opacity-70">{property.address}</div>
                                        </div>
                                    </a>
                                </li>
                            ))}
                            <div className="divider my-1"></div>
                            <li>
                                <a onClick={() => setActiveTab('properties')} className="btn btn-sm btn-primary">
                                    Manage Properties
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6">
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
                
                <div className="tabs tabs-boxed mb-6">
                    <div className="tooltip" data-tip="Overview of all properties">
                        <a 
                            className={`tab ${activeTab === 'dashboard' ? 'tab-active' : ''}`}
                            onClick={() => setActiveTab('dashboard')}
                        >
                            Dashboard
                        </a>
                    </div>
                    <div className="tooltip" data-tip={!selectedProperty ? "Select a property first" : "Manage tenants"}>
                        <a 
                            className={`tab ${activeTab === 'tenants' ? 'tab-active' : ''} ${!selectedProperty ? 'tab-disabled' : ''}`}
                            onClick={() => selectedProperty && setActiveTab('tenants')}
                        >
                            Tenants
                        </a>
                    </div>
                    <div className="tooltip" data-tip={!selectedProperty ? "Select a property first" : "Manage utility costs"}>
                        <a 
                            className={`tab ${activeTab === 'utilities' ? 'tab-active' : ''} ${!selectedProperty ? 'tab-disabled' : ''}`}
                            onClick={() => selectedProperty && setActiveTab('utilities')}
                        >
                            Utilities
                        </a>
                    </div>
                    <div className="tooltip" data-tip={!selectedProperty ? "Select a property first" : "Generate monthly reports"}>
                        <a 
                            className={`tab ${activeTab === 'reports' ? 'tab-active' : ''} ${!selectedProperty ? 'tab-disabled' : ''}`}
                            onClick={() => selectedProperty && setActiveTab('reports')}
                        >
                            Reports
                        </a>
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
                        <h2 className="text-2xl font-bold mb-4">Utility Entries</h2>
                        
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
                                            <option value="">All Months</option>
                                            {[...Array(12)].map((_, i) => (
                                                <option key={i + 1} value={i + 1}>
                                                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
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
                                            <option value="">All Utility Types</option>
                                            <option value="Elektrika">Elektrika</option>
                                            <option value="Voda">Voda</option>
                                            <option value="Ogrevanje">Ogrevanje</option>
                                            <option value="Internet">Internet</option>
                                            <option value="TV + RTV prispevek">TV + RTV prispevek</option>
                                            <option value="Snaga">Snaga</option>
                                            <option value="Ostalo">Ostalo</option>
                                        </select>
                                    </div>
                                    <div className="form-control w-full">
                                        <select 
                                            value={utilityFilter.year} 
                                            onChange={(e) => setUtilityFilter({...utilityFilter, year: e.target.value})}
                                            className="select select-bordered w-full"
                                        >
                                            <option value="">All Years</option>
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
                                            Clear Filters
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {utilities.length === 0 ? (
                            <div className="card bg-base-100 shadow-xl">
                                <div className="card-body">
                                    <p>No utility entries yet. Add your first utility cost above.</p>
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
                                        <p>No utility entries found for the selected period.</p>
                                        <p className="text-sm opacity-70 mt-2">
                                            Try adjusting your month/year filters or clear all filters to see all entries.
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
                                                <p><span className="font-semibold">Period:</span> {utility.month}/{utility.year}</p>
                                                <p><span className="font-semibold">Total Amount:</span> €{utility.total_amount}</p>
                                                <p><span className="font-semibold">Allocation:</span> {utility.allocation_method.replace('_', ' ')}</p>
                                            </div>
                                            <div className="card-actions justify-end mt-4">
                                                <div className="tooltip" data-tip="Edit this utility entry">
                                                    <button className="btn btn-sm btn-outline" onClick={() => handleUtilityEdit(utility)}>Edit</button>
                                                </div>
                                                <div className="tooltip" data-tip="Delete this utility entry">
                                                    <button className="btn btn-sm btn-error" onClick={() => handleUtilityDelete(utility.id)}>Delete</button>
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
            
            {activeTab === 'reports' && <ReportGenerator selectedProperty={selectedProperty} tenants={tenants} />}
            
            {activeTab === 'properties' && (
                <PropertyManager 
                    properties={properties}
                    onPropertyChange={loadProperties}
                    onError={setError}
                    onSuccess={setSuccess}
                />
            )}
            </div>
        </div>
    );
}