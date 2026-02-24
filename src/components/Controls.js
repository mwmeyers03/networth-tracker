import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { TrendingUp, PiggyBank, Heart, ChevronDown, ChevronUp } from 'lucide-react';

const Controls = () => {
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
    salary: true,
    contributions: true,
    expenses: true,
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
      className={`w-full flex items-center justify-between p-3 transition-all rounded-lg group border border-slate-600/60 ${
        expandedSections[section]
          ? 'bg-slate-700/70 ring-1 ring-blue-500/50 text-slate-100'
          : 'bg-slate-800/40 hover:bg-slate-700/50 text-slate-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-blue-400" />
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">{title}</h3>
      </div>
      {expandedSections[section] ? 
        <ChevronUp size={18} className="text-slate-300 group-hover:text-blue-400 transition" /> :
        <ChevronDown size={18} className="text-slate-300 group-hover:text-blue-400 transition" />
      }
    </button>
  );

  const InputField = ({ label, name, value, onChange, type = 'number', step = '0.01', isPercentage = false }) => (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">{label}</label>
      <div className="relative">
        <input
          type={type}
          step={step}
          name={name}
          value={isPercentage ? (parseFloat(value) * 100).toFixed(2) : value}
          onChange={isPercentage ? handlePercentageChange : onChange}
          className="w-full p-2.5 bg-slate-700/50 border border-slate-600 text-slate-100 placeholder-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
        />
        {isPercentage && <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm">%</span>}
      </div>
    </div>
  );

  const formatLabel = (label) => (
    label
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );

  return (
    <div className="p-6 pb-24 text-slate-100 max-w-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <SectionHeader title="Macro Environment" icon={TrendingUp} section="macro" />
          {expandedSections.macro && (
            <div className="mt-4 space-y-4">
              <InputField
                label="Market Return"
                name="marketReturn"
                value={globals.marketReturn}
                onChange={handleGlobalChange}
                isPercentage={true}
              />
              <InputField
                label="Market Volatility"
                name="marketReturnStdDev"
                value={globals.marketReturnStdDev}
                onChange={handleGlobalChange}
                isPercentage={true}
              />
              <InputField
                label="Inflation Rate"
                name="inflationRate"
                value={globals.inflationRate}
                onChange={handleGlobalChange}
                isPercentage={true}
              />
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <SectionHeader title="Salary Growth" icon={TrendingUp} section="salary" />
          {expandedSections.salary && (
            <div className="mt-4 space-y-4">
              <InputField
                label="Michael Annual Growth"
                name="michaelSalaryGrowth"
                value={globals.michaelSalaryGrowth}
                onChange={handleGlobalChange}
                isPercentage={true}
              />
              <InputField
                label="Brianna Annual Growth"
                name="briannaSalaryGrowth"
                value={globals.briannaSalaryGrowth}
                onChange={handleGlobalChange}
                isPercentage={true}
              />
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <SectionHeader title="Core Contributions" icon={PiggyBank} section="contributions" />
          {expandedSections.contributions && (
            <div className="mt-4 space-y-4">
              <InputField
                label="Michael 401K Rate"
                name="michael401kRate"
                value={globals.michael401kRate}
                onChange={handleGlobalChange}
                isPercentage={true}
              />
              <InputField
                label="Michael 401K Match"
                name="michael401kMatch"
                value={globals.michael401kMatch}
                onChange={handleGlobalChange}
                isPercentage={true}
              />
              <InputField
                label="Brianna 401K Rate"
                name="brianna401kRate"
                value={globals.brianna401kRate}
                onChange={handleGlobalChange}
                isPercentage={true}
              />
              <InputField
                label="Roth IRA Yearly ($)"
                name="rothYearlyContrib"
                value={globals.rothYearlyContrib}
                onChange={handleGlobalChange}
                type="number"
                isPercentage={false}
              />
              <InputField
                label="Brokerage Yearly ($)"
                name="brokerageYearlyContrib"
                value={globals.brokerageYearlyContrib}
                onChange={handleGlobalChange}
                type="number"
                isPercentage={false}
              />
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <SectionHeader title="Monthly Expenses" icon={PiggyBank} section="expenses" />
          {expandedSections.expenses && (
            <div className="mt-4 space-y-6">
              <div className="bg-slate-900/40 rounded p-3 border border-slate-700/40">
                <h4 className="text-xs font-bold text-slate-300 uppercase mb-3">Michael's Monthly</h4>
                <div className="space-y-2">
                  {Object.entries(michaelExpenses).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <label className="text-xs text-slate-400">{formatLabel(key)}</label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => handleMichaelExpenseChange(key, e.target.value)}
                        className="w-24 p-1.5 bg-slate-800/60 border border-slate-600 text-slate-100 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  ))}
                  <div className="border-t border-slate-700/60 pt-3 mt-3">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2">Add Category</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={michaelNewCategory}
                        onChange={(e) => setMichaelNewCategory(e.target.value)}
                        placeholder="e.g. Gym"
                        className="flex-1 p-1.5 bg-slate-800/60 border border-slate-600 text-slate-100 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          addMichaelExpenseCategory(michaelNewCategory);
                          setMichaelNewCategory('');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600/80 hover:bg-blue-600 text-white transition"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-slate-700/60 pt-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">Monthly Total</span>
                      <span className="text-sm font-bold text-blue-400">
                        ${Object.values(michaelExpenses).reduce((a, b) => a + b, 0).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/40 rounded p-3 border border-slate-700/40">
                <h4 className="text-xs font-bold text-slate-300 uppercase mb-3">Brianna's Monthly</h4>
                <div className="space-y-2">
                  {Object.entries(briannaExpenses).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <label className="text-xs text-slate-400">{formatLabel(key)}</label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => handleBriannaExpenseChange(key, e.target.value)}
                        className="w-24 p-1.5 bg-slate-800/60 border border-slate-600 text-slate-100 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  ))}
                  <div className="border-t border-slate-700/60 pt-3 mt-3">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-2">Add Category</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={briannaNewCategory}
                        onChange={(e) => setBriannaNewCategory(e.target.value)}
                        placeholder="e.g. Subscriptions"
                        className="flex-1 p-1.5 bg-slate-800/60 border border-slate-600 text-slate-100 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          addBriannaExpenseCategory(briannaNewCategory);
                          setBriannaNewCategory('');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-purple-600/80 hover:bg-purple-600 text-white transition"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-slate-700/60 pt-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">Monthly Total</span>
                      <span className="text-sm font-bold text-purple-400">
                        ${Object.values(briannaExpenses).reduce((a, b) => a + b, 0).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
          <SectionHeader title="FIRE / Retirement" icon={Heart} section="retirement" />
          {expandedSections.retirement && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="Michael Retirement Age"
                  name="michaelRetirementAge"
                  value={globals.michaelRetirementAge}
                  onChange={handleGlobalChange}
                  type="number"
                  isPercentage={false}
                />
                <InputField
                  label="Brianna Retirement Age"
                  name="briannaRetirementAge"
                  value={globals.briannaRetirementAge}
                  onChange={handleGlobalChange}
                  type="number"
                  isPercentage={false}
                />
              </div>
              <InputField
                label="Life Expectancy"
                name="lifeExpectancy"
                value={globals.lifeExpectancy}
                onChange={handleGlobalChange}
                type="number"
                isPercentage={false}
              />
              <InputField
                label="Annual Retirement Spend ($)"
                name="retirementYearlyExp"
                value={retirementExpenses.yearlyAmount}
                onChange={(e) => handleRetirementExpenseChange(e.target.value)}
                type="number"
                isPercentage={false}
              />
              <InputField
                label="Safe Withdrawal Rate"
                name="withdrawalRate"
                value={globals.withdrawalRate}
                onChange={handleGlobalChange}
                isPercentage={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Controls;

