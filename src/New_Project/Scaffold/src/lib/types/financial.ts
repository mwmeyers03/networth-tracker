/**
 * Financial Type Definitions for Net Worth Tracker
 * Strict TypeScript interfaces derived from existing JavaScript data model
 */

/**
 * Global configuration for the FIRE calculation engine
 */
export interface Globals {
  // Portfolio Allocation
  stockAllocation: number; // 0-1
  bondAllocation: number;  // 0-1
  cashAllocation: number;  // 0-1

  // Asset Class Returns & Volatility
  stockReturn: number;
  stockVolatility: number;
  bondReturn: number;
  bondVolatility: number;
  cashReturn: number;
  inflationRate: number;

  // Starting Balances (Individual)
  michael401kStart: number;
  brianna401kStart: number;
  michaelRothStart: number;
  briannaRothStart: number;
  michaelBrokerageStart: number;
  briannaBrokerageStart: number;
  michaelSavingsStart: number;
  briannaSavingsStart: number;

  // Salaries & Growth
  michaelStartSalary: number;
  briannaStartSalary: number;
  michaelSalaryGrowth: number;
  briannaSalaryGrowth: number;

  // Retirement Contributions (Individual)
  michael401kRate: number;      // Percentage of salary
  michael401kMatch: number;     // Employer match percentage
  brianna401kRate: number;
  brianna401kMatch: number;
  michaelRothYearlyContrib: number;
  briannaRothYearlyContrib: number;

  // Tax & Penalties
  capitalGainsTaxRate: number;
  earlyWithdrawalPenalty: number;
  state: string;
  stateTaxRates: Record<string, number>;

  // Social Security
  michaelSocialSecurityAge: number;
  briannaSocialSecurityAge: number;
  michaelYearsWorked: number;
  briannaYearsWorked: number;

  // Retirement Parameters
  michaelRetirementAge: number;
  briannaRetirementAge: number;
  lifeExpectancy: number;
  withdrawalMethod: 'portfolioPercent' | 'constantDollar' | 'oneOverN' | 'endowment' | 'maximize' | 'vpw' | 'guytonKlinger';
  portfolioPercentRate: number;
  constantDollarAmount: number;

  // Year-by-year overrides
  yearOverrides: Record<number, YearOverride>;
}

/**
 * Override configuration for a specific year
 */
export interface YearOverride {
  michaelExpenses?: number;
  briannaExpenses?: number;
  michael401k?: number;
  brianna401k?: number;
  michaelRoth?: number;
  briannaRoth?: number;
  michaelBrokerage?: number;
  briannaBrokerage?: number;
  michaelSavings?: number;
  briannaSavings?: number;
}

/**
 * Monthly expenses for a single person
 */
export interface MonthlyExpenses {
  insurance?: number;
  gas?: number;
  food?: number;
  dates?: number;
  rent?: number;
  car?: number;
  vacationFund?: number;
  [key: string]: number | undefined;
}

/**
 * Retirement-specific expenses configuration
 */
export interface RetirementExpenses {
  yearlyAmount: number;
}

/**
 * Special financial event (e.g., house purchase, inheritance)
 */
export interface SpecialEvent {
  id?: string | number;
  year: number;
  type: string;
  description: string;
  amount: number;
}

/**
 * Salary adjustments for a specific year
 */
export interface SalaryAdjustments {
  [year: number]: {
    michaelSalary?: number;
    briannaSalary?: number;
  };
}

/**
 * Account balances for a single person
 */
export interface PersonAccountBalances {
  m401kBal: number;
  mRothBal: number;
  mBrokerageBal: number;
  mSavingsBal: number;
}

/**
 * Single projection year in the 42-year array
 */
export interface ProjectionYear {
  year: number;
  michaelAge: number;
  briannaAge: number;

  // Salary & Expenses
  mSalary: number;
  bSalary: number;
  combinedGross: number;
  mExp: number;
  bExp: number;
  combinedExp: number;

  // Account Balances
  m401kBal: number;
  b401kBal: number;
  total401k: number;
  mRothBal: number;
  bRothBal: number;
  totalRoth: number;
  mBrokerageBal: number;
  bBrokerageBal: number;
  totalBrokerage: number;
  mSavingsBal: number;
  bSavingsBal: number;
  totalSavings: number;

  // Net Worth
  michaelNetWorth: number;
  briannaNetWorth: number;
  netWorth: number;

  // Retirement & Income
  withdrawalSource: string;
  socialSecurityIncome: number;
  retired: boolean;
  michaelRetired: boolean;
  briannaRetired: boolean;

  // Shortfall
  liquidityGap: number;

  // Actual withdrawal amount for this year (dynamic — reflects chosen withdrawal strategy)
  actualWithdrawalAmount: number;
}

/**
 * Array of 42 annual projection years (2024-2065)
 */
export type ProjectionData = ProjectionYear[];

/**
 * Tax calculation result
 */
export interface TaxBreakdown {
  federalIncomeTax: number;
  fica: number;
  stateLocalTax: number;
  totalTax: number;
  netAfterTax: number;
}

/**
 * Portfolio composition with weighted returns
 */
export interface PortfolioMetrics {
  expectedReturn: number;
  volatility: number;
}

/**
 * Social Security calculation parameters and result
 */
export interface SocialSecurityBenefit {
  monthlyEarningsAvg: number;
  primaryInsuranceAmount: number;
  annualBenefit: number;
  claimingAge: number;
  fullRetirementAge: number;
}
