import React, { createContext, useState, useMemo, useContext, useCallback, useEffect } from 'react';

const DataContext = createContext();

export const START_YEAR = 2025;

export const useData = () => useContext(DataContext);

// ── localStorage helpers ─────────────────────────────────────────────────────
const LS_PREFIX = 'nwt_';

const loadLS = (key, fallback) => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveLS = (key, value) => {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch { /* quota exceeded or private browsing */ }
};

// ── Default state values ─────────────────────────────────────────────────────
const DEFAULT_GLOBALS = {
  marketReturn: 0.07,
  marketReturnStdDev: 0.15,
  inflationRate: 0.025,
  michaelStartingSalary: 81700,
  briannaStartingSalary: 35000,
  michaelSalaryGrowth: 0.03,
  briannaSalaryGrowth: 0.03,
  michael401kRate: 0.15,
  michael401kMatch: 0.06,
  brianna401kRate: 0.08,
  rothYearlyContrib: 7500,
  brokerageYearlyContrib: 12000,
  michaelRetirementAge: 50,
  briannaRetirementAge: 50,
  lifeExpectancy: 100,
  withdrawalRate: 0.04,
};

const DEFAULT_MICHAEL_EXPENSES = {
  insurance: 220,
  gas: 252,
  food: 200,
  dates: 160,
  rent: 600,
  vacationFund: 200,
};

const DEFAULT_BRIANNA_EXPENSES = {
  insurance: 350,
  gas: 252,
  food: 200,
  car: 600,
  rent: 150,
  vacationFund: 200,
};

// ── Starting account balances for the first projection year ──────────────────
const INITIAL_M401K       = 32980;
const INITIAL_B401K       = 2800;
const INITIAL_ROTH        = 45475;
const INITIAL_BROKERAGE   = 130540;
const INITIAL_SAVINGS     = 10848;

export const DataProvider = ({ children }) => {
  const [globals, setGlobals] = useState(() => ({ ...DEFAULT_GLOBALS, ...loadLS('globals', {}) }));
  const [overrides, setOverrides] = useState(() => loadLS('overrides', {}));
  const [michaelExpenses, setMichaelExpenses] = useState(() => loadLS('michaelExpenses', DEFAULT_MICHAEL_EXPENSES));
  const [briannaExpenses, setBriannaExpenses] = useState(() => loadLS('briannaExpenses', DEFAULT_BRIANNA_EXPENSES));
  const [retirementExpenses, setRetirementExpenses] = useState(() => loadLS('retirementExpenses', { yearlyAmount: 80000 }));

  // Persist every state slice to localStorage whenever it changes
  useEffect(() => { saveLS('globals', globals); }, [globals]);
  useEffect(() => { saveLS('overrides', overrides); }, [overrides]);
  useEffect(() => { saveLS('michaelExpenses', michaelExpenses); }, [michaelExpenses]);
  useEffect(() => { saveLS('briannaExpenses', briannaExpenses); }, [briannaExpenses]);
  useEffect(() => { saveLS('retirementExpenses', retirementExpenses); }, [retirementExpenses]);

  const handleGlobalChange = (e) => {
    const { name, value } = e.target;
    setGlobals(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handleCellEdit = (year, field, value) => {
    const numValue = parseFloat(value);
    setOverrides(prev => ({
      ...prev,
      [year]: { ...prev[year], [field]: isNaN(numValue) ? undefined : numValue }
    }));
  };

  const handleMichaelExpenseChange = (field, value) => {
    setMichaelExpenses(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const handleBriannaExpenseChange = (field, value) => {
    setBriannaExpenses(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const normalizeExpenseKey = (label) => {
    const cleaned = label.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
    if (!cleaned) return '';
    const parts = cleaned.split(/\s+/);
    return parts
      .map((word, index) => {
        const lower = word.toLowerCase();
        if (index === 0) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join('');
  };

  const addMichaelExpenseCategory = (label) => {
    const key = normalizeExpenseKey(label);
    if (!key) return;
    setMichaelExpenses(prev => (prev[key] !== undefined ? prev : { ...prev, [key]: 0 }));
  };

  const addBriannaExpenseCategory = (label) => {
    const key = normalizeExpenseKey(label);
    if (!key) return;
    setBriannaExpenses(prev => (prev[key] !== undefined ? prev : { ...prev, [key]: 0 }));
  };

  const handleRetirementExpenseChange = (value) => {
    setRetirementExpenses({ yearlyAmount: parseFloat(value) || 0 });
  };

  const calculateMichaelExpenses = useCallback(() => Object.values(michaelExpenses).reduce((a, b) => a + b, 0), [michaelExpenses]);
  const calculateBriannaExpenses = useCallback(() => Object.values(briannaExpenses).reduce((a, b) => a + b, 0), [briannaExpenses]);

  const calculateFederalTax = (grossIncome, preTax401k = 0) => {
    const standardDeduction = 15750;
    const incomeAfter401k = grossIncome - preTax401k;
    const taxableIncome = Math.max(0, incomeAfter401k - standardDeduction);
    let tax = 0;
    if (taxableIncome > 626350) tax += (taxableIncome - 626350) * 0.37;
    if (taxableIncome > 250525) tax += (Math.min(taxableIncome, 626350) - 250525) * 0.35;
    if (taxableIncome > 197300) tax += (Math.min(taxableIncome, 250525) - 197300) * 0.32;
    if (taxableIncome > 103350) tax += (Math.min(taxableIncome, 197300) - 103350) * 0.24;
    if (taxableIncome > 48475)  tax += (Math.min(taxableIncome, 103350) - 48475) * 0.22;
    if (taxableIncome > 11925)  tax += (Math.min(taxableIncome, 48475) - 11925) * 0.12;
    if (taxableIncome > 0)      tax += Math.min(taxableIncome, 11925) * 0.10;
    const fica = grossIncome * 0.0765;
    return grossIncome - preTax401k - tax - fica;
  };

  const financialData = useMemo(() => {
    let data = [];
    let prev = null;
    const baseMExp = calculateMichaelExpenses();
    const baseBExp = calculateBriannaExpenses();

    for (let year = START_YEAR; year <= START_YEAR + globals.lifeExpectancy; year++) {
      const o = overrides[year] || {};
      const michaelAge = 22 + (year - 2024);
      const briannaAge = 21 + (year - 2024);
      
      const michaelRetired = michaelAge >= globals.michaelRetirementAge;
      const briannaRetired = briannaAge >= globals.briannaRetirementAge;
      const bothRetired = michaelRetired && briannaRetired;
      
      const mSalary = o.mSalary ?? (michaelRetired ? 0 : (year === START_YEAR ? globals.michaelStartingSalary : (prev?.mSalary || globals.michaelStartingSalary) * (1 + globals.michaelSalaryGrowth)));
      const bSalary = o.bSalary ?? (briannaRetired ? 0 : (year === START_YEAR ? globals.briannaStartingSalary : (prev?.bSalary || globals.briannaStartingSalary) * (1 + globals.briannaSalaryGrowth)));
      
      let mExp, bExp, yearlyExpenses;
      if (bothRetired) {
        yearlyExpenses = retirementExpenses.yearlyAmount;
        mExp = 0; 
        bExp = 0;
      } else {
        mExp = o.mExp ?? (year === START_YEAR ? baseMExp : (prev?.mExp || baseMExp) * (1 + globals.inflationRate));
        bExp = o.bExp ?? (year === START_YEAR ? baseBExp : (prev?.bExp || baseBExp) * (1 + globals.inflationRate));
        yearlyExpenses = (mExp + bExp) * 12;
      }

      // ── Get initial balances from the PREVIOUS year's final values ──────────
      // Fix: m401kBal and b401kBal are now stored individually in `current`, so
      // prev.m401kBal / prev.b401kBal correctly carries the balance forward.
      const m401kInitial = year === START_YEAR ? INITIAL_M401K     : (prev?.m401kBal ?? 0);
      const b401kInitial = year === START_YEAR ? INITIAL_B401K     : (prev?.b401kBal ?? 0);

      // Apply market returns first
      let m401kBal    = m401kInitial * (1 + globals.marketReturn);
      let b401kBal    = b401kInitial * (1 + globals.marketReturn);
      let rothBal     = (year === START_YEAR ? INITIAL_ROTH      : (prev?.rothBal      ?? 0)) * (1 + globals.marketReturn);
      let brokerageBal= (year === START_YEAR ? INITIAL_BROKERAGE : (prev?.brokerageBal ?? 0)) * (1 + globals.marketReturn);
      let savingsBal  =  year === START_YEAR ? INITIAL_SAVINGS   : (prev?.savingsBal   ?? 0);
      
      let withdrawalAmount = 0;
      let liquidityGap = 0;
      
      if (!bothRetired) {
        const m401kAdded = mSalary > 0 ? (mSalary * globals.michael401kRate) + (mSalary * globals.michael401kMatch) : 0;
        const b401kAdded = bSalary > 0 ? (bSalary * globals.brianna401kRate) : 0;
        
        m401kBal += m401kAdded;
        b401kBal += b401kAdded;
        rothBal += globals.rothYearlyContrib;
        brokerageBal += globals.brokerageYearlyContrib;
        
        const mTakeHome = mSalary > 0 ? calculateFederalTax(mSalary, m401kAdded) : 0;
        const bTakeHome = bSalary > 0 ? calculateFederalTax(bSalary, b401kAdded) : 0;
        
        const mSavingsContrib = mTakeHome - (mExp*12) - (globals.rothYearlyContrib / 2) - (globals.brokerageYearlyContrib / 2);
        const bSavingsContrib = bTakeHome - (bExp*12) - (globals.rothYearlyContrib / 2) - (globals.brokerageYearlyContrib / 2);
        
        savingsBal += mSavingsContrib + bSavingsContrib;
      } else {
        let needed = yearlyExpenses;
        
        if (savingsBal >= needed) {
          savingsBal -= needed;
          needed = 0;
        } else {
          needed -= savingsBal;
          savingsBal = 0;
        }
        
        if (needed > 0 && brokerageBal > 0) {
          const take = Math.min(brokerageBal, needed);
          brokerageBal -= take;
          needed -= take;
        }
        
        if (needed > 0) {
          if (michaelAge >= 59.5 && m401kBal > 0) {
            const take = Math.min(m401kBal, needed);
            m401kBal -= take;
            needed -= take;
          }
          if (needed > 0 && briannaAge >= 59.5 && b401kBal > 0) {
            const take = Math.min(b401kBal, needed);
            b401kBal -= take;
            needed -= take;
          }
        }
        
        if (needed > 0 && (michaelAge >= 59.5 || briannaAge >= 59.5) && rothBal > 0) {
          const take = Math.min(rothBal, needed);
          rothBal -= take;
          needed -= take;
        }
        
        if (needed > 0) {
          savingsBal -= needed;
          liquidityGap = needed;
        }
      }
      
      m401kBal = Math.max(0, m401kBal);
      b401kBal = Math.max(0, b401kBal);
      rothBal = Math.max(0, rothBal);
      brokerageBal = Math.max(0, brokerageBal);

      // ── Apply overrides as FINAL values (after returns & contributions) ─────
      // Fix: overrides now represent the displayed ending balance, not an initial
      // balance. This prevents the ~$20-30K inflation that occurred when a user
      // clicked a cell and clicked away without changing anything.
      if (o.total401kBal !== undefined) {
        const totalInit = m401kInitial + b401kInitial;
        const mRatio = totalInit > 0 ? m401kInitial / totalInit : INITIAL_M401K / (INITIAL_M401K + INITIAL_B401K);
        m401kBal = Math.max(0, o.total401kBal) * mRatio;
        b401kBal = Math.max(0, o.total401kBal) * (1 - mRatio);
      }
      if (o.rothBal      !== undefined) rothBal      = Math.max(0, o.rothBal);
      if (o.brokerageBal !== undefined) brokerageBal = Math.max(0, o.brokerageBal);
      if (o.savingsBal   !== undefined) savingsBal   = o.savingsBal; // allow negative (debt)

      const current = { 
        year, 
        michaelAge: Math.round(michaelAge * 10) / 10,
        briannaAge: Math.round(briannaAge * 10) / 10,
        mSalary, 
        bSalary, 
        combinedGross: mSalary + bSalary, 
        mExp,
        bExp,
        combinedExp: yearlyExpenses,
        // Store individual 401k balances so the next iteration can read them via prev
        m401kBal,
        b401kBal,
        total401k: m401kBal + b401kBal, 
        rothBal, 
        brokerageBal, 
        savingsBal, 
        netWorth: m401kBal + b401kBal + rothBal + brokerageBal + savingsBal,
        retired: bothRetired,
        withdrawalAmount,
        liquidityGap
      };
      data.push(current);
      prev = current;
    }
    return data;
  }, [globals, overrides, calculateMichaelExpenses, calculateBriannaExpenses, retirementExpenses]);

  const runMonteCarloSimulation = useCallback((numSimulations = 1000, withdrawalRateOverride = null) => {
    const baseMExp = calculateMichaelExpenses();
    const baseBExp = calculateBriannaExpenses();
    const results = [];

    // Track per-year portfolio totals across simulations (retirement phase only)
    const yearlyPortfolios = {};

    const normalRandom = () => {
      const u1 = Math.random();
      const u2 = Math.random();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };
    
    for (let sim = 0; sim < numSimulations; sim++) {
      let m401k = INITIAL_M401K, b401k = INITIAL_B401K, roth = INITIAL_ROTH, brokerage = INITIAL_BROKERAGE, savings = INITIAL_SAVINGS;
      let mSal = globals.michaelStartingSalary;
      let bSal = globals.briannaStartingSalary;
      let survived = true;
      const endYears = [];
      let retirementYear = null;
      let initialRetirementExpense = 0;
      
      for (let year = START_YEAR; year <= START_YEAR + globals.lifeExpectancy; year++) {
        const michaelAge = 22 + (year - 2024);
        const briannaAge = 21 + (year - 2024);
        const michaelRetired = michaelAge >= globals.michaelRetirementAge;
        const briannaRetired = briannaAge >= globals.briannaRetirementAge;
        const bothRetired = michaelRetired && briannaRetired;
        
        const randomReturn = normalRandom() * globals.marketReturnStdDev + globals.marketReturn;
        
        m401k *= (1 + randomReturn);
        b401k *= (1 + randomReturn);
        roth *= (1 + randomReturn);
        brokerage *= (1 + randomReturn);
        
        if (!bothRetired) {
          if(!michaelRetired) mSal *= (1 + globals.michaelSalaryGrowth);
          else mSal = 0;
          if(!briannaRetired) bSal *= (1 + globals.briannaSalaryGrowth);
          else bSal = 0;

          if (!michaelRetired) {
            const m401kAdded = (mSal * globals.michael401kRate) + (mSal * globals.michael401kMatch);
            m401k += m401kAdded;
            const mTakeHome = calculateFederalTax(mSal, m401kAdded);
            const mSavings = mTakeHome - (baseMExp * 12 * (1 + globals.inflationRate) ** (year - START_YEAR)) - (globals.rothYearlyContrib / 2) - (globals.brokerageYearlyContrib / 2);
            savings += mSavings;
          }
          if (!briannaRetired) {
            const b401kAdded = bSal * globals.brianna401kRate;
            b401k += b401kAdded;
            const bTakeHome = calculateFederalTax(bSal, b401kAdded);
            const bSavings = bTakeHome - (baseBExp * 12 * (1 + globals.inflationRate) ** (year - START_YEAR)) - (globals.brokerageYearlyContrib / 2);
            savings += bSavings;
          }

          roth += globals.rothYearlyContrib;
          brokerage += globals.brokerageYearlyContrib;

        } else {
          if (retirementYear === null) {
            retirementYear = year;
            if (withdrawalRateOverride !== null) {
              const totalPortfolio = m401k + b401k + roth + brokerage + savings;
              initialRetirementExpense = totalPortfolio * withdrawalRateOverride;
            } else {
              initialRetirementExpense = retirementExpenses.yearlyAmount;
            }
          }

          let currentYearExpense;
          if (withdrawalRateOverride !== null) {
             currentYearExpense = initialRetirementExpense * (1 + globals.inflationRate) ** (year - retirementYear);
          } else {
             currentYearExpense = retirementExpenses.yearlyAmount * (1 + globals.inflationRate) ** (year - START_YEAR);
          }

          let needed = currentYearExpense;
          
          if (savings >= needed) {
            savings -= needed;
            needed = 0;
          } else {
            needed -= savings;
            savings = 0;
          }
          
          if (needed > 0 && brokerage > 0) {
            const take = Math.min(brokerage, needed);
            brokerage -= take;
            needed -= take;
          }
          
          if (needed > 0) {
            const total401k = m401k + b401k;
            if (total401k > 0) {
               const penalty = (michaelAge < 59.5 && briannaAge < 59.5) ? 0.10 : 0;
               const grossNeeded = needed / (1 - penalty);
               const takeGross = Math.min(total401k, grossNeeded);
               const netReceived = takeGross * (1 - penalty);
               
               if (m401k >= takeGross) m401k -= takeGross;
               else {
                 const rem = takeGross - m401k;
                 m401k = 0;
                 b401k -= rem;
               }
               needed -= netReceived;
            }
          }
          
          if (needed > 0 && roth > 0) {
             const penalty = (michaelAge < 59.5 && briannaAge < 59.5) ? 0.10 : 0;
             const grossNeeded = needed / (1 - penalty);
             const takeGross = Math.min(roth, grossNeeded);
             const netReceived = takeGross * (1 - penalty);
             roth -= takeGross;
             needed -= netReceived;
          }

          // Record portfolio value for this year if still surviving
          if (survived) {
            const total = m401k + b401k + roth + brokerage + savings;
            if (!yearlyPortfolios[year]) yearlyPortfolios[year] = [];
            yearlyPortfolios[year].push(Math.max(0, total));
          }
          
          if (needed > 100) {
             survived = false;
             endYears.push(year);
             break;
          }
        }
        
        m401k = Math.max(0, m401k);
        b401k = Math.max(0, b401k);
        roth = Math.max(0, roth);
        brokerage = Math.max(0, brokerage);
        savings = Math.max(0, savings);
        
      }
      
      results.push({ survived, finalYear: endYears[0] || START_YEAR + globals.lifeExpectancy });
    }
    
    const successCount = results.filter(r => r.survived).length;
    const successRate = (successCount / numSimulations) * 100;
    const avgFinalYear = results.reduce((a, b) => a + b.finalYear, 0) / numSimulations;

    // Compute year-by-year percentile bands for the fan chart
    const percentileData = Object.entries(yearlyPortfolios)
      .map(([year, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        const pct = (p) => sorted[Math.min(Math.floor(p * n), n - 1)] ?? 0;
        return {
          year: parseInt(year),
          p10: Math.max(0, pct(0.10)),
          p25: Math.max(0, pct(0.25)),
          p50: Math.max(0, pct(0.50)),
          p75: Math.max(0, pct(0.75)),
          p90: Math.max(0, pct(0.90)),
        };
      })
      .sort((a, b) => a.year - b.year);

    // Compute failure decade distribution
    const failuresByDecade = {};
    results.filter(r => !r.survived).forEach(r => {
      const decade = Math.floor((r.finalYear - START_YEAR) / 10) * 10;
      failuresByDecade[decade] = (failuresByDecade[decade] || 0) + 1;
    });

    // Median ending portfolio (from surviving sims)
    const survivingFinals = results
      .filter(r => r.survived)
      .map(r => {
        const lastYear = START_YEAR + globals.lifeExpectancy;
        const vals = yearlyPortfolios[lastYear];
        return vals ? vals[Math.floor(vals.length / 2)] : 0;
      });
    const medianFinalPortfolio = survivingFinals.length > 0
      ? [...survivingFinals].sort((a, b) => a - b)[Math.floor(survivingFinals.length / 2)]
      : 0;

    return {
      successRate,
      successCount,
      numSimulations,
      avgFinalYear,
      percentileData,
      failuresByDecade,
      medianFinalPortfolio,
      allResults: results,
    };
  }, [calculateMichaelExpenses, calculateBriannaExpenses, globals, retirementExpenses]);

  const monteCarloBaseline = useMemo(() => runMonteCarloSimulation(1000, null), [runMonteCarloSimulation]);
  const monteCarloConservative = useMemo(() => runMonteCarloSimulation(1000, 0.03), [runMonteCarloSimulation]);
  const monteCarloAggressive = useMemo(() => runMonteCarloSimulation(1000, 0.05), [runMonteCarloSimulation]);

  const value = {
    globals,
    overrides,
    michaelExpenses,
    briannaExpenses,
    retirementExpenses,
    handleGlobalChange,
    handleCellEdit,
    handleMichaelExpenseChange,
    handleBriannaExpenseChange,
    addMichaelExpenseCategory,
    addBriannaExpenseCategory,
    handleRetirementExpenseChange,
    calculateMichaelExpenses,
    calculateBriannaExpenses,
    financialData,
    runMonteCarloSimulation,
    monteCarloBaseline,
    monteCarloConservative,
    monteCarloAggressive,
    formatCur: (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val),
    formatLabel: (str) => {
      const formatted = str.replace(/([A-Z])/g, ' $1');
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};