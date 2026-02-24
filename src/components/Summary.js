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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-slate-200/50 flex items-center">
        <div className="bg-emerald-100 p-4 rounded-full mr-6">
          <PiggyBank className="text-emerald-600" size={32} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Current Net Worth</h3>
          <div className="text-4xl font-bold text-emerald-600">{formatCur(currentNetWorth)}</div>
        </div>
      </div>
      <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-slate-200/50 flex items-center">
        <div className="bg-blue-100 p-4 rounded-full mr-6">
          <TrendingUp className="text-blue-600" size={32} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Projected at Retirement</h3>
          <div className="text-4xl font-bold text-blue-600">{formatCur(retirementNetWorth)}</div>
        </div>
      </div>
      <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-slate-200/50 flex items-center">
        <div className="bg-indigo-100 p-4 rounded-full mr-6">
          <Target className="text-indigo-600" size={32} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Years to Retirement</h3>
          <div className='text-4xl font-bold text-indigo-600'>{yearsToRetirement}</div>
        </div>
      </div>
    </div>
  );
};

export default Summary;