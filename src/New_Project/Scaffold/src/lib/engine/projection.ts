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

const START_YEAR = 2024;
const MICHAEL_START_AGE = 22;
const BRIANNA_START_AGE = 21;

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
  let initialRetirementBalance: number | null = null;
  let firstRetirementYear: number | null = null;
  // Guyton-Klinger guardrail state — initialised on first retirement year
  let gkState: GuytonKlingerState | null = null;

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
    const michaelRetired = michaelAge >= globals.michaelRetirementAge;
    const briannaRetired = briannaAge >= globals.briannaRetirementAge;
    const bothRetired = michaelRetired && briannaRetired;

    // Get year-specific overrides
    const adjustments = salaryAdjustmentsObj[year] || {};
    const overrides = yearOverridesObj[year] || {};

    // Calculate salaries
    const mSalary = michaelRetired
      ? 0
      : adjustments.michaelSalary !== undefined
        ? adjustments.michaelSalary
        : year === START_YEAR
          ? globals.michaelStartSalary
          : (prev?.mSalary || globals.michaelStartSalary) * (1 + globals.michaelSalaryGrowth);

    const bSalary = briannaRetired
      ? 0
      : adjustments.briannaSalary !== undefined
        ? adjustments.briannaSalary
        : year === START_YEAR
          ? globals.briannaStartSalary
          : (prev?.bSalary || globals.briannaStartSalary) * (1 + globals.briannaSalaryGrowth);

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

    // Apply market returns to all accounts
    m401kBal *= 1 + marketReturn;
    b401kBal *= 1 + marketReturn;
    mRothBal *= 1 + marketReturn;
    bRothBal *= 1 + marketReturn;
    mBrokerageBal *= 1 + marketReturn;
    bBrokerageBal *= 1 + marketReturn;
    mSavingsBal *= 1 + marketReturn;
    bSavingsBal *= 1 + marketReturn;

    let liquidityGap = 0;
    let withdrawalSource = '';
    let socialSecurityIncome = 0;
    let actualWithdrawalAmount = 0;

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

      // Calculate take-home pay after taxes
      const mTakeHome =
        mSalary > 0
          ? calculateFederalTax(mSalary, m401kCapped, globals.state, globals.stateTaxRates)
          : 0;
      const bTakeHome =
        bSalary > 0
          ? calculateFederalTax(bSalary, b401kCapped, globals.state, globals.stateTaxRates)
          : 0;

      // Savings calculation: Take-home minus expenses minus Roth contributions
      const mSavingsContrib = mTakeHome - mExp * 12 - mRothContrib;
      const bSavingsContrib = bTakeHome - bExp * 12 - bRothContrib;

      mSavingsBal += mSavingsContrib;
      bSavingsBal += bSavingsContrib;

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
        bSavingsBal;

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

      actualWithdrawalAmount = annualWithdrawal;

      // ── Required Minimum Distributions (RMD) — may force a larger draw ───
      let finalWithdrawalTarget = annualWithdrawal;
      if (michaelAge >= 73 || briannaAge >= 73) {
        const oldestAge = Math.max(michaelAge, briannaAge);
        const distributionPeriod = Math.max(1, 26.5 - (oldestAge - 73));
        const rmdAmount = (m401kBal + b401kBal) / distributionPeriod;
        if (rmdAmount > finalWithdrawalTarget) {
          finalWithdrawalTarget = rmdAmount;
          actualWithdrawalAmount = finalWithdrawalTarget;
        }
      }

      // ── Sequential draw-down: Savings → Brokerage → 401k → Roth ─────────
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
      liquidityGap = drawResult.liquidityGap;
    }

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
        bSavingsBal,
      withdrawalSource: withdrawalSource || 'Active',
      socialSecurityIncome,
      retired: bothRetired,
      michaelRetired,
      briannaRetired,
      liquidityGap
    };

    data.push(current);
    prev = current;
  }

  return data;
};
