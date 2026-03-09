import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { TrendingUp, PiggyBank, Heart, ChevronDown, ChevronUp } from 'lucide-react';

const Controls = ({ onClose }) => {
  const {
    globals,
    michaelExpenses,
    briannaExpenses,
    retirementExpenses,
    handleGlobalChange,
    handleMichaelExpenseChange,
    handleBriannaExpenseChange,
    addMichaelExpenseCategory,
    addBriannaExpenseCategory,
    handleRetirementExpenseChange,
  } = useData();

  const [expandedSections, setExpandedSections] = useState({
    macro: true,
    salary: false,
    contributions: false,
    expenses: false,
    retirement: true,
  });
  const [michaelNewCategory, setMichaelNewCategory] = useState('');
  const [briannaNewCategory, setBriannaNewCategory] = useState('');

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handlePercentageChange = (e) => {
    const { name, value } = e.target;
    const decimalValue = parseFloat(value) / 100 || 0;
    handleGlobalChange({
      target: { name, value: decimalValue.toString() }
    });
  };

  const SectionHeader = ({ title, icon: Icon, section }) => (
    <button
      onClick={() => toggleSection(section)}
      className={`w-full flex items-center justify-between p-3 transition-all rounded-lg group border ${
        expandedSections[section]
          ? 'bg-slate-800 ring-1 ring-sky-500/40 text-white border-slate-600'
          : 'bg-slate-800/40 hover:bg-slate-800 text-slate-300 border-slate-700/60'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon size={16} className="text-sky-400" />
        <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">{title}</h3>
      </div>
      {expandedSections[section]
        ? <ChevronUp size={16} className="text-slate-400" />
        : <ChevronDown size={16} className="text-slate-400" />
      }
    </button>
  );

  const InputField = ({ label, name, value, onChange, type = 'number', step = '0.01', isPercentage = false }) => (
    <div>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          step={step}
          name={name}
          value={isPercentage ? (parseFloat(value) * 100).toFixed(2) : value}
          onChange={isPercentage ? handlePercentageChange : onChange}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 outline-none transition text-sm"
        />
        {isPercentage && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
        )}
      </div>
    </div>
  );

  const formatLabel = (label) =>
    label
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  return (
    <div className="p-4 space-y-3 text-slate-100">

      {/* Macro Environment */}
      <div className="rounded-xl border border-slate-700/60 overflow-hidden">
        <SectionHeader title="Macro Environment" icon={TrendingUp} section="macro" />
        {expandedSections.macro && (
          <div className="p-4 space-y-3 bg-slate-900/40">
            <InputField label="Market Return" name="marketReturn" value={globals.marketReturn} onChange={handleGlobalChange} isPercentage />
            <InputField label="Market Volatility (Std Dev)" name="marketReturnStdDev" value={globals.marketReturnStdDev} onChange={handleGlobalChange} isPercentage />
            <InputField label="Inflation Rate" name="inflationRate" value={globals.inflationRate} onChange={handleGlobalChange} isPercentage />
          </div>
        )}
      </div>

      {/* Salary Growth */}
      <div className="rounded-xl border border-slate-700/60 overflow-hidden">
        <SectionHeader title="Salary Growth" icon={TrendingUp} section="salary" />
        {expandedSections.salary && (
          <div className="p-4 space-y-3 bg-slate-900/40">
            <InputField label="Michael Annual Growth" name="michaelSalaryGrowth" value={globals.michaelSalaryGrowth} onChange={handleGlobalChange} isPercentage />
            <InputField label="Brianna Annual Growth" name="briannaSalaryGrowth" value={globals.briannaSalaryGrowth} onChange={handleGlobalChange} isPercentage />
          </div>
        )}
      </div>

      {/* Contributions */}
      <div className="rounded-xl border border-slate-700/60 overflow-hidden">
        <SectionHeader title="Core Contributions" icon={PiggyBank} section="contributions" />
        {expandedSections.contributions && (
          <div className="p-4 space-y-3 bg-slate-900/40">
            <InputField label="Michael 401K Rate" name="michael401kRate" value={globals.michael401kRate} onChange={handleGlobalChange} isPercentage />
            <InputField label="Michael 401K Match" name="michael401kMatch" value={globals.michael401kMatch} onChange={handleGlobalChange} isPercentage />
            <InputField label="Brianna 401K Rate" name="brianna401kRate" value={globals.brianna401kRate} onChange={handleGlobalChange} isPercentage />
            <InputField label="Roth IRA Yearly ($)" name="rothYearlyContrib" value={globals.rothYearlyContrib} onChange={handleGlobalChange} type="number" />
            <InputField label="Brokerage Yearly ($)" name="brokerageYearlyContrib" value={globals.brokerageYearlyContrib} onChange={handleGlobalChange} type="number" />
          </div>
        )}
      </div>

      {/* Monthly Expenses */}
      <div className="rounded-xl border border-slate-700/60 overflow-hidden">
        <SectionHeader title="Monthly Expenses" icon={PiggyBank} section="expenses" />
        {expandedSections.expenses && (
          <div className="p-4 space-y-5 bg-slate-900/40">
            {/* Michael */}
            <div>
              <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-2">Michael's Monthly</h4>
              <div className="space-y-2">
                {Object.entries(michaelExpenses).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <label className="text-xs text-slate-400 flex-1 truncate">{formatLabel(key)}</label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => handleMichaelExpenseChange(key, e.target.value)}
                      className="w-24 px-2 py-1.5 bg-slate-800 border border-slate-700 text-slate-100 rounded text-xs focus:ring-1 focus:ring-sky-500/50 outline-none"
                    />
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-700/50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={michaelNewCategory}
                      onChange={(e) => setMichaelNewCategory(e.target.value)}
                      placeholder="New category…"
                      className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 text-slate-100 rounded text-xs focus:ring-1 focus:ring-sky-500/50 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => { addMichaelExpenseCategory(michaelNewCategory); setMichaelNewCategory(''); }}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white transition"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs text-slate-400">Monthly Total</span>
                  <span className="text-sm font-bold text-sky-400">
                    ${Object.values(michaelExpenses).reduce((a, b) => a + b, 0).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
            {/* Brianna */}
            <div>
              <h4 className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-2">Brianna's Monthly</h4>
              <div className="space-y-2">
                {Object.entries(briannaExpenses).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <label className="text-xs text-slate-400 flex-1 truncate">{formatLabel(key)}</label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => handleBriannaExpenseChange(key, e.target.value)}
                      className="w-24 px-2 py-1.5 bg-slate-800 border border-slate-700 text-slate-100 rounded text-xs focus:ring-1 focus:ring-violet-500/50 outline-none"
                    />
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-700/50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={briannaNewCategory}
                      onChange={(e) => setBriannaNewCategory(e.target.value)}
                      placeholder="New category…"
                      className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 text-slate-100 rounded text-xs focus:ring-1 focus:ring-violet-500/50 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => { addBriannaExpenseCategory(briannaNewCategory); setBriannaNewCategory(''); }}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-violet-600 hover:bg-violet-500 text-white transition"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs text-slate-400">Monthly Total</span>
                  <span className="text-sm font-bold text-violet-400">
                    ${Object.values(briannaExpenses).reduce((a, b) => a + b, 0).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FIRE / Retirement */}
      <div className="rounded-xl border border-slate-700/60 overflow-hidden">
        <SectionHeader title="FIRE / Retirement" icon={Heart} section="retirement" />
        {expandedSections.retirement && (
          <div className="p-4 space-y-3 bg-slate-900/40">
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Michael Retirement Age" name="michaelRetirementAge" value={globals.michaelRetirementAge} onChange={handleGlobalChange} type="number" />
              <InputField label="Brianna Retirement Age" name="briannaRetirementAge" value={globals.briannaRetirementAge} onChange={handleGlobalChange} type="number" />
            </div>
            <InputField label="Life Expectancy" name="lifeExpectancy" value={globals.lifeExpectancy} onChange={handleGlobalChange} type="number" />
            <InputField label="Annual Retirement Spend ($)" name="retirementYearlyExp" value={retirementExpenses.yearlyAmount} onChange={(e) => handleRetirementExpenseChange(e.target.value)} type="number" />
            <InputField label="Safe Withdrawal Rate" name="withdrawalRate" value={globals.withdrawalRate} onChange={handleGlobalChange} isPercentage />
          </div>
        )}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition mt-2"
        >
          Done
        </button>
      )}
    </div>
  );
};

export default Controls;
