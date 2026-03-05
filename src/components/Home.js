import React from 'react';
import Dashboard from './Dashboard';

const Home = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">
          Financial Dashboard
        </h2>
        <p className="text-slate-500 text-sm max-w-2xl">
          Track your net worth, assets, and progress towards financial independence.
        </p>
      </div>
      <Dashboard />
    </div>
  );
};

export default Home;