/**
 * Financial Projection Engine - Main Export
 * Pure, type-safe functions for financial calculations
 */

export { calculateFederalTax, calculateTaxBreakdown } from './taxes';
export {
  calculateSocialSecurity,
  calculateSocialSecurityBenefit,
  getClaimingReductionFactor
} from './socialSecurity';
export {
  buildProjection,
  calculatePortfolioReturn,
  calculatePortfolioVolatility
} from './projection';

// ── Simulation (historical backtest) engine ──────────────────────────────────
export {
  SimulationWorkerManager,
  simulationManager,
  globalsToSimulationInput,
} from './simulationWorkerManager';
export type {
  SimulationInput,
  SimulationResult,
  SimulationCallbacks,
} from './simulationWorkerManager';

// ── Withdrawal strategies ────────────────────────────────────────────────────────
export {
  calculateConstantDollar,
  calculateVPW,
  calculateGuytonKlinger,
  initGuytonKlinger,
  applySequentialWithdrawal,
} from './withdrawals';
export type {
  WithdrawalResult,
  GuytonKlingerState,
  GuytonKlingerOptions,
  AccountBuckets,
  DrawDownResult,
} from './withdrawals';

// ── Historical data helpers ───────────────────────────────────────────────────
export {
  HISTORICAL_RETURNS,
  FIRST_COHORT_YEAR,
  lastCohortStartYear,
  DEFAULT_CASH_RETURN,
} from './data/historicalReturns';
