import React from 'react';

const Header = ({ activeTab, setActiveTab }) => {
  const navItems = ['dashboard', 'assumptions', 'expenses', 'retirement'];

  return (
    <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Net Worth Tracker
              </h1>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navItems.map((item) => (
                <button
                  key={item}
                  onClick={() => setActiveTab(item)}
                  className={`capitalize px-3 py-2 rounded-md text-sm font-medium ${
                    activeTab === item
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;