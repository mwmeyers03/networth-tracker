/**
 * simulationStore.ts
 * ------------------
 * Reactive Svelte store that bridges the financial data stores (fireStore.js)
 * with the historical backtest Web Worker (SimulationWorkerManager).
 *
 * Flow:
 *   globals + retirementExpenses + financialData
 *     → (debounced, 500 ms)
 *     → simulationManager.run()
 *     → simulationResult / simulationProgress / simulationRunning
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { globals, retirementExpenses, financialData } from './fireStore.js';
import { simulationManager, globalsToSimulationInput } from '../engine/simulationWorkerManager';
import type { SimulationResult } from '../types/simulation';
import { debounce } from '../utils/debounce';

// ─── Public stores ────────────────────────────────────────────────────────────

/** 0–1 progress fraction while a simulation run is in flight. */
export const simulationProgress = writable<number>(0);

/** Latest completed SimulationResult (null until first run finishes). */
export const simulationResult = writable<SimulationResult | null>(null);

/** True while the worker is running. */
export const simulationRunning = writable<boolean>(false);

// ─── Internal trigger ─────────────────────────────────────────────────────────

const _triggerSimulation = debounce(
  (g: any, retExp: any, projData: any[]) => {
    if (!browser || !projData?.length) return;

    // Find the first year where both people are retired (full retirement onset)
    const retirementRow = projData.find((d: any) => d.retired);
    if (!retirementRow) return;

    const totalPortfolio = retirementRow.netWorth;
    if (totalPortfolio <= 0) return;

    const input = globalsToSimulationInput(g, totalPortfolio, retExp.yearlyAmount);

    simulationRunning.set(true);
    simulationProgress.set(0);

    simulationManager.run(input, {
      onProgress: (p) => simulationProgress.set(p),
      onResult: (result) => {
        simulationResult.set(result);
        simulationRunning.set(false);
        simulationProgress.set(1);
      },
      onError: (msg) => {
        console.error('[SimulationStore]', msg);
        simulationRunning.set(false);
      },
    });
  },
  500,
);

// ─── Wire up subscriptions (browser-only, avoids SSR issues) ─────────────────

if (browser) {
  derived(
    [globals, retirementExpenses, financialData],
    ([$g, $ret, $data]) => ({ g: $g, ret: $ret, data: $data as any[] }),
  ).subscribe(({ g, ret, data }) => {
    _triggerSimulation(g, ret, data);
  });
}

// ─── Convenience derived values ───────────────────────────────────────────────

/** Success rate as a percentage string e.g. "94%" */
export const successRateLabel = derived(
  simulationResult,
  ($r) => ($r ? `${Math.round($r.successRate * 100)}%` : '—'),
);

/** Safe withdrawal rate as a percentage string e.g. "3.72%" */
export const safeWithdrawalRateLabel = derived(
  simulationResult,
  ($r) => ($r ? `${($r.safeWithdrawalRate * 100).toFixed(2)}%` : '—'),
);

/**
 * Success rate colour class for use in UI badges.
 * Green ≥ 90%, Yellow 75–90%, Red < 75%.
 */
export const successRateColor = derived(simulationResult, ($r): 'green' | 'yellow' | 'red' => {
  if (!$r) return 'yellow';
  if ($r.successRate >= 0.9) return 'green';
  if ($r.successRate >= 0.75) return 'yellow';
  return 'red';
});
