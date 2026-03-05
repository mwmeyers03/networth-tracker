import React from 'react';
import { useData } from '../contexts/DataContext';
import { PiggyBank, Target, TrendingUp } from 'lucide-react';

const Summary = () => {
  const { financialData, globals, retirementExpenses, formatCur } = useData();
  const currentNetWorth = financialData[0]?.netWorth || 0;
  const retirementNetWorth = financialData.find(d => d.retired)?.netWorth || 0;
  const retirementYear = financialData.find(d => d.retired)?.year;
  const yearsToRetirement = retirementYear ? retirementYear - new Date().getFullYear() : 'N/A';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-5 rounded-lg border border-slate-200 flex items-center gap-4">
        <div className="bg-emerald-50 p-2.5 rounded-lg">
          <PiggyBank className="text-emerald-500" size={20} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Current Net Worth</p>
          <div className="text-2xl font-bold text-slate-800 mt-0.5">{formatCur(currentNetWorth)}</div>
        </div>
      </div>
      <div className="bg-white p-5 rounded-lg border border-slate-200 flex items-center gap-4">
        <div className="bg-sky-50 p-2.5 rounded-lg">
          <TrendingUp className="text-sky-500" size={20} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Projected at Retirement</p>
          <div className="text-2xl font-bold text-slate-800 mt-0.5">{formatCur(retirementNetWorth)}</div>
        </div>
      </div>
      <div className="bg-white p-5 rounded-lg border border-slate-200 flex items-center gap-4">
        <div className="bg-violet-50 p-2.5 rounded-lg">
          <Target className="text-violet-500" size={20} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Years to Retirement</p>
          <div className="text-2xl font-bold text-slate-800 mt-0.5">{yearsToRetirement}</div>
        </div>
      </div>
    </div>
  );
};

export default Summary;