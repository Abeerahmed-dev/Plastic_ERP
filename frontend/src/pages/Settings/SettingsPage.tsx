import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, Users, Building2, Sliders, Shield, Info, Moon, Sun, Palette, Check, Sparkles } from 'lucide-react';
import UsersListPage from '../Users/UsersListPage';
import { useThemeStore } from '../../store/theme.store';

type SettingsTab = 'appearance' | 'employees' | 'company' | 'pos' | 'security';

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'appearance';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const { theme, setTheme, toggleTheme } = useThemeStore();

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'appearance' as SettingsTab,
      label: 'Appearance & Theme',
      icon: Palette,
      description: 'Dark mode, light mode, and visual theme color codes',
    },
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
              Manage system appearance, employees, and business operational rules.
            </p>
          </div>
        </div>

        {/* Quick Dark Mode Toggle Button in Header */}
        <div className="flex items-center gap-3 bg-slate-100 p-2 px-3 rounded-2xl border border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-purple-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            <span className="text-xs font-bold text-slate-800">
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
              theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'
            }`}
            title="Toggle Dark / Light Mode"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
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
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 cursor-pointer ${
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
        {/* Appearance & Theme Tab */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            {/* Theme Selector Cards */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Software Theme Mode</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Select your preferred interface style across all ERP pages, reports, and POS terminal.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                  Active: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Light Mode Card */}
                <div
                  onClick={() => setTheme('light')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                    theme === 'light'
                      ? 'border-blue-600 bg-blue-50/20 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {theme === 'light' && (
                    <div className="absolute top-3 right-3 p-1 rounded-full bg-blue-600 text-white">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900">Light Mode</h4>
                      <p className="text-xs text-slate-500">Classic Clean High-Contrast</p>
                    </div>
                  </div>
                  {/* Visual Mini Mockup */}
                  <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 space-y-2 pointer-events-none">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                      <div className="w-20 h-2 bg-slate-300 rounded" />
                      <div className="w-10 h-2 bg-blue-500 rounded" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <div className="w-12 h-1.5 bg-slate-400 rounded mb-1" />
                        <div className="w-16 h-2 bg-slate-800 rounded" />
                      </div>
                      <div className="p-2 rounded-lg bg-white border border-slate-200">
                        <div className="w-12 h-1.5 bg-slate-400 rounded mb-1" />
                        <div className="w-16 h-2 bg-emerald-600 rounded" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dark Mode Card */}
                <div
                  onClick={() => setTheme('dark')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-[#121520] shadow-md ring-2 ring-blue-500/30'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {theme === 'dark' && (
                    <div className="absolute top-3 right-3 p-1 rounded-full bg-blue-600 text-white">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-purple-900/40 text-purple-400">
                      <Moon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900">Dark Mode</h4>
                      <p className="text-xs text-slate-500">Deep Navy & Neon Blue (#0A0B10 / #161925)</p>
                    </div>
                  </div>
                  {/* Visual Mini Mockup */}
                  <div className="p-3 rounded-xl bg-[#0A0B10] border border-[#23283B] space-y-2 pointer-events-none">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#161925] border border-[#23283B]">
                      <div className="w-20 h-2 bg-slate-400 rounded" />
                      <div className="w-10 h-2 bg-[#3B82F6] rounded" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-[#161925] border border-[#23283B]">
                        <div className="w-12 h-1.5 bg-[#9CA3AF] rounded mb-1" />
                        <div className="w-16 h-2 bg-white rounded" />
                      </div>
                      <div className="p-2 rounded-lg bg-[#161925] border border-[#23283B]">
                        <div className="w-12 h-1.5 bg-[#9CA3AF] rounded mb-1" />
                        <div className="w-16 h-2 bg-[#34D399] rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Color Codes Reference Grid */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Theme Color Palette Specifications</h4>
                  <p className="text-xs text-slate-500">Configured dark theme color codes and architectural roles</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border border-slate-700 shadow-sm shrink-0" style={{ backgroundColor: '#0A0B10' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Background</p>
                    <p className="text-[11px] font-mono text-slate-500">#0A0B10 / #0F111A</p>
                    <span className="text-[10px] text-slate-400">Deep Dark / Navy Black</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border border-slate-700 shadow-sm shrink-0" style={{ backgroundColor: '#161925' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Card Backgrounds / Panels</p>
                    <p className="text-[11px] font-mono text-slate-500">#161925 / #121520</p>
                    <span className="text-[10px] text-slate-400">Dark Blue-Grey Panels</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border border-slate-700 shadow-sm shrink-0" style={{ backgroundColor: '#3B82F6' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Primary Accent</p>
                    <p className="text-[11px] font-mono text-slate-500">#2563EB / #3B82F6</p>
                    <span className="text-[10px] text-slate-400">Neon Blue Highlights</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border border-slate-700 shadow-sm shrink-0" style={{ backgroundColor: '#8B5CF6' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Purple Glow Accent</p>
                    <p className="text-[11px] font-mono text-slate-500">#8B5CF6 / #7C3AED</p>
                    <span className="text-[10px] text-slate-400">Sidebar & Logo Accent</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border border-slate-300 shadow-sm shrink-0" style={{ backgroundColor: '#FFFFFF' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Primary Text Color</p>
                    <p className="text-[11px] font-mono text-slate-500">#FFFFFF</p>
                    <span className="text-[10px] text-slate-400">Headings & Important Text</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border border-slate-500 shadow-sm shrink-0" style={{ backgroundColor: '#9CA3AF' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Secondary Text / Borders</p>
                    <p className="text-[11px] font-mono text-slate-500">#9CA3AF / #6B7280</p>
                    <span className="text-[10px] text-slate-400">Subtitles & Muted Elements</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
