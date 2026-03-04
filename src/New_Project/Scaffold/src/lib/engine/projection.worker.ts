/**
 * Projection Web Worker
 * Runs 42-year projection calculations on a background thread
 * Prevents UI blocking during intensive math operations
 *
 * Usage from main thread:
 * ```typescript
 * const worker = new Worker(new URL('./projection.worker.ts', import.meta.url), { type: 'module' });
 * worker.postMessage({ globals, michaelExpenses, briannaExpenses, retirementExpenses, specialEvents, salaryAdjustments, customReturnRate });
 * worker.onmessage = (e) => {
 *   const { conservativeData, financialData, aggressiveData } = e.data;
 * };
 * ```
 */

import {
  buildProjection,
  calculatePortfolioReturn
} from './index';

interface ProjectionWorkerInput {
  globals: any;
  michaelExpenses: Record<string, number>;
  briannaExpenses: Record<string, number>;
  retirementExpenses: { yearlyAmount: number };
  specialEvents: any[];
  salaryAdjustments: Record<number, any>;
}

/**
 * Worker message handler
 * Receives calculation parameters and sends back projection data
 */
self.onmessage = (event: MessageEvent<ProjectionWorkerInput>) => {
  try {
    const {
      globals,
      michaelExpenses,
      briannaExpenses,
      retirementExpenses,
      specialEvents,
      salaryAdjustments
    } = event.data;

    const conservativeGlobals = {
      ...globals,
      stockAllocation: 0.60,
      bondAllocation: 0.30,
      cashAllocation: 0.10
    };
    const expectedGlobals = {
      ...globals,
      stockAllocation: 0.70,
      bondAllocation: 0.20,
      cashAllocation: 0.10
    };
    const aggressiveGlobals = {
      ...globals,
      stockAllocation: 0.80,
      bondAllocation: 0.10,
      cashAllocation: 0.10
    };

    const conservativeReturn = calculatePortfolioReturn(conservativeGlobals);
    const expectedReturn = calculatePortfolioReturn(expectedGlobals);
    const aggressiveReturn = calculatePortfolioReturn(aggressiveGlobals);

    const conservativeData = buildProjection(
      conservativeGlobals,
      michaelExpenses,
      briannaExpenses,
      retirementExpenses,
      specialEvents,
      salaryAdjustments,
      conservativeReturn
    );

    // Expected scenario
    const financialData = buildProjection(
      expectedGlobals,
      michaelExpenses,
      briannaExpenses,
      retirementExpenses,
      specialEvents,
      salaryAdjustments,
      expectedReturn
    );

    // Aggressive scenario
    const aggressiveData = buildProjection(
      aggressiveGlobals,
      michaelExpenses,
      briannaExpenses,
      retirementExpenses,
      specialEvents,
      salaryAdjustments,
      aggressiveReturn
    );

    // Send results back to main thread
    self.postMessage({
      conservativeData,
      financialData,
      aggressiveData,
      success: true
    });
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Indicate worker is ready
self.postMessage({ ready: true });
