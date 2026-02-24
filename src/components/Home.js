import React from 'react';
import Dashboard from './Dashboard';

const Home = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-slate-200/50">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
          Financial Dashboard
        </h2>
        <p className="text-slate-600 max-w-2xl">
          Welcome to your financial dashboard. Here you can track your net worth, assets, and progress towards financial independence.
        </p>
      </div>
      <Dashboard />
    </div>
  );
};

export default Home;