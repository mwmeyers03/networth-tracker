import React from 'react';
import { useData } from '../contexts/DataContext';

const DataLedger = () => {
  const { financialData, formatCur } = useData();

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-200px)] flex flex-col">
      <div className="bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700 flex flex-col flex-1 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Financial Projection Ledger</h2>
          <p className="text-slate-400">Complete year-by-year projection based on your inputs. Hover over rows to see highlighted data.</p>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-slate-800 to-slate-700 text-slate-100 sticky top-0 z-10 shadow-md">
              <tr>
                <th className="px-6 py-4 font-semibold border-r border-slate-600">Year</th>
                <th className="px-6 py-4 font-semibold text-slate-300">Michael Age</th>
                <th className="px-6 py-4 font-semibold text-slate-300 border-r border-slate-600">Brianna Age</th>
                <th className="px-6 py-4 font-semibold">Combined Income</th>
                <th className="px-6 py-4 font-semibold border-r border-slate-600">Annual Expenses</th>
                <th className="px-6 py-4 font-semibold">401K Balance</th>
                <th className="px-6 py-4 font-semibold">Roth IRA</th>
                <th className="px-6 py-4 font-semibold">Brokerage</th>
                <th className="px-6 py-4 font-semibold border-r border-slate-600">Cash Savings</th>
                <th className="px-6 py-4 font-bold text-emerald-300">Total Net Worth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {financialData.map((row) => (
                <tr
                  key={row.year}
                  className={`hover:bg-slate-700/40 transition-colors ${
                    row.retired ? 'bg-gradient-to-r from-emerald-900/30 to-green-900/20' : ''
                  }`}
                >
                  <td className="px-6 py-4 font-bold text-slate-100 text-lg border-r border-slate-700">{row.year}</td>
                  <td className="px-6 py-4 text-slate-300 whitespace-nowrap">{Math.floor(row.michaelAge)}</td>
                  <td className="px-6 py-4 text-slate-300 border-r border-slate-700 whitespace-nowrap">{Math.floor(row.briannaAge)}</td>
                  <td className="px-6 py-4 text-slate-200 font-semibold">{formatCur(row.combinedGross)}</td>
                  <td className="px-6 py-4 text-slate-200 border-r border-slate-700">{formatCur(row.combinedExp)}</td>
                  <td className="px-6 py-4 text-slate-300 font-semibold">{formatCur(row.total401k)}</td>
                  <td className="px-6 py-4 text-slate-300 font-semibold">{formatCur(row.rothBal)}</td>
                  <td className="px-6 py-4 text-slate-300 font-semibold">{formatCur(row.brokerageBal)}</td>
                  <td className="px-6 py-4 text-slate-300 border-r border-slate-700 font-semibold">{formatCur(row.savingsBal)}</td>
                  <td
                    className={`px-6 py-4 font-bold text-lg ${
                      row.liquidityGap > 0
                        ? 'text-red-400 bg-red-900/40'
                        : row.netWorth > 0
                        ? 'text-emerald-400 bg-emerald-900/40'
                        : 'text-slate-500'
                    }`}
                  >
                    {formatCur(row.netWorth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataLedger;
