import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Users, Keyboard, Info, ShieldCheck, Truck, Loader2, Receipt, ShoppingCart, CreditCard, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import UsersListPage from '../Users/UsersListPage';
import { settingsService } from '../../services/settings.service';

type SettingsTab = 'employees' | 'controls' | 'feature_access';

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const initialTab: SettingsTab = rawTab === 'pos' ? 'controls' : (rawTab as SettingsTab) || 'employees';
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
      id: 'controls' as SettingsTab,
      label: 'Controls',
      icon: Keyboard,
      description: 'Keyboard shortcuts & navigation controls guide',
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
              Manage employees, feature permissions, and system keyboard controls.
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

        {activeTab === 'controls' && (
          <div className="space-y-6">
            {/* Top Overview Banner */}
            <div className="bg-white dark:bg-[#161925] rounded-2xl p-6 border border-slate-200/80 dark:border-[#23283B] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
                  <Keyboard className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">ERP Controls & Keyboard Shortcuts Guide</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Poore system me tezi se data-entry ke liye mouse ki zaroorat nahi hai. Har module ke controls aur shortcuts neeche darj hain:
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold shrink-0 self-start md:self-auto">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                100% Keyboard-Driven Workflow Active
              </div>
            </div>

            {/* Grid of Modules */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Module 1: Sales Wholesale Invoices */}
              <div className="bg-white dark:bg-[#161925] rounded-2xl border border-slate-200/80 dark:border-[#23283B] shadow-xs overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-[#23283B] flex items-center justify-between bg-slate-50/50 dark:bg-[#181B28]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-lg">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Wholesale Sales Invoices</h3>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded-md">
                    Sales Module
                  </span>
                </div>

                <div className="p-5 flex-1 divide-y divide-slate-100 dark:divide-[#23283B]">
                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Enter</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Next Field Progression & Auto Row</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Customer → Product → Variant → Bags → Qty → Rate. Aakhri rate par Enter dabane par khud nayi row add hojayegi.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">↑ / ↓</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Navigate Search Dropdowns</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Customer ya Product search list me upar / neeche scroll aur select karne ke liye.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded shadow-2xs text-amber-900 dark:text-amber-200">Ctrl + Enter</kbd>
                      <span className="text-xs text-slate-400 font-mono">ya</span>
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded shadow-2xs text-amber-900 dark:text-amber-200">F9</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-amber-700 dark:text-amber-400">Save & Print Invoice (A4)</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Invoice save ho kar foran A4 print dialog preview open kar dega.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Alt + H</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Hold Invoice</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Incomplete bill ko temporary hold pe daal dega taake baad me resume kar sakein.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Alt + P</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Toggle Print Copies</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Original → Duplicate → Both print copy mode ko switch karta hai.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Alt + Del</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Delete Current Row</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Maujooda item row ko delete karke pichli row par focus bhejta hai.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Esc</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Cancel / Close Modal</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Invoice form modal ko band karne ke liye.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module 2: Purchasing Invoices */}
              <div className="bg-white dark:bg-[#161925] rounded-2xl border border-slate-200/80 dark:border-[#23283B] shadow-xs overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-[#23283B] flex items-center justify-between bg-slate-50/50 dark:bg-[#181B28]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Purchasing Invoices</h3>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 px-2 py-0.5 rounded-md">
                    Purchases Module
                  </span>
                </div>

                <div className="p-5 flex-1 divide-y divide-slate-100 dark:divide-[#23283B]">
                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Enter</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Next Field & Auto Row Append</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Supplier → Product → Variant → Bags → Qty → Rate. Rate par Enter dabate hi agli row khud create hojayegi.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Shift + Enter</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Jump to Discount & Charges</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Line items mukammal hone ke baad Discount aur Delivery Charges par jump karne ke liye.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">↑ / ↓</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Search Combobox Navigation</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Party ya Product drop-down list me tezi se select karne ke liye.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 rounded shadow-2xs text-indigo-900 dark:text-indigo-200">Ctrl + Enter</kbd>
                      <span className="text-xs text-slate-400 font-mono">ya</span>
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 rounded shadow-2xs text-indigo-900 dark:text-indigo-200">F9</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-indigo-700 dark:text-indigo-400">Save Purchase Invoice</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Purchasing bill ko foran backend me save karta hai.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Alt + A</kbd>
                      <span className="text-xs text-slate-400 font-mono">ya</span>
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">F4</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Add Line Item Row</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Manually nayi row add karne ke liye shortcut.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Alt + Del</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Delete Row</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Selected product row ko delete karne ke liye.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Esc</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Cancel / Close</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Purchasing modal ko band karne ke liye.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module 3: Record Payments */}
              <div className="bg-white dark:bg-[#161925] rounded-2xl border border-slate-200/80 dark:border-[#23283B] shadow-xs overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-[#23283B] flex items-center justify-between bg-slate-50/50 dark:bg-[#181B28]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Record Payments (Sales & Purchasing)</h3>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 px-2 py-0.5 rounded-md">
                    Payments Module
                  </span>
                </div>

                <div className="p-5 flex-1 divide-y divide-slate-100 dark:divide-[#23283B]">
                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-1 text-xs font-bold font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded border border-emerald-300 dark:border-emerald-700 shadow-2xs">Auto Focus</span>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Smart Field Focus</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Invoice action se kholne par cursor seedha Amount field me all-select ho jata hai.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Enter</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Sequential Field Chaining</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Party → Invoice → Date → Amount → Method → Bank/Cheque → Notes.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded shadow-2xs text-emerald-900 dark:text-emerald-200">Alt + C</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">Clear Full Balance</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Bill ka baki bacha poora balance Amount field me khud-ba-khud fill kardeta hai.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded shadow-2xs text-emerald-900 dark:text-emerald-200">Ctrl + Enter</kbd>
                      <span className="text-xs text-slate-400 font-mono">ya</span>
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded shadow-2xs text-emerald-900 dark:text-emerald-200">F9</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">Save Payment</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Payment entry ko save aur finalize karta hai.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Esc</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Cancel / Close</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Payment dialog band karne ke liye.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module 4: Retail POS Counter */}
              <div className="bg-white dark:bg-[#161925] rounded-2xl border border-slate-200/80 dark:border-[#23283B] shadow-xs overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-[#23283B] flex items-center justify-between bg-slate-50/50 dark:bg-[#181B28]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-lg">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Retail POS Counter</h3>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded-md">
                    POS Terminal
                  </span>
                </div>

                <div className="p-5 flex-1 divide-y divide-slate-100 dark:divide-[#23283B]">
                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Enter</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Add Product & Quantity Loop</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Search me Enter se item cart me jayega, Qty type karke Enter se Price par, aur phir Enter se wapis Search ready hojayega.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">↑ / ↓</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Navigate Products & Cart</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Search results me products select karne aur cart items ke darmiyan move karne ke liye.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded shadow-2xs text-amber-900 dark:text-amber-200">Ctrl + Enter</kbd>
                      <span className="text-xs text-slate-400 font-mono">ya</span>
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded shadow-2xs text-amber-900 dark:text-amber-200">F9</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-amber-700 dark:text-amber-400">Complete POS Sale</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Sale finalize karta hai, stock deduct karta hai aur thermal receipt print karta hai.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Alt + H</kbd>
                      <span className="text-xs text-slate-400 font-mono">ya</span>
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">F8</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Hold Bill</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Current customer ke bill ko hold par rakh kar agle customer ko attend karne ke liye.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Alt + B</kbd>
                      <span className="text-xs text-slate-400 font-mono">ya</span>
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">F7</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Held Bills Modal</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Pehle se hold kiye gaye bills ki list khol kar resume karne ke liye.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Alt + P</kbd>
                      <span className="text-xs text-slate-400 font-mono">ya</span>
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">F6</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Toggle Slip Mode</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Single slip (1 slip) aur Duplicate slip (2 slips) ke darmiyan toggle karta hai.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Alt + A</kbd>
                      <span className="text-xs text-slate-400 font-mono">ya</span>
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">F10</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Amount Paid Focus</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Tendered cash amount enter karne ke liye cursor foran Amount Paid par le jata hai.</div>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-xs font-bold font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-2xs text-slate-800 dark:text-slate-200">Alt + M</kbd>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Payment Method Cycle</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Cash, Bank Transfer, aur Split Payment ke darmiyan switch karta hai.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module 4: Best Practices & Tips */}
              <div className="bg-white dark:bg-[#161925] rounded-2xl border border-slate-200/80 dark:border-[#23283B] shadow-xs overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-[#23283B] flex items-center justify-between bg-slate-50/50 dark:bg-[#181B28]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Tips & Best Practices</h3>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded-md">
                    Pro Tips
                  </span>
                </div>

                <div className="p-5 flex-1 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <div className="p-3.5 bg-slate-50 dark:bg-[#181B28] rounded-xl border border-slate-200/60 dark:border-slate-800/80 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Direct Typing in Search Fields
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                      Customer ya Supplier combobox me mouse click karne ki zaroorat nahi hoti. Sirf naam ya city type karen, list khud filter hojayegi, arrow keys se move karke <kbd className="px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-800 border rounded font-mono">Enter</kbd> dabayein.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-[#181B28] rounded-xl border border-slate-200/60 dark:border-slate-800/80 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Auto-Selected Numeric Values
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                      Jab aap Enter se Bags, Quantity ya Rate par move karte hain, to purani value automatically highlight ho jati hai. Aapko Backspace dabane ki zaroorat nahi parti, direct naya number type karen.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-[#181B28] rounded-xl border border-slate-200/60 dark:border-slate-800/80 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Clean UI Experience
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                      Modals par se fuzool text labels aur badges hata diye gaye hain taake screen saaf suthri rahe, jab ke tamam keyboard shortcuts background me 100% active hain.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
