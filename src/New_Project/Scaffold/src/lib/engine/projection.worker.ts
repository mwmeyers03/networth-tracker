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
  calculatePortfolioReturn,
  calculatePortfolioVolatility
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

    // Calculate base portfolio metrics for scenarios
    const baseReturn = calculatePortfolioReturn(globals);
    const volatility = calculatePortfolioVolatility(globals);

    // Conservative scenario (base return - volatility)
    const conservativeReturn = baseReturn - volatility * 0.67;
    const conservativeData = buildProjection(
      globals,
      michaelExpenses,
      briannaExpenses,
      retirementExpenses,
      specialEvents,
      salaryAdjustments,
      conservativeReturn
    );

    // Expected scenario (base return)
    const financialData = buildProjection(
      globals,
      michaelExpenses,
      briannaExpenses,
      retirementExpenses,
      specialEvents,
      salaryAdjustments,
      null // Use default portfolio return
    );

    // Aggressive scenario (base return + volatility)
    const aggressiveReturn = baseReturn + volatility * 0.67;
    const aggressiveData = buildProjection(
      globals,
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
