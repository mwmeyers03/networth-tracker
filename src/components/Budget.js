import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  PlusCircle, Trash2, TrendingDown, TrendingUp, DollarSign,
  PiggyBank, ShoppingCart, Home, Car, Heart, Utensils,
  Zap, Wifi, Plane, Gamepad2, GraduationCap, Gift,
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import Tooltip from './Tooltip';

// ── Category icon map ───────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  Housing: Home,
  Food: Utensils,
  Transport: Car,
  Insurance: Heart,
  Utilities: Zap,
  Internet: Wifi,
  Travel: Plane,
  Entertainment: Gamepad2,
  Education: GraduationCap,
  Gifts: Gift,
  Shopping: ShoppingCart,
  Other: DollarSign,
};

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Housing', icon: 'Housing', budget: 1500, actual: 1500, color: '#0ea5e9' },
  { id: 2, name: 'Food & Dining', icon: 'Food', budget: 600, actual: 520, color: '#10b981' },
  { id: 3, name: 'Transport', icon: 'Transport', budget: 400, actual: 380, color: '#f59e0b' },
  { id: 4, name: 'Insurance', icon: 'Insurance', budget: 300, actual: 300, color: '#8b5cf6' },
  { id: 5, name: 'Utilities', icon: 'Utilities', budget: 150, actual: 160, color: '#ef4444' },
  { id: 6, name: 'Entertainment', icon: 'Entertainment', budget: 200, actual: 240, color: '#ec4899' },
  { id: 7, name: 'Travel / Vacation', icon: 'Travel', budget: 300, actual: 180, color: '#14b8a6' },
  { id: 8, name: 'Shopping', icon: 'Shopping', budget: 250, actual: 310, color: '#f97316' },
];

const PIE_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316',
  '#6366f1', '#84cc16',
];

// ── Inline editable cell ────────────────────────────────────────────────────
const EditCell = ({ value, onChange, prefix = '$' }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState('');

  const start = () => { setLocal(String(value)); setEditing(true); };
  const commit = () => {
    const n = parseFloat(local);
    if (!isNaN(n)) onChange(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        className="w-24 px-2 py-1 bg-slate-700 border border-sky-500 text-slate-100 rounded text-sm text-right focus:outline-none"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }
  return (
    <button
      onClick={start}
      className="text-sm font-medium text-slate-200 hover:text-sky-400 transition-colors tabular-nums"
    >
      {prefix}{value.toLocaleString()}
    </button>
  );
};

// ── Savings Rate Gauge ──────────────────────────────────────────────────────
const SavingsGauge = ({ rate }) => {
  const color = rate >= 30 ? '#10b981' : rate >= 15 ? '#f59e0b' : '#ef4444';
  const label = rate >= 30 ? 'Excellent' : rate >= 20 ? 'Good' : rate >= 10 ? 'Fair' : 'Low';
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const filled = Math.min(1, rate / 50) * circ; // max display = 50% savings rate
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="50" y="46" textAnchor="middle" fill={color} fontSize="15" fontWeight="700">{rate.toFixed(0)}%</text>
        <text x="50" y="62" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="500">{label.toUpperCase()}</text>
      </svg>
      <p className="text-[10px] text-slate-400">Savings Rate</p>
    </div>
  );
};

// Monotonically increasing counter for unique IDs
let _nextId = DEFAULT_CATEGORIES.length + 1;
const nextId = () => ++_nextId;

// ── Main Budget Component ───────────────────────────────────────────────────
const Budget = () => {
  const { formatCur, michaelExpenses, briannaExpenses } = useData();

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [newName, setNewName] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [activeView, setActiveView] = useState('overview'); // 'overview' | 'breakdown' | 'projection'
  const [monthlyIncome, setMonthlyIncome] = useState(8000);

  // Note: syncedBudget shows the DataContext monthly total for informational reference
  const syncedExpenses = useMemo(() => {
    const mTotal = Object.values(michaelExpenses).reduce((a, b) => a + b, 0);
    const bTotal = Object.values(briannaExpenses).reduce((a, b) => a + b, 0);
    return mTotal + bTotal;
  }, [michaelExpenses, briannaExpenses]);

  const totalBudget = useMemo(() => categories.reduce((a, c) => a + c.budget, 0), [categories]);
  const totalActual = useMemo(() => categories.reduce((a, c) => a + c.actual, 0), [categories]);
  const totalVariance = totalBudget - totalActual;
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - totalActual) / monthlyIncome) * 100 : 0;
  const monthlySavings = monthlyIncome - totalActual;

  const updateCategory = (id, field, val) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const deleteCategory = (id) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const addCategory = () => {
    const name = newName.trim();
    const budget = parseFloat(newBudget);
    if (!name || isNaN(budget) || budget < 0) return;
    setCategories(prev => [
      ...prev,
      {
        id: nextId(),
        name,
        icon: 'Other',
        budget,
        actual: 0,
        color: PIE_COLORS[prev.length % PIE_COLORS.length],
      },
    ]);
    setNewName('');
    setNewBudget('');
  };

  // ── Chart data ──────────────────────────────────────────────────────────
  const barData = categories.map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
    Budget: c.budget,
    Actual: c.actual,
  }));

  const pieData = categories.map(c => ({ name: c.name, value: c.actual, color: c.color }));

  // ── 12-month projection ─────────────────────────────────────────────────
  const projectionData = useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date().getMonth();
    return months.map((m, i) => {
      const past = i < now;
      const variance = past ? (Math.random() * 0.1 - 0.05) : 0;
      return {
        month: m,
        Income: monthlyIncome,
        Expenses: past ? Math.round(totalActual * (1 + variance)) : totalBudget,
        Savings: past
          ? Math.round(monthlyIncome - totalActual * (1 + variance))
          : Math.round(monthlyIncome - totalBudget),
      };
    });
  }, [monthlyIncome, totalActual, totalBudget]);

  const VIEWS = [
    { id: 'overview', label: 'Overview' },
    { id: 'breakdown', label: 'Breakdown' },
    { id: 'projection', label: 'Monthly Trend' },
  ];

  const BudgetTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl text-xs">
        <p className="font-semibold text-slate-200 mb-1.5">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {formatCur(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-6">

      {/* ── Header + View Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Budget Center</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track monthly spending, compare budget vs actual, and see how it affects your net worth journey.
            {syncedExpenses > 0 && (
              <span className="ml-1 text-sky-400">
                (Projection expenses: ${syncedExpenses.toFixed(0)}/mo from Settings)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeView === v.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Monthly Income',
            value: formatCur(monthlyIncome),
            color: 'text-sky-400',
            bg: 'bg-sky-500/10',
            icon: TrendingUp,
            tip: 'Your total monthly take-home income. Click the value to edit.',
            editable: true,
            rawValue: monthlyIncome,
            onEdit: setMonthlyIncome,
          },
          {
            label: 'Total Budget',
            value: formatCur(totalBudget),
            color: 'text-violet-400',
            bg: 'bg-violet-500/10',
            icon: PiggyBank,
            tip: 'Sum of all budgeted monthly amounts across all categories.',
          },
          {
            label: 'Total Actual',
            value: formatCur(totalActual),
            color: totalActual > totalBudget ? 'text-rose-400' : 'text-emerald-400',
            bg: totalActual > totalBudget ? 'bg-rose-500/10' : 'bg-emerald-500/10',
            icon: totalActual > totalBudget ? TrendingDown : TrendingUp,
            tip: 'Sum of all actual monthly spending. Red = over budget.',
          },
          {
            label: 'Monthly Savings',
            value: formatCur(monthlySavings),
            color: monthlySavings >= 0 ? 'text-emerald-400' : 'text-rose-400',
            bg: monthlySavings >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10',
            icon: monthlySavings >= 0 ? TrendingUp : TrendingDown,
            tip: 'Income minus actual spending. Positive = money saved this month.',
          },
        ].map(({ label, value, color, bg, icon: Icon, tip, editable, rawValue, onEdit }) => (
          <div key={label} className={`${bg} border border-slate-700 rounded-xl p-4 flex items-start gap-3`}>
            <div className={`w-9 h-9 ${bg} ${color} rounded-lg flex items-center justify-center shrink-0 border border-slate-700`}>
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                <Tooltip text={tip} side="top" />
              </div>
              {editable ? (
                <EditCell value={rawValue} onChange={onEdit} />
              ) : (
                <p className={`text-lg font-bold ${color} leading-tight`}>{value}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Category Table */}
          <div className="lg:col-span-2 bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h3 className="text-sm font-bold text-white">Budget Categories</h3>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-400" /> Budget
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Actual
                </span>
              </div>
            </div>
            <div className="divide-y divide-slate-700/50">
              {categories.map(c => {
                const IconComp = CATEGORY_ICONS[c.icon] || DollarSign;
                const over = c.actual > c.budget;
                const pct = c.budget > 0 ? Math.min(100, (c.actual / c.budget) * 100) : 0;
                return (
                  <div key={c.id} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${c.color}20`, color: c.color }}
                      >
                        <IconComp size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-slate-200 truncate">{c.name}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-[9px] text-slate-500 uppercase">Budget</p>
                              <EditCell value={c.budget} onChange={(v) => updateCategory(c.id, 'budget', v)} />
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-slate-500 uppercase">Actual</p>
                              <EditCell value={c.actual} onChange={(v) => updateCategory(c.id, 'actual', v)} />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums ${over ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {over ? '▲' : '▼'} ${Math.abs(c.budget - c.actual)}
                            </span>
                            <button
                              onClick={() => deleteCategory(c.id)}
                              className="text-slate-600 hover:text-rose-400 transition-colors"
                              aria-label="Delete category"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: over ? '#ef4444' : c.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Category Row */}
            <div className="px-5 py-4 border-t border-slate-700 bg-slate-900/40">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Category name…"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg text-xs focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                />
                <input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  placeholder="Monthly $"
                  className="w-28 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg text-xs focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                />
                <button
                  onClick={addCategory}
                  className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <PlusCircle size={14} />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Right column: gauge + pie */}
          <div className="flex flex-col gap-4">
            {/* Savings Gauge */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex flex-col items-center gap-3">
              <SavingsGauge rate={savingsRate} />
              <div className="w-full grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/60 rounded-lg p-2.5 text-center">
                  <p className="text-slate-500 uppercase text-[9px] tracking-wider">Variance</p>
                  <p className={`font-bold text-sm ${totalVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalVariance >= 0 ? '+' : ''}{formatCur(totalVariance)}
                  </p>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-2.5 text-center">
                  <p className="text-slate-500 uppercase text-[9px] tracking-wider">Annual Savings</p>
                  <p className="font-bold text-sm text-sky-400">{formatCur(monthlySavings * 12)}</p>
                </div>
              </div>
              <div className="w-full bg-slate-900/60 rounded-lg p-3 text-xs text-slate-400 text-center leading-relaxed">
                <span className="text-emerald-400 font-semibold">💡 Tip:</span> Saving{' '}
                <span className="text-white font-semibold">{formatCur(monthlySavings)}/mo</span> grows to{' '}
                <span className="text-sky-400 font-semibold">{formatCur(monthlySavings > 0 ? monthlySavings * ((Math.pow(1 + 0.07/12, 240) - 1) / (0.07/12)) : 0)}</span>{' '}
                in 20 yrs (at 7% growth).
              </div>
            </div>

            {/* Spending Pie */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-1 mb-3">
                <h3 className="text-sm font-bold text-white">Spending Split</h3>
                <Tooltip text="Proportional breakdown of your actual monthly spending by category." />
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartTooltip
                      formatter={(val) => formatCur(val)}
                      contentStyle={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                        color: '#e2e8f0',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                {categories.slice(0, 6).map(c => (
                  <div key={c.id} className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                    {c.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Breakdown tab ── */}
      {activeView === 'breakdown' && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-1 mb-4">
            <h3 className="text-sm font-bold text-white">Budget vs Actual by Category</h3>
            <Tooltip text="Compare your planned budget to your actual spending side by side for each category." />
          </div>
          <div style={{ height: 360, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 12, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => `$${v.toLocaleString()}`}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <RechartTooltip content={<BudgetTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '8px', color: '#94a3b8', fontSize: '11px' }} />
                <Bar dataKey="Budget" fill="#0ea5e9" opacity={0.6} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Actual" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Table */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-2 font-semibold">Category</th>
                  <th className="pb-2 font-semibold text-right">Budget</th>
                  <th className="pb-2 font-semibold text-right">Actual</th>
                  <th className="pb-2 font-semibold text-right">Variance</th>
                  <th className="pb-2 font-semibold text-right">% Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {categories.map(c => {
                  const variance = c.budget - c.actual;
                  const pctUsed = c.budget > 0 ? (c.actual / c.budget) * 100 : 0;
                  const over = variance < 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                          <span className="text-slate-200 font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-slate-300">{formatCur(c.budget)}</td>
                      <td className={`py-2.5 text-right font-semibold ${over ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCur(c.actual)}
                      </td>
                      <td className={`py-2.5 text-right ${over ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {over ? '-' : '+'}{formatCur(Math.abs(variance))}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`font-semibold ${pctUsed > 100 ? 'text-rose-400' : pctUsed > 85 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {pctUsed.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-600 font-bold">
                  <td className="py-2.5 text-white">Total</td>
                  <td className="py-2.5 text-right text-sky-400">{formatCur(totalBudget)}</td>
                  <td className={`py-2.5 text-right ${totalActual > totalBudget ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCur(totalActual)}</td>
                  <td className={`py-2.5 text-right ${totalVariance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {totalVariance >= 0 ? '+' : ''}{formatCur(totalVariance)}
                  </td>
                  <td className="py-2.5 text-right text-slate-300">
                    {totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(0) : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Monthly Trend tab ── */}
      {activeView === 'projection' && (
        <div className="space-y-5">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-1 mb-4">
              <h3 className="text-sm font-bold text-white">Full-Year Income vs Expenses</h3>
              <Tooltip text="Past months use your actual spending. Future months use your budgeted amounts." />
            </div>
            <div style={{ height: 320, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectionData} margin={{ top: 10, right: 12, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <RechartTooltip content={<BudgetTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '8px', color: '#94a3b8', fontSize: '11px' }} />
                  <Bar dataKey="Income" fill="#0ea5e9" opacity={0.7} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#f43f5e" opacity={0.7} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Savings" fill="#10b981" opacity={0.7} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Net Worth Impact */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-1 mb-3">
              <h3 className="text-sm font-bold text-white">Budget Impact on Net Worth</h3>
              <Tooltip text="How your monthly savings rate translates to long-term net worth growth, assuming 7% annual market return." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: '5-Year Projection', years: 5 },
                { label: '10-Year Projection', years: 10 },
                { label: '20-Year Projection', years: 20 },
              ].map(({ label, years }) => {
                const r = 0.07 / 12;
                const n = years * 12;
                const fv = monthlySavings > 0
                  ? monthlySavings * ((Math.pow(1 + r, n) - 1) / r)
                  : 0;
                const contributions = Math.max(0, monthlySavings * 12 * years);
                return (
                  <div key={label} className="bg-slate-900/60 rounded-lg p-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1">{formatCur(Math.max(0, fv))}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      +{formatCur(contributions)} principal contributed
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Budget;
