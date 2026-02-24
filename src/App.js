import React, { useState } from 'react';
import { DataProvider } from './contexts/DataContext';
import Dashboard from './components/Dashboard';
import DataLedger from './components/DataLedger';
import Retirement from './components/Retirement';
import Controls from './components/Controls';
import { BarChart3, Table2, TrendingUp } from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex min-h-screen bg-slate-950 overflow-hidden font-sans text-slate-100 flex-col">
      <header className="bg-slate-900/90 backdrop-blur-lg px-8 py-6 border-b border-slate-800 shadow-lg z-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Net Worth</h1>
              <p className="text-slate-400 text-sm mt-1">FIRE Calculator</p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-900/40 px-4 py-2 rounded-full border border-emerald-700/50">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-emerald-300">Engine Active</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              <BarChart3 size={18} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
                activeTab === 'ledger'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              <Table2 size={18} />
              Data Ledger
            </button>
            <button
              onClick={() => setActiveTab('retirement')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
                activeTab === 'retirement'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              <TrendingUp size={18} />
              Retirement
            </button>
          </div>
        </div>
      </header>

      <section className="bg-slate-900/60 border-b border-slate-800">
        <Controls />
      </section>

      <main className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'ledger' && <DataLedger />}
        {activeTab === 'retirement' && <Retirement />}
      </main>
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