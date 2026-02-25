/**
 * Web Worker Projection Manager
 * Manages worker lifecycle, debouncing, and result caching
 * Prevents UI blocking during 42-year projection calculations
 */

import type { ProjectionData } from '../types/financial';

interface ProjectionWorkerResult {
  conservativeData?: ProjectionData;
  financialData?: ProjectionData;
  aggressiveData?: ProjectionData;
  success?: boolean;
  error?: string;
  ready?: boolean;
}

interface ProjectionWorkerInput {
  globals: any;
  michaelExpenses: Record<string, number>;
  briannaExpenses: Record<string, number>;
  retirementExpenses: { yearlyAmount: number };
  specialEvents: any[];
  salaryAdjustments: Record<number, any>;
}

export class ProjectionWorkerManager {
  private worker: Worker | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number = 300;
  private pendingRequest: ((result: ProjectionWorkerResult) => void)[] = [];
  private isCalculating: boolean = false;
  private lastInput: ProjectionWorkerInput | null = null;
  private recalcRequested: boolean = false;

  constructor(debounceMs: number = 300) {
    this.debounceMs = debounceMs;
    this.initializeWorker();
  }

  /**
   * Initialize the Web Worker
   */
  private initializeWorker(): void {
    if (typeof window === 'undefined') return; // SSR safety check

    try {
      const workerUrl = new URL('../engine/projection.worker.ts', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });

      this.worker.onmessage = (event: MessageEvent<ProjectionWorkerResult>) => {
        if (event.data.ready) {
          console.log('✅ Projection worker ready');
          return;
        }

        this.isCalculating = false;

        // If newer input arrived while this run was in-flight, run again first
        // and resolve all queued callers with the freshest result.
        if (this.recalcRequested && this.lastInput) {
          this.recalcRequested = false;
          this.executeCalculation(this.lastInput);
          return;
        }

        if (event.data.success) {
          // Resolve all pending callbacks
          const { conservativeData, financialData, aggressiveData } = event.data;
          this.pendingRequest.forEach((callback) => {
            callback({
              conservativeData,
              financialData,
              aggressiveData,
              success: true
            });
          });
        } else {
          // Handle error
          console.error('Worker error:', event.data.error);
          this.pendingRequest.forEach((callback) => {
            callback({
              success: false,
              error: event.data.error
            });
          });
        }

        this.pendingRequest = [];
      };

      this.worker.onerror = (error) => {
        this.isCalculating = false;
        console.error('Worker initialization error:', error);
        this.pendingRequest.forEach((callback) => {
          callback({
            success: false,
            error: error.message
          });
        });
        this.pendingRequest = [];
      };
    } catch (err) {
      console.warn('Could not initialize Web Worker, will fall back to main thread:', err);
    }
  }

  /**
   * Calculate projections with debouncing
   * Multiple calls within debounceMs are coalesced into a single calculation
   *
   * @param input Projection parameters
   * @returns Promise that resolves with projection data
   */
  calculateProjections(input: ProjectionWorkerInput): Promise<ProjectionWorkerResult> {
    return new Promise((resolve) => {
      // Add callback to pending list
      this.pendingRequest.push(resolve);

      // Clear existing debounce timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Store the latest input
      this.lastInput = input;

      // Debounce the actual calculation
      this.debounceTimer = setTimeout(() => {
        if (this.lastInput) {
          this.executeCalculation(this.lastInput);
        }
      }, this.debounceMs);
    });
  }

  /**
   * Execute the calculation (possibly on worker)
   */
  private executeCalculation(input: ProjectionWorkerInput): void {
    if (this.isCalculating) {
      // Calculation already in progress, new request will be handled after
      this.recalcRequested = true;
      return;
    }

    this.isCalculating = true;

    // Try to use worker if available
    if (this.worker) {
      try {
        this.worker.postMessage(input);
        return;
      } catch (err) {
        console.warn('Worker failed, falling back to main thread:', err);
      }
    }

    // Fallback to main thread (synchronous blocking)
    this.fallbackCalculation(input);
  }

  /**
   * Fallback calculation on main thread
   * Used if Web Worker is unavailable
   */
  private async fallbackCalculation(input: ProjectionWorkerInput): Promise<void> {
    try {
      // Dynamically import to avoid circular dependencies
      const {
        buildProjection,
        calculatePortfolioReturn,
        calculatePortfolioVolatility
      } = await import('./index');

      const baseReturn = calculatePortfolioReturn(input.globals);
      const volatility = calculatePortfolioVolatility(input.globals);

      const conservativeReturn = baseReturn - volatility * 0.67;
      const aggressiveReturn = baseReturn + volatility * 0.67;

      const conservativeData = buildProjection(
        input.globals,
        input.michaelExpenses,
        input.briannaExpenses,
        input.retirementExpenses,
        input.specialEvents,
        input.salaryAdjustments,
        conservativeReturn
      );

      const financialData = buildProjection(
        input.globals,
        input.michaelExpenses,
        input.briannaExpenses,
        input.retirementExpenses,
        input.specialEvents,
        input.salaryAdjustments,
        null
      );

      const aggressiveData = buildProjection(
        input.globals,
        input.michaelExpenses,
        input.briannaExpenses,
        input.retirementExpenses,
        input.specialEvents,
        input.salaryAdjustments,
        aggressiveReturn
      );

      this.isCalculating = false;

      if (this.recalcRequested && this.lastInput) {
        this.recalcRequested = false;
        this.executeCalculation(this.lastInput);
        return;
      }

      // Resolve all pending callbacks
      this.pendingRequest.forEach((callback) => {
        callback({
          conservativeData,
          financialData,
          aggressiveData,
          success: true
        });
      });
      this.pendingRequest = [];
    } catch (error) {
      this.isCalculating = false;

      if (this.recalcRequested && this.lastInput) {
        this.recalcRequested = false;
        this.executeCalculation(this.lastInput);
        return;
      }

      this.pendingRequest.forEach((callback) => {
        callback({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });
      this.pendingRequest = [];
    }
  }

  /**
   * Check if calculation is in progress
   */
  getIsCalculating(): boolean {
    return this.isCalculating;
  }

  /**
   * Terminate the worker (cleanup)
   */
  terminate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Singleton instance
let projectionManager: ProjectionWorkerManager | null = null;

/**
 * Get or create the singleton projection manager
 */
export function getProjectionManager(): ProjectionWorkerManager {
  if (!projectionManager) {
    projectionManager = new ProjectionWorkerManager(300); // 300ms debounce
  }
  return projectionManager;
}
