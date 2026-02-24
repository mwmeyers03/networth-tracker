import React from 'react';

const PercentageInput = ({ name, value, onChange, ...props }) => {
  const handleFocus = (e) => {
    e.target.select();
  };

  const handleChange = (e) => {
    const { value } = e.target;
    onChange({
      target: {
        name,
        value: parseFloat(value) / 100,
      },
    });
  };

  return (
    <div className="relative">
      <input
        type="number"
        step="1"
        name={name}
        value={Math.round(value * 100)}
        onChange={handleChange}
        onFocus={handleFocus}
        className="w-full p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-8"
        {...props}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
    </div>
  );
};

export default PercentageInput;