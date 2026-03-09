import React, { useState } from 'react';
import { DataProvider } from './contexts/DataContext';
import Dashboard from './components/Dashboard';
import DataLedger from './components/DataLedger';
import Retirement from './components/Retirement';
import Controls from './components/Controls';
import { Settings, X, LayoutDashboard, Table2, TrendingUp } from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ledger', label: 'Ledger', icon: Table2 },
  { id: 'retirement', label: 'Retirement', icon: TrendingUp },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* ── Top Header ── */}
      <header className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Net Worth Tracker</h1>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">FIRE Calculator</p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open settings"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <Settings size={18} className="text-slate-300" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-slate-800 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === id
                  ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'ledger' && <DataLedger />}
        {activeTab === 'retirement' && <Retirement />}
      </main>

      {/* ── Settings Drawer (right side on desktop, full-screen on mobile) ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer Panel */}
          <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-slate-900 border-l border-slate-800 overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-sky-400" />
                <h2 className="text-sm font-bold text-white">Assumptions & Controls</h2>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Close settings"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Controls onClose={() => setDrawerOpen(false)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}