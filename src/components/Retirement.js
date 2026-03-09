import React, { useMemo } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useData } from '../contexts/DataContext';
import { CheckCircle, AlertCircle, Shield, Target, Clock } from 'lucide-react';

// Gauge-style circular progress for success rate
const SuccessGauge = ({ rate }) => {
  const color = rate >= 90 ? '#10b981' : rate >= 75 ? '#f59e0b' : '#ef4444';
  const label = rate >= 90 ? 'Excellent' : rate >= 80 ? 'Good' : rate >= 70 ? 'Caution' : 'At Risk';
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const filled = (rate / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="48" y="44" textAnchor="middle" fill={color} fontSize="15" fontWeight="700">
          {rate.toFixed(1)}%
        </text>
        <text x="48" y="60" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="500">
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  );
};

const FanChartTooltip = ({ active, payload, label, formatCur }) => {
  if (active && payload && payload.length) {
    const p50 = payload.find(p => p.dataKey === 'p50');
    const p25 = payload.find(p => p.dataKey === 'p25');
    const p75 = payload.find(p => p.dataKey === 'p75');
    const p10 = payload.find(p => p.dataKey === 'p10');
    const p90 = payload.find(p => p.dataKey === 'p90');
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl text-xs">
        <p className="font-semibold text-slate-200 mb-2">Year {label}</p>
        {p90 && <p className="text-emerald-400">Best (90th): {formatCur(p90.value)}</p>}
        {p75 && <p className="text-sky-400">Good (75th): {formatCur(p75.value)}</p>}
        {p50 && <p className="text-white font-semibold">Median (50th): {formatCur(p50.value)}</p>}
        {p25 && <p className="text-amber-400">Poor (25th): {formatCur(p25.value)}</p>}
        {p10 && <p className="text-rose-400">Worst (10th): {formatCur(p10.value)}</p>}
      </div>
    );
  }
  return null;
};

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

  const michaelCurrentAge = 22;
  const briannaCurrentAge = 21;
  const yearsToMichaelRetirement = globals.michaelRetirementAge - michaelCurrentAge;
  const yearsToBriannaRetirement = globals.briannaRetirementAge - briannaCurrentAge;

  const michaelRetirementNetWorth = financialData.find(
    d => d.michaelAge >= globals.michaelRetirementAge
  )?.netWorth || 0;

  const retirementYears = globals.lifeExpectancy - Math.max(globals.michaelRetirementAge, globals.briannaRetirementAge);
  const fireNumber = retirementExpenses.yearlyAmount / globals.withdrawalRate;

  // Build chart data for the fan chart — limit to first 35 years of retirement for readability
  const fanData = useMemo(() => {
    if (!monteCarloBaseline.percentileData || monteCarloBaseline.percentileData.length === 0) return [];
    const firstRetireYear = monteCarloBaseline.percentileData[0]?.year || 0;
    return monteCarloBaseline.percentileData
      .filter(d => d.year <= firstRetireYear + 35)
      .map(d => ({
        year: d.year,
        p10: d.p10,
        p25: d.p25,
        p50: d.p50,
        p75: d.p75,
        p90: d.p90,
        // recharts area bands need cumulative deltas
        band_10_25: d.p25 - d.p10,
        band_25_50: d.p50 - d.p25,
        band_50_75: d.p75 - d.p50,
        band_75_90: d.p90 - d.p75,
      }));
  }, [monteCarloBaseline.percentileData]);

  // Cap the Y-axis at the 75th percentile at the midpoint year to keep the chart readable
  const fanYMax = useMemo(() => {
    if (!fanData.length) return undefined;
    const midIdx = Math.floor(fanData.length / 2);
    const cap = fanData[midIdx]?.p75 || 0;
    return cap > 0 ? Math.ceil(cap / 1_000_000) * 1_000_000 : undefined;
  }, [fanData]);

  const strategies = [
    {
      label: 'Conservative',
      rate: '3%',
      data: monteCarloConservative,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      description: 'Low withdrawal — maximum safety',
    },
    {
      label: 'Target',
      rate: `${(globals.withdrawalRate * 100).toFixed(1)}%`,
      data: monteCarloBaseline,
      color: monteCarloBaseline.successRate > 85 ? 'text-sky-400' : 'text-amber-400',
      bg: monteCarloBaseline.successRate > 85
        ? 'bg-sky-500/10 border-sky-500/30'
        : 'bg-amber-500/10 border-amber-500/30',
      description: 'Your configured withdrawal rate',
    },
    {
      label: 'Aggressive',
      rate: '5%',
      data: monteCarloAggressive,
      color: monteCarloAggressive.successRate > 70 ? 'text-violet-400' : 'text-rose-400',
      bg: monteCarloAggressive.successRate > 70
        ? 'bg-violet-500/10 border-violet-500/30'
        : 'bg-rose-500/10 border-rose-500/30',
      description: 'High withdrawal — higher risk',
    },
  ];

  const progressPct = Math.min(100, (michaelRetirementNetWorth / fireNumber) * 100);

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-6">

      {/* FIRE Progress Banner */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white">FIRE Progress</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Target: {formatCur(fireNumber)} ({(globals.withdrawalRate * 100).toFixed(1)}% withdrawal of {formatCur(retirementExpenses.yearlyAmount)}/yr)
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold text-emerald-400">{progressPct.toFixed(0)}%</span>
            <p className="text-xs text-slate-400">funded at retirement</p>
          </div>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Michael Retires", value: `Age ${globals.michaelRetirementAge}`, sub: `${yearsToMichaelRetirement} yrs`, icon: Clock, color: 'text-sky-400' },
            { label: "Brianna Retires", value: `Age ${globals.briannaRetirementAge}`, sub: `${yearsToBriannaRetirement} yrs`, icon: Clock, color: 'text-violet-400' },
            { label: "Portfolio at Retirement", value: formatCur(michaelRetirementNetWorth), sub: "projected", icon: Target, color: 'text-emerald-400' },
            { label: "Retirement Span", value: `${retirementYears} yrs`, sub: `Until age ${globals.lifeExpectancy}`, icon: Shield, color: 'text-amber-400' },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-slate-900/50 rounded-lg p-3 flex items-start gap-2">
              <Icon size={16} className={`${color} mt-0.5 shrink-0`} />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide leading-tight">{label}</p>
                <p className={`text-sm font-bold ${color} leading-tight`}>{value}</p>
                <p className="text-[10px] text-slate-500">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monte Carlo Success Rate Cards */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-white">Monte Carlo Simulation — 1,000 Scenarios</h2>
          <p className="text-xs text-slate-400 mt-0.5">Randomized market returns stress-test your retirement plan across possible futures</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {strategies.map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</p>
                  <p className="text-sm font-bold text-white">{s.rate} Withdrawal</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{s.description}</p>
                </div>
                {s.data.successRate >= 85
                  ? <CheckCircle size={20} className="text-emerald-400 shrink-0" />
                  : <AlertCircle size={20} className="text-amber-400 shrink-0" />
                }
              </div>
              <SuccessGauge rate={s.data.successRate} />
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/50 rounded p-2">
                  <p className="text-slate-400">Successes</p>
                  <p className="font-semibold text-white">{s.data.successCount}/{s.data.numSimulations}</p>
                </div>
                <div className="bg-slate-900/50 rounded p-2">
                  <p className="text-slate-400">Avg End Year</p>
                  <p className="font-semibold text-white">{Math.round(s.data.avgFinalYear)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fan Chart — Portfolio Percentile Bands */}
      {fanData.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-base font-bold text-white">Portfolio Trajectory — Percentile Fan</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Range of outcomes across 1,000 simulations over the first 35 retirement years. Darker band = more likely outcomes (25th–75th percentile).
            </p>
          </div>
          <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fanData} margin={{ top: 10, right: 16, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="g10_25" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="g25_50" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="g50_75" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="g75_90" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis
                  dataKey="year"
                  stroke="#475569"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
                  stroke="#475569"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  domain={fanYMax ? [0, fanYMax] : [0, 'auto']}
                />
                <Tooltip content={(props) => <FanChartTooltip {...props} formatCur={formatCur} />} />
                {/* Include p10 as the transparent base so bands start at p10, not 0 */}
                <Area type="monotone" dataKey="p10" stackId="fan" stroke="none" fill="transparent" name="10th pct" />
                <Area type="monotone" dataKey="band_10_25" stackId="fan" stroke="none" fill="url(#g10_25)" name="10–25th pct" />
                <Area type="monotone" dataKey="band_25_50" stackId="fan" stroke="none" fill="url(#g25_50)" name="25–50th pct" />
                <Area type="monotone" dataKey="band_50_75" stackId="fan" stroke="none" fill="url(#g50_75)" name="50–75th pct" />
                <Area type="monotone" dataKey="band_75_90" stackId="fan" stroke="none" fill="url(#g75_90)" name="75–90th pct" />
                {/* Median line — separate (non-stacked) */}
                <Area
                  type="monotone"
                  dataKey="p50"
                  stroke="#ffffff"
                  strokeWidth={2}
                  fill="none"
                  dot={false}
                  name="Median"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            {[
              { color: 'bg-rose-500/40', label: '10th–25th pct (worst 25%)' },
              { color: 'bg-amber-500/40', label: '25th–50th pct (below median)' },
              { color: 'bg-sky-500/40', label: '50th–75th pct (above median)' },
              { color: 'bg-emerald-500/40', label: '75th–90th pct (best 25%)' },
              { color: 'bg-white', label: 'Median (50th pct)', line: true },
            ].map(({ color, label, line }) => (
              <div key={label} className="flex items-center gap-1.5 text-slate-400">
                {line
                  ? <span className={`h-0.5 w-5 ${color}`} />
                  : <span className={`h-3 w-3 rounded-sm ${color}`} />
                }
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retirement Plan Details */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
        <h2 className="text-base font-bold text-white mb-4">Plan Parameters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { label: "Michael's Retirement Age", value: globals.michaelRetirementAge, color: 'text-sky-400' },
            { label: "Brianna's Retirement Age", value: globals.briannaRetirementAge, color: 'text-violet-400' },
            { label: "Life Expectancy", value: globals.lifeExpectancy, color: 'text-emerald-400' },
            { label: "Safe Withdrawal Rate", value: `${(globals.withdrawalRate * 100).toFixed(1)}%`, color: 'text-amber-400' },
            { label: "Annual Retirement Spend", value: formatCur(retirementExpenses.yearlyAmount), color: 'text-rose-400' },
            { label: "FIRE Number", value: formatCur(fireNumber), color: 'text-white' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700/50">
              <span className="text-slate-400">{label}</span>
              <span className={`font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Retirement;