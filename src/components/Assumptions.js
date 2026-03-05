import React from 'react';
import { TrendingUp, PiggyBank, Zap } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import PercentageInput from './PercentageInput';

const Assumptions = () => {
  const { globals, handleGlobalChange } = useData();

  const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-800 outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400 transition-colors";
  const labelCls = "block text-xs font-medium text-slate-500 mb-1.5";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp className="text-slate-400" size={16}/>Rates & Growth</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Market Return (%)</label>
            <PercentageInput name="marketReturn" value={globals.marketReturn} onChange={handleGlobalChange} />
          </div>
          <div>
            <label className={labelCls}>Inflation Rate (%)</label>
            <PercentageInput name="inflationRate" value={globals.inflationRate} onChange={handleGlobalChange} />
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><PiggyBank className="text-slate-400" size={16}/>Contributions</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Michael's 401k Rate (%)</label>
            <PercentageInput name="michael401kRate" value={globals.michael401kRate} onChange={handleGlobalChange} />
          </div>
          <div>
            <label className={labelCls}>Michael's 401k Match (%)</label>
            <PercentageInput name="michael401kMatch" value={globals.michael401kMatch} onChange={handleGlobalChange} />
          </div>
          <div>
            <label className={labelCls}>Brianna's 401k Rate (%)</label>
            <PercentageInput name="brianna401kRate" value={globals.brianna401kRate} onChange={handleGlobalChange} />
          </div>
          <div>
            <label className={labelCls}>Annual Roth IRA Contribution ($)</label>
            <input type="number" name="rothYearlyContrib" value={globals.rothYearlyContrib} onChange={handleGlobalChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Annual Brokerage Contribution ($)</label>
            <input type="number" name="brokerageYearlyContrib" value={globals.brokerageYearlyContrib} onChange={handleGlobalChange} className={inputCls} />
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Zap className="text-slate-400" size={16}/>FIRE Planning</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Michael's Retirement Age</label>
            <input type="number" name="michaelRetirementAge" value={globals.michaelRetirementAge} onChange={handleGlobalChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Brianna's Retirement Age</label>
            <input type="number" name="briannaRetirementAge" value={globals.briannaRetirementAge} onChange={handleGlobalChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Life Expectancy (Years)</label>
            <input type="number" name="lifeExpectancy" value={globals.lifeExpectancy} onChange={handleGlobalChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Market Return Std. Dev. (%)</label>
            <PercentageInput name="marketReturnStdDev" value={globals.marketReturnStdDev} onChange={handleGlobalChange} />
          </div>
          <div>
            <label className={labelCls}>Safe Withdrawal Rate (%)</label>
            <PercentageInput name="withdrawalRate" value={globals.withdrawalRate} onChange={handleGlobalChange} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assumptions;