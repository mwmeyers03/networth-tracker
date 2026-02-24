/**
 * Simulation Type Definitions
 * Covers historical backtesting and Monte Carlo simulation models.
 */

// ──────────────────────────────────────────────
// RAW DATA TYPES
// ──────────────────────────────────────────────

/**
 * A single calendar year of historical market data.
 * All values are nominal (not real / inflation-adjusted).
 * Source: Robert Shiller CAPE dataset (1871–2024).
 */
export interface HistoricalYear {
  /** Calendar year (e.g. 1929) */
  year: number;
  /** Nominal total return for a broad US equity index (e.g. 0.112 = 11.2%) */
  stockReturn: number;
  /** Nominal total return for 10-year US Treasury bonds */
  bondReturn: number;
  /** Annual CPI inflation rate (e.g. 0.03 = 3%) */
  inflation: number;
}

// ──────────────────────────────────────────────
// SIMULATION INPUT
// ──────────────────────────────────────────────

/**
 * Withdrawal strategy identifier passed into the simulation engine.
 */
export type WithdrawalStrategy =
  | 'constantDollar'   // Fixed real dollars (classic 4% rule)
  | 'portfolioPercent' // % of current balance each year
  | 'vpw'              // Variable Percentage Withdrawal
  | 'guytonKlinger'    // Guyton-Klinger guardrails
  | 'oneOverN'         // 1 / years remaining
  | 'endowment';       // 5% of rolling 3-yr average

/**
 * Complete set of parameters required to run a simulation.
 * Derived from the existing `Globals` interface but flattened
 * to only what the worker needs, keeping the worker dependency-free.
 */
export interface SimulationInput {
  // ── Portfolio ──────────────────────────────
  /** Starting total investable portfolio (all accounts combined) */
  startingBalance: number;
  stockAllocation: number;    // 0–1
  bondAllocation: number;     // 0–1
  cashAllocation: number;     // 0–1

  // ── Retirement span ────────────────────────
  /** Calendar year retirement begins (simulation start anchor) */
  retirementStartYear: number;
  /** Number of years the simulation must fund (e.g. 55 years) */
  retirementDurationYears: number;

  // ── Spending ───────────────────────────────
  /** First-year withdrawal amount in today's (nominal) dollars */
  initialAnnualWithdrawal: number;
  /** Which withdrawal strategy to apply */
  withdrawalStrategy: WithdrawalStrategy;

  // ── Social Security income boost ───────────
  /** Additional annual income (SS, pension, part-time) that starts at a given age */
  additionalIncomeEvents: AdditionalIncomeEvent[];

  // ── Cash return (for uninvested cash sleeve) ──
  cashReturn: number;

  // ── VPW-specific ───────────────────────────
  /** Current age of the primary retiree (used by VPW table) */
  currentAge?: number;

  // ── Guyton-Klinger guardrails ───────────────
  gkCeilingRate?: number;   // default 1.20 — raise withdrawal by 10% if below ceiling
  gkFloorRate?: number;     // default 0.80 — cut withdrawal by 10% if above floor
}

/**
 * A fixed-camera external income event (e.g. Social Security at 62).
 */
export interface AdditionalIncomeEvent {
  /** Year when this income stream begins */
  startYear: number;
  /** Annual amount in nominal dollars at the time of `startYear` */
  annualAmount: number;
  /** Whether the amount grows with CPI each subsequent year */
  inflationAdjusted: boolean;
}

// ──────────────────────────────────────────────
// SIMULATION OUTPUT
// ──────────────────────────────────────────────

/**
 * Single-year portfolio state for one historical cohort run.
 */
export interface CohortYear {
  /** Offset year index from retirement start (0 = year 1 of retirement) */
  yearIndex: number;
  /** Portfolio balance at end of year (after withdrawal, after growth) */
  portfolioBalance: number;
  /** Actual dollar amount withdrawn this year */
  actualWithdrawal: number;
  /** Cumulative CPI inflation factor from year 0 */
  cumulativeInflation: number;
}

/**
 * Full result for a single historical cohort (one starting year).
 */
export interface CohortResult {
  /** The historical calendar year this cohort started (e.g. 1929) */
  startYear: number;
  /** Whether this cohort survived to the end without hitting $0 */
  survived: boolean;
  /**
   * Year-by-year portfolio balances.
   * Index 0 = year 1 of retirement. Length = retirementDurationYears.
   */
  yearlyBalances: CohortYear[];
  /** First year the portfolio was exhausted (undefined if survived) */
  depletionYearIndex?: number;
}

/**
 * Aggregated output from running all historical cohorts.
 */
export interface SimulationResult {
  // ── Summary statistics ─────────────────────
  /** Fraction of cohorts that survived (0–1). e.g. 0.96 = 96% success */
  successRate: number;
  /** Number of historical cohorts tested */
  totalCohorts: number;
  /** Number of cohorts that survived the full duration */
  successfulCohorts: number;

  // ── Per-cohort matrix (for spaghetti chart) ──
  /** All cohort results. One entry per historical starting year. */
  cohorts: CohortResult[];

  // ── Percentile envelopes ────────────────────
  /**
   * Percentile portfolio balance at each year index.
   * p10 = worst 10% outcome, p50 = median, p90 = best 10% outcome.
   * Each array has length = retirementDurationYears.
   */
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];

  // ── Safe Withdrawal Rate analysis ──────────
  /**
   * Maximum withdrawal rate (as fraction of starting balance)
   * that would have succeeded in 100% of historical cohorts.
   */
  safeWithdrawalRate: number;

  /**
   * The worst-case final portfolio balance across all cohorts
   * (lowest surviving balance, or 0 for failed runs).
   */
  worstCaseFinalBalance: number;
  bestCaseFinalBalance: number;
  medianFinalBalance: number;
}

// ──────────────────────────────────────────────
// WORKER MESSAGE PROTOCOL
// ──────────────────────────────────────────────

/** Message sent from the main thread → worker. */
export interface WorkerRequestMessage {
  type: 'RUN_SIMULATION';
  payload: SimulationInput;
}

/** Message sent from worker → main thread (progress). */
export interface WorkerProgressMessage {
  type: 'PROGRESS';
  cohortsCompleted: number;
  totalCohorts: number;
}

/** Message sent from worker → main thread (final result). */
export interface WorkerResultMessage {
  type: 'RESULT';
  result: SimulationResult;
}

/** Message sent from worker → main thread on error. */
export interface WorkerErrorMessage {
  type: 'ERROR';
  message: string;
}

export type WorkerOutboundMessage =
  | WorkerProgressMessage
  | WorkerResultMessage
  | WorkerErrorMessage;
