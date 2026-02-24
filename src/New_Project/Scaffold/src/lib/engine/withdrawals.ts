/**
 * withdrawals.ts
 * ──────────────
 * Typed, pure withdrawal-strategy functions for the FIRE projection engine.
 *
 * Three primary strategies are exported:
 *   • calculateConstantDollar   — Classic SWR / inflation-adjusted fixed spending
 *   • calculateVPW              — Variable Percentage Withdrawal (Bogleheads)
 *   • calculateGuytonKlinger    — Guardrail rules (Guyton & Klinger, 2006)
 *
 * All functions are pure with respect to their inputs EXCEPT Guyton-Klinger,
 * which carries a mutable `GuytonKlingerState` object across years — the caller
 * holds and threads that state through the projection loop.
 *
 * Sequential draw-down order (enforced by `applyWithdrawal` helper):
 *   1. Taxable cash / savings        (no tax drag on principal)
 *   2. Taxable brokerage             (capital-gains tax applies)
 *   3. Tax-deferred 401k / trad IRA  (ordinary income tax + early-withdrawal penalty)
 *   4. Tax-free Roth IRA             (preserve longest for tax-free growth)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Result returned by every withdrawal strategy function.
 */
export interface WithdrawalResult {
  /** Gross dollar amount the strategy says to withdraw this year. */
  targetWithdrawal: number;
}

/**
 * Mutable state threaded through the Guyton-Klinger projection loop.
 * Create once at retirement onset; pass the same object each year.
 */
export interface GuytonKlingerState {
  /** Withdrawal amount at the END of the previous year (after guardrail adjustments). */
  currentWithdrawal: number;
  /** Portfolio balance at retirement onset — the "floor" anchor for guardrail math. */
  initialBalance: number;
  /** Base withdrawal rate = initialWithdrawal / initialBalance. Stored once at init. */
  initialRate: number;
  /** Years elapsed since retirement onset (0 = first year). */
  yearsElapsed: number;
}

// ─── 1. Constant Dollar (Classic SWR) ────────────────────────────────────────

/**
 * Classic inflation-adjusted fixed-dollar withdrawal.
 *
 * Typically used for the "4% rule": the first-year dollar amount is set once
 * at retirement, then grown by CPI every subsequent year.
 *
 * @param baseAmount          - Dollar amount at retirement onset (year 0 value).
 * @param cumulativeInflation - Product of (1 + cpi) for each year since onset.
 *                              e.g. after 3 years at 3% inflation: (1.03)^3 ≈ 1.0927.
 * @returns                     Inflation-adjusted withdrawal target for this year.
 *
 * @example
 * // Retiring with $80,000/yr target; 5 years later, CPI has compounded to 1.159:
 * calculateConstantDollar(80_000, 1.159); // → 92,720
 */
export const calculateConstantDollar = (
  baseAmount: number,
  cumulativeInflation: number,
): WithdrawalResult => ({
  targetWithdrawal: baseAmount * cumulativeInflation,
});

// ─── 2. Variable Percentage Withdrawal (VPW) ─────────────────────────────────

/**
 * Variable Percentage Withdrawal using the Bogleheads amortization formula.
 *
 * Based on the principle of spreading the current portfolio balance over the
 * remaining life expectancy at a real (inflation-adjusted) expected return:
 *
 *   W_t = B_t × r / (1 − (1+r)^(−n))
 *
 * Where:
 *   B_t  = current portfolio balance
 *   r    = expected real return (nominal return − inflation rate)
 *   n    = years remaining (life expectancy − current age)
 *
 * Special case: when r ≈ 0 the formula simplifies to W_t = B_t / n (straight-line
 * amortisation), which is handled explicitly to avoid division-by-zero.
 *
 * @param currentBalance   - Total portfolio balance after market return, pre-withdrawal.
 * @param yearsRemaining   - `lifeExpectancy − currentAge`, floored at 1.
 * @param realReturn       - Nominal portfolio return minus inflation (e.g. 0.07 − 0.03 = 0.04).
 *                           Floored at 0.001 by the caller to avoid degenerate math.
 * @returns Withdrawal target for this year.
 */
export const calculateVPW = (
  currentBalance: number,
  yearsRemaining: number,
  realReturn: number,
): WithdrawalResult => {
  const n = Math.max(1, Math.round(yearsRemaining));
  const r = Math.max(0.001, realReturn);
  // Amortization factor:  r / (1 − (1+r)^(−n))
  const amortFactor = r / (1 - Math.pow(1 + r, -n));
  return { targetWithdrawal: currentBalance * amortFactor };
};

// ─── 3. Guyton-Klinger Guardrails ────────────────────────────────────────────

/**
 * Guyton-Klinger dynamic withdrawal with guardrail rules.
 *
 * Original paper: Guyton, J. T. & Klinger, W. J. (2006).
 * "Decision Rules and Maximum Initial Withdrawal Rates."
 * Journal of Financial Planning, 19(3), 48–58.
 *
 * Rules applied (in order):
 *
 *   1. **Inflation rule** — raise the prior year's withdrawal by CPI.
 *   2. **Prosperity rule** — if this year's withdrawal rate falls below
 *      `floorMultiplier × initialRate` (default: 80%) AND it is not the
 *      first year of retirement, raise the withdrawal by `upwardAdjustment`
 *      (default: +10%).  This captures unexpectedly strong market growth.
 *   3. **Capital preservation rule** — if this year's withdrawal rate exceeds
 *      `ceilingMultiplier × initialRate` (default: 120%) AND it is not the
 *      last 15 years of the plan, cut the withdrawal by `downwardAdjustment`
 *      (default: −10%).  This protects the portfolio after bad sequences.
 *
 * The state object is **mutated in place** so the caller can simply pass it
 * through the projection loop without explicit state management.
 *
 * @param state               - Mutable GK state (create with `initGuytonKlinger`).
 * @param annualInflationRate - This year's CPI rate (e.g. 0.03 = 3%).
 * @param options             - Optional overrides for guardrail thresholds.
 * @returns                     Withdrawal target and the updated state reference.
 *
 * @example
 * const state = initGuytonKlinger(80_000, 2_000_000);
 * // Year 1:
 * const { targetWithdrawal } = calculateGuytonKlinger(state, 0.03);
 * // → ~82,400 (inflation-adjusted), no guardrail triggered yet
 */
export interface GuytonKlingerOptions {
  /** Withdrawal rate multiple below which the Prosperity rule fires.  Default 0.80. */
  floorMultiplier?: number;
  /** Withdrawal rate multiple above which the Capital Preservation rule fires.  Default 1.20. */
  ceilingMultiplier?: number;
  /** Multiplier applied when Prosperity rule raises withdrawal.  Default 1.10. */
  upwardAdjustment?: number;
  /** Multiplier applied when Capital Preservation rule cuts withdrawal.  Default 0.90. */
  downwardAdjustment?: number;
  /** Planning horizon in years — guardrails relax in the final 15 years. */
  planningHorizonYears?: number;
}

/**
 * Create the initial GuytonKlingerState at retirement onset.
 *
 * @param initialWithdrawal - First-year withdrawal amount (e.g. 80_000).
 * @param initialBalance    - Portfolio balance at retirement onset.
 */
export const initGuytonKlinger = (
  initialWithdrawal: number,
  initialBalance: number,
): GuytonKlingerState => ({
  currentWithdrawal: initialWithdrawal,
  initialBalance,
  initialRate: initialBalance > 0 ? initialWithdrawal / initialBalance : 0.04,
  yearsElapsed: 0,
});

export const calculateGuytonKlinger = (
  state: GuytonKlingerState,
  currentBalance: number,
  annualInflationRate: number,
  options: GuytonKlingerOptions = {},
): WithdrawalResult => {
  const {
    floorMultiplier = 0.80,
    ceilingMultiplier = 1.20,
    upwardAdjustment = 1.10,
    downwardAdjustment = 0.90,
    planningHorizonYears,
  } = options;

  // Rule 1: Inflation adjustment
  let withdrawal = state.currentWithdrawal * (1 + annualInflationRate);

  // Skip guardrail rules in year 0 (before any portfolio growth has occurred)
  // and in the final 15 years of the plan (GK paper exempts those years).
  const inFinalYears =
    planningHorizonYears !== undefined &&
    state.yearsElapsed >= planningHorizonYears - 15;

  if (state.yearsElapsed > 0 && !inFinalYears && currentBalance > 0) {
    const currentRate = withdrawal / currentBalance;

    // Rule 2: Prosperity rule — rate too LOW → raise spending
    if (currentRate < state.initialRate * floorMultiplier) {
      withdrawal *= upwardAdjustment;
    }

    // Rule 3: Capital preservation rule — rate too HIGH → cut spending
    if (currentRate > state.initialRate * ceilingMultiplier) {
      withdrawal *= downwardAdjustment;
    }
  }

  // Mutate state for the next year
  state.currentWithdrawal = withdrawal;
  state.yearsElapsed += 1;

  return { targetWithdrawal: withdrawal };
};

// ─── Sequential draw-down helper ─────────────────────────────────────────────

/**
 * Account bucket snapshot fed to `applySequentialWithdrawal`.
 * All values are current balances (post-market-return, pre-withdrawal).
 */
export interface AccountBuckets {
  mSavingsBal: number;
  bSavingsBal: number;
  mBrokerageBal: number;
  bBrokerageBal: number;
  m401kBal: number;
  b401kBal: number;
  mRothBal: number;
  bRothBal: number;
}

export interface DrawDownOptions {
  michaelAge: number;
  briannaAge: number;
  earlyWithdrawalPenalty: number;
  capitalGainsTaxRate: number;
}

export interface DrawDownResult {
  buckets: AccountBuckets;
  withdrawalSource: string;
  /** Net amount actually funded (target − any unfunded gap) */
  amountFunded: number;
  /** Positive value when portfolio was exhausted before meeting the target. */
  liquidityGap: number;
}

/**
 * Withdraw `targetAmount` from account buckets in the canonical FIRE order:
 *   1. Savings (tax-free access)
 *   2. Brokerage (capital-gains tax on gross proceeds)
 *   3. 401k / traditional IRA (ordinary income; penalty if under 59½)
 *   4. Roth IRA (tax-free; preserve longest)
 *
 * Returns updated bucket balances and accounting of sources used.
 * All bucket values are floored at 0.
 */
export const applySequentialWithdrawal = (
  buckets: AccountBuckets,
  targetAmount: number,
  opts: DrawDownOptions,
): DrawDownResult => {
  // Deep-clone so callers can diff before/after
  const b: AccountBuckets = { ...buckets };
  let needed = targetAmount;
  const sources: string[] = [];

  // ── 1. Savings (both people) ─────────────────────────────────────────────
  for (const key of ['mSavingsBal', 'bSavingsBal'] as const) {
    if (needed <= 0) break;
    if (b[key] <= 0) continue;
    const take = Math.min(b[key], needed);
    b[key] -= take;
    needed -= take;
    if (!sources.includes('Savings')) sources.push('Savings');
  }

  // ── 2. Brokerage (capital-gains tax applies) ──────────────────────────────
  for (const key of ['mBrokerageBal', 'bBrokerageBal'] as const) {
    if (needed <= 0) break;
    if (b[key] <= 0) continue;
    // To net `needed` after cap-gains tax: gross = needed / (1 − taxRate)
    const cgt = opts.capitalGainsTaxRate;
    const grossNeeded = cgt < 1 ? needed / (1 - cgt) : needed;
    const grossTake = Math.min(b[key], grossNeeded);
    const netProceeds = grossTake * (1 - cgt);
    b[key] -= grossTake;
    needed -= netProceeds;
    if (!sources.includes('Brokerage')) sources.push('Brokerage');
  }

  // ── 3. 401k / traditional IRA ────────────────────────────────────────────
  const ages: Record<'m401kBal' | 'b401kBal', number> = {
    m401kBal: opts.michaelAge,
    b401kBal: opts.briannaAge,
  };
  for (const key of ['m401kBal', 'b401kBal'] as const) {
    if (needed <= 0) break;
    if (b[key] <= 0) continue;
    const age = ages[key];
    const take = Math.min(b[key], needed);
    if (age >= 59.5) {
      b[key] -= take;
      needed -= take;
      if (!sources.includes('401k')) sources.push('401k');
    } else {
      // Early withdrawal: balance is reduced by take + penalty
      const penalty = take * opts.earlyWithdrawalPenalty;
      b[key] = Math.max(0, b[key] - take - penalty);
      needed -= take;
      if (!sources.includes('401k(early)')) sources.push('401k(early)');
    }
  }

  // ── 4. Roth IRA ───────────────────────────────────────────────────────────
  for (const key of ['mRothBal', 'bRothBal'] as const) {
    if (needed <= 0) break;
    if (b[key] <= 0) continue;
    const take = Math.min(b[key], needed);
    b[key] -= take;
    needed -= take;
    if (!sources.includes('Roth')) sources.push('Roth');
  }

  // Floor all balances
  for (const key of Object.keys(b) as (keyof AccountBuckets)[]) {
    b[key] = Math.max(0, b[key]);
  }

  const liquidityGap = Math.max(0, needed);
  const amountFunded = targetAmount - liquidityGap;

  return {
    buckets: b,
    withdrawalSource: sources.join(' + ') || 'None',
    amountFunded,
    liquidityGap,
  };
};
