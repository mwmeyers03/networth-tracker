/**
 * simulationWorkerManager.ts
 * ---------------------------
 * Main-thread facade for the simulation Web Worker.
 *
 * Responsibilities:
 *   • Spawn (and lazily re-use) the simulation worker
 *   • Serialize SimulationInput → WorkerRequestMessage
 *   • Deserialize WorkerOutboundMessage → typed callbacks
 *   • Expose a cancel() method that terminates the worker mid-run
 *   • Guard against stale results if a new request supersedes an old one
 *
 * Usage:
 * ```ts
 * import { SimulationWorkerManager } from '$lib/engine/simulationWorkerManager';
 *
 * const manager = new SimulationWorkerManager();
 *
 * manager.run(input, {
 *   onProgress: (pct) => console.log(`${pct}% done`),
 *   onResult:   (result) => store.set(result),
 *   onError:    (msg)    => console.error(msg),
 * });
 *
 * // Cancel a running simulation (e.g. when the user changes inputs)
 * manager.cancel();
 *
 * // Tear down completely (call on component destroy)
 * manager.destroy();
 * ```
 */

import type {
  SimulationInput,
  SimulationResult,
  WorkerOutboundMessage,
} from '../types/simulation';

// ─── Callback interface ───────────────────────────────────────────────────────

export interface SimulationCallbacks {
  /** Called periodically during a run. `progress` is 0–1. */
  onProgress?: (progress: number) => void;
  /** Called once when the simulation completes successfully. */
  onResult: (result: SimulationResult) => void;
  /** Called if the worker throws an error. */
  onError?: (message: string) => void;
}

// ─── Manager class ────────────────────────────────────────────────────────────

export class SimulationWorkerManager {
  private worker: Worker | null = null;
  /** Monotonically incrementing ID — used to discard stale responses. */
  private runId = 0;

  // ─── Internal: lazily create a fresh worker ─────────────────────────────

  private spawnWorker(): Worker {
    // Vite's ?worker syntax — tree-shaken at build time to a separate chunk.
    // The `type: 'module'` is required for ESM workers (SvelteKit / Vite).
    return new Worker(
      new URL('./simulation.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Run a simulation. If a previous run is still in-flight it is cancelled
   * before the new one starts.
   */
  run(input: SimulationInput, callbacks: SimulationCallbacks): void {
    // Cancel any existing worker first
    this.cancel();

    const currentRunId = ++this.runId;
    this.worker = this.spawnWorker();

    this.worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
      // Guard: ignore messages from superseded runs
      if (currentRunId !== this.runId) return;

      const msg = event.data;

      switch (msg.type) {
        case 'PROGRESS':
          callbacks.onProgress?.(msg.cohortsCompleted / msg.totalCohorts);
          break;

        case 'RESULT':
          callbacks.onResult(msg.result);
          // Worker has finished — clean up
          this.worker?.terminate();
          this.worker = null;
          break;

        case 'ERROR':
          callbacks.onError?.(msg.message);
          this.worker?.terminate();
          this.worker = null;
          break;
      }
    };

    this.worker.onerror = (err: ErrorEvent) => {
      if (currentRunId !== this.runId) return;
      callbacks.onError?.(`Worker error: ${err.message}`);
      this.worker?.terminate();
      this.worker = null;
    };

    // Kick off the simulation
    this.worker.postMessage({ type: 'RUN_SIMULATION', payload: input });
  }

  /**
   * Run the simulation as a Promise (no progress callbacks).
   * Resolves with the result, rejects on error or cancellation.
   */
  runAsync(input: SimulationInput): Promise<SimulationResult> {
    return new Promise((resolve, reject) => {
      this.run(input, {
        onResult: resolve,
        onError: reject,
      });
    });
  }

  /**
   * Abort the currently running simulation immediately.
   * The worker process is terminated; any in-flight results are discarded.
   */
  cancel(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    // Incrementing runId ensures any already-posted messages are ignored
    this.runId++;
  }

  /**
   * Destroy the manager. Call this from the Svelte `onDestroy` hook.
   */
  destroy(): void {
    this.cancel();
  }
}

// ─── Singleton helper for simple use-cases ────────────────────────────────────

/**
 * A module-level singleton manager.
 * Adequate for single-page apps where only one simulation runs at a time.
 * Import and use directly:
 *
 * ```ts
 * import { simulationManager } from '$lib/engine/simulationWorkerManager';
 * simulationManager.run(input, { onResult: (r) => myStore.set(r) });
 * ```
 */
export const simulationManager = new SimulationWorkerManager();

// ─── Utility: build SimulationInput from Globals ─────────────────────────────

import type { Globals } from '../types/financial';

const MICHAEL_BIRTH_YEAR = 2002; // age 22 in 2024
const BRIANNA_BIRTH_YEAR = 2003; // age 21 in 2024
const CURRENT_YEAR = 2024;

/**
 * Converts the existing `Globals` record (from fireStore / Supabase)
 * into a `SimulationInput` that the worker understands.
 *
 * @param globals         Full Globals configuration
 * @param totalPortfolio  Sum of all account balances at retirement
 * @param annualExpenses  Target annual spending in retirement
 */
export function globalsToSimulationInput(
  globals: Globals,
  totalPortfolio: number,
  annualExpenses: number,
): SimulationInput {
  // Earliest retirement year (whichever person retires first)
  const michaelRetireYear =
    MICHAEL_BIRTH_YEAR + globals.michaelRetirementAge;
  const briannaRetireYear =
    BRIANNA_BIRTH_YEAR + globals.briannaRetirementAge;
  const retirementStartYear = Math.min(michaelRetireYear, briannaRetireYear);

  // Duration: from first retirement to life expectancy
  const youngestRetirementAge = Math.min(
    globals.michaelRetirementAge,
    globals.briannaRetirementAge,
  );
  const retirementDurationYears =
    globals.lifeExpectancy - youngestRetirementAge;

  // Social Security as additional income events
  const additionalIncomeEvents = [];

  const michaelSSYear = MICHAEL_BIRTH_YEAR + globals.michaelSocialSecurityAge;
  if (michaelSSYear > retirementStartYear) {
    additionalIncomeEvents.push({
      startYear: michaelSSYear,
      // Rough SS estimate: ~30% of final salary inflation-adjusted
      annualAmount: globals.michaelStartSalary * 0.30,
      inflationAdjusted: true,
    });
  }

  const briannaSSYear = BRIANNA_BIRTH_YEAR + globals.briannaSocialSecurityAge;
  if (briannaSSYear > retirementStartYear) {
    additionalIncomeEvents.push({
      startYear: briannaSSYear,
      annualAmount: globals.briannaStartSalary * 0.30,
      inflationAdjusted: true,
    });
  }

  return {
    startingBalance: totalPortfolio,
    stockAllocation: globals.stockAllocation,
    bondAllocation: globals.bondAllocation,
    cashAllocation: globals.cashAllocation,
    retirementStartYear,
    retirementDurationYears: Math.max(1, retirementDurationYears),
    initialAnnualWithdrawal: annualExpenses,
    withdrawalStrategy:
      (globals.withdrawalMethod as SimulationInput['withdrawalStrategy']) ??
      'constantDollar',
    additionalIncomeEvents,
    cashReturn: globals.cashReturn,
    currentAge: youngestRetirementAge,
  };
}

// Re-export the type so callers only need one import
export type { SimulationInput, SimulationResult } from '../types/simulation';
