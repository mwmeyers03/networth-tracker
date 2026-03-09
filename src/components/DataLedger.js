import React from 'react';
import { useData } from '../contexts/DataContext';

const DataLedger = () => {
  const { financialData, formatCur } = useData();

  return (
    <div className="max-w-7xl mx-auto pb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Financial Projection Ledger</h2>
          <p className="text-xs text-slate-400 mt-0.5">Year-by-year projection · Scroll right on small screens</p>
        </div>
        <span className="text-[10px] text-slate-500 bg-slate-800 border border-slate-700 rounded px-2 py-1">
          {financialData.length} rows
        </span>
      </div>
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-900/80 sticky top-0 z-10">
              <tr>
                {[
                  'Year', 'M Age', 'B Age',
                  'Combined Income', 'Annual Expenses',
                  '401K', 'Roth IRA', 'Brokerage', 'Cash',
                  'Net Worth'
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`px-3 py-3 font-semibold text-slate-300 whitespace-nowrap ${
                      i === 9 ? 'text-emerald-400' : ''
                    } ${[2, 4, 8].includes(i) ? 'border-r border-slate-700' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {financialData.map((row) => (
                <tr
                  key={row.year}
                  className={`transition-colors ${
                    row.retired
                      ? 'bg-emerald-900/10 hover:bg-emerald-900/20'
                      : 'hover:bg-slate-700/30'
                  }`}
                >
                  <td className="px-3 py-2.5 font-bold text-slate-100">{row.year}</td>
                  <td className="px-3 py-2.5 text-sky-400">{Math.floor(row.michaelAge)}</td>
                  <td className="px-3 py-2.5 text-violet-400 border-r border-slate-700/50">{Math.floor(row.briannaAge)}</td>
                  <td className="px-3 py-2.5 text-slate-200 font-medium">{formatCur(row.combinedGross)}</td>
                  <td className="px-3 py-2.5 text-slate-300 border-r border-slate-700/50">{formatCur(row.combinedExp)}</td>
                  <td className="px-3 py-2.5 text-slate-300">{formatCur(row.total401k)}</td>
                  <td className="px-3 py-2.5 text-slate-300">{formatCur(row.rothBal)}</td>
                  <td className="px-3 py-2.5 text-slate-300">{formatCur(row.brokerageBal)}</td>
                  <td className="px-3 py-2.5 text-slate-300 border-r border-slate-700/50">{formatCur(row.savingsBal)}</td>
                  <td
                    className={`px-3 py-2.5 font-bold ${
                      row.liquidityGap > 0
                        ? 'text-rose-400'
                        : row.netWorth > 0
                        ? 'text-emerald-400'
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
