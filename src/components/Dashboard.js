import React from 'react';
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { useData } from '../contexts/DataContext';
import { DollarSign, TrendingUp, BarChart3 } from 'lucide-react';

// Custom Tooltip
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

const Dashboard = () => {
  const { financialData, formatCur, globals } = useData();

  const currentNetWorth = financialData[0]?.netWorth || 0;
  const retirementData = financialData.find(d => d.retired);
  const retirementNetWorth = retirementData?.netWorth || 0;
  const retirementYear = retirementData?.year;

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
    },
    {
      icon: TrendingUp,
      label: 'At Retirement',
      value: formatCur(retirementNetWorth),
      sub: retirementYear ? `Year ${retirementYear}` : 'N/A',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: BarChart3,
      label: 'Total Growth',
      value: `${growthPct}%`,
      sub: 'Pre-retirement increase',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpiCards.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
            <div className={`w-9 h-9 ${bg} ${color} rounded-lg flex items-center justify-center shrink-0`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
              <p className={`text-xl font-bold ${color} mt-0.5 leading-none`}>{value}</p>
              <p className="text-[10px] text-slate-500 mt-1">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Net Worth Chart */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
        <div className="mb-4">
          <h2 className="text-base font-bold text-white">Total Net Worth Trajectory</h2>
          <p className="text-slate-400 text-xs mt-0.5">Wealth growth from today through retirement and beyond</p>
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
        {/* Asset Allocation */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">Asset Allocation</h2>
            <p className="text-slate-400 text-xs mt-0.5">Distribution across investment vehicles</p>
          </div>
          <div style={{ height: 280, width: '100%' }}>
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
                <Legend wrapperStyle={{ paddingTop: '8px', color: '#94a3b8', fontSize: '11px' }} />
                <Bar dataKey="total401k" name="401K" stackId="a" fill="#0ea5e9" />
                <Bar dataKey="rothBal" name="Roth IRA" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="brokerageBal" name="Brokerage" stackId="a" fill="#10b981" />
                <Bar dataKey="savingsBal" name="Cash" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                {michaelRetireYear && <ReferenceLine x={michaelRetireYear} stroke="#64748b" strokeDasharray="4 4" />}
                {briannaRetireYear && briannaRetireYear !== michaelRetireYear && <ReferenceLine x={briannaRetireYear} stroke="#a78bfa" strokeDasharray="4 4" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income vs Expenses */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">Income vs Expenses</h2>
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