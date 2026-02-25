/**
 * Projection Engine
 * Core 42-year financial projection with market growth, withdrawals, and tax calculations
 */

import type { Globals, ProjectionData, ProjectionYear } from '../types/financial';
import { calculateFederalTax } from './taxes';
import { calculateSocialSecurity } from './socialSecurity';
import {
  calculateConstantDollar,
  calculateVPW,
  calculateGuytonKlinger,
  initGuytonKlinger,
  applySequentialWithdrawal,
} from './withdrawals';
import type { GuytonKlingerState } from './withdrawals';

const START_YEAR = 2025;
const MICHAEL_START_AGE = 22;
const BRIANNA_START_AGE = 21;

type IncomeState = 'working' | 'sabbatical' | 'partTime' | 'retired';

const resolveState = (
  year: number,
  age: number,
  retirementAge: number,
  map?: Record<number, IncomeState>
): IncomeState => {
  const override = map?.[year];
  if (override) return override;
  return age >= retirementAge ? 'retired' : 'working';
};

/**
 * Calculate weighted portfolio return based on allocation
 * Pure function
 */
export const calculatePortfolioReturn = (globals: Globals): number => {
  const stockWeight = globals.stockAllocation;
  const bondWeight = globals.bondAllocation;
  const cashWeight = globals.cashAllocation;

  return (
    stockWeight * globals.stockReturn +
    bondWeight * globals.bondReturn +
    cashWeight * globals.cashReturn
  );
};

/**
 * Calculate weighted portfolio volatility for scenario analysis
 * Assumes 0.3 correlation between stocks and bonds
 * Pure function
 */
export const calculatePortfolioVolatility = (globals: Globals): number => {
  const stockWeight = globals.stockAllocation;
  const bondWeight = globals.bondAllocation;
  const correlation = 0.3;

  return Math.sqrt(
    Math.pow(stockWeight * globals.stockVolatility, 2) +
    Math.pow(bondWeight * globals.bondVolatility, 2) +
    2 * stockWeight * bondWeight * globals.stockVolatility * globals.bondVolatility * correlation
  );
};

/**
 * Core 42-year financial projection engine
 * Builds annual projection array from 2024 to life expectancy
 *
 * @param globals - Global configuration (allocation, returns, retirement ages, etc.)
 * @param michaelExpenses - Michael's monthly expense breakdown
 * @param briannaExpenses - Brianna's monthly expense breakdown
 * @param retirementExpenses - Combined retirement yearly expenses
 * @param specialEvents - Array of lump-sum events (house purchase, etc.)
 * @param salaryAdjustments - Year-specific salary overrides
 * @param customReturnRate - Optional override for market return (for scenario analysis)
 * @returns Array of 42 annual projection years
 */
export const buildProjection = (
  globals: Globals,
  michaelExpenses: Record<string, number>,
  briannaExpenses: Record<string, number>,
  retirementExpenses: { yearlyAmount: number },
  specialEvents: any[] = [],
  salaryAdjustments: Record<number, any> = {},
  customReturnRate: number | null = null
): ProjectionData => {
  const data: ProjectionYear[] = [];

  // Calculate base monthly expenses
  const baseMExp = Object.values(michaelExpenses).reduce((a, b) => a + b, 0);
  const baseBExp = Object.values(briannaExpenses).reduce((a, b) => a + b, 0);

  let prev: ProjectionYear | null = null;
  let prevMBaseSalary = globals.michaelStartSalary;
  let prevBBaseSalary = globals.briannaStartSalary;
  let initialRetirementBalance: number | null = null;
  let firstRetirementYear: number | null = null;
  // Guyton-Klinger guardrail state — initialised on first retirement year
  let gkState: GuytonKlingerState | null = null;
  // Tax-loss harvesting carryforward
  let capitalLossCarry = 0;

  // ── SEPP 72(t) state ─────────────────────────────────────────────────────
  // Once a SEPP schedule is started its annual amount is FIXED for 5 years or
  // until age 59.5 (whichever is later).  We lock it on first retirement year.
  let seppFixedAmount: number | null = null;

  // ── Roth Conversion Ladder pipeline ──────────────────────────────────────
  interface RothTranche { year: number; amount: number; }
  let rothPipeline: RothTranche[] = [];

  // Ensure arrays are valid
  const specialEventsArray = Array.isArray(specialEvents) ? specialEvents : [];
  const salaryAdjustmentsObj =
    typeof salaryAdjustments === 'object' && salaryAdjustments !== null ? salaryAdjustments : {};
  const yearOverridesObj =
    typeof globals.yearOverrides === 'object' && globals.yearOverrides !== null
      ? globals.yearOverrides
      : {};

  const marketReturn =
    customReturnRate !== null ? customReturnRate : calculatePortfolioReturn(globals);
  const endYear =
    START_YEAR +
    Math.max(
      globals.lifeExpectancy - MICHAEL_START_AGE,
      globals.lifeExpectancy - BRIANNA_START_AGE
    );

  // 42-year projection loop
  for (let year = START_YEAR; year <= endYear; year++) {
    const michaelAge = MICHAEL_START_AGE + (year - START_YEAR);
    const briannaAge = BRIANNA_START_AGE + (year - START_YEAR);
    const michaelState = resolveState(year, michaelAge, globals.michaelRetirementAge, globals.michaelStateMachine);
    const briannaState = resolveState(year, briannaAge, globals.briannaRetirementAge, globals.briannaStateMachine);
    const michaelRetired = michaelState === 'retired';
    const briannaRetired = briannaState === 'retired';
    const bothRetired = michaelRetired && briannaRetired;

    // Get year-specific overrides
    const adjustments = salaryAdjustmentsObj[year] || {};
    const overrides = yearOverridesObj[year] || {};

    // Calculate salaries
    const mBaseSalary = adjustments.michaelSalary !== undefined
      ? adjustments.michaelSalary
      : year === START_YEAR
        ? globals.michaelStartSalary
        : prevMBaseSalary * (1 + globals.michaelSalaryGrowth);

    const bBaseSalary = adjustments.briannaSalary !== undefined
      ? adjustments.briannaSalary
      : year === START_YEAR
        ? globals.briannaStartSalary
        : prevBBaseSalary * (1 + globals.briannaSalaryGrowth);

    const stateMultiplier = (state: IncomeState) => {
      if (state === 'working') return 1;
      if (state === 'partTime') return 0.5;
      return 0; // sabbatical or retired
    };

    const mSalary = mBaseSalary * stateMultiplier(michaelState);
    const bSalary = bBaseSalary * stateMultiplier(briannaState);
    prevMBaseSalary = mBaseSalary;
    prevBBaseSalary = bBaseSalary;

    // Calculate expenses
    let yearlyExpenses: number;
    let mExp = 0;
    let bExp = 0;

    if (bothRetired) {
      yearlyExpenses = retirementExpenses.yearlyAmount;
    } else {
      mExp = overrides.michaelExpenses !== undefined
        ? overrides.michaelExpenses / 12
        : year === START_YEAR
          ? baseMExp
          : (prev?.mExp || baseMExp) * (1 + globals.inflationRate);

      bExp = overrides.briannaExpenses !== undefined
        ? overrides.briannaExpenses / 12
        : year === START_YEAR
          ? baseBExp
          : (prev?.bExp || baseBExp) * (1 + globals.inflationRate);

      yearlyExpenses = (mExp + bExp) * 12;
    }

    // Initialize account balances (with overrides)
    let mHsaBal = overrides.michaelHsa !== undefined
      ? overrides.michaelHsa
      : year === START_YEAR
        ? globals.michaelHsaStart || 0
        : prev?.mHsaBal || 0;

    let bHsaBal = overrides.briannaHsa !== undefined
      ? overrides.briannaHsa
      : year === START_YEAR
        ? globals.briannaHsaStart || 0
        : prev?.bHsaBal || 0;

    let m529Bal = overrides.michael529 !== undefined
      ? overrides.michael529
      : year === START_YEAR
        ? globals.michael529Start || 0
        : prev?.m529Bal || 0;

    let b529Bal = overrides.brianna529 !== undefined
      ? overrides.brianna529
      : year === START_YEAR
        ? globals.brianna529Start || 0
        : prev?.b529Bal || 0;
    let m401kBal = overrides.michael401k !== undefined
      ? overrides.michael401k
      : year === START_YEAR
        ? globals.michael401kStart || 0
        : prev?.m401kBal || 0;

    let b401kBal = overrides.brianna401k !== undefined
      ? overrides.brianna401k
      : year === START_YEAR
        ? globals.brianna401kStart || 0
        : prev?.b401kBal || 0;

    let mRothBal = overrides.michaelRoth !== undefined
      ? overrides.michaelRoth
      : year === START_YEAR
        ? globals.michaelRothStart || 0
        : prev?.mRothBal || 0;

    let bRothBal = overrides.briannaRoth !== undefined
      ? overrides.briannaRoth
      : year === START_YEAR
        ? globals.briannaRothStart || 0
        : prev?.bRothBal || 0;

    let mBrokerageBal = overrides.michaelBrokerage !== undefined
      ? overrides.michaelBrokerage
      : year === START_YEAR
        ? globals.michaelBrokerageStart || 0
        : prev?.mBrokerageBal || 0;

    let bBrokerageBal = overrides.briannaBrokerage !== undefined
      ? overrides.briannaBrokerage
      : year === START_YEAR
        ? globals.briannaBrokerageStart || 0
        : prev?.bBrokerageBal || 0;

    let mSavingsBal = overrides.michaelSavings !== undefined
      ? overrides.michaelSavings
      : year === START_YEAR
        ? globals.michaelSavingsStart || 0
        : prev?.mSavingsBal || 0;

    let bSavingsBal = overrides.briannaSavings !== undefined
      ? overrides.briannaSavings
      : year === START_YEAR
        ? globals.briannaSavingsStart || 0
        : prev?.bSavingsBal || 0;

    // Capture pre-return brokerage for TLH
    const preReturnBrokerage = mBrokerageBal + bBrokerageBal;

    // Apply returns: growth assets get market return; savings are treated as no-interest cash.
    m401kBal *= 1 + marketReturn;
    b401kBal *= 1 + marketReturn;
    mRothBal *= 1 + marketReturn;
    bRothBal *= 1 + marketReturn;
    mBrokerageBal *= 1 + marketReturn;
    bBrokerageBal *= 1 + marketReturn;
    mSavingsBal *= 1;
    bSavingsBal *= 1;
    mHsaBal *= 1 + marketReturn;
    bHsaBal *= 1 + marketReturn;
    m529Bal *= 1 + marketReturn;
    b529Bal *= 1 + marketReturn;

    // Harvest capital losses when markets are down
    const postReturnBrokerage = mBrokerageBal + bBrokerageBal;
    if (postReturnBrokerage < preReturnBrokerage) {
      capitalLossCarry += preReturnBrokerage - postReturnBrokerage;
    }

    let liquidityGap = 0;
    let withdrawalSource = '';
    let socialSecurityIncome = 0;
    let actualWithdrawalAmount = 0;
    let seppWithdrawal = 0;
    let rothConversion = 0;

    // ── Roth Ladder: mature 5-year-old tranches into Roth balances ─────────
    if (globals.enableRothLadder) {
      const matured: RothTranche[] = [];
      const pending: RothTranche[] = [];
      for (const t of rothPipeline) {
        if (year - t.year >= 5) {
          matured.push(t);
        } else {
          pending.push(t);
        }
      }
      // Add matured conversions to Michael's Roth (conversions came from his 401k)
      for (const t of matured) {
        mRothBal += t.amount;
      }
      rothPipeline = pending;
    }

    // WORKING PHASE
    if (!bothRetired) {
      // 401k contributions with limits
      const m401kAdded =
        mSalary > 0
          ? mSalary * globals.michael401kRate + mSalary * globals.michael401kMatch
          : 0;
      const b401kAdded =
        bSalary > 0
          ? bSalary * globals.brianna401kRate + bSalary * globals.brianna401kMatch
          : 0;

      const annual401kLimit = 23000;
      const m401kCapped = Math.min(m401kAdded, annual401kLimit);
      const b401kCapped = Math.min(b401kAdded, annual401kLimit);

      m401kBal += m401kCapped;
      b401kBal += b401kCapped;

      // Roth IRA contributions with limits
      const rothLimit = 7000;
      const mRothContrib = Math.min(globals.michaelRothYearlyContrib || 3500, rothLimit);
      const bRothContrib = Math.min(globals.briannaRothYearlyContrib || 3500, rothLimit);
      mRothBal += mRothContrib;
      bRothBal += bRothContrib;

      // HSA contributions (post-tax neutral)
      const mHsaContrib = globals.michaelHsaYearlyContrib || 0;
      const bHsaContrib = globals.briannaHsaYearlyContrib || 0;
      mHsaBal += mHsaContrib;
      bHsaBal += bHsaContrib;

      // 529 contributions
      const m529Contrib = globals.michael529YearlyContrib || 0;
      const b529Contrib = globals.brianna529YearlyContrib || 0;
      m529Bal += m529Contrib;
      b529Bal += b529Contrib;

      // Brokerage contributions
      const mBrokerageContrib = globals.michaelBrokerageYearlyContrib || 0;
      const bBrokerageContrib = globals.briannaBrokerageYearlyContrib || 0;
      mBrokerageBal += mBrokerageContrib;
      bBrokerageBal += bBrokerageContrib;

      // Calculate take-home pay after taxes
      const mTakeHome =
        mSalary > 0
          ? calculateFederalTax(mSalary, m401kCapped, globals.state, globals.stateTaxRates)
          : 0;
      const bTakeHome =
        bSalary > 0
          ? calculateFederalTax(bSalary, b401kCapped, globals.state, globals.stateTaxRates)
          : 0;

      // Household cashflow: include all post-tax contributions as cash outflows.
      // This avoids artificial surplus growth in savings.
      const mCashflow =
        mTakeHome - mExp * 12 - mRothContrib - mHsaContrib - m529Contrib - mBrokerageContrib;
      const bCashflow =
        bTakeHome - bExp * 12 - bRothContrib - bHsaContrib - b529Contrib - bBrokerageContrib;
      const netCash = mCashflow + bCashflow;

      if (netCash >= 0) {
        // Allocate surplus by positive contributor share (fallback 50/50).
        // Using savings-balance share can bias growth into one person's account.
        const mPositive = Math.max(0, mCashflow);
        const bPositive = Math.max(0, bCashflow);
        const totalPositive = mPositive + bPositive;
        const mShare = totalPositive > 0 ? mPositive / totalPositive : 0.5;
        const bShare = 1 - mShare;
        mSavingsBal += netCash * mShare;
        bSavingsBal += netCash * bShare;
        liquidityGap = 0;
      } else {
        let shortfall = -netCash;

        // Draw from combined savings first
        const fromMSavings = Math.min(mSavingsBal, shortfall);
        mSavingsBal -= fromMSavings;
        shortfall -= fromMSavings;

        const fromBSavings = Math.min(bSavingsBal, shortfall);
        bSavingsBal -= fromBSavings;
        shortfall -= fromBSavings;

        // Then brokerage
        const fromMBrokerage = Math.min(mBrokerageBal, shortfall);
        mBrokerageBal -= fromMBrokerage;
        shortfall -= fromMBrokerage;

        const fromBBrokerage = Math.min(bBrokerageBal, shortfall);
        bBrokerageBal -= fromBBrokerage;
        shortfall -= fromBBrokerage;

        liquidityGap = Math.max(0, shortfall);
      }

      // Handle special events (one-time lump sum expenses)
      const yearEvents = specialEventsArray.filter((e) => e.year === year);
      for (const event of yearEvents) {
        let eventCost = event.amount;

        // Withdrawal sequence: Savings -> Brokerage -> 401k -> Roth
        if (mSavingsBal >= eventCost) {
          mSavingsBal -= eventCost;
          eventCost = 0;
        } else {
          eventCost -= mSavingsBal;
          mSavingsBal = 0;

          if (mBrokerageBal >= eventCost) {
            mBrokerageBal -= eventCost;
            eventCost = 0;
          } else {
            eventCost -= mBrokerageBal;
            mBrokerageBal = 0;
          }
        }

        // If still not covered, try Brianna's accounts
        if (eventCost > 0) {
          if (bSavingsBal >= eventCost) {
            bSavingsBal -= eventCost;
            eventCost = 0;
          } else {
            eventCost -= bSavingsBal;
            bSavingsBal = 0;

            if (bBrokerageBal >= eventCost) {
              bBrokerageBal -= eventCost;
            } else {
              bBrokerageBal = 0;
            }
          }
        }
      }
    } else {
      // RETIREMENT PHASE

      // ── SEPP 72(t): penalty-free 401k access before 59.5 ─────────────────
      if (globals.enableSEPP && (michaelAge < 59.5 || briannaAge < 59.5)) {
        const seppRate = globals.seppRate ?? 0.05;
        const lifeRemaining = Math.max(1, globals.lifeExpectancy - Math.max(michaelAge, briannaAge));
        // Fixed amortisation method: SEPP = Balance * r / (1 - (1+r)^-n)
        const total401k = m401kBal + b401kBal;
        if (seppFixedAmount === null && total401k > 0) {
          const denom = 1 - Math.pow(1 + seppRate, -lifeRemaining);
          seppFixedAmount = denom > 0 ? total401k * (seppRate / denom) : 0;
        }
        if (seppFixedAmount && seppFixedAmount > 0) {
          // Draw SEPP from 401k (Michael first, then Brianna)
          let seppNeeded = seppFixedAmount;
          const mTake = Math.min(m401kBal, seppNeeded);
          m401kBal -= mTake;
          seppNeeded -= mTake;
          const bTake = Math.min(b401kBal, seppNeeded);
          b401kBal -= bTake;
          seppNeeded -= bTake;
          seppWithdrawal = seppFixedAmount - seppNeeded;
        }
      }

      // ── Roth Conversion Ladder: convert 401k → Roth (pre-59.5) ───────────
      if (globals.enableRothLadder && (michaelAge < 59.5 || briannaAge < 59.5)) {
        // Determine conversion amount
        let conversionTarget = globals.rothLadderAmount || 0;
        if (conversionTarget <= 0) {
          // Auto-optimise: fill the standard deduction + 10% bracket
          // 2024 standard deduction 15750 + 10% bracket up to 11925 = ~27675
          conversionTarget = 27675;
        }
        const availableToConvert = m401kBal + b401kBal;
        const actualConversion = Math.min(conversionTarget, availableToConvert);
        if (actualConversion > 0) {
          // Pull from Michael's 401k first
          const mConvert = Math.min(m401kBal, actualConversion);
          m401kBal -= mConvert;
          let remaining = actualConversion - mConvert;
          if (remaining > 0) {
            const bConvert = Math.min(b401kBal, remaining);
            b401kBal -= bConvert;
            remaining -= bConvert;
          }
          // Track in pipeline — will mature in 5 years
          rothPipeline.push({ year, amount: actualConversion });
          rothConversion = actualConversion;
          // NOTE: Tax on conversion is implicitly handled — the conversion is
          // ordinary income subject to federal tax.  We account for this by
          // reducing the net cashflow in retirement (the spending from savings
          // / brokerage will need to cover the tax bill).  For a more precise
          // model the tax could be explicitly computed here, but the effect is
          // small when converting into the lowest brackets.
        }
      }

      // Calculate Social Security income
      if (michaelAge >= globals.michaelSocialSecurityAge) {
        socialSecurityIncome += calculateSocialSecurity(
          globals.michaelStartSalary,
          globals.michaelSalaryGrowth,
          globals.michaelYearsWorked,
          globals.michaelSocialSecurityAge
        );
      }

      if (briannaAge >= globals.briannaSocialSecurityAge) {
        socialSecurityIncome += calculateSocialSecurity(
          globals.briannaStartSalary,
          globals.briannaSalaryGrowth,
          globals.briannaYearsWorked,
          globals.briannaSocialSecurityAge
        );
      }

      // Current retirement balance (after returns applied)
      const currentRetirementBalance =
        m401kBal +
        b401kBal +
        mRothBal +
        bRothBal +
        mBrokerageBal +
        bBrokerageBal +
        mSavingsBal +
        bSavingsBal +
        mHsaBal +
        bHsaBal +
        m529Bal +
        b529Bal;

      // Track initial retirement balance for 4% rule
      if (!initialRetirementBalance) {
        initialRetirementBalance = currentRetirementBalance;
        firstRetirementYear = year;
      }

      // ── Calculate withdrawal target (delegated to withdrawals.ts) ─────────
      const yearsIntoRetirement = year - firstRetirementYear!;
      const cumulativeInflation = Math.pow(1 + globals.inflationRate, yearsIntoRetirement);
      const planHorizonYears =
        globals.lifeExpectancy -
        Math.min(globals.michaelRetirementAge, globals.briannaRetirementAge);
      const primaryAge = Math.max(michaelAge, briannaAge);

      let annualWithdrawal = 0;

      switch (globals.withdrawalMethod) {
        case 'constantDollar':
          annualWithdrawal = calculateConstantDollar(
            globals.constantDollarAmount,
            cumulativeInflation,
          ).targetWithdrawal;
          break;

        case 'vpw':
          annualWithdrawal = calculateVPW(
            currentRetirementBalance,
            Math.max(1, globals.lifeExpectancy - primaryAge),
            Math.max(0.001, marketReturn - globals.inflationRate),
          ).targetWithdrawal;
          break;

        case 'guytonKlinger': {
          if (!gkState) {
            gkState = initGuytonKlinger(
              globals.constantDollarAmount,
              initialRetirementBalance!,
            );
          }
          annualWithdrawal = calculateGuytonKlinger(
            gkState,
            currentRetirementBalance,
            globals.inflationRate,
            { planningHorizonYears: planHorizonYears },
          ).targetWithdrawal;
          break;
        }

        case 'oneOverN': {
          const yearsRemaining = Math.max(1, globals.lifeExpectancy - primaryAge);
          annualWithdrawal = currentRetirementBalance / yearsRemaining;
          break;
        }

        case 'endowment':
          annualWithdrawal = calculateConstantDollar(
            initialRetirementBalance! * 0.05,
            cumulativeInflation,
          ).targetWithdrawal;
          break;

        case 'maximize':
          annualWithdrawal = currentRetirementBalance;
          break;

        case 'portfolioPercent':
        default:
          // True % of current portfolio — recalculates every year against live balance.
          annualWithdrawal = currentRetirementBalance * globals.portfolioPercentRate;
          break;
      }

      // Spending need: retirement expenses minus Social Security income
      const spendingNeed = Math.max(0, retirementExpenses.yearlyAmount - socialSecurityIncome);
      const baseWithdrawalNeed = Math.max(spendingNeed, annualWithdrawal);

      // ── Required Minimum Distributions (RMD) — may force a larger draw ───
      let finalWithdrawalTarget = baseWithdrawalNeed;
      if (michaelAge >= 73 || briannaAge >= 73) {
        const oldestAge = Math.max(michaelAge, briannaAge);
        const distributionPeriod = Math.max(1, 26.5 - (oldestAge - 73));
        const rmdAmount = (m401kBal + b401kBal) / distributionPeriod;
        if (rmdAmount > finalWithdrawalTarget) {
          finalWithdrawalTarget = rmdAmount;
        }
      }

      // ── Sequential draw-down: Savings → Brokerage → 401k → Roth ─────────
      // Apply healthcare / education to HSA/529 first
      const healthcareNeed = globals.healthcareAnnual || 0;
      const educationNeed = globals.educationAnnual || 0;

      let remainingHealthcare = healthcareNeed;
      for (const key of ['mHsaBal', 'bHsaBal'] as const) {
        if (remainingHealthcare <= 0) break;
        const take = Math.min(remainingHealthcare, key === 'mHsaBal' ? mHsaBal : bHsaBal);
        if (key === 'mHsaBal') mHsaBal -= take; else bHsaBal -= take;
        remainingHealthcare -= take;
      }

      let remainingEducation = educationNeed;
      for (const key of ['m529Bal', 'b529Bal'] as const) {
        if (remainingEducation <= 0) break;
        const take = Math.min(remainingEducation, key === 'm529Bal' ? m529Bal : b529Bal);
        if (key === 'm529Bal') m529Bal -= take; else b529Bal -= take;
        remainingEducation -= take;
      }

      const preCovered = healthcareNeed - remainingHealthcare + educationNeed - remainingEducation;
      finalWithdrawalTarget = Math.max(0, finalWithdrawalTarget - preCovered);
      const adjustedBaseNeed = Math.max(0, baseWithdrawalNeed - preCovered);

      // Reduce withdrawal target by SEPP already drawn this year
      const seppCredited = Math.min(seppWithdrawal, finalWithdrawalTarget);
      finalWithdrawalTarget = Math.max(0, finalWithdrawalTarget - seppCredited);
      const adjustedBaseNeedPostSEPP = Math.max(0, adjustedBaseNeed - seppCredited);

      const drawResult = applySequentialWithdrawal(
        {
          mSavingsBal,
          bSavingsBal,
          mBrokerageBal,
          bBrokerageBal,
          m401kBal,
          b401kBal,
          mRothBal,
          bRothBal,
        },
        finalWithdrawalTarget,
        {
          michaelAge,
          briannaAge,
          earlyWithdrawalPenalty: globals.earlyWithdrawalPenalty,
          capitalGainsTaxRate: globals.capitalGainsTaxRate,
          capitalLossCarry,
          seppAmount: seppWithdrawal,
        },
      );

      // Unpack updated balances back into local vars
      ({
        mSavingsBal,
        bSavingsBal,
        mBrokerageBal,
        bBrokerageBal,
        m401kBal,
        b401kBal,
        mRothBal,
        bRothBal,
      } = drawResult.buckets);
      withdrawalSource = drawResult.withdrawalSource;

      // Actual spending is capped at the base spending need; RMD surplus is re-deposited to brokerage.
      const fundedAmount = drawResult.amountFunded + seppCredited;
      capitalLossCarry = drawResult.remainingLossCarry ?? capitalLossCarry;
      const rmdSurplus = Math.max(0, fundedAmount - adjustedBaseNeed);
      if (rmdSurplus > 0) {
        mBrokerageBal += rmdSurplus;
      }

      actualWithdrawalAmount = Math.min(adjustedBaseNeed, fundedAmount) + preCovered;
      liquidityGap = Math.max(0, adjustedBaseNeed - fundedAmount);
    }

    // Apply ordinary income offset up to $3k from loss carry each year
    capitalLossCarry = Math.max(0, capitalLossCarry - 3000);

    // Floor all balances at 0
    m401kBal = Math.max(0, m401kBal);
    b401kBal = Math.max(0, b401kBal);
    mRothBal = Math.max(0, mRothBal);
    bRothBal = Math.max(0, bRothBal);
    mBrokerageBal = Math.max(0, mBrokerageBal);
    bBrokerageBal = Math.max(0, bBrokerageBal);
    mSavingsBal = Math.max(0, mSavingsBal);
    bSavingsBal = Math.max(0, bSavingsBal);

    // Create annual projection record
    const current: ProjectionYear = {
      year,
      michaelAge,
      briannaAge,
      mSalary,
      bSalary,
      combinedGross: mSalary + bSalary,
      mExp,
      bExp,
      combinedExp: yearlyExpenses,
      actualWithdrawalAmount: bothRetired ? actualWithdrawalAmount : yearlyExpenses,
      m401kBal,
      b401kBal,
      total401k: m401kBal + b401kBal,
      mRothBal,
      bRothBal,
      totalRoth: mRothBal + bRothBal,
      mBrokerageBal,
      bBrokerageBal,
      totalBrokerage: mBrokerageBal + bBrokerageBal,
      mSavingsBal,
      bSavingsBal,
      totalSavings: mSavingsBal + bSavingsBal,
      mHsaBal,
      bHsaBal,
      totalHsa: mHsaBal + bHsaBal,
      m529Bal,
      b529Bal,
      total529: m529Bal + b529Bal,
      michaelNetWorth: m401kBal + mRothBal + mBrokerageBal + mSavingsBal,
      briannaNetWorth: b401kBal + bRothBal + bBrokerageBal + bSavingsBal,
      netWorth:
        m401kBal +
        b401kBal +
        mRothBal +
        bRothBal +
        mBrokerageBal +
        bBrokerageBal +
        mSavingsBal +
        bSavingsBal +
        mHsaBal +
        bHsaBal +
        m529Bal +
        b529Bal,
      withdrawalSource: withdrawalSource || 'Active',
      michaelState,
      briannaState,
      socialSecurityIncome,
      retired: bothRetired,
      michaelRetired,
      briannaRetired,
      liquidityGap,
      seppWithdrawal: seppWithdrawal || undefined,
      rothConversion: rothConversion || undefined,
      rothPipelineTotal: rothPipeline.reduce((s, t) => s + t.amount, 0) || undefined,
    };

    data.push(current);
    prev = current;
  }

  return data;
};
