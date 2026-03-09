import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';

const DataLedger = () => {
  const { financialData, formatCur, handleCellEdit, overrides } = useData();
  const [editingCell, setEditingCell] = useState({ year: null, field: null, value: '' });

  const startEdit = (year, field, currentValue) => {
    setEditingCell({ year, field, value: String(Math.round(currentValue)) });
  };

  const commitEdit = () => {
    if (editingCell.year !== null) {
      handleCellEdit(editingCell.year, editingCell.field, editingCell.value);
      setEditingCell({ year: null, field: null, value: '' });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingCell({ year: null, field: null, value: '' });
  };

  const hasOverride = (year, field) => overrides[year]?.[field] !== undefined;

  const EditableCell = ({ row, field, value, extraClass = '' }) => {
    const isCurrentlyEditing = editingCell.year === row.year && editingCell.field === field;
    const edited = hasOverride(row.year, field);

    if (isCurrentlyEditing) {
      return (
        <td className={`px-3 py-2.5 ${extraClass}`}>
          <input
            autoFocus
            type="number"
            aria-label={`Edit ${field} for year ${row.year}`}
            value={editingCell.value}
            onChange={(e) => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-24 px-1 py-0.5 bg-slate-700 text-white text-xs rounded outline-none border border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </td>
      );
    }

    return (
      <td
        className={`px-3 py-2.5 cursor-pointer hover:bg-slate-600/40 ${edited ? 'text-amber-400' : 'text-slate-300'} ${extraClass}`}
        onClick={() => startEdit(row.year, field, value)}
        title={edited ? 'Custom override — click to edit, clear to reset' : 'Click to edit'}
      >
        {formatCur(value)}
        {edited && <span className="ml-1 text-amber-500 text-[9px]">✎</span>}
      </td>
    );
  };

  return (
    <div className="max-w-7xl mx-auto pb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Financial Projection Ledger</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Year-by-year projection · Scroll right on small screens ·{' '}
            <span className="text-amber-400">Click a balance cell to override it</span>
          </p>
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
                  <EditableCell row={row} field="total401kBal" value={row.total401k} />
                  <EditableCell row={row} field="rothBal" value={row.rothBal} />
                  <EditableCell row={row} field="brokerageBal" value={row.brokerageBal} />
                  <EditableCell row={row} field="savingsBal" value={row.savingsBal} extraClass="border-r border-slate-700/50" />
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
