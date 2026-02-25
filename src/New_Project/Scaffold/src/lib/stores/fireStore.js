import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import {
	buildProjection,
	calculatePortfolioReturn,
	calculatePortfolioVolatility,
	calculateFederalTax,
	calculateSocialSecurity
} from '../engine';
import { getProjectionManager } from '../engine/projectionWorkerManager';
import { createSupabaseStore, createSupabaseArrayStore } from './supabaseStore';
import { DEFAULT_HOUSEHOLD_ID } from '../supabaseClient';

// Use fallback localStore for initialization
const localStore = (key, initialValue) => {
	const serialize = (value) => JSON.stringify(value);
	const deserialize = (value) => {
		try {
			return JSON.parse(value);
		} catch {
			return initialValue;
		}
	};

	const storedValue = browser ? localStorage.getItem(key) : null;
	// Merge stored values with initial values to ensure new fields are added
	const data = storedValue ? { ...initialValue, ...deserialize(storedValue) } : initialValue;

	const store = writable(data);

	if (browser) {
		store.subscribe((value) => {
			localStorage.setItem(key, serialize(value));
		});
	}

	return store;
};

const START_YEAR = 2025;
const END_YEAR = 2065;
const MICHAEL_START_AGE = 22;
const BRIANNA_START_AGE = 21;

export const globals = localStore('fire-globals', {
  // Portfolio Allocation
	stockAllocation: 0.70,
	bondAllocation: 0.20,
  cashAllocation: 0.10,
  // Asset Class Returns & Volatility
  stockReturn: 0.08,
  stockVolatility: 0.18,
  bondReturn: 0.04,
  bondVolatility: 0.05,
  cashReturn: 0.035,
  inflationRate: 0.025,
  // Starting Balances (Individual)
  michael401kStart: 29000,
  brianna401kStart: 7000,
  michaelRothStart: 20000,
  briannaRothStart: 0,
  michaelBrokerageStart: 140000,
  briannaBrokerageStart: 0,
  michaelSavingsStart: 5000,
  briannaSavingsStart: 2000,
	michaelHsaStart: 0,
	briannaHsaStart: 0,
	michael529Start: 0,
	brianna529Start: 0,
  // Salaries & Growth
	michaelStartSalary: 81700,
	briannaStartSalary: 35000,
	michaelSalaryGrowth: 0.03,
	briannaSalaryGrowth: 0.03,
  // Retirement Contributions (Individual)
	michael401kRate: 0.15,
	michael401kMatch: 0.06,
	brianna401kRate: 0.08,
	brianna401kMatch: 0.03,
  michaelRothYearlyContrib: 7000,
  briannaRothYearlyContrib: 0,
	michaelHsaYearlyContrib: 0,
	briannaHsaYearlyContrib: 0,
	michael529YearlyContrib: 0,
	brianna529YearlyContrib: 0,
	healthcareAnnual: 0,
	educationAnnual: 0,
	ira415cLimit: 69000,
	michaelStateMachine: {},
	briannaStateMachine: {},

  // Tax & Penalties
  capitalGainsTaxRate: 0.15,
  earlyWithdrawalPenalty: 0.10,
  state: 'FL',
  // State tax rates by state
  stateTaxRates: {
    'AL': 0.00, 'AK': 0.00, 'AZ': 0.0475, 'AR': 0.065, 'CA': 0.093,
    'CO': 0.0485, 'CT': 0.0699, 'DE': 0.066, 'FL': 0.00, 'GA': 0.055,
    'HI': 0.088, 'ID': 0.0585, 'IL': 0.0495, 'IN': 0.0365, 'IA': 0.0898,
    'KS': 0.057, 'KY': 0.065, 'LA': 0.06, 'ME': 0.0875, 'MD': 0.0875,
    'MA': 0.0505, 'MI': 0.046, 'MN': 0.0985, 'MS': 0.05, 'MO': 0.065,
    'MT': 0.10, 'NE': 0.0684, 'NV': 0.00, 'NH': 0.00, 'NJ': 0.0885,
    'NM': 0.077, 'NY': 0.0885, 'NC': 0.0425, 'ND': 0.029, 'OH': 0.0575,
    'OK': 0.065, 'OR': 0.0995, 'PA': 0.0307, 'RI': 0.06375, 'SC': 0.07,
    'SD': 0.00, 'TN': 0.00, 'TX': 0.00, 'UT': 0.0485, 'VT': 0.0875,
    'VA': 0.0775, 'WA': 0.00, 'WV': 0.065, 'WI': 0.0993, 'WY': 0.00
  },
  // Social Security
  michaelSocialSecurityAge: 62,
  briannaSocialSecurityAge: 62,
  michaelYearsWorked: 24, // Age 21 to retirement at 45
  briannaYearsWorked: 24, // Age 21 to retirement at 45
  // Retirement Parameters
  michaelRetirementAge: 45,
  briannaRetirementAge: 45,
  lifeExpectancy: 100,
  withdrawalMethod: 'portfolioPercent', // 'portfolioPercent', 'constantDollar', 'oneOverN', 'endowment', 'maximize'
  portfolioPercentRate: 0.04,
  constantDollarAmount: 80000,
  // Early Retirement Strategies
  enableSEPP: false,
  seppRate: 0.05,
  enableRothLadder: false,
  rothLadderAmount: 0,
  // Year-by-year overrides
  yearOverrides: {}
});

export const michaelExpenses = localStore('fire-michael-expenses', {
	insurance: 220,
	gas: 252,
	food: 200,
	dates: 160,
	rent: 600,
	vacationFund: 200
});

export const briannaExpenses = localStore('fire-brianna-expenses', {
	insurance: 350,
	gas: 252,
	food: 200,
	car: 600,
	rent: 150,
	vacationFund: 200
});

export const retirementExpenses = localStore('fire-retirement-expenses', { yearlyAmount: 80000 });

export const specialEvents = localStore('fire-special-events', [
  // Example: { id: 1, year: 2028, type: 'house', description: 'House Down Payment', amount: 50000 }
]);

export const salaryAdjustments = localStore('fire-salary-adjustments', {
  // Example: { '2026': { michaelSalary: 0, briannaSalary: 35000 } }
});

// Loading indicator store (true when projections are calculating)
export const isCalculating = writable(false);

// Re-export for backward compatibility
export { calculateFederalTax };

export const formatCur = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

export const formatLabel = (label) =>
  label
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const normalRandom = () => {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// Calculate Social Security benefit based on work history
// Re-export for backward compatibility
export { calculateSocialSecurity };

// Derived stores for Social Security Annual Benefits
export const michaelSocialSecurityAnnual = derived(
	globals,
	($globals) => {
		if (!$globals) return 0;
		return calculateSocialSecurity(
			$globals.michaelStartSalary,
			$globals.michaelSalaryGrowth,
			$globals.michaelYearsWorked,
			$globals.michaelSocialSecurityAge
		);
	}
);

export const briannaSocialSecurityAnnual = derived(
	globals,
	($globals) => {
		if (!$globals) return 0;
		return calculateSocialSecurity(
			$globals.briannaStartSalary,
			$globals.briannaSalaryGrowth,
			$globals.briannaYearsWorked,
			$globals.briannaSocialSecurityAge
		);
	}
);

// Re-export for backward compatibility
export { calculatePortfolioReturn };

// Re-export for backward compatibility
export { calculatePortfolioVolatility };

// Re-export buildProjection for backward compatibility (now imported from engine)
export { buildProjection };

// Worker-based projection stores (no debounce so UI refreshes immediately)
let lastProjectionResult = {
	conservativeData: [],
	financialData: [],
	aggressiveData: []
};

const conservativeDataStore = writable([]);
const financialDataStore = writable([]);
const aggressiveDataStore = writable([]);

const calculateProjections = async (
	$globals,
	$michaelExpenses,
	$briannaExpenses,
	$retirementExpenses,
	$specialEvents,
	$salaryAdjustments
)	=> {
	try {
		const manager = getProjectionManager();
		isCalculating.set(true);

		const result = await manager.calculateProjections({
			globals: $globals,
			michaelExpenses: $michaelExpenses,
			briannaExpenses: $briannaExpenses,
			retirementExpenses: $retirementExpenses,
			specialEvents: $specialEvents,
			salaryAdjustments: $salaryAdjustments
		});

		if (result.success) {
			lastProjectionResult = {
				conservativeData: result.conservativeData || [],
				financialData: result.financialData || [],
				aggressiveData: result.aggressiveData || []
			};
		} else {
			console.error('Projection calculation error:', result.error);
			const baseReturn = calculatePortfolioReturn($globals);
			const volatility = calculatePortfolioVolatility($globals);
			const conservativeReturn = baseReturn - volatility * 0.67;
			const aggressiveReturn = baseReturn + volatility * 0.67;

			lastProjectionResult = {
				conservativeData: buildProjection(
					$globals,
					$michaelExpenses,
					$briannaExpenses,
					$retirementExpenses,
					$specialEvents,
					$salaryAdjustments,
					conservativeReturn
				),
				financialData: buildProjection(
					$globals,
					$michaelExpenses,
					$briannaExpenses,
					$retirementExpenses,
					$specialEvents,
					$salaryAdjustments,
					null
				),
				aggressiveData: buildProjection(
					$globals,
					$michaelExpenses,
					$briannaExpenses,
					$retirementExpenses,
					$specialEvents,
					$salaryAdjustments,
					aggressiveReturn
				)
			};
		}

		conservativeDataStore.set(lastProjectionResult.conservativeData);
		financialDataStore.set(lastProjectionResult.financialData);
		aggressiveDataStore.set(lastProjectionResult.aggressiveData);
	} catch (error) {
		console.error('Error calculating projections:', error);
	} finally {
		isCalculating.set(false);
	}
};

// Set up subscription to trigger calculations immediately on change
let unsubscribe = null;
if (browser) {
	unsubscribe = derived(
		[globals, michaelExpenses, briannaExpenses, retirementExpenses, specialEvents, salaryAdjustments],
		([$globals, $michaelExpenses, $briannaExpenses, $retirementExpenses, $specialEvents, $salaryAdjustments]) => {
			calculateProjections($globals, $michaelExpenses, $briannaExpenses, $retirementExpenses, $specialEvents, $salaryAdjustments);
			return null;
		}
	).subscribe(() => {});
}

export const conservativeData = derived(conservativeDataStore, ($data) => $data);
export const financialData = derived(financialDataStore, ($data) => $data);
export const aggressiveData = derived(aggressiveDataStore, ($data) => $data);

// Initialize projection manager on first store subscription
let projectionManagerInitialized = false;

function initializeProjectionManager() {
	if (!browser || projectionManagerInitialized) return;
	projectionManagerInitialized = true;
	// Manager is lazily created on first use
}

export { START_YEAR, END_YEAR, MICHAEL_START_AGE, BRIANNA_START_AGE };
