// Explicit, framework-free compatibility boundary. These helpers are migrated independently.
export {clone,validate} from '../../../../engine/plan.mjs';
export {housingSchedule} from '../../../../engine/housing.mjs';
export {accessBreakdown} from '../../../../engine/access.mjs';
export {salaryAt,employerContribution} from '../../../../engine/employment.mjs';
export {healthcareAt,povertyLevel,coverageMonths} from '../../../../engine/healthcare.mjs';
export {effectiveStrategy,annualSavingsFlow} from '../../../../engine/savings-strategy.mjs';
export {retirementEnvelope,envelopeCosts,isRetirementExpense} from '../../../../engine/budget.mjs';
