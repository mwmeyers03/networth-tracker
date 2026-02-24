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
        fill="#cbd5e1"
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
      <div className="bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-700 backdrop-blur-sm">
        <p className="font-bold text-slate-100 mb-2">Year: {label}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} style={{ color: entry.color }} className="font-semibold">
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
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 p-8 rounded-2xl shadow-lg border border-slate-600 flex items-start gap-6 hover:shadow-xl transition-all">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Current Net Worth</p>
            <p className="text-4xl font-extrabold text-slate-100 mt-1">{formatCur(currentNetWorth)}</p>
            <p className="text-xs text-slate-500 mt-2">Starting Position</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-700 p-8 rounded-2xl shadow-lg border border-slate-600 flex items-start gap-6 hover:shadow-xl transition-all">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide">At Retirement</p>
            <p className="text-4xl font-extrabold text-slate-100 mt-1">{formatCur(retirementNetWorth)}</p>
            <p className="text-xs text-slate-500 mt-2">{retirementYear ? `Year ${retirementYear}` : 'N/A'}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-700 p-8 rounded-2xl shadow-lg border border-slate-600 flex items-start gap-6 hover:shadow-xl transition-all">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <BarChart3 size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Growth</p>
            <p className="text-4xl font-extrabold text-slate-100 mt-1">{((retirementNetWorth / currentNetWorth - 1) * 100).toFixed(0)}%</p>
            <p className="text-xs text-slate-500 mt-2">Total Increase</p>
          </div>
        </div>
      </div>

      {/* Main Net Worth Chart */}
      <div className="bg-slate-800/50 p-8 rounded-2xl shadow-lg border border-slate-700 hover:shadow-xl transition-all">
        <div className="mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-1">
            Total Net Worth Trajectory
          </h2>
          <p className="text-slate-400 text-sm">Your wealth growth projection from now until retirement and beyond</p>
        </div>
        <div style={{ height: '450px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={financialData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="gradientNW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#475569" />
              <XAxis 
                dataKey="year" 
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                interval={Math.floor(financialData.length / 8)}
              />
              <YAxis 
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} formatCur={formatCur} />} />
              <Area 
                type="monotone" 
                dataKey="netWorth" 
                stroke="#2563eb" 
                strokeWidth={3}
                fill="url(#gradientNW)"
                dot={false}
              />
              {michaelRetireYear && <ReferenceLine x={michaelRetireYear} stroke="#60a5fa" strokeDasharray="5 5" />}
              {briannaRetireYear && briannaRetireYear !== michaelRetireYear && <ReferenceLine x={briannaRetireYear} stroke="#a78bfa" strokeDasharray="5 5" />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {(michaelRetireYear || briannaRetireYear) && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-300">
            {sameRetireYear ? (
              <div className="flex items-center gap-2">
                <span className="h-2 w-6 rounded-full bg-gradient-to-r from-blue-400 to-purple-400" />
                <span>Retirement (Both) · Year {michaelRetireYear}</span>
              </div>
            ) : (
              <>
                {michaelRetireYear && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-6 rounded-full bg-blue-400" />
                    <span>Michael Retirement · Year {michaelRetireYear}</span>
                  </div>
                )}
                {briannaRetireYear && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-6 rounded-full bg-purple-400" />
                    <span>Brianna Retirement · Year {briannaRetireYear}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Asset Allocation & Income/Expense Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Asset Allocation */}
        <div className="bg-slate-800/50 p-8 rounded-2xl shadow-lg border border-slate-700 hover:shadow-xl transition-all">
          <div className="mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-1">
              Asset Allocation Breakdown
            </h2>
            <p className="text-slate-400 text-sm">Distribution across different investment vehicles</p>
          </div>
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData} margin={{ top: 30, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#475569" />
                <XAxis 
                  dataKey="year" 
                  stroke="#94a3b8"
                  tick={<CustomXAxisTick data={financialData} />}
                  interval={Math.floor(financialData.length / 8)}
                  height={70}
                />
                <YAxis 
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={(props) => <CustomTooltip {...props} formatCur={formatCur} />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px', color: '#cbd5e1' }} />
                <Bar dataKey="total401k" name="Combined 401K" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rothBal" name="Roth IRA" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="brokerageBal" name="Brokerage" stackId="a" fill="#10b981" />
                <Bar dataKey="savingsBal" name="Cash Savings" stackId="a" fill="#f59e0b" radius={[0, 0, 4, 4]} />
                {michaelRetireYear && <ReferenceLine x={michaelRetireYear} stroke="#60a5fa" strokeDasharray="5 5" />}
                {briannaRetireYear && briannaRetireYear !== michaelRetireYear && <ReferenceLine x={briannaRetireYear} stroke="#a78bfa" strokeDasharray="5 5" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income vs Expenses */}
        <div className="bg-slate-800/50 p-8 rounded-2xl shadow-lg border border-slate-700 hover:shadow-xl transition-all">
          <div className="mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent mb-1">
              Income vs Expenses
            </h2>
            <p className="text-slate-400 text-sm">Annual gross income compared to total expenses</p>
          </div>
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={financialData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#475569" />
                <XAxis 
                  dataKey="year" 
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(financialData.length / 8)}
                />
                <YAxis 
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={(props) => <CustomTooltip {...props} formatCur={formatCur} />} />
                <Legend wrapperStyle={{ paddingTop: '20px', color: '#cbd5e1' }} />
                <Line 
                  type="monotone" 
                  dataKey="combinedGross" 
                  name="Gross Income" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="combinedExp" 
                  name="Total Expenses" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  dot={false}
                />
                {michaelRetireYear && <ReferenceLine x={michaelRetireYear} stroke="#60a5fa" strokeDasharray="5 5" />}
                {briannaRetireYear && briannaRetireYear !== michaelRetireYear && <ReferenceLine x={briannaRetireYear} stroke="#a78bfa" strokeDasharray="5 5" />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;