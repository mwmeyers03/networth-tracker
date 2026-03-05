import React from 'react';
import { useData } from '../contexts/DataContext';
import { CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

const Retirement = () => {
  const {
    globals,
    financialData,
    retirementExpenses,
    monteCarloBaseline,
    monteCarloConservative,
    monteCarloAggressive,
    formatCur,
  } = useData();

  // Calculate ages dynamically
  const michaelCurrentAge = 22;
  const briannaCurrentAge = 21;
  const yearsToMichaelRetirement = globals.michaelRetirementAge - michaelCurrentAge;
  const yearsToBriannaRetirement = globals.briannaRetirementAge - briannaCurrentAge;

  // Get net worth at retirement
  const michaelRetirementNetWorth = financialData.find(
    d => d.michaelAge >= globals.michaelRetirementAge
  )?.netWorth || 0;
  
  const briannaRetirementNetWorth = financialData.find(
    d => d.briannaAge >= globals.briannaRetirementAge
  )?.netWorth || 0;

  const retirementYears = globals.lifeExpectancy - Math.max(globals.michaelRetirementAge, globals.briannaRetirementAge);

  const thCls = "px-4 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-200";
  const tdCls = "px-4 py-3 text-sm text-slate-600 border-b border-slate-100";
  const trHover = "hover:bg-slate-50 transition-colors";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Retirement Timeline & Projections</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className={thCls}>Profile</th>
                <th className={thCls}>Target Age</th>
                <th className={thCls}>Years To Retirement</th>
                <th className={thCls}>Projected Net Worth</th>
              </tr>
            </thead>
            <tbody>
              <tr className={trHover}>
                <td className={tdCls}>Michael</td>
                <td className={`${tdCls} font-semibold text-sky-600`}>{globals.michaelRetirementAge}</td>
                <td className={tdCls}>{yearsToMichaelRetirement}</td>
                <td className={`${tdCls} font-semibold text-emerald-600`}>{formatCur(michaelRetirementNetWorth)}</td>
              </tr>
              <tr className={trHover}>
                <td className={tdCls}>Brianna</td>
                <td className={`${tdCls} font-semibold text-violet-600`}>{globals.briannaRetirementAge}</td>
                <td className={tdCls}>{yearsToBriannaRetirement}</td>
                <td className={`${tdCls} font-semibold text-emerald-600`}>{formatCur(briannaRetirementNetWorth)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className={thCls}>Post-Retirement Plan</th>
                <th className={thCls}>Value</th>
                <th className={thCls}>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr className={trHover}>
                <td className={tdCls}>Retirement Duration</td>
                <td className={`${tdCls} font-semibold text-emerald-600`}>{retirementYears} years</td>
                <td className={tdCls}>Until age {globals.lifeExpectancy}</td>
              </tr>
              <tr className={trHover}>
                <td className={tdCls}>Target Annual Spend</td>
                <td className={`${tdCls} font-semibold text-slate-800`}>{formatCur(retirementExpenses.yearlyAmount)}</td>
                <td className={tdCls}>Fixed annual spending plan</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Monte Carlo Simulation Results</h2>
        <p className="text-slate-400 text-xs mb-4">1,000 randomized market scenarios testing your retirement success rate</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className={thCls}>Strategy</th>
                <th className={thCls}>Withdrawal Rate</th>
                <th className={thCls}>Success Rate</th>
                <th className={thCls}>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr className={trHover}>
                <td className={tdCls}>Conservative</td>
                <td className={tdCls}>3%</td>
                <td className={`${tdCls} font-semibold text-emerald-600`}>{monteCarloConservative.successRate.toFixed(1)}%</td>
                <td className={tdCls}>Highly safe strategy</td>
              </tr>
              <tr className={trHover}>
                <td className={tdCls}>Target</td>
                <td className={tdCls}>{(globals.withdrawalRate * 100).toFixed(1)}%</td>
                <td className={`${tdCls} font-semibold ${monteCarloBaseline.successRate > 85 ? 'text-sky-600' : 'text-amber-500'}`}>
                  {monteCarloBaseline.successRate.toFixed(1)}%
                </td>
                <td className={tdCls}>Fixed annual spend</td>
              </tr>
              <tr className={trHover}>
                <td className={tdCls}>Aggressive</td>
                <td className={tdCls}>5%</td>
                <td className={`${tdCls} font-semibold ${monteCarloAggressive.successRate > 70 ? 'text-violet-600' : 'text-red-500'}`}>
                  {monteCarloAggressive.successRate.toFixed(1)}%
                </td>
                <td className={tdCls}>Higher risk strategy</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Retirement Framework</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className={thCls}>Metric</th>
                <th className={thCls}>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className={trHover}>
                <td className={tdCls}>Michael's Retirement Age</td>
                <td className={`${tdCls} font-semibold text-sky-600`}>{globals.michaelRetirementAge}</td>
              </tr>
              <tr className={trHover}>
                <td className={tdCls}>Brianna's Retirement Age</td>
                <td className={`${tdCls} font-semibold text-violet-600`}>{globals.briannaRetirementAge}</td>
              </tr>
              <tr className={trHover}>
                <td className={tdCls}>Life Expectancy</td>
                <td className={`${tdCls} font-semibold text-emerald-600`}>{globals.lifeExpectancy}</td>
              </tr>
              <tr className={trHover}>
                <td className={tdCls}>Safe Withdrawal Rate</td>
                <td className={`${tdCls} font-semibold text-rose-500`}>{(globals.withdrawalRate * 100).toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Retirement;