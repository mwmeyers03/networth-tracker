import React from 'react';
import { TrendingUp, PiggyBank, Zap } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import PercentageInput from './PercentageInput';

const Assumptions = () => {
  const { globals, handleGlobalChange } = useData();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-slate-200/50">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 flex items-center gap-2"><TrendingUp className="text-blue-600" size={26}/>Rates & Growth</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Market Return (%)</label>
            <PercentageInput name="marketReturn" value={globals.marketReturn} onChange={handleGlobalChange} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Inflation Rate (%)</label>
            <PercentageInput name="inflationRate" value={globals.inflationRate} onChange={handleGlobalChange} />
          </div>
        </div>
      </div>
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-slate-200/50">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 flex items-center gap-2"><PiggyBank className="text-indigo-600" size={26}/>Contributions</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Michael's 401k Rate (%)</label>
            <PercentageInput name="michael401kRate" value={globals.michael401kRate} onChange={handleGlobalChange} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Michael's 401k Match (%)</label>
            <PercentageInput name="michael401kMatch" value={globals.michael401kMatch} onChange={handleGlobalChange} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Brianna's 401k Rate (%)</label>
            <PercentageInput name="brianna401kRate" value={globals.brianna401kRate} onChange={handleGlobalChange} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Annual Roth IRA Contribution ($)</label>
            <input type="number" name="rothYearlyContrib" value={globals.rothYearlyContrib} onChange={handleGlobalChange} className="w-full p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Annual Brokerage Contribution ($)</label>
            <input type="number" name="brokerageYearlyContrib" value={globals.brokerageYearlyContrib} onChange={handleGlobalChange} className="w-full p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>
        </div>
      </div>
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-slate-200/50">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 flex items-center gap-2"><Zap className="text-amber-500" size={26}/>FIRE Planning</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Michael's Retirement Age</label>
            <input type="number" name="michaelRetirementAge" value={globals.michaelRetirementAge} onChange={handleGlobalChange} className="w-full p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Brianna's Retirement Age</label>
            <input type="number" name="briannaRetirementAge" value={globals.briannaRetirementAge} onChange={handleGlobalChange} className="w-full p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Life Expectancy (Years)</label>
            <input type="number" name="lifeExpectancy" value={globals.lifeExpectancy} onChange={handleGlobalChange} className="w-full p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Market Return Std. Dev. (%)</label>
            <PercentageInput name="marketReturnStdDev" value={globals.marketReturnStdDev} onChange={handleGlobalChange} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Safe Withdrawal Rate (%)</label>
            <PercentageInput name="withdrawalRate" value={globals.withdrawalRate} onChange={handleGlobalChange} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assumptions;