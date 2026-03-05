import React, { useState } from 'react';
import { DataProvider } from './contexts/DataContext';
import Dashboard from './components/Dashboard';
import DataLedger from './components/DataLedger';
import Retirement from './components/Retirement';
import Controls from './components/Controls';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-hidden font-sans text-slate-900 flex-col">
      <header className="bg-white px-8 py-4 border-b border-slate-200 z-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Net Worth</h1>
              <p className="text-slate-400 text-xs mt-0.5">FIRE Calculator</p>
            </div>
          </div>
          <div className="flex gap-6 border-b border-slate-200 -mb-4">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'ledger', label: 'Data Ledger' },
              { id: 'retirement', label: 'Retirement' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === id
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="bg-white border-b border-slate-200">
        <Controls />
      </section>

      <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
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