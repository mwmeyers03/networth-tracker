import React from 'react';

const Header = ({ activeTab, setActiveTab }) => {
  const navItems = ['dashboard', 'assumptions', 'expenses', 'retirement'];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex-shrink-0">
            <h1 className="text-lg font-semibold text-slate-800">
              Net Worth Tracker
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-1 h-full">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => setActiveTab(item)}
                className={`capitalize px-3 h-full text-sm font-medium border-b-2 transition-colors ${
                  activeTab === item
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;