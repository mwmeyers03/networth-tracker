import React from 'react';
import { useData } from '../contexts/DataContext';

const Expenses = () => {
  const {
    michaelExpenses,
    briannaExpenses,
    retirementExpenses,
    handleMichaelExpenseChange,
    handleBriannaExpenseChange,
    handleRetirementExpenseChange,
    calculateMichaelExpenses,
    calculateBriannaExpenses,
    formatCur,
    formatLabel,
  } = useData();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Michael Expenses */}
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-slate-200/50">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">Michael's Monthly Expenses</h2>
            <p className="text-slate-600">Monthly Breakdown</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600">Total Monthly</div>
            <div className="text-3xl font-bold text-blue-600">{formatCur(calculateMichaelExpenses())}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(michaelExpenses).map(([key, value]) => (
            <div key={key} className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <label className="block text-sm font-semibold text-slate-700 mb-2 capitalize">{formatLabel(key)}</label>
              <input type="number" value={value} onChange={e => handleMichaelExpenseChange(key, e.target.value)} className="w-full p-2 bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          ))}
        </div>
      </div>

      {/* Brianna Expenses */}
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-slate-200/50">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">Brianna's Monthly Expenses</h2>
            <p className="text-slate-600">Monthly Breakdown</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600">Total Monthly</div>
            <div className="text-3xl font-bold text-indigo-600">{formatCur(calculateBriannaExpenses())}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(briannaExpenses).map(([key, value]) => (
            <div key={key} className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-200">
              <label className="block text-sm font-semibold text-slate-700 mb-2 capitalize">{formatLabel(key)}</label>
              <input type="number" value={value} onChange={e => handleBriannaExpenseChange(key, e.target.value)} className="w-full p-2 bg-white border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          ))}
        </div>
      </div>

      {/* Combined Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8 rounded-2xl shadow-lg">
        <h3 className="text-2xl font-bold mb-6">Combined Monthly Expenses</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-white/70 text-sm mb-2">Michael</div>
            <div className="text-3xl font-bold">{formatCur(calculateMichaelExpenses())}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-white/70 text-sm mb-2">Brianna</div>
            <div className="text-3xl font-bold">{formatCur(calculateBriannaExpenses())}</div>
          </div>
          <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm border border-white/30">
            <div className="text-white/70 text-sm mb-2">Total</div>
            <div className="text-3xl font-bold">{formatCur(calculateMichaelExpenses() + calculateBriannaExpenses())}</div>
          </div>
        </div>
      </div>

      {/* Annual Summary */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-slate-200/50">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Annual Expense Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <span className="text-slate-600">Michael (12 months)</span>
              <span className="font-bold text-blue-600">{formatCur(calculateMichaelExpenses() * 12)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <span className="text-slate-600">Brianna (12 months)</span>
              <span className="font-bold text-indigo-600">{formatCur(calculateBriannaExpenses() * 12)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 text-lg font-bold text-emerald-600">
              <span>Combined Annual</span>
              <span>{formatCur((calculateMichaelExpenses() + calculateBriannaExpenses()) * 12)}</span>
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-slate-200/50">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Retirement Expense Planning</h3>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Yearly Retirement Expenses</label>
            <input type="number" value={retirementExpenses.yearlyAmount} onChange={e => handleRetirementExpenseChange(e.target.value)} className="w-full p-3 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg font-bold" />
            <p className="text-slate-600 text-sm mt-4">This amount will be used for retirement projections</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Expenses;