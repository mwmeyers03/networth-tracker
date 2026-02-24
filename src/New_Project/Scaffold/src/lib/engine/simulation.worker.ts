/**
 * simulation.worker.ts
 * ---------------------
 * Web Worker — Historical Sequence-of-Returns Backtest Engine
 *
 * Receives a SimulationInput message, runs the user's retirement scenario
 * against EVERY historical starting cohort in the dataset, and returns a
 * typed SimulationResult with:
 *   • Per-cohort survival / depletion data  (CohortResult[])
 *   • 10th / 25th / 50th / 75th / 90th percentile envelopes
 *   • Success rate, safe withdrawal rate, worst/median/best final balance
 *
 * This file must be dependency-free at runtime (no SvelteKit, no Supabase).
 * The historical data is inlined via a static import so the worker bundle is
 * self-contained.
 *
 * Message protocol:
 *   Main → Worker  : WorkerRequestMessage  { type: 'RUN_SIMULATION', payload: SimulationInput }
 *   Worker → Main  : WorkerProgressMessage { type: 'PROGRESS', cohortsCompleted, totalCohorts }
 *                  | WorkerResultMessage   { type: 'RESULT', result: SimulationResult }
 *                  | WorkerErrorMessage    { type: 'ERROR', message: string }
 */

import { HISTORICAL_RETURNS, lastCohortStartYear } from './data/historicalReturns';
import type {
  SimulationInput,
  SimulationResult,
  CohortResult,
  CohortYear,
  WorkerRequestMessage,
  WorkerOutboundMessage,
} from '../types/simulation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Clamp a value between [min, max] */
const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

/** Percentile of a sorted array (linear interpolation). Array MUST be pre-sorted ascending. */
const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

/** Send a typed message to the main thread. */
const post = (msg: WorkerOutboundMessage) => self.postMessage(msg);

// ─── VPW Withdrawal Percentage Table ─────────────────────────────────────────
// Based on the Bogleheads VPW methodology for a 60/40 portfolio.
// Key: retirement age → withdrawal percentage of current balance.
// Values interpolated from the published VPW spreadsheet.
const VPW_TABLE: Record<number, number> = {
  40: 0.0327, 41: 0.0334, 42: 0.0341, 43: 0.0349, 44: 0.0357,
  45: 0.0365, 46: 0.0374, 47: 0.0384, 48: 0.0394, 49: 0.0405,
  50: 0.0417, 51: 0.0430, 52: 0.0443, 53: 0.0458, 54: 0.0474,
  55: 0.0491, 56: 0.0510, 57: 0.0530, 58: 0.0552, 59: 0.0577,
  60: 0.0604, 61: 0.0633, 62: 0.0666, 63: 0.0702, 64: 0.0742,
  65: 0.0787, 66: 0.0837, 67: 0.0893, 68: 0.0956, 69: 0.1028,
  70: 0.1111, 71: 0.1205, 72: 0.1316, 73: 0.1449, 74: 0.1613,
  75: 0.1818, 76: 0.2083, 77: 0.2439, 78: 0.2941, 79: 0.3704,
  80: 0.5000,
};

/** Look up VPW percentage; clamp to [40, 80] age range. */
const vpwRate = (age: number): number => {
  const clamped = clamp(Math.round(age), 40, 80);
  return VPW_TABLE[clamped] ?? 0.05;
};

// ─── Single-cohort simulation ─────────────────────────────────────────────────

/**
 * Simulate one retirement cohort using a slice of the historical return series.
 *
 * @param input          - Simulation parameters
 * @param returnsSlice   - Historical return rows for this cohort (length >= retirementDurationYears)
 * @param cohortStartYear - Calendar year this cohort retires
 */
function simulateCohort(
  input: SimulationInput,
  returnsSlice: typeof HISTORICAL_RETURNS,
  cohortStartYear: number,
): CohortResult {
  const {
    startingBalance,
    stockAllocation,
    bondAllocation,
    cashAllocation,
    retirementDurationYears,
    initialAnnualWithdrawal,
    withdrawalStrategy,
    additionalIncomeEvents,
    cashReturn,
    currentAge = 45,
    gkCeilingRate = 1.20,
    gkFloorRate = 0.80,
  } = input;

  let portfolio = startingBalance;
  const yearlyBalances: CohortYear[] = [];
  let survived = true;
  let depletionYearIndex: number | undefined;

  // Guyton-Klinger state
  let gkCurrentWithdrawal = initialAnnualWithdrawal;
  let gkInitialBalance = startingBalance;

  // Cumulative inflation multiplier (tracks real purchasing power loss)
  let cumulativeInflation = 1.0;

  for (let i = 0; i < retirementDurationYears; i++) {
    // ── 1. Determine market returns for this year ──────────────────────────
    const histRow = returnsSlice[i];
    // If we run out of history (for very long durations), wrap around
    const row = histRow ?? returnsSlice[i % returnsSlice.length];

    const portfolioReturn =
      stockAllocation * row.stockReturn +
      bondAllocation * row.bondReturn +
      cashAllocation * cashReturn;

    // ── 2. Apply returns ───────────────────────────────────────────────────
    portfolio *= 1 + portfolioReturn;

    // ── 3. Accumulate inflation ────────────────────────────────────────────
    cumulativeInflation *= 1 + row.inflation;

    // ── 4. Additional income events (Social Security, part-time, etc.) ─────
    const calendarYear = cohortStartYear + i;
    let additionalIncome = 0;
    for (const evt of additionalIncomeEvents) {
      if (calendarYear >= evt.startYear) {
        const yearsActive = calendarYear - evt.startYear;
        additionalIncome += evt.inflationAdjusted
          ? evt.annualAmount * Math.pow(1 + row.inflation, yearsActive)
          : evt.annualAmount;
      }
    }

    // ── 5. Calculate withdrawal ────────────────────────────────────────────
    const age = currentAge + i;
    let withdrawal = 0;

    switch (withdrawalStrategy) {
      case 'constantDollar':
        // Classic SWR: inflation-adjust each year
        withdrawal = initialAnnualWithdrawal * cumulativeInflation;
        break;

      case 'portfolioPercent': {
        // Fixed % of current portfolio balance
        const rate = initialAnnualWithdrawal / startingBalance;
        withdrawal = portfolio * rate;
        break;
      }

      case 'vpw':
        // Variable Percentage Withdrawal: % based on age from VPW table
        withdrawal = portfolio * vpwRate(age);
        break;

      case 'guytonKlinger': {
        // Step 1: Inflation-adjust base withdrawal
        gkCurrentWithdrawal *= 1 + row.inflation;

        // Step 2: Prosperity rule — if withdrawal rate < floor, raise by 10%
        const currentRate = gkCurrentWithdrawal / portfolio;
        const initialRate = initialAnnualWithdrawal / gkInitialBalance;

        if (currentRate < initialRate * gkFloorRate && i > 0) {
          gkCurrentWithdrawal *= 1.10;
        }

        // Step 3: Capital preservation rule — if withdrawal rate > ceiling, cut by 10%
        if (currentRate > initialRate * gkCeilingRate && i > 0) {
          gkCurrentWithdrawal *= 0.90;
        }

        withdrawal = gkCurrentWithdrawal;
        break;
      }

      case 'oneOverN': {
        const yearsRemaining = Math.max(1, retirementDurationYears - i);
        withdrawal = portfolio / yearsRemaining;
        break;
      }

      case 'endowment':
        // 5% of current portfolio, smoothed—same as portfolioPercent at 5%
        withdrawal = portfolio * 0.05;
        break;

      default:
        withdrawal = initialAnnualWithdrawal * cumulativeInflation;
    }

    // Additional income offsets how much we need from the portfolio
    const portfolioWithdrawal = Math.max(0, withdrawal - additionalIncome);

    // ── 6. Deduct withdrawal from portfolio ────────────────────────────────
    portfolio -= portfolioWithdrawal;

    if (portfolio <= 0) {
      portfolio = 0;
      survived = false;
      if (depletionYearIndex === undefined) depletionYearIndex = i;
    }

    yearlyBalances.push({
      yearIndex: i,
      portfolioBalance: portfolio,
      actualWithdrawal: portfolioWithdrawal,
      cumulativeInflation,
    });

    // Once depleted, fill remaining years with zeros
    if (!survived && depletionYearIndex !== undefined) {
      for (let j = i + 1; j < retirementDurationYears; j++) {
        cumulativeInflation *= 1 + (returnsSlice[j]?.inflation ?? 0.03);
        yearlyBalances.push({
          yearIndex: j,
          portfolioBalance: 0,
          actualWithdrawal: 0,
          cumulativeInflation,
        });
      }
      break;
    }
  }

  return { startYear: cohortStartYear, survived, yearlyBalances, depletionYearIndex };
}

// ─── Percentile envelope builder ─────────────────────────────────────────────

/**
 * Given all cohort results, produce a percentile time series.
 * Returns an array of length `durationYears` where each element is the
 * p-th percentile balance across all cohorts for that year index.
 */
function buildPercentileEnvelope(
  cohorts: CohortResult[],
  durationYears: number,
  p: number,
): number[] {
  const result: number[] = [];
  for (let i = 0; i < durationYears; i++) {
    const balancesAtYear = cohorts
      .map((c) => c.yearlyBalances[i]?.portfolioBalance ?? 0)
      .sort((a, b) => a - b);
    result.push(percentile(balancesAtYear, p));
  }
  return result;
}

// ─── Safe Withdrawal Rate finder ─────────────────────────────────────────────

/**
 * Binary-searches for the maximum withdrawal rate (as a fraction of starting
 * balance) that achieves 100% historical success.
 * Precision: 0.0001 (1 basis point).
 */
function findSafeWithdrawalRate(input: SimulationInput): number {
  const lastStart = lastCohortStartYear(input.retirementDurationYears);
  const cohortStarts = HISTORICAL_RETURNS
    .filter((r) => r.year <= lastStart)
    .map((r) => r.year);

  let lo = 0.01;
  let hi = 0.20;

  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2;
    const testInput: SimulationInput = {
      ...input,
      initialAnnualWithdrawal: input.startingBalance * mid,
      withdrawalStrategy: 'constantDollar',
    };

    let allSurvived = true;
    for (const startYear of cohortStarts) {
      const idx = HISTORICAL_RETURNS.findIndex((r) => r.year === startYear);
      const slice = HISTORICAL_RETURNS.slice(idx);
      const result = simulateCohort(testInput, slice, startYear);
      if (!result.survived) {
        allSurvived = false;
        break;
      }
    }

    if (allSurvived) {
      lo = mid; // can go higher
    } else {
      hi = mid; // too aggressive
    }
  }

  return Math.round(lo * 10000) / 10000; // round to 4 decimal places
}

// ─── Main simulation runner ───────────────────────────────────────────────────

function runSimulation(input: SimulationInput): SimulationResult {
  const { retirementDurationYears } = input;

  // Determine valid cohort starting years
  const lastStart = lastCohortStartYear(retirementDurationYears);
  const cohortStarts = HISTORICAL_RETURNS
    .filter((r) => r.year <= lastStart)
    .map((r) => r.year);

  const totalCohorts = cohortStarts.length;
  const cohorts: CohortResult[] = [];

  // ── Run all cohorts ───────────────────────────────────────────────────────
  for (let ci = 0; ci < cohortStarts.length; ci++) {
    const startYear = cohortStarts[ci];
    const idx = HISTORICAL_RETURNS.findIndex((r) => r.year === startYear);
    const slice = HISTORICAL_RETURNS.slice(idx); // slice from startYear to end of dataset

    const cohortResult = simulateCohort(input, slice, startYear);
    cohorts.push(cohortResult);

    // Send progress every 10 cohorts
    if (ci % 10 === 0 || ci === cohortStarts.length - 1) {
      post({ type: 'PROGRESS', cohortsCompleted: ci + 1, totalCohorts });
    }
  }

  // ── Aggregate statistics ──────────────────────────────────────────────────
  const successfulCohorts = cohorts.filter((c) => c.survived).length;
  const successRate = totalCohorts > 0 ? successfulCohorts / totalCohorts : 0;

  // Final-year balances for worst/median/best
  const finalBalances = cohorts
    .map((c) => c.yearlyBalances[retirementDurationYears - 1]?.portfolioBalance ?? 0)
    .sort((a, b) => a - b);

  const worstCaseFinalBalance = finalBalances[0] ?? 0;
  const bestCaseFinalBalance = finalBalances[finalBalances.length - 1] ?? 0;
  const medianFinalBalance = percentile(finalBalances, 50);

  // ── Percentile envelopes ──────────────────────────────────────────────────
  const p10 = buildPercentileEnvelope(cohorts, retirementDurationYears, 10);
  const p25 = buildPercentileEnvelope(cohorts, retirementDurationYears, 25);
  const p50 = buildPercentileEnvelope(cohorts, retirementDurationYears, 50);
  const p75 = buildPercentileEnvelope(cohorts, retirementDurationYears, 75);
  const p90 = buildPercentileEnvelope(cohorts, retirementDurationYears, 90);

  // ── Safe Withdrawal Rate ──────────────────────────────────────────────────
  const safeWithdrawalRate = findSafeWithdrawalRate(input);

  return {
    successRate,
    totalCohorts,
    successfulCohorts,
    cohorts,
    p10,
    p25,
    p50,
    p75,
    p90,
    safeWithdrawalRate,
    worstCaseFinalBalance,
    bestCaseFinalBalance,
    medianFinalBalance,
  };
}

// ─── Worker message handler ───────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerRequestMessage>) => {
  const { type, payload } = event.data;

  if (type !== 'RUN_SIMULATION') {
    post({ type: 'ERROR', message: `Unknown message type: ${type}` });
    return;
  }

  try {
    const result = runSimulation(payload);
    post({ type: 'RESULT', result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'ERROR', message });
  }
};
