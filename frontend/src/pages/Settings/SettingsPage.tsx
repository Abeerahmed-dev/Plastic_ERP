import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, Users, Building2, Sliders, Shield, Info } from 'lucide-react';
import UsersListPage from '../Users/UsersListPage';

type SettingsTab = 'employees' | 'company' | 'pos' | 'security';

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'employees';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'employees' as SettingsTab,
      label: 'Software Access',
      icon: Users,
      description: 'Manage staff, cashier accounts, and software roles',
    },
    {
      id: 'company' as SettingsTab,
      label: 'Company Profile',
      icon: Building2,
      description: 'Business name, address, contact & invoice headers',
    },
    {
      id: 'pos' as SettingsTab,
      label: 'POS & Billing Rules',
      icon: Sliders,
      description: 'Price floors, payment restrictions & defaults',
    },
    {
      id: 'security' as SettingsTab,
      label: 'Security & Audit',
      icon: Shield,
      description: 'Permissions, activity logs & session controls',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl text-slate-950 font-bold shadow-sm shrink-0">
            <Settings className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
            <p className="text-sm font-medium text-slate-500 mt-0.5">
              Manage system configuration, employees, and business operational rules.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-amber-400 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="transition-all">
        {activeTab === 'employees' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <UsersListPage embedded={true} />
          </div>
        )}

        {activeTab === 'company' && (
          <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center py-16">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Company Profile Settings</h2>
              <p className="text-sm text-slate-500">
                Aap is tab me company details, contact info, ya receipt header settings add karwa sakte hain.
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 font-semibold mt-2">
                <Info className="w-3.5 h-3.5" />
                Bataiye aapko yahan kya options chahiye?
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pos' && (
          <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center py-16">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                <Sliders className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">POS & Billing Rules</h2>
              <p className="text-sm text-slate-500">
                Aap yahan cash restrictions, price-floor parameters, ya discount limits set karne ke options add karwa sakte hain.
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 font-semibold mt-2">
                <Info className="w-3.5 h-3.5" />
                Bataiye aapko yahan kya options chahiye?
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center py-16">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Security & Permissions</h2>
              <p className="text-sm text-slate-500">
                Multi-role access policies, audit logging, ya session timeouts configure karne ka section.
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 font-semibold mt-2">
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
