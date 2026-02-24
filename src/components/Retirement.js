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

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="bg-slate-800/60 p-8 rounded-2xl shadow-lg border border-slate-700">
        <h2 className="text-3xl font-bold text-slate-100 mb-6">Retirement Timeline & Projections</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border border-slate-700">
            <thead className="bg-slate-900/60 text-slate-200">
              <tr>
                <th className="px-4 py-3 border-b border-slate-700">Profile</th>
                <th className="px-4 py-3 border-b border-slate-700">Target Age</th>
                <th className="px-4 py-3 border-b border-slate-700">Years To Retirement</th>
                <th className="px-4 py-3 border-b border-slate-700">Projected Net Worth</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Michael</td>
                <td className="px-4 py-3 border-b border-slate-700 text-blue-400 font-semibold">{globals.michaelRetirementAge}</td>
                <td className="px-4 py-3 border-b border-slate-700">{yearsToMichaelRetirement}</td>
                <td className="px-4 py-3 border-b border-slate-700 text-emerald-400 font-semibold">{formatCur(michaelRetirementNetWorth)}</td>
              </tr>
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Brianna</td>
                <td className="px-4 py-3 border-b border-slate-700 text-purple-400 font-semibold">{globals.briannaRetirementAge}</td>
                <td className="px-4 py-3 border-b border-slate-700">{yearsToBriannaRetirement}</td>
                <td className="px-4 py-3 border-b border-slate-700 text-emerald-400 font-semibold">{formatCur(briannaRetirementNetWorth)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm border border-slate-700">
            <thead className="bg-slate-900/60 text-slate-200">
              <tr>
                <th className="px-4 py-3 border-b border-slate-700">Post-Retirement Plan</th>
                <th className="px-4 py-3 border-b border-slate-700">Value</th>
                <th className="px-4 py-3 border-b border-slate-700">Notes</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Retirement Duration</td>
                <td className="px-4 py-3 border-b border-slate-700 text-emerald-400 font-semibold">{retirementYears} years</td>
                <td className="px-4 py-3 border-b border-slate-700">Until age {globals.lifeExpectancy}</td>
              </tr>
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Target Annual Spend</td>
                <td className="px-4 py-3 border-b border-slate-700 text-slate-100 font-semibold">{formatCur(retirementExpenses.yearlyAmount)}</td>
                <td className="px-4 py-3 border-b border-slate-700">Fixed annual spending plan</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800/60 p-8 rounded-2xl shadow-lg border border-slate-700">
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Monte Carlo Simulation Results</h2>
        <p className="text-slate-400 mb-6">1,000 randomized market scenarios testing your retirement success rate</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border border-slate-700">
            <thead className="bg-slate-900/60 text-slate-200">
              <tr>
                <th className="px-4 py-3 border-b border-slate-700">Strategy</th>
                <th className="px-4 py-3 border-b border-slate-700">Withdrawal Rate</th>
                <th className="px-4 py-3 border-b border-slate-700">Success Rate</th>
                <th className="px-4 py-3 border-b border-slate-700">Notes</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Conservative</td>
                <td className="px-4 py-3 border-b border-slate-700">3%</td>
                <td className="px-4 py-3 border-b border-slate-700 text-emerald-400 font-semibold">{monteCarloConservative.successRate.toFixed(1)}%</td>
                <td className="px-4 py-3 border-b border-slate-700">Highly safe strategy</td>
              </tr>
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Target</td>
                <td className="px-4 py-3 border-b border-slate-700">{(globals.withdrawalRate * 100).toFixed(1)}%</td>
                <td className={`px-4 py-3 border-b border-slate-700 font-semibold ${monteCarloBaseline.successRate > 85 ? 'text-blue-400' : 'text-amber-400'}`}>
                  {monteCarloBaseline.successRate.toFixed(1)}%
                </td>
                <td className="px-4 py-3 border-b border-slate-700">Fixed annual spend</td>
              </tr>
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Aggressive</td>
                <td className="px-4 py-3 border-b border-slate-700">5%</td>
                <td className={`px-4 py-3 border-b border-slate-700 font-semibold ${monteCarloAggressive.successRate > 70 ? 'text-purple-400' : 'text-red-400'}`}>
                  {monteCarloAggressive.successRate.toFixed(1)}%
                </td>
                <td className="px-4 py-3 border-b border-slate-700">Higher risk strategy</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800/60 p-8 rounded-2xl shadow-lg border border-slate-700">
        <h2 className="text-2xl font-bold text-slate-100 mb-6">Retirement Framework</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border border-slate-700">
            <thead className="bg-slate-900/60 text-slate-200">
              <tr>
                <th className="px-4 py-3 border-b border-slate-700">Metric</th>
                <th className="px-4 py-3 border-b border-slate-700">Value</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Michael's Retirement Age</td>
                <td className="px-4 py-3 border-b border-slate-700 text-blue-400 font-semibold">{globals.michaelRetirementAge}</td>
              </tr>
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Brianna's Retirement Age</td>
                <td className="px-4 py-3 border-b border-slate-700 text-purple-400 font-semibold">{globals.briannaRetirementAge}</td>
              </tr>
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Life Expectancy</td>
                <td className="px-4 py-3 border-b border-slate-700 text-emerald-400 font-semibold">{globals.lifeExpectancy}</td>
              </tr>
              <tr className="hover:bg-slate-700/40">
                <td className="px-4 py-3 border-b border-slate-700">Safe Withdrawal Rate</td>
                <td className="px-4 py-3 border-b border-slate-700 text-rose-400 font-semibold">{(globals.withdrawalRate * 100).toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Retirement;