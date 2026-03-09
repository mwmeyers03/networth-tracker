import React, { useState } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { useData } from '../contexts/DataContext';
import { DollarSign, TrendingUp, BarChart3, Download, Eye, EyeOff } from 'lucide-react';
import InfoTooltip from './Tooltip';

// Custom chart tooltip
const CustomTooltip = ({ active, payload, label, formatCur }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl text-xs">
        <p className="font-semibold text-slate-200 mb-1.5">Year: {label}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {typeof entry.value === 'number' ? formatCur(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Export projection data as CSV
const exportCsv = (financialData) => {
  if (!financialData.length) return;
  const headers = ['Year','Michael Age','Brianna Age','Combined Income','Annual Expenses','401K','Roth IRA','Brokerage','Cash','Net Worth'];
  const rows = financialData.map(r => [
    r.year, Math.floor(r.michaelAge), Math.floor(r.briannaAge),
    r.combinedGross.toFixed(0), r.combinedExp.toFixed(0),
    r.total401k.toFixed(0), r.rothBal.toFixed(0), r.brokerageBal.toFixed(0),
    r.savingsBal.toFixed(0), r.netWorth.toFixed(0),
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `networth-projection-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// Toggle button for chart legend
const LegendToggle = ({ color, label, active, onToggle }) => (
  <button
    onClick={onToggle}
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-all ${
      active
        ? 'border-current text-slate-200 bg-slate-700/50'
        : 'border-slate-700 text-slate-600 bg-transparent'
    }`}
    style={active ? { borderColor: color, color } : {}}
  >
    {active ? <Eye size={11} /> : <EyeOff size={11} />}
    {label}
  </button>
);

const Dashboard = () => {
  const { financialData, formatCur, globals } = useData();

  // Chart legend toggles
  const [show401k, setShow401k] = useState(true);
  const [showRoth, setShowRoth] = useState(true);
  const [showBrokerage, setShowBrokerage] = useState(true);
  const [showCash, setShowCash] = useState(true);

  const currentNetWorth = financialData[0]?.netWorth || 0;
  const retirementData = financialData.find(d => d.retired);
  const retirementNetWorth = retirementData?.netWorth || 0;
  const retirementYear = retirementData?.year;
  const peakNetWorth = financialData.length ? Math.max(...financialData.map(d => d.netWorth)) : 0;
  const peakYear = financialData.find(d => d.netWorth === peakNetWorth)?.year;

  const michaelRetireYear = financialData.find(d => d.michaelAge >= globals.michaelRetirementAge)?.year;
  const briannaRetireYear = financialData.find(d => d.briannaAge >= globals.briannaRetirementAge)?.year;
  const sameRetireYear = michaelRetireYear && briannaRetireYear && michaelRetireYear === briannaRetireYear;

  const growthPct = currentNetWorth > 0
    ? ((retirementNetWorth / currentNetWorth - 1) * 100).toFixed(0)
    : '—';

  const kpiCards = [
    {
      icon: DollarSign,
      label: 'Current Net Worth',
      value: formatCur(currentNetWorth),
      sub: 'Starting position',
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      tip: 'Total value of all accounts (401K + Roth IRA + Brokerage + Cash) at the start of the projection.',
    },
    {
      icon: TrendingUp,
      label: 'At Retirement',
      value: formatCur(retirementNetWorth),
      sub: retirementYear ? `Year ${retirementYear}` : 'N/A',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      tip: 'Projected net worth in the year both partners are retired. Adjust retirement ages in Settings.',
    },
    {
      icon: BarChart3,
      label: 'Peak Net Worth',
      value: formatCur(peakNetWorth),
      sub: peakYear ? `Year ${peakYear}` : '—',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      tip: 'The highest projected net worth value across the entire simulation period.',
    },
    {
      icon: TrendingUp,
      label: 'Total Growth',
      value: `${growthPct}%`,
      sub: 'Pre-retirement increase',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      tip: 'Percentage increase from current net worth to retirement net worth. Based on market return assumptions.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiCards.map(({ icon: Icon, label, value, sub, color, bg, tip }) => (
          <div key={label} className={`${bg} border border-slate-700 rounded-xl p-4 flex items-start gap-3`}>
            <div className={`w-9 h-9 ${color} bg-slate-800 rounded-lg flex items-center justify-center shrink-0 border border-slate-700`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
                <InfoTooltip text={tip} side="top" />
              </div>
              <p className={`text-lg font-bold ${color} mt-0.5 leading-none tabular-nums`}>{value}</p>
              <p className="text-[10px] text-slate-500 mt-1">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Net Worth Chart */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-1.5">
              Total Net Worth Trajectory
              <InfoTooltip text="Year-by-year projection of combined net worth including all accounts. Dashed lines mark retirement dates." side="right" />
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">Wealth growth from today through retirement and beyond</p>
          </div>
          <button
            onClick={() => exportCsv(financialData)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-xs font-semibold text-slate-300 transition-colors"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
        <div style={{ height: 320, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={financialData} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="gradientNW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis
                dataKey="year"
                stroke="#475569"
                tick={{ fontSize: 11, fill: '#64748b' }}
                interval={Math.floor(financialData.length / 6)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
                stroke="#475569"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} formatCur={formatCur} />} />
              <Area
                type="monotone"
                dataKey="netWorth"
                name="Net Worth"
                stroke="#0ea5e9"
                strokeWidth={2}
                fill="url(#gradientNW)"
                dot={false}
              />
              {michaelRetireYear && (
                <ReferenceLine x={michaelRetireYear} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'M', fill: '#64748b', fontSize: 10, position: 'insideTopRight' }} />
              )}
              {briannaRetireYear && briannaRetireYear !== michaelRetireYear && (
                <ReferenceLine x={briannaRetireYear} stroke="#a78bfa" strokeDasharray="4 4" label={{ value: 'B', fill: '#a78bfa', fontSize: 10, position: 'insideTopRight' }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {(michaelRetireYear || briannaRetireYear) && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            {sameRetireYear ? (
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-5 bg-slate-500" />
                <span>Both retire · Year {michaelRetireYear}</span>
              </div>
            ) : (
              <>
                {michaelRetireYear && (
                  <div className="flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-slate-500" />
                    <span>Michael · Year {michaelRetireYear}</span>
                  </div>
                )}
                {briannaRetireYear && (
                  <div className="flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-violet-400" />
                    <span>Brianna · Year {briannaRetireYear}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Asset Allocation & Income/Expense Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Asset Allocation with legend toggles */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <div className="mb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-1.5">
              Asset Allocation
              <InfoTooltip text="How your wealth is distributed across 401K, Roth IRA, brokerage, and cash accounts over time. Click the toggles below to show/hide account types." side="right" />
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">Distribution across investment vehicles</p>
          </div>
          {/* Legend toggles */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <LegendToggle color="#0ea5e9" label="401K" active={show401k} onToggle={() => setShow401k(v => !v)} />
            <LegendToggle color="#8b5cf6" label="Roth IRA" active={showRoth} onToggle={() => setShowRoth(v => !v)} />
            <LegendToggle color="#10b981" label="Brokerage" active={showBrokerage} onToggle={() => setShowBrokerage(v => !v)} />
            <LegendToggle color="#f59e0b" label="Cash" active={showCash} onToggle={() => setShowCash(v => !v)} />
          </div>
          <div style={{ height: 260, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData} margin={{ top: 10, right: 12, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis
                  dataKey="year"
                  stroke="#475569"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  interval={Math.floor(financialData.length / 6)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  stroke="#475569"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={(props) => <CustomTooltip {...props} formatCur={formatCur} />} cursor={{ fill: 'rgba(14,165,233,0.05)' }} />
                {show401k && <Bar dataKey="total401k" name="401K" stackId="a" fill="#0ea5e9" />}
                {showRoth && <Bar dataKey="rothBal" name="Roth IRA" stackId="a" fill="#8b5cf6" />}
                {showBrokerage && <Bar dataKey="brokerageBal" name="Brokerage" stackId="a" fill="#10b981" />}
                {showCash && <Bar dataKey="savingsBal" name="Cash" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />}
                {michaelRetireYear && <ReferenceLine x={michaelRetireYear} stroke="#64748b" strokeDasharray="4 4" />}
                {briannaRetireYear && briannaRetireYear !== michaelRetireYear && <ReferenceLine x={briannaRetireYear} stroke="#a78bfa" strokeDasharray="4 4" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income vs Expenses */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-1.5">
              Income vs Expenses
              <InfoTooltip text="Annual gross combined income (before tax) compared to total annual expenses. The gap represents your savings capacity." side="left" />
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">Annual gross income vs total expenses</p>
          </div>
          <div style={{ height: 280, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={financialData} margin={{ top: 10, right: 12, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis
                  dataKey="year"
                  stroke="#475569"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  interval={Math.floor(financialData.length / 6)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  stroke="#475569"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={(props) => <CustomTooltip {...props} formatCur={formatCur} />} />
                <Legend wrapperStyle={{ paddingTop: '8px', color: '#94a3b8', fontSize: '11px' }} />
                <Line type="monotone" dataKey="combinedGross" name="Gross Income" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="combinedExp" name="Expenses" stroke="#f43f5e" strokeWidth={2} dot={false} />
                {michaelRetireYear && <ReferenceLine x={michaelRetireYear} stroke="#64748b" strokeDasharray="4 4" />}
                {briannaRetireYear && briannaRetireYear !== michaelRetireYear && <ReferenceLine x={briannaRetireYear} stroke="#a78bfa" strokeDasharray="4 4" />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
