import React from 'react';
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { useData } from '../contexts/DataContext';
import { DollarSign, TrendingUp, BarChart3 } from 'lucide-react';

// Custom X-Axis Tick to show ages
const CustomXAxisTick = (props) => {
  const { x, y, payload, data } = props;
  const year = payload.value;
  const dataPoint = data?.find(d => d.year === year);
  
  if (!dataPoint) return null;
  
  const mAge = Math.floor(dataPoint.michaelAge);
  const bAge = Math.floor(dataPoint.briannaAge);
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={0} 
        y={0} 
        dy={4}
        textAnchor="middle" 
        fill="#64748b"
        fontSize={12}
        fontWeight={500}
      >
        {year}
      </text>
      <text 
        x={0} 
        y={16} 
        textAnchor="middle" 
        fill="#94a3b8"
        fontSize={10}
        fontWeight={400}
      >
        M:{mAge} B:{bAge}
      </text>
    </g>
  );
};

// Custom Tooltip
const CustomTooltip = ({ active, payload, label, formatCur }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-md border border-slate-200">
        <p className="font-semibold text-slate-700 mb-1 text-xs">Year: {label}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} style={{ color: entry.color }} className="text-xs font-medium">
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

  // KPI Cards
  const currentNetWorth = financialData[0]?.netWorth || 0;
  const retirementData = financialData.find(d => d.retired);
  const retirementNetWorth = retirementData?.netWorth || 0;
  const retirementYear = retirementData?.year;

  // Calculate retirement marker years
  const michaelRetireYear = financialData.find(d => d.michaelAge >= globals.michaelRetirementAge)?.year;
  const briannaRetireYear = financialData.find(d => d.briannaAge >= globals.briannaRetirementAge)?.year;
  const sameRetireYear = michaelRetireYear && briannaRetireYear && michaelRetireYear === briannaRetireYear;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-slate-200 flex items-start gap-4">
          <div className="w-10 h-10 bg-sky-50 text-sky-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Current Net Worth</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{formatCur(currentNetWorth)}</p>
            <p className="text-xs text-slate-400 mt-1">Starting Position</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 flex items-start gap-4">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">At Retirement</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{formatCur(retirementNetWorth)}</p>
            <p className="text-xs text-slate-400 mt-1">{retirementYear ? `Year ${retirementYear}` : 'N/A'}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 flex items-start gap-4">
          <div className="w-10 h-10 bg-violet-50 text-violet-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <BarChart3 size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Growth</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{((retirementNetWorth / currentNetWorth - 1) * 100).toFixed(0)}%</p>
            <p className="text-xs text-slate-400 mt-1">Total Increase</p>
          </div>
        </div>
      </div>

      {/* Main Net Worth Chart */}
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-800">Total Net Worth Trajectory</h2>
          <p className="text-slate-400 text-xs mt-0.5">Wealth growth projection from now until retirement and beyond</p>
        </div>
        <div style={{ height: '400px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={financialData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="gradientNW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="year" 
                stroke="#cbd5e1"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                interval={Math.floor(financialData.length / 8)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                stroke="#cbd5e1"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} formatCur={formatCur} />} />
              <Area 
                type="monotone" 
                dataKey="netWorth" 
                stroke="#0ea5e9" 
                strokeWidth={2}
                fill="url(#gradientNW)"
                dot={false}
              />
              {michaelRetireYear && <ReferenceLine x={michaelRetireYear} stroke="#94a3b8" strokeDasharray="4 4" />}
              {briannaRetireYear && briannaRetireYear !== michaelRetireYear && <ReferenceLine x={briannaRetireYear} stroke="#c4b5fd" strokeDasharray="4 4" />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {(michaelRetireYear || briannaRetireYear) && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
            {sameRetireYear ? (
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-5 bg-slate-400" />
                <span>Retirement (Both) · Year {michaelRetireYear}</span>
              </div>
            ) : (
              <>
                {michaelRetireYear && (
                  <div className="flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-slate-400" />
                    <span>Michael · Year {michaelRetireYear}</span>
                  </div>
                )}
                {briannaRetireYear && (
                  <div className="flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-violet-300" />
                    <span>Brianna · Year {briannaRetireYear}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Asset Allocation & Income/Expense Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Allocation */}
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-800">Asset Allocation</h2>
            <p className="text-slate-400 text-xs mt-0.5">Distribution across investment vehicles</p>
          </div>
          <div style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData} margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="year" 
                  stroke="#cbd5e1"
                  tick={<CustomXAxisTick data={financialData} />}
                  interval={Math.floor(financialData.length / 8)}
                  height={70}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  stroke="#cbd5e1"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={(props) => <CustomTooltip {...props} formatCur={formatCur} />} cursor={{ fill: 'rgba(14,165,233,0.05)' }} />
                <Legend wrapperStyle={{ paddingTop: '12px', color: '#64748b', fontSize: '12px' }} />
                <Bar dataKey="total401k" name="Combined 401K" stackId="a" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="rothBal" name="Roth IRA" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="brokerageBal" name="Brokerage" stackId="a" fill="#10b981" />
                <Bar dataKey="savingsBal" name="Cash Savings" stackId="a" fill="#f59e0b" radius={[0, 0, 3, 3]} />
                {michaelRetireYear && <ReferenceLine x={michaelRetireYear} stroke="#94a3b8" strokeDasharray="4 4" />}
                {briannaRetireYear && briannaRetireYear !== michaelRetireYear && <ReferenceLine x={briannaRetireYear} stroke="#c4b5fd" strokeDasharray="4 4" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income vs Expenses */}
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-800">Income vs Expenses</h2>
            <p className="text-slate-400 text-xs mt-0.5">Annual gross income compared to total expenses</p>
          </div>
          <div style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={financialData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="year" 
                  stroke="#cbd5e1"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  interval={Math.floor(financialData.length / 8)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  stroke="#cbd5e1"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={(props) => <CustomTooltip {...props} formatCur={formatCur} />} />
                <Legend wrapperStyle={{ paddingTop: '12px', color: '#64748b', fontSize: '12px' }} />
                <Line 
                  type="monotone" 
                  dataKey="combinedGross" 
                  name="Gross Income" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="combinedExp" 
                  name="Total Expenses" 
                  stroke="#f43f5e" 
                  strokeWidth={2}
                  dot={false}
                />
                {michaelRetireYear && <ReferenceLine x={michaelRetireYear} stroke="#94a3b8" strokeDasharray="4 4" />}
                {briannaRetireYear && briannaRetireYear !== michaelRetireYear && <ReferenceLine x={briannaRetireYear} stroke="#c4b5fd" strokeDasharray="4 4" />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;