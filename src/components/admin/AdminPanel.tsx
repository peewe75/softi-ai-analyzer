import React, { useState, useEffect } from 'react';
import {
    Users, Shield, Settings, BarChart,
    Search, Filter, MoreVertical, Clock, LayoutDashboard
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: 'owner' | 'admin' | 'user';
    subscription_status?: string | null;
    plan_name?: string;
    created_at: string;
}

interface AdminSummary {
    total_users: number;
    active_pro: number;
    system_load: number;
    pending_support: number;
}

interface AuditLog {
    id: string;
    admin_id: string;
    action: string;
    target_id: string;
    details?: Record<string, unknown>;
    created_at: string;
}

interface EntitlementItem {
    id: string;
    name: string;
    description?: string | null;
}

interface PlanDefinition {
    id: string;
    name: string;
    description?: string | null;
    entitlements: EntitlementItem[];
}

interface PlanLimit {
    plan_id: string;
    limit_key: string;
    limit_value: number | null;
    window: 'none' | 'daily' | 'monthly';
}

interface LimitCatalogItem {
    limit_key: string;
    label: string;
    description: string;
    supported_windows: string[];
}

interface PaymentPrice {
    id: string;
    plan_id: string;
    interval: string;
    amount: number;
    currency: string;
    stripe_price_id?: string | null;
    is_active?: boolean;
    created_at?: string;
}

interface BillingRecord {
    id: string;
    [key: string]: unknown;
}

type ApplyScope = 'all_active_and_new' | 'new_only';

export default function AdminPanel() {
    const { getToken } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [summary, setSummary] = useState<AdminSummary | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [plans, setPlans] = useState<PlanDefinition[]>([]);
    const [catalogEntitlements, setCatalogEntitlements] = useState<EntitlementItem[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [selectedEntitlementKeys, setSelectedEntitlementKeys] = useState<string[]>([]);
    const [planApplyScope, setPlanApplyScope] = useState<ApplyScope>('all_active_and_new');
    const [isSavingPlan, setIsSavingPlan] = useState(false);
    const [planLimits, setPlanLimits] = useState<PlanLimit[]>([]);
    const [limitCatalog, setLimitCatalog] = useState<LimitCatalogItem[]>([]);
    const [isSavingLimits, setIsSavingLimits] = useState(false);
    const [paymentPrices, setPaymentPrices] = useState<PaymentPrice[]>([]);
    const [billingSubscriptions, setBillingSubscriptions] = useState<BillingRecord[]>([]);
    const [paymentEvents, setPaymentEvents] = useState<BillingRecord[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [savingByUser, setSavingByUser] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'system' | 'plans' | 'payments'>('users');
    const [superAnalysis, setSuperAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const parseJsonResponse = (raw: string) => {
        if (!raw) return {};
        try {
            return JSON.parse(raw);
        } catch {
            return { error: 'Unexpected non-JSON response from server.' };
        }
    };

    const apiFetch = async (url: string, init: RequestInit = {}) => {
        const token = await getToken();
        return fetch(url, {
            ...init,
            headers: {
                ...(init.headers || {}),
                Authorization: `Bearer ${token}`,
            },
        });
    };

    const loadUsers = async () => {
        setError(null);
        try {
            const response = await apiFetch('/api/admin/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
        } catch (e) {
            setError('Unable to load admin users.');
            console.error(e);
        }
    };

    const loadSummary = async () => {
        try {
            const response = await apiFetch('/api/admin/summary');
            if (!response.ok) throw new Error('Failed to fetch summary');
            const data = await response.json();
            setSummary(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadAuditLogs = async () => {
        try {
            const response = await apiFetch('/api/admin/audit?limit=15');
            if (!response.ok) throw new Error('Failed to fetch audit logs');
            const data = await response.json();
            setAuditLogs(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadPlanSettings = async () => {
        try {
            const [plansResponse, entitlementsResponse] = await Promise.all([
                apiFetch('/api/admin/plans'),
                apiFetch('/api/admin/entitlements'),
            ]);

            if (!plansResponse.ok) throw new Error('Failed to fetch plans');
            if (!entitlementsResponse.ok) throw new Error('Failed to fetch entitlement catalog');

            const plansData = (await plansResponse.json()) as PlanDefinition[];
            const entitlementData = (await entitlementsResponse.json()) as EntitlementItem[];

            setPlans(plansData);
            setCatalogEntitlements(entitlementData);

            setSelectedPlanId((current) => {
                if (current && plansData.some((plan) => plan.id === current)) return current;
                return plansData[0]?.id ?? null;
            });
        } catch (e) {
            console.error(e);
            setError('Unable to load plan configuration.');
        }
    };

    const loadPlanLimits = async (planId: string) => {
        try {
            const [limitsResponse, catalogResponse] = await Promise.all([
                apiFetch(`/api/admin/plans/${planId}/limits`),
                apiFetch('/api/admin/limits/catalog'),
            ]);

            if (!limitsResponse.ok) throw new Error('Failed to fetch plan limits');
            if (!catalogResponse.ok) throw new Error('Failed to fetch limits catalog');

            const limitsData = (await limitsResponse.json()) as PlanLimit[];
            const catalogData = (await catalogResponse.json()) as LimitCatalogItem[];
            setPlanLimits(limitsData);
            setLimitCatalog(catalogData);
        } catch (e) {
            console.error(e);
        }
    };

    const loadPayments = async () => {
        try {
            setIsLoadingPayments(true);
            const [pricesRes, subscriptionsRes, eventsRes] = await Promise.all([
                apiFetch('/api/admin/payments/prices'),
                apiFetch('/api/admin/payments/subscriptions'),
                apiFetch('/api/admin/payments/events'),
            ]);

            const pricesRaw = await pricesRes.text();
            const subscriptionsRaw = await subscriptionsRes.text();
            const eventsRaw = await eventsRes.text();

            const pricesPayload = parseJsonResponse(pricesRaw);
            const subscriptionsPayload = parseJsonResponse(subscriptionsRaw);
            const eventsPayload = parseJsonResponse(eventsRaw);

            if (pricesRes.ok && Array.isArray(pricesPayload)) setPaymentPrices(pricesPayload as PaymentPrice[]);
            if (subscriptionsRes.ok && Array.isArray(subscriptionsPayload)) setBillingSubscriptions(subscriptionsPayload as BillingRecord[]);
            if (eventsRes.ok && Array.isArray(eventsPayload)) setPaymentEvents(eventsPayload as BillingRecord[]);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingPayments(false);
        }
    };

    useEffect(() => {
        if (!selectedPlanId) {
            setSelectedEntitlementKeys([]);
            return;
        }

        const plan = plans.find((entry) => entry.id === selectedPlanId);
        if (!plan) {
            setSelectedEntitlementKeys([]);
            return;
        }

        setSelectedEntitlementKeys(plan.entitlements.map((entitlement) => entitlement.name));
    }, [selectedPlanId, plans]);

    useEffect(() => {
        if (!selectedPlanId) return;
        loadPlanLimits(selectedPlanId);
    }, [selectedPlanId]);

    useEffect(() => {
        if (activeTab === 'payments') {
            loadPayments();
        }
    }, [activeTab]);

    const refreshAll = async (initial = false) => {
        if (initial) {
            setIsLoading(true);
        } else {
            setIsRefreshing(true);
        }

        await Promise.all([loadUsers(), loadSummary(), loadAuditLogs(), loadPlanSettings()]);

        if (initial) {
            setIsLoading(false);
        } else {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        refreshAll(true);
    }, [getToken]);

    const updateUserRole = async (userId: string, newRole: string) => {
        try {
            setNotice(null);
            setError(null);
            setSavingByUser((prev) => ({ ...prev, [userId]: true }));
            let response = await apiFetch(`/api/admin/users/${userId}/role`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ role: newRole })
            });

            if (response.status === 404) {
                response = await apiFetch(`/api/admin/users/${userId}/role`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ role: newRole })
                });
            }

            const raw = await response.text();
            const payload = parseJsonResponse(raw);
            if (!response.ok) throw new Error(payload?.error || 'Failed role update');
            if (payload?.clerk_sync_status === 'failed') {
                setNotice('Role updated in Supabase, but Clerk metadata sync failed. Access control is still safe on server-side.');
            }
            await refreshAll();
        } catch (e) {
            console.error(e);
            setError('Unable to update user role.');
        }
        finally {
            setSavingByUser((prev) => ({ ...prev, [userId]: false }));
        }
    };

    const updateUserPlan = async (userId: string, planName: string) => {
        try {
            setError(null);
            setSavingByUser((prev) => ({ ...prev, [userId]: true }));
            let response = await apiFetch(`/api/admin/users/${userId}/subscription`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ plan_name: planName })
            });

            if (response.status === 404) {
                response = await apiFetch(`/api/admin/users/${userId}/subscription`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ plan_name: planName })
                });
            }

            const raw = await response.text();
            const payload = parseJsonResponse(raw);
            if (!response.ok) throw new Error(payload?.error || 'Failed subscription update');
            await refreshAll();
        } catch (e) {
            console.error(e);
            setError('Unable to update user subscription.');
        }
        finally {
            setSavingByUser((prev) => ({ ...prev, [userId]: false }));
        }
    };

    const toggleEntitlement = (entitlementName: string) => {
        setSelectedEntitlementKeys((prev) => {
            if (prev.includes(entitlementName)) {
                return prev.filter((key) => key !== entitlementName);
            }
            return [...prev, entitlementName];
        });
    };

    const savePlanEntitlements = async () => {
        if (!selectedPlanId) return;

        try {
            setError(null);
            setNotice(null);
            setIsSavingPlan(true);

            let response = await apiFetch(`/api/admin/plans/${selectedPlanId}/entitlements`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    entitlement_keys: selectedEntitlementKeys,
                    apply_scope: planApplyScope,
                }),
            });

            if (response.status === 404) {
                response = await apiFetch(`/api/admin/plans/${selectedPlanId}/entitlements`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        entitlement_keys: selectedEntitlementKeys,
                        apply_scope: planApplyScope,
                    }),
                });
            }

            const raw = await response.text();
            const payload = parseJsonResponse(raw) as { error?: string; affected_active_users?: number };
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to update plan entitlements');
            }

            setNotice(
                planApplyScope === 'new_only'
                    ? `Plan rules updated. Existing active users preserved: ${payload.affected_active_users ?? 0}.`
                    : 'Plan rules updated and applied to active and future subscribers.'
            );
            await refreshAll();
        } catch (e: any) {
            console.error(e);
            setError(e?.message || 'Unable to update plan entitlements.');
        } finally {
            setIsSavingPlan(false);
        }
    };

    const updatePlanLimit = (limitKey: string, patch: Partial<PlanLimit>) => {
        setPlanLimits((prev) => {
            const existing = prev.find((limit) => limit.limit_key === limitKey);
            if (!existing && selectedPlanId) {
                return [...prev, {
                    plan_id: selectedPlanId,
                    limit_key: limitKey,
                    limit_value: patch.limit_value ?? null,
                    window: (patch.window as 'none' | 'daily' | 'monthly') ?? 'none'
                }];
            }

            return prev.map((limit) => limit.limit_key === limitKey ? { ...limit, ...patch } : limit);
        });
    };

    const savePlanLimits = async () => {
        if (!selectedPlanId) return;

        try {
            setError(null);
            setNotice(null);
            setIsSavingLimits(true);

            const payloadLimits = planLimits
                .filter((limit) => limit.limit_key)
                .map((limit) => ({
                    limit_key: limit.limit_key,
                    limit_value: limit.limit_value,
                    window: limit.window,
                }));

            let response = await apiFetch(`/api/admin/plans/${selectedPlanId}/limits`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    limits: payloadLimits,
                    apply_scope: planApplyScope,
                })
            });

            if (response.status === 404) {
                response = await apiFetch(`/api/admin/plans/${selectedPlanId}/limits`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        limits: payloadLimits,
                        apply_scope: planApplyScope,
                    })
                });
            }

            const raw = await response.text();
            const result = parseJsonResponse(raw) as { error?: string; affected_active_users?: number };
            if (!response.ok) {
                throw new Error(result.error || 'Failed to save plan limits');
            }

            setNotice(
                planApplyScope === 'new_only'
                    ? `Plan limits updated. Existing active users preserved: ${result.affected_active_users ?? 0}.`
                    : 'Plan limits updated for active and future subscribers.'
            );

            await loadPlanLimits(selectedPlanId);
        } catch (e: any) {
            console.error(e);
            setError(e?.message || 'Unable to update plan limits.');
        } finally {
            setIsSavingLimits(false);
        }
    };

    const updatePaymentPrice = async (price: PaymentPrice, patch: Partial<PaymentPrice>) => {
        try {
            const payload = {
                amount: patch.amount ?? price.amount,
                currency: patch.currency ?? price.currency,
                interval: patch.interval ?? price.interval,
                is_active: patch.is_active ?? price.is_active ?? true,
            };

            const response = await apiFetch(`/api/admin/payments/prices/${price.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const raw = await response.text();
            const result = parseJsonResponse(raw) as { error?: string };
            if (!response.ok) throw new Error(result.error || 'Failed to update price');

            setNotice('Payment price updated successfully.');
            await loadPayments();
        } catch (e: any) {
            console.error(e);
            setError(e?.message || 'Unable to update payment price.');
        }
    };

    const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null;
    const planLimitsMap = new Map(planLimits.map((limit) => [limit.limit_key, limit]));
    const advancedAnalysisLimit = planLimitsMap.get('advanced_analysis_max_requests');
    const maxAssetsLimit = planLimitsMap.get('max_assets_per_analysis');
    const selectedPlanSortedKeys = [...selectedEntitlementKeys].sort();
    const persistedPlanSortedKeys = selectedPlan
        ? selectedPlan.entitlements.map((entitlement) => entitlement.name).sort()
        : [];
    const isPlanDirty = JSON.stringify(selectedPlanSortedKeys) !== JSON.stringify(persistedPlanSortedKeys);

    const filteredUsers = users.filter((user) => {
        const lower = query.toLowerCase();
        if (!lower.trim()) return true;
        return user.email.toLowerCase().includes(lower) || (user.full_name || '').toLowerCase().includes(lower);
    });

    const roleStats = filteredUsers.reduce(
        (acc, user) => {
            acc[user.role] += 1;
            return acc;
        },
        { owner: 0, admin: 0, user: 0 }
    );

    const runSuperAnalysis = async () => {
        try {
            setIsAnalyzing(true);
            setNotice(null);
            const response = await apiFetch('/api/admin/super-analysis', {
                method: 'POST'
            });
            if (!response.ok) throw new Error('Super analysis failed');
            const data = await response.json();
            setSuperAnalysis(data.analysis);
            setNotice('Super-Analysis generated successfully based on last 24h archives.');
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Operation failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const cards = [
        {
            label: 'Total Users',
            value: String(summary?.total_users ?? users.length),
            change: `${Math.max(0, users.length)} live`,
            icon: Users,
            color: 'text-blue-500'
        },
        {
            label: 'Active Pro',
            value: String(summary?.active_pro ?? 0),
            change: 'paid tiers',
            icon: Shield,
            color: 'text-[#238636]'
        },
        {
            label: 'System Load',
            value: `${summary?.system_load ?? 0}%`,
            change: (summary?.system_load ?? 0) < 70 ? 'Stable' : 'High',
            icon: BarChart,
            color: 'text-[#00A3FF]'
        },
        {
            label: 'Pending Support',
            value: String(summary?.pending_support ?? 0),
            change: 'queue',
            icon: Clock,
            color: 'text-orange-500'
        }
    ];

    return (
        <div className="min-h-screen bg-[#0A0E14] text-[#E1E4E8]">
            <div className="max-w-7xl mx-auto px-8 py-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-6">
                        <Link
                            to="/app"
                            className="p-3 bg-[#161B22] border border-[#30363D] rounded-xl text-[#8B949E] hover:text-[#00A3FF] hover:border-[#00A3FF] transition-all group shadow-lg"
                            title="Torna alla Dashboard App"
                        >
                            <LayoutDashboard size={24} />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-white mb-2">Admin Control Center</h1>
                            <p className="text-[#8B949E]">Manage users, roles, and platform-wide configurations.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 bg-[#238636] hover:bg-[#2EA043] text-white text-sm font-bold rounded-lg transition-all">
                            New Integration
                        </button>
                    </div>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    {cards.map((stat, i) => (
                        <div key={i} className="bg-[#0D1117] border border-[#30363D] p-6 rounded-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className={cn("p-2 rounded-lg bg-white/5", stat.color)}>
                                    <stat.icon size={20} />
                                </div>
                                <span className="text-[10px] font-bold text-[#238636] bg-[#238636]/10 px-2 py-1 rounded-full uppercase tracking-widest">{stat.change}</span>
                            </div>
                            <p className="text-[#8B949E] text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                            <h3 className="text-2xl font-black text-white">{stat.value}</h3>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="bg-[#0D1117] border border-[#30363D] rounded-3xl overflow-hidden shadow-2xl">
                    <div className="border-b border-[#30363D] flex items-center justify-between px-8 py-4 bg-[#161B22]/50">
                        <div className="flex items-center gap-8">
                            {['users', 'roles', 'plans', 'payments', 'system'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={cn(
                                        "text-sm font-bold uppercase tracking-widest transition-all pb-4 border-b-2 relative top-[17px]",
                                        activeTab === tab ? "text-[#00A3FF] border-[#00A3FF]" : "text-[#8B949E] border-transparent hover:text-white"
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#484F58]" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search emails..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="bg-[#0D1117] border border-[#30363D] rounded-xl py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-[#00A3FF] transition-all"
                                    aria-label="Search users by email or name"
                                />
                            </div>
                            <button className="p-2 text-[#8B949E] hover:text-white transition-colors" title="Filter"><Filter size={16} /></button>
                        </div>
                    </div>

                    <div className="p-0">
                        {notice && (
                            <div className="mx-8 mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                                {notice}
                            </div>
                        )}
                        {error ? (
                            <div className="px-8 py-10 text-sm text-red-400">{error}</div>
                        ) : activeTab === 'users' ? (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#0D1117] border-b border-[#30363D]">
                                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[#8B949E]">User</th>
                                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[#8B949E]">Role</th>
                                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[#8B949E]">Plan</th>
                                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-[#8B949E]">Created</th>
                                        <th className="px-8 py-4 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00A3FF]"></div>
                                                    <p className="text-[#8B949E] text-sm animate-pulse">Accessing secure user database...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="p-4 rounded-full bg-white/5 text-[#484F58]">
                                                        <Users size={32} />
                                                    </div>
                                                    <p className="text-[#8B949E] text-sm">No users match this search.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <tr key={user.id} className="border-b border-[#30363D] hover:bg-white/5 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-white mb-0.5">{user.full_name || 'No Name'}</span>
                                                        <span className="text-xs text-[#8B949E]">{user.email}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <select
                                                        value={user.role}
                                                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                                                        title="Change User Role"
                                                        aria-label="User Role"
                                                        disabled={!!savingByUser[user.id]}
                                                        className={cn(
                                                            "bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-tight focus:outline-none focus:border-[#00A3FF]",
                                                            user.role === 'owner' ? "text-purple-400" :
                                                                user.role === 'admin' ? "text-blue-400" : "text-[#8B949E]"
                                                        )}
                                                    >
                                                        <option value="user">User</option>
                                                        <option value="admin">Admin</option>
                                                        <option value="owner">Owner (maps to Admin)</option>
                                                    </select>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <select
                                                        value={user.plan_name || 'free'}
                                                        onChange={(e) => updateUserPlan(user.id, e.target.value)}
                                                        title="Change Subscription Plan"
                                                        aria-label="Subscription Plan"
                                                        disabled={!!savingByUser[user.id]}
                                                        className="bg-[#0D1117] border border-[#30363D] rounded-lg px-2 py-1 text-[10px] font-bold text-[#E36209] uppercase tracking-tight focus:outline-none focus:border-[#00A3FF]"
                                                    >
                                                        <option value="free">Free</option>
                                                        <option value="lite">Lite</option>
                                                        <option value="pro">Pro</option>
                                                        <option value="premium">Premium</option>
                                                    </select>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-xs text-[#8B949E]">{new Date(user.created_at).toLocaleDateString()}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <button className="p-2 text-[#484F58] hover:text-white transition-colors" title="Actions">
                                                        {savingByUser[user.id] ? '...' : <MoreVertical size={16} />}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        ) : activeTab === 'roles' ? (
                            <div className="px-8 py-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-5">
                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest mb-2">Owner</p>
                                        <p className="text-3xl font-black text-white">{roleStats.owner}</p>
                                    </div>
                                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-5">
                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest mb-2">Admin</p>
                                        <p className="text-3xl font-black text-white">{roleStats.admin}</p>
                                    </div>
                                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-5">
                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest mb-2">User</p>
                                        <p className="text-3xl font-black text-white">{roleStats.user}</p>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-5 text-sm text-[#8B949E]">
                                    Role updates are enforced server-side. In this phase, owner is normalized to admin for consistent sync across Clerk and Supabase.
                                </div>
                            </div>
                        ) : activeTab === 'plans' ? (
                            <div className="px-8 py-8 space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-6">
                                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-2">
                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest mb-1">Subscription Plans</p>
                                        {plans.map((plan) => (
                                            <button
                                                key={plan.id}
                                                onClick={() => setSelectedPlanId(plan.id)}
                                                className={cn(
                                                    'w-full text-left rounded-lg border px-3 py-2 transition-colors',
                                                    selectedPlanId === plan.id
                                                        ? 'border-[#00A3FF] bg-[#00A3FF]/10 text-white'
                                                        : 'border-[#30363D] text-[#8B949E] hover:text-white hover:border-[#8B949E]'
                                                )}
                                            >
                                                <p className="text-sm font-semibold uppercase">{plan.name}</p>
                                                <p className="text-[11px] opacity-70 mt-1">{plan.entitlements.length} enabled</p>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-5">
                                        {!selectedPlan ? (
                                            <p className="text-sm text-[#8B949E]">No plan selected.</p>
                                        ) : (
                                            <div className="space-y-5">
                                                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                                                    <div>
                                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest">Selected Plan</p>
                                                        <h3 className="text-xl font-black text-white uppercase">{selectedPlan.name}</h3>
                                                        <p className="text-xs text-[#8B949E] mt-1">Choose which features are included in this subscription.</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <select
                                                            value={planApplyScope}
                                                            onChange={(e) => setPlanApplyScope(e.target.value as ApplyScope)}
                                                            title="Select Plan Apply Scope"
                                                            aria-label="Plan Apply Scope"
                                                            className="bg-[#0A0E14] border border-[#30363D] rounded-lg px-3 py-2 text-xs text-[#E1E4E8] focus:outline-none focus:border-[#00A3FF]"
                                                        >
                                                            <option value="all_active_and_new">Apply to active + new</option>
                                                            <option value="new_only">Apply only to new subscribers</option>
                                                        </select>
                                                        <button
                                                            onClick={savePlanEntitlements}
                                                            disabled={!isPlanDirty || isSavingPlan}
                                                            className={cn(
                                                                'px-4 py-2 rounded-lg text-xs font-bold transition-colors',
                                                                !isPlanDirty || isSavingPlan
                                                                    ? 'bg-[#30363D] text-[#8B949E] cursor-not-allowed'
                                                                    : 'bg-[#238636] hover:bg-[#2EA043] text-white'
                                                            )}
                                                        >
                                                            {isSavingPlan ? 'Saving...' : 'Save Changes'}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {catalogEntitlements.map((entitlement) => {
                                                        const enabled = selectedEntitlementKeys.includes(entitlement.name);
                                                        return (
                                                            <button
                                                                key={entitlement.id}
                                                                type="button"
                                                                onClick={() => toggleEntitlement(entitlement.name)}
                                                                className={cn(
                                                                    'rounded-lg border px-4 py-3 text-left transition-colors',
                                                                    enabled
                                                                        ? 'border-[#00A3FF] bg-[#00A3FF]/10 text-white'
                                                                        : 'border-[#30363D] text-[#8B949E] hover:text-white hover:border-[#8B949E]'
                                                                )}
                                                            >
                                                                <p className="text-sm font-semibold">{entitlement.name}</p>
                                                                {entitlement.description && (
                                                                    <p className="text-xs opacity-75 mt-1">{entitlement.description}</p>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <div className="rounded-lg border border-[#30363D] bg-[#0A0E14] px-4 py-3 text-xs text-[#8B949E]">
                                                    Scope: <span className="text-white">{planApplyScope === 'new_only' ? 'Only new subscribers after save' : 'Active and future subscribers'}</span>
                                                </div>

                                                <div className="rounded-lg border border-[#30363D] bg-[#0A0E14] p-4 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest">Plan Limits</p>
                                                        <button
                                                            onClick={savePlanLimits}
                                                            disabled={isSavingLimits}
                                                            className={cn(
                                                                'px-4 py-2 rounded-lg text-xs font-bold transition-colors',
                                                                isSavingLimits
                                                                    ? 'bg-[#30363D] text-[#8B949E] cursor-not-allowed'
                                                                    : 'bg-[#1F6FEB] hover:bg-[#388BFD] text-white'
                                                            )}
                                                        >
                                                            {isSavingLimits ? 'Saving limits...' : 'Save Limits'}
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="rounded-lg border border-[#30363D] p-3 space-y-2">
                                                            <p className="text-sm font-semibold text-white">Advanced Analysis Requests</p>
                                                            <p className="text-xs text-[#8B949E]">Max requests allowed in the selected window. Empty = unlimited.</p>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={advancedAnalysisLimit?.limit_value ?? ''}
                                                                onChange={(e) => updatePlanLimit('advanced_analysis_max_requests', {
                                                                    limit_value: e.target.value === '' ? null : Number(e.target.value),
                                                                })}
                                                                aria-label="Advanced Analysis Max Requests"
                                                                className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00A3FF]"
                                                            />
                                                            <select
                                                                value={advancedAnalysisLimit?.window || 'monthly'}
                                                                onChange={(e) => updatePlanLimit('advanced_analysis_max_requests', {
                                                                    window: e.target.value as 'none' | 'daily' | 'monthly'
                                                                })}
                                                                aria-label="Limit Window"
                                                                className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-xs text-[#E1E4E8] focus:outline-none focus:border-[#00A3FF]"
                                                            >
                                                                <option value="daily">Daily</option>
                                                                <option value="monthly">Monthly</option>
                                                                <option value="none">No window (lifetime/global)</option>
                                                            </select>
                                                        </div>

                                                        <div className="rounded-lg border border-[#30363D] p-3 space-y-2">
                                                            <p className="text-sm font-semibold text-white">Max Assets Per Analysis</p>
                                                            <p className="text-xs text-[#8B949E]">Maximum currencies/assets selectable by a subscriber.</p>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={maxAssetsLimit?.limit_value ?? ''}
                                                                onChange={(e) => updatePlanLimit('max_assets_per_analysis', {
                                                                    limit_value: e.target.value === '' ? null : Number(e.target.value),
                                                                    window: 'none',
                                                                })}
                                                                aria-label="Max Assets Per Analysis"
                                                                className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00A3FF]"
                                                            />
                                                            <p className="text-[11px] text-[#8B949E]">Window is always <span className="text-white">none</span> for this limit.</p>
                                                        </div>
                                                    </div>

                                                    {limitCatalog.length > 0 && (
                                                        <div className="text-[11px] text-[#8B949E]">
                                                            {limitCatalog.map((item) => (
                                                                <p key={item.limit_key}>
                                                                    <span className="text-white">{item.limit_key}</span> - {item.description}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'payments' ? (
                            <div className="px-8 py-8 space-y-6">
                                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest">Plan Prices</p>
                                        <button
                                            onClick={loadPayments}
                                            className="text-xs font-semibold text-[#00A3FF] hover:text-white transition-colors"
                                            disabled={isLoadingPayments}
                                        >
                                            {isLoadingPayments ? 'Refreshing...' : 'Refresh'}
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {paymentPrices.length === 0 ? (
                                            <p className="text-sm text-[#8B949E]">No pricing rows found. Create records in `plan_prices` to manage payments here.</p>
                                        ) : paymentPrices.map((price) => (
                                            <div key={price.id} className="grid grid-cols-1 md:grid-cols-[1fr,140px,120px,120px,120px] gap-3 items-center rounded-lg border border-[#30363D] p-3">
                                                <div>
                                                    <p className="text-sm text-white font-semibold">Price ID: {price.id}</p>
                                                    <p className="text-xs text-[#8B949E]">Plan: {price.plan_id} | Stripe: {price.stripe_price_id || 'n/a'}</p>
                                                </div>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    defaultValue={price.amount}
                                                    onBlur={(e) => updatePaymentPrice(price, { amount: Number(e.target.value) })}
                                                    aria-label="Price Amount"
                                                    className="bg-[#0A0E14] border border-[#30363D] rounded px-3 py-2 text-xs text-white"
                                                />
                                                <input
                                                    type="text"
                                                    defaultValue={price.currency}
                                                    onBlur={(e) => updatePaymentPrice(price, { currency: e.target.value })}
                                                    aria-label="Price Currency"
                                                    className="bg-[#0A0E14] border border-[#30363D] rounded px-3 py-2 text-xs text-white"
                                                />
                                                <select
                                                    defaultValue={price.interval}
                                                    onChange={(e) => updatePaymentPrice(price, { interval: e.target.value })}
                                                    aria-label="Price Interval"
                                                    className="bg-[#0A0E14] border border-[#30363D] rounded px-3 py-2 text-xs text-white"
                                                >
                                                    <option value="week">Week</option>
                                                    <option value="month">Month</option>
                                                    <option value="year">Year</option>
                                                </select>
                                                <button
                                                    onClick={() => updatePaymentPrice(price, { is_active: !price.is_active })}
                                                    className={cn(
                                                        'px-3 py-2 rounded text-xs font-semibold',
                                                        price.is_active ? 'bg-[#238636] text-white' : 'bg-[#30363D] text-[#8B949E]'
                                                    )}
                                                >
                                                    {price.is_active ? 'Active' : 'Inactive'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-5">
                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest mb-3">Billing Subscriptions</p>
                                        <p className="text-2xl font-black text-white">{billingSubscriptions.length}</p>
                                        <p className="text-xs text-[#8B949E] mt-2">Records loaded from `billing_subscriptions`.</p>
                                    </div>
                                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-5">
                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest mb-3">Payment Events</p>
                                        <p className="text-2xl font-black text-white">{paymentEvents.length}</p>
                                        <p className="text-xs text-[#8B949E] mt-2">Records loaded from `payments`.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="px-8 py-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-5">
                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest mb-2">System Health</p>
                                        <p className="text-2xl font-black text-white">{(summary?.system_load ?? 0).toFixed(1)}%</p>
                                        <p className="text-xs text-[#8B949E] mt-2">Computed from current backend process usage.</p>
                                    </div>
                                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-5">
                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest mb-2">Pending Queue</p>
                                        <p className="text-2xl font-black text-white">{summary?.pending_support ?? 0}</p>
                                        <p className="text-xs text-[#8B949E] mt-2">Derived from audit events flagged as pending support.</p>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-black text-white">AI Super-Analysis</h3>
                                            <p className="text-xs text-[#8B949E]">Aggregate all user analysis from the last 24 hours for a macro-trend view.</p>
                                        </div>
                                        <button
                                            onClick={runSuperAnalysis}
                                            disabled={isAnalyzing}
                                            className={cn(
                                                "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg",
                                                isAnalyzing
                                                    ? "bg-[#30363D] text-[#8B949E] animate-pulse"
                                                    : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white"
                                            )}
                                        >
                                            {isAnalyzing ? "Processing..." : "Run Macro Analysis"}
                                        </button>
                                    </div>

                                    {superAnalysis ? (
                                        <div className="mt-4 p-5 bg-[#0A0E14] border border-[#30363D] rounded-2xl max-h-[400px] overflow-y-auto custom-scrollbar">
                                            <div className="prose prose-invert prose-xs max-w-none text-[#E1E4E8] leading-relaxed whitespace-pre-wrap font-mono">
                                                {superAnalysis}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-4 p-8 border-2 border-dashed border-[#30363D] rounded-2xl flex flex-col items-center justify-center gap-4">
                                            <div className="p-3 rounded-full bg-white/5 text-[#484F58]">
                                                <BarChart size={32} />
                                            </div>
                                            <p className="text-xs text-[#8B949E]">No aggregated insights generated yet. Click above to start.</p>
                                        </div>
                                    )}
                                </div>
                                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] overflow-hidden">
                                    <div className="px-5 py-4 border-b border-[#30363D] flex items-center justify-between">
                                        <p className="text-xs text-[#8B949E] uppercase tracking-widest">Recent Admin Actions</p>
                                        <button
                                            onClick={() => refreshAll()}
                                            className="text-xs font-semibold text-[#00A3FF] hover:text-white transition-colors"
                                            disabled={isRefreshing}
                                        >
                                            {isRefreshing ? 'Refreshing...' : 'Refresh'}
                                        </button>
                                    </div>
                                    <div className="max-h-[340px] overflow-y-auto">
                                        {auditLogs.length === 0 ? (
                                            <div className="px-5 py-8 text-sm text-[#8B949E]">No audit entries yet.</div>
                                        ) : (
                                            auditLogs.map((log) => (
                                                <div key={log.id} className="px-5 py-4 border-b border-[#30363D] last:border-b-0">
                                                    <p className="text-sm text-white font-semibold">{log.action}</p>
                                                    <p className="text-xs text-[#8B949E] mt-1">Target: {log.target_id || '-'}</p>
                                                    <p className="text-xs text-[#8B949E]">At: {new Date(log.created_at).toLocaleString()}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
