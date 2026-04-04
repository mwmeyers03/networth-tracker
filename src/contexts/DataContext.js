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

const GLOBAL_KEYS = new Set(Object.keys(DEFAULT_GLOBALS));
const OVERRIDE_KEYS = new Set([
  'mSalary',
  'bSalary',
  'mExp',
  'bExp',
  'total401kBal',
  'rothBal',
  'brokerageBal',
  'savingsBal',
]);

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

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

  const applyAIPatch = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') {
      return {
        applied: false,
        counts: { globals: 0, michaelExpenses: 0, briannaExpenses: 0, retirementExpenses: 0, overrides: 0 },
      };
    }

    const normalizedGlobals = {};
    const normalizedMichaelExpenses = {};
    const normalizedBriannaExpenses = {};
    const normalizedOverrides = {};
    let normalizedRetirementYearly = null;

    if (patch.globals && typeof patch.globals === 'object') {
      for (const [key, value] of Object.entries(patch.globals)) {
        if (!GLOBAL_KEYS.has(key)) continue;
        const num = toFiniteNumber(value);
        if (num === null) continue;
        normalizedGlobals[key] = num;
      }
    }

    if (patch.michaelExpenses && typeof patch.michaelExpenses === 'object') {
      for (const [label, value] of Object.entries(patch.michaelExpenses)) {
        const key = normalizeExpenseKey(label);
        const num = toFiniteNumber(value);
        if (!key || num === null) continue;
        normalizedMichaelExpenses[key] = num;
      }
    }

    if (patch.briannaExpenses && typeof patch.briannaExpenses === 'object') {
      for (const [label, value] of Object.entries(patch.briannaExpenses)) {
        const key = normalizeExpenseKey(label);
        const num = toFiniteNumber(value);
        if (!key || num === null) continue;
        normalizedBriannaExpenses[key] = num;
      }
    }

    if (typeof patch.retirementExpenses === 'number') {
      normalizedRetirementYearly = toFiniteNumber(patch.retirementExpenses);
    } else if (
      patch.retirementExpenses &&
      typeof patch.retirementExpenses === 'object' &&
      patch.retirementExpenses.yearlyAmount !== undefined
    ) {
      normalizedRetirementYearly = toFiniteNumber(patch.retirementExpenses.yearlyAmount);
    }

    if (patch.overrides && typeof patch.overrides === 'object') {
      const maxYear = START_YEAR + Math.max(globals.lifeExpectancy, 1);
      for (const [yearKey, fields] of Object.entries(patch.overrides)) {
        const year = parseInt(yearKey, 10);
        if (!Number.isInteger(year) || year < START_YEAR || year > maxYear) continue;
        if (!fields || typeof fields !== 'object') continue;

        const yearPatch = {};
        for (const [field, value] of Object.entries(fields)) {
          if (!OVERRIDE_KEYS.has(field)) continue;
          const num = toFiniteNumber(value);
          if (num === null) continue;
          yearPatch[field] = num;
        }

        if (Object.keys(yearPatch).length > 0) {
          normalizedOverrides[year] = yearPatch;
        }
      }
    }

    if (Object.keys(normalizedGlobals).length > 0) {
      setGlobals(prev => ({ ...prev, ...normalizedGlobals }));
    }

    if (Object.keys(normalizedMichaelExpenses).length > 0) {
      setMichaelExpenses(prev => ({ ...prev, ...normalizedMichaelExpenses }));
    }

    if (Object.keys(normalizedBriannaExpenses).length > 0) {
      setBriannaExpenses(prev => ({ ...prev, ...normalizedBriannaExpenses }));
    }

    if (normalizedRetirementYearly !== null) {
      setRetirementExpenses({ yearlyAmount: normalizedRetirementYearly });
    }

    if (Object.keys(normalizedOverrides).length > 0) {
      setOverrides(prev => {
        const next = { ...prev };
        for (const [year, yearPatch] of Object.entries(normalizedOverrides)) {
          next[year] = { ...(next[year] || {}), ...yearPatch };
        }
        return next;
      });
    }

    const counts = {
      globals: Object.keys(normalizedGlobals).length,
      michaelExpenses: Object.keys(normalizedMichaelExpenses).length,
      briannaExpenses: Object.keys(normalizedBriannaExpenses).length,
      retirementExpenses: normalizedRetirementYearly !== null ? 1 : 0,
      overrides: Object.values(normalizedOverrides).reduce((sum, fields) => sum + Object.keys(fields).length, 0),
    };

    const total =
      counts.globals +
      counts.michaelExpenses +
      counts.briannaExpenses +
      counts.retirementExpenses +
      counts.overrides;

    return { applied: total > 0, counts };
  }, [globals.lifeExpectancy]);

  const handleRetirementExpenseChange = (value) => {
    setRetirementExpenses({ yearlyAmount: parseFloat(value) || 0 });
  };

  const calculateMichaelExpenses = useCallback(() => Object.values(michaelExpenses).reduce((a, b) => a + b, 0), [michaelExpenses]);
  const calculateBriannaExpenses = useCallback(() => Object.values(briannaExpenses).reduce((a, b) => a + b, 0), [briannaExpenses]);

  const calculateFederalTax = useCallback((grossIncome, preTax401k = 0) => {
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
  }, []);

  const projectFinancials = useCallback(({
    scenarioGlobals = globals,
    scenarioRetirementExpenses = retirementExpenses,
    scenarioInflationShockRate = null,
    scenarioInflationShockYears = 0,
  } = {}) => {
    let data = [];
    let prev = null;
    const baseMExp = calculateMichaelExpenses();
    const baseBExp = calculateBriannaExpenses();

    for (let year = START_YEAR; year <= START_YEAR + scenarioGlobals.lifeExpectancy; year++) {
      const o = overrides[year] || {};
      const michaelAge = 22 + (year - 2024);
      const briannaAge = 21 + (year - 2024);

      const michaelRetired = michaelAge >= scenarioGlobals.michaelRetirementAge;
      const briannaRetired = briannaAge >= scenarioGlobals.briannaRetirementAge;
      const bothRetired = michaelRetired && briannaRetired;

      const mSalary = o.mSalary ?? (
        michaelRetired
          ? 0
          : (year === START_YEAR
            ? scenarioGlobals.michaelStartingSalary
            : (prev?.mSalary || scenarioGlobals.michaelStartingSalary) * (1 + scenarioGlobals.michaelSalaryGrowth))
      );
      const bSalary = o.bSalary ?? (
        briannaRetired
          ? 0
          : (year === START_YEAR
            ? scenarioGlobals.briannaStartingSalary
            : (prev?.bSalary || scenarioGlobals.briannaStartingSalary) * (1 + scenarioGlobals.briannaSalaryGrowth))
      );

      const yearOffset = year - START_YEAR;
      const inflationForYear = (
        scenarioInflationShockRate !== null &&
        yearOffset > 0 &&
        yearOffset <= scenarioInflationShockYears
      )
        ? scenarioInflationShockRate
        : scenarioGlobals.inflationRate;

      let mExp;
      let bExp;
      let yearlyExpenses;
      if (bothRetired) {
        yearlyExpenses = scenarioRetirementExpenses.yearlyAmount;
        mExp = 0;
        bExp = 0;
      } else {
        mExp = o.mExp ?? (
          year === START_YEAR
            ? baseMExp
            : (prev?.mExp || baseMExp) * (1 + inflationForYear)
        );
        bExp = o.bExp ?? (
          year === START_YEAR
            ? baseBExp
            : (prev?.bExp || baseBExp) * (1 + inflationForYear)
        );
        yearlyExpenses = (mExp + bExp) * 12;
      }

      const m401kInitial = year === START_YEAR ? INITIAL_M401K : (prev?.m401kBal ?? 0);
      const b401kInitial = year === START_YEAR ? INITIAL_B401K : (prev?.b401kBal ?? 0);

      let m401kBal = m401kInitial * (1 + scenarioGlobals.marketReturn);
      let b401kBal = b401kInitial * (1 + scenarioGlobals.marketReturn);
      let rothBal = (year === START_YEAR ? INITIAL_ROTH : (prev?.rothBal ?? 0)) * (1 + scenarioGlobals.marketReturn);
      let brokerageBal = (year === START_YEAR ? INITIAL_BROKERAGE : (prev?.brokerageBal ?? 0)) * (1 + scenarioGlobals.marketReturn);
      let savingsBal = year === START_YEAR ? INITIAL_SAVINGS : (prev?.savingsBal ?? 0);

      let withdrawalAmount = 0;
      let liquidityGap = 0;

      if (!bothRetired) {
        const m401kAdded = mSalary > 0
          ? (mSalary * scenarioGlobals.michael401kRate) + (mSalary * scenarioGlobals.michael401kMatch)
          : 0;
        const b401kAdded = bSalary > 0 ? (bSalary * scenarioGlobals.brianna401kRate) : 0;

        m401kBal += m401kAdded;
        b401kBal += b401kAdded;
        rothBal += scenarioGlobals.rothYearlyContrib;
        brokerageBal += scenarioGlobals.brokerageYearlyContrib;

        const mTakeHome = mSalary > 0 ? calculateFederalTax(mSalary, m401kAdded) : 0;
        const bTakeHome = bSalary > 0 ? calculateFederalTax(bSalary, b401kAdded) : 0;

        const mSavingsContrib = mTakeHome - (mExp * 12) - (scenarioGlobals.rothYearlyContrib / 2) - (scenarioGlobals.brokerageYearlyContrib / 2);
        const bSavingsContrib = bTakeHome - (bExp * 12) - (scenarioGlobals.rothYearlyContrib / 2) - (scenarioGlobals.brokerageYearlyContrib / 2);

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

      if (o.total401kBal !== undefined) {
        const totalInit = m401kInitial + b401kInitial;
        const mRatio = totalInit > 0 ? m401kInitial / totalInit : INITIAL_M401K / (INITIAL_M401K + INITIAL_B401K);
        m401kBal = Math.max(0, o.total401kBal) * mRatio;
        b401kBal = Math.max(0, o.total401kBal) * (1 - mRatio);
      }
      if (o.rothBal !== undefined) rothBal = Math.max(0, o.rothBal);
      if (o.brokerageBal !== undefined) brokerageBal = Math.max(0, o.brokerageBal);
      if (o.savingsBal !== undefined) savingsBal = o.savingsBal;

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
        m401kBal,
        b401kBal,
        total401k: m401kBal + b401kBal,
        rothBal,
        brokerageBal,
        savingsBal,
        netWorth: m401kBal + b401kBal + rothBal + brokerageBal + savingsBal,
        retired: bothRetired,
        withdrawalAmount,
        liquidityGap,
      };

      data.push(current);
      prev = current;
    }

    return data;
  }, [
    globals,
    overrides,
    calculateMichaelExpenses,
    calculateBriannaExpenses,
    retirementExpenses,
    calculateFederalTax,
  ]);

  const financialData = useMemo(() => {
    return projectFinancials();
  }, [projectFinancials]);

  const summarizeProjection = useCallback((rows, activeGlobals, activeRetirementExpenses) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        startYear: null,
        endYear: null,
        retirementYear: null,
        retirementNetWorth: null,
        peakNetWorth: null,
        peakYear: null,
        endNetWorth: null,
        minNetWorth: null,
        minYear: null,
        firstLiquidityGapYear: null,
        firstNonPositiveNetWorthYear: null,
        withdrawalCoverageRatio: null,
      };
    }

    const first = rows[0];
    const last = rows[rows.length - 1];
    const retirement = rows.find((row) => row.retired) || null;
    const peak = rows.reduce((acc, row) => (row.netWorth > acc.netWorth ? row : acc), rows[0]);
    const trough = rows.reduce((acc, row) => (row.netWorth < acc.netWorth ? row : acc), rows[0]);
    const liquidityGapRow = rows.find((row) => Number(row.liquidityGap || 0) > 0) || null;
    const nonPositiveNetWorthRow = rows.find((row) => Number(row.netWorth || 0) <= 0) || null;

    const retirementIncomeEstimate = retirement
      ? retirement.netWorth * Number(activeGlobals.withdrawalRate || 0)
      : null;
    const withdrawalCoverageRatio = (
      retirementIncomeEstimate !== null &&
      Number(activeRetirementExpenses?.yearlyAmount || 0) > 0
    )
      ? retirementIncomeEstimate / Number(activeRetirementExpenses.yearlyAmount)
      : null;

    return {
      startYear: first.year,
      startNetWorth: first.netWorth,
      endYear: last.year,
      endNetWorth: last.netWorth,
      retirementYear: retirement?.year ?? null,
      retirementNetWorth: retirement?.netWorth ?? null,
      peakNetWorth: peak.netWorth,
      peakYear: peak.year,
      minNetWorth: trough.netWorth,
      minYear: trough.year,
      firstLiquidityGapYear: liquidityGapRow?.year ?? null,
      firstNonPositiveNetWorthYear: nonPositiveNetWorthRow?.year ?? null,
      withdrawalCoverageRatio,
    };
  }, []);

  const evaluateScenario = useCallback((scenario = {}) => {
    const scenarioGlobals = { ...globals };
    const scenarioRetirementExpenses = { ...retirementExpenses };

    const inflationRate = toFiniteNumber(scenario.inflationRate);
    const inflationShockRate = toFiniteNumber(scenario.inflationShockRate);
    const inflationShockYearsRaw = toFiniteNumber(scenario.inflationShockYears);
    const inflationShockYears = inflationShockYearsRaw !== null
      ? Math.max(0, Math.floor(inflationShockYearsRaw))
      : 0;

    const michaelRetirementAge = toFiniteNumber(scenario.michaelRetirementAge);
    const briannaRetirementAge = toFiniteNumber(scenario.briannaRetirementAge);
    const withdrawalRate = toFiniteNumber(scenario.withdrawalRate);
    const marketReturn = toFiniteNumber(scenario.marketReturn);
    const retirementYearlyAmount = toFiniteNumber(scenario.retirementYearlyAmount);

    if (inflationRate !== null) scenarioGlobals.inflationRate = inflationRate;
    if (michaelRetirementAge !== null) scenarioGlobals.michaelRetirementAge = michaelRetirementAge;
    if (briannaRetirementAge !== null) scenarioGlobals.briannaRetirementAge = briannaRetirementAge;
    if (withdrawalRate !== null) scenarioGlobals.withdrawalRate = withdrawalRate;
    if (marketReturn !== null) scenarioGlobals.marketReturn = marketReturn;
    if (retirementYearlyAmount !== null) scenarioRetirementExpenses.yearlyAmount = retirementYearlyAmount;

    const scenarioRows = projectFinancials({
      scenarioGlobals,
      scenarioRetirementExpenses,
      scenarioInflationShockRate: inflationShockRate,
      scenarioInflationShockYears: inflationShockYears,
    });

    const baselineSummary = summarizeProjection(financialData, globals, retirementExpenses);
    const scenarioSummary = summarizeProjection(scenarioRows, scenarioGlobals, scenarioRetirementExpenses);

    const baselinePreview = financialData.slice(0, 18).map((row) => ({
      year: row.year,
      netWorth: Math.round(row.netWorth),
      combinedExp: Math.round(row.combinedExp),
      combinedGross: Math.round(row.combinedGross),
      liquidityGap: Math.round(row.liquidityGap || 0),
      retired: !!row.retired,
    }));

    const comparisonSeries = scenarioRows.map((row, index) => {
      const baseRow = financialData[index] || null;

      return {
        year: row.year,
        baselineNetWorth: baseRow ? Math.round(baseRow.netWorth) : null,
        scenarioNetWorth: Math.round(row.netWorth),
        baselineIncome: baseRow ? Math.round(baseRow.combinedGross) : null,
        scenarioIncome: Math.round(row.combinedGross),
        baselineExpenses: baseRow ? Math.round(baseRow.combinedExp) : null,
        scenarioExpenses: Math.round(row.combinedExp),
        baselineLiquidityGap: baseRow ? Math.round(baseRow.liquidityGap || 0) : null,
        scenarioLiquidityGap: Math.round(row.liquidityGap || 0),
        baselineCash: baseRow ? Math.round(baseRow.savingsBal || 0) : null,
        scenarioCash: Math.round(row.savingsBal || 0),
        retired: !!row.retired,
      };
    });

    const baselineRetirementRow = financialData.find((row) => row.retired) || financialData[financialData.length - 1] || null;
    const scenarioRetirementRow = scenarioRows.find((row) => row.retired) || scenarioRows[scenarioRows.length - 1] || null;

    const allocationComparison = [
      {
        bucket: '401K',
        baseline: baselineRetirementRow ? Math.round(baselineRetirementRow.total401k || 0) : null,
        scenario: scenarioRetirementRow ? Math.round(scenarioRetirementRow.total401k || 0) : null,
      },
      {
        bucket: 'Roth',
        baseline: baselineRetirementRow ? Math.round(baselineRetirementRow.rothBal || 0) : null,
        scenario: scenarioRetirementRow ? Math.round(scenarioRetirementRow.rothBal || 0) : null,
      },
      {
        bucket: 'Brokerage',
        baseline: baselineRetirementRow ? Math.round(baselineRetirementRow.brokerageBal || 0) : null,
        scenario: scenarioRetirementRow ? Math.round(scenarioRetirementRow.brokerageBal || 0) : null,
      },
      {
        bucket: 'Cash',
        baseline: baselineRetirementRow ? Math.round(baselineRetirementRow.savingsBal || 0) : null,
        scenario: scenarioRetirementRow ? Math.round(scenarioRetirementRow.savingsBal || 0) : null,
      },
    ];

    return {
      inputs: {
        inflationRate,
        inflationShockRate,
        inflationShockYears,
        michaelRetirementAge,
        briannaRetirementAge,
        withdrawalRate,
        marketReturn,
        retirementYearlyAmount,
      },
      baseline: baselineSummary,
      scenario: scenarioSummary,
      baselinePreview,
      scenarioPreview: scenarioRows.slice(0, 18).map((row) => ({
        year: row.year,
        netWorth: Math.round(row.netWorth),
        combinedExp: Math.round(row.combinedExp),
        combinedGross: Math.round(row.combinedGross),
        liquidityGap: Math.round(row.liquidityGap || 0),
        retired: !!row.retired,
      })),
      comparisonSeries,
      allocationComparison,
    };
  }, [
    globals,
    retirementExpenses,
    projectFinancials,
    summarizeProjection,
    financialData,
  ]);

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
  }, [calculateMichaelExpenses, calculateBriannaExpenses, calculateFederalTax, globals, retirementExpenses]);

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
    applyAIPatch,
    handleRetirementExpenseChange,
    calculateMichaelExpenses,
    calculateBriannaExpenses,
    financialData,
    runMonteCarloSimulation,
    evaluateScenario,
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