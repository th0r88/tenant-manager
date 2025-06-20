import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../services/api';
import { useTranslation } from '../hooks/useTranslation';

export default function Dashboard() {
    const { t, formatCurrency, formatDate } = useTranslation();
    const [overview, setOverview] = useState({});
    const [propertiesBreakdown, setPropertiesBreakdown] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [revenueTrends, setRevenueTrends] = useState([]);
    const [utilityBreakdown, setUtilityBreakdown] = useState([]);
    const [capacityMetrics, setCapacityMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            setError('');
            
            const [
                overviewData,
                propertiesData,
                activityData,
                revenueData,
                utilityData,
                capacityData
            ] = await Promise.all([
                dashboardApi.getOverview(),
                dashboardApi.getPropertiesBreakdown(),
                dashboardApi.getRecentActivity(8),
                dashboardApi.getRevenueTrends(6),
                dashboardApi.getUtilityBreakdown(3),
                dashboardApi.getCapacityMetrics()
            ]);

            setOverview(overviewData);
            setPropertiesBreakdown(propertiesData);
            setRecentActivity(activityData);
            setRevenueTrends(revenueData);
            setUtilityBreakdown(utilityData);
            setCapacityMetrics(capacityData);
        } catch (err) {
            console.error('Error loading dashboard:', err);
            setError('Failed to load dashboard data: ' + err.message);
        } finally {
            setLoading(false);
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="alert alert-error">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    {error}
                </div>
            )}
            
            {/* Overview Statistics */}
            <div className="stats stats-vertical lg:stats-horizontal shadow w-full bg-white">
                <div className="stat">
                    <div className="stat-figure text-primary">
                        <svg className="w-8 h-8" style={{ marginTop: '50%' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-8 0H3m2 0h6" />
                        </svg>
                    </div>
                    <div className="stat-title">{t('navigation.properties')}</div>
                    <div className="stat-value text-primary">{overview.properties || 0}</div>
                </div>
                
                <div className="stat">
                    <div className="stat-figure text-secondary">
                        <svg className="w-8 h-8" style={{ marginTop: '50%' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                    </div>
                    <div className="stat-title">{t('navigation.tenants')}</div>
                    <div className="stat-value text-secondary">{overview.tenants || 0}</div>
                </div>
                
                <div className="stat">
                    <div className="stat-figure text-accent">
                        <svg className="w-8 h-8" style={{ marginTop: '50%' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div className="stat-title">{t('dashboard.monthlyRevenue')}</div>
                    <div className="stat-value text-accent">{formatCurrency(overview.totalRent)}</div>
                </div>
                
                <div className="stat">
                    <div className="stat-figure text-success">
                        <svg className="w-8 h-8" style={{ marginTop: '50%' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div className="stat-title">{t('dashboard.effectiveOccupancy')}</div>
                    <div className="stat-value text-success">{((overview.effectiveOccupancy || overview.avgOccupancy || 0) * 100).toFixed(1)}%</div>
                </div>
            </div>

            {/* Properties Breakdown, Capacity Overview, and Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Properties Breakdown */}
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title text-xl mb-4">{t('dashboard.propertiesBreakdown')}</h2>
                        <div className="grid grid-cols-1 gap-3">
                            {propertiesBreakdown.map(property => (
                                <div key={property.id} className="card bg-base-200 shadow">
                                    <div className="card-body p-4">
                                        <h3 className="card-title text-base">{property.name}</h3>
                                        <p className="text-xs opacity-70 mb-2">{property.address}</p>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="font-medium">{t('dashboard.type')}</span>
                                                <span>{t(`properties.propertyTypes.${property.property_type}`) || property.property_type}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="font-medium">{t('dashboard.tenantsLabel')}</span>
                                                <span className="badge badge-primary badge-sm">{property.tenant_count}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="font-medium">{t('dashboard.monthlyRent')}</span>
                                                <span className="font-bold text-success">{formatCurrency(property.total_rent)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="font-medium">{t('dashboard.totalArea')}</span>
                                                <span>{property.total_area} m²</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Capacity Overview */}
                {capacityMetrics && (
                    <div className="card bg-base-100 shadow-xl">
                        <div className="card-body">
                            <h2 className="card-title text-xl mb-4">{t('dashboard.capacityOverview')}</h2>
                            <div className="space-y-3">
                                <div className="stat">
                                    <div className="stat-title text-sm">{t('dashboard.totalCapacity')}</div>
                                    <div className="stat-value text-2xl text-primary">{capacityMetrics.totalCapacity || t('dashboard.unlimited')}</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-title text-sm">{t('dashboard.currentOccupancy')}</div>
                                    <div className="stat-value text-2xl text-secondary">{capacityMetrics.totalOccupied || 0}</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-title text-sm">{t('dashboard.availableSpaces')}</div>
                                    <div className="stat-value text-2xl text-success">{capacityMetrics.availableSpaces || t('dashboard.unlimited')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Recent Activity */}
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title text-xl mb-4">{t('dashboard.recentActivity')}</h2>
                        {recentActivity.length === 0 ? (
                            <div className="text-center py-8 opacity-50">
                                <p>{t('dashboard.noRecentActivity')}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recentActivity.map((activity, index) => (
                                    <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-base-200">
                                        <div className="avatar">
                                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                                                <div className="text-2xl flex items-center justify-center w-full h-full">
                                                    {activity.type === 'tenant' ? '👤' : '⚡'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-sm">
                                                {activity.type === 'tenant' ? t('dashboard.newTenant') : t('dashboard.utilityEntry')}
                                                <span className="font-bold">{activity.description}</span>
                                            </div>
                                            <div className="text-xs opacity-70">
                                                {activity.property_name} • {formatDate(activity.timestamp)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Revenue Trends */}
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title text-2xl mb-4">{t('dashboard.revenueTrends')}</h2>
                    {revenueTrends.length === 0 ? (
                        <div className="text-center py-8 opacity-50">
                            <p>{t('dashboard.noRevenueData')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="table table-zebra">
                                <thead>
                                    <tr>
                                        <th>{t('dashboard.period')}</th>
                                        <th>{t('dashboard.rentRevenue')}</th>
                                        <th>{t('dashboard.utilityRevenue')}</th>
                                        <th>{t('dashboard.totalRevenue')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {revenueTrends.map((trend, index) => (
                                        <tr key={index}>
                                            <td className="font-medium">{trend.month}/{trend.year}</td>
                                            <td>{formatCurrency(trend.rent_revenue)}</td>
                                            <td>{formatCurrency(trend.utility_revenue)}</td>
                                            <td className="font-bold text-success">{formatCurrency(trend.total_revenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Utility Breakdown */}
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title text-2xl mb-4">{t('dashboard.utilityCostsBreakdown')}</h2>
                    {utilityBreakdown.length === 0 ? (
                        <div className="text-center py-8 opacity-50">
                            <p>{t('dashboard.noUtilityData')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {utilityBreakdown.map((utility, index) => (
                                <div key={index} className="card bg-base-200 shadow">
                                    <div className="card-body">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="card-title text-lg">{utility.utility_type}</h3>
                                            <div className="text-2xl font-bold text-primary">{formatCurrency(utility.total_amount)}</div>
                                        </div>
                                        <div className="flex justify-between text-sm opacity-70">
                                            <span>{utility.entry_count} {t('dashboard.entriesAcrossProperties')} {utility.properties_count} {t('dashboard.propertiesCount')}</span>
                                            <span>{t('dashboard.average')} {formatCurrency(utility.avg_amount)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}