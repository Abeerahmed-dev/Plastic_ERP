import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Users, Sliders, Info, ShieldCheck, Truck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import UsersListPage from '../Users/UsersListPage';
import { settingsService } from '../../services/settings.service';

type SettingsTab = 'employees' | 'pos' | 'feature_access';

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'employees';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const qc = useQueryClient();

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const { data: featureAccess, isLoading: loadingAccess } = useQuery({
    queryKey: ['cashier-feature-access'],
    queryFn: () => settingsService.getCashierFeatureAccess(),
  });

  const toggleMutation = useMutation({
    mutationFn: (update: { customer_access?: boolean; party_access?: boolean }) =>
      settingsService.updateCashierFeatureAccess(update),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashier-feature-access'] });
      toast.success('Feature access settings updated successfully!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to update feature access settings.';
      toast.error(msg);
    },
  });

  const handleToggle = (key: 'customer_access' | 'party_access', currentVal: boolean) => {
    toggleMutation.mutate({ [key]: currentVal });
  };

  const tabs = [
    {
      id: 'employees' as SettingsTab,
      label: 'Software Access',
      icon: Users,
      description: 'Manage staff, cashier accounts, and software roles',
    },
    {
      id: 'feature_access' as SettingsTab,
      label: 'Feature Access',
      icon: ShieldCheck,
      description: 'Cashier screen feature access toggles (Customer & Party)',
    },
    {
      id: 'pos' as SettingsTab,
      label: 'POS & Billing Rules',
      icon: Sliders,
      description: 'Price floors, payment restrictions & defaults',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#161925] rounded-2xl p-6 border border-slate-200/80 dark:border-[#23283B] shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl text-slate-950 font-bold shadow-sm shrink-0">
            <Settings className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">System Settings</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Manage employees, feature permissions, and POS billing rules.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#23283B] pb-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f2438]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400 dark:text-slate-950' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="transition-all">
        {activeTab === 'employees' && (
          <div className="bg-white dark:bg-[#161925] rounded-2xl p-6 border border-slate-200/80 dark:border-[#23283B] shadow-xs">
            <UsersListPage embedded={true} />
          </div>
        )}

        {activeTab === 'feature_access' && (
          <div className="bg-white dark:bg-[#161925] rounded-2xl p-6 sm:p-8 border border-slate-200/80 dark:border-[#23283B] shadow-xs">
            {loadingAccess ? (
              <div className="py-12 flex items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading feature settings...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Customer Feature Card */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  featureAccess?.customer_access
                    ? 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/50'
                    : 'bg-slate-50/60 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                        featureAccess?.customer_access
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-base">Customer</h3>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            featureAccess?.customer_access
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {featureAccess?.customer_access ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Shows Customer button in Cashier navbar. Cashier can view customer profiles and ledgers in read-only mode.
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      disabled={toggleMutation.isPending}
                      onClick={() => handleToggle('customer_access', !featureAccess?.customer_access)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                        featureAccess?.customer_access ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                      } ${toggleMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                      aria-label="Toggle Customer Access"
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          featureAccess?.customer_access ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Cashier Permissions:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/50">
                      Read Only (No Add / Edit / Delete)
                    </span>
                  </div>
                </div>

                {/* 2. Party (Suppliers) Feature Card */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  featureAccess?.party_access
                    ? 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/50'
                    : 'bg-slate-50/60 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                        featureAccess?.party_access
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        <Truck className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-base">Party (Suppliers)</h3>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            featureAccess?.party_access
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {featureAccess?.party_access ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          Shows Party button in Cashier navbar. Cashier can view party lists and statements in read-only mode.
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      disabled={toggleMutation.isPending}
                      onClick={() => handleToggle('party_access', !featureAccess?.party_access)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                        featureAccess?.party_access ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                      } ${toggleMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
                      aria-label="Toggle Party Access"
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          featureAccess?.party_access ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Cashier Permissions:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/50">
                      Read Only (No Add / Edit / Delete)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pos' && (
          <div className="bg-white dark:bg-[#161925] rounded-2xl p-8 border border-slate-200/80 dark:border-[#23283B] shadow-xs text-center py-16">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <Sliders className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">POS & Billing Rules</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Aap yahan cash restrictions, price-floor parameters, ya discount limits set karne ke options add karwa sakte hain.
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/60 font-semibold mt-2">
                <Info className="w-3.5 h-3.5" />
                Bataiye aapko yahan kya options chahiye?
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
