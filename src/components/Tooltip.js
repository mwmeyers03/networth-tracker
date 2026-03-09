import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Tooltip component — shows an info icon; hovering/focusing reveals the tip.
 * Usage: <Tooltip text="Explain this field here" />
 */
const Tooltip = ({ text, children, side = 'top' }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  // Close on click-outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setVisible(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-700',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-700',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-700',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-700',
  };

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children || (
        <button
          type="button"
          aria-label="Info"
          className="text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
          tabIndex={0}
          onClick={() => setVisible((v) => !v)}
        >
          <HelpCircle size={13} />
        </button>
      )}
      {visible && (
        <span
          role="tooltip"
          className={`absolute z-50 ${sideClasses[side]} w-56 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed pointer-events-none`}
        >
          {text}
          <span
            className={`absolute border-4 ${arrowClasses[side]}`}
          />
        </span>
      )}
    </span>
  );
};

export default Tooltip;
