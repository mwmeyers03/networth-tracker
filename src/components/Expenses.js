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

  const inputCls = "w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-800 outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400 transition-colors";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Michael Expenses */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Michael's Monthly Expenses</h2>
            <p className="text-slate-400 text-xs mt-0.5">Monthly breakdown</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Total Monthly</div>
            <div className="text-xl font-bold text-slate-800">{formatCur(calculateMichaelExpenses())}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(michaelExpenses).map(([key, value]) => (
            <div key={key} className="p-3 rounded-md border border-slate-100 bg-slate-50">
              <label className="block text-xs font-medium text-slate-500 mb-1.5 capitalize">{formatLabel(key)}</label>
              <input type="number" value={value} onChange={e => handleMichaelExpenseChange(key, e.target.value)} className={inputCls} />
            </div>
          ))}
        </div>
      </div>

      {/* Brianna Expenses */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Brianna's Monthly Expenses</h2>
            <p className="text-slate-400 text-xs mt-0.5">Monthly breakdown</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Total Monthly</div>
            <div className="text-xl font-bold text-slate-800">{formatCur(calculateBriannaExpenses())}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(briannaExpenses).map(([key, value]) => (
            <div key={key} className="p-3 rounded-md border border-slate-100 bg-slate-50">
              <label className="block text-xs font-medium text-slate-500 mb-1.5 capitalize">{formatLabel(key)}</label>
              <input type="number" value={value} onChange={e => handleBriannaExpenseChange(key, e.target.value)} className={inputCls} />
            </div>
          ))}
        </div>
      </div>

      {/* Combined Summary */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Combined Monthly Expenses</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-md p-4 border border-slate-100">
            <div className="text-xs text-slate-400 mb-1">Michael</div>
            <div className="text-xl font-bold text-slate-800">{formatCur(calculateMichaelExpenses())}</div>
          </div>
          <div className="bg-slate-50 rounded-md p-4 border border-slate-100">
            <div className="text-xs text-slate-400 mb-1">Brianna</div>
            <div className="text-xl font-bold text-slate-800">{formatCur(calculateBriannaExpenses())}</div>
          </div>
          <div className="bg-sky-50 rounded-md p-4 border border-sky-100">
            <div className="text-xs text-sky-500 mb-1 font-medium">Total</div>
            <div className="text-xl font-bold text-sky-700">{formatCur(calculateMichaelExpenses() + calculateBriannaExpenses())}</div>
          </div>
        </div>
      </div>

      {/* Annual Summary */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Annual Expense Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Michael (12 months)</span>
              <span className="text-sm font-semibold text-slate-800">{formatCur(calculateMichaelExpenses() * 12)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Brianna (12 months)</span>
              <span className="text-sm font-semibold text-slate-800">{formatCur(calculateBriannaExpenses() * 12)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-semibold text-slate-700">Combined Annual</span>
              <span className="text-sm font-bold text-sky-600">{formatCur((calculateMichaelExpenses() + calculateBriannaExpenses()) * 12)}</span>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Retirement Expense Planning</h3>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Yearly Retirement Expenses</label>
            <input type="number" value={retirementExpenses.yearlyAmount} onChange={e => handleRetirementExpenseChange(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400 transition-colors" />
            <p className="text-slate-400 text-xs mt-2">Used for retirement withdrawal projections</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Expenses;