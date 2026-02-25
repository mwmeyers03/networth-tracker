/**
 * Social Security Calculation Engine
 * Implements U.S. Social Security benefit formula with bend points and early claiming adjustments
 */

import type { SocialSecurityBenefit } from '../types/financial';

// 2026 Social Security bend points (monthly earnings thresholds)
const BEND_POINT_1 = 1286;
const BEND_POINT_2 = 7749;

// Bend point replacement rates
const BEND_RATE_1 = 0.9;   // 90% of first bend point
const BEND_RATE_2 = 0.32;  // 32% of second band
const BEND_RATE_3 = 0.15;  // 15% above second bend point

// Full Retirement Age (FRA) assumptions
const FULL_RETIREMENT_AGE = 67; // Current generation
const EARLY_CLAIMING_REDUCTION_RATE = 0.06667; // ~6.67% per year before FRA
const EARLY_CLAIMING_MINIMUM = 0.7; // Minimum 70% of full benefit at age 62
const DELAYED_RETIREMENT_CREDIT = 0.08; // 8% per year after FRA up to age 70
const INDEXED_YEARS = 35; // SSA averages highest 35 indexed earnings years

const buildIndexedEarnings = (
  startSalary: number,
  salaryGrowth: number,
  yearsWorked: number,
) => {
  // Generate earnings history with compound growth; pad with zeros to 35 years
  const earnings: number[] = [];
  for (let i = 0; i < yearsWorked; i++) {
    earnings.push(startSalary * Math.pow(1 + salaryGrowth, i));
  }
  while (earnings.length < INDEXED_YEARS) earnings.push(0);

  // SSA uses highest 35 years; wages are wage-indexed in practice, here we approximate
  const top35 = earnings.sort((a, b) => b - a).slice(0, INDEXED_YEARS);
  const aime = top35.reduce((sum, val) => sum + val, 0) / (INDEXED_YEARS * 12);
  return { aime, top35 };
};

/**
 * Calculate Social Security Primary Insurance Amount (PIA) and annual benefit
 * Pure function: no side effects
 *
 * Uses simplified average indexed monthly earnings (AIME) approach based on years worked.
 * Applies bend point formula and early claiming reductions.
 *
 * @param startSalary - Initial salary at age of calculation
 * @param salaryGrowth - Annual salary growth rate
 * @param yearsWorked - Number of years worked (for averaging)
 * @param claimingAge - Age when claiming Social Security benefits
 * @returns Annual Social Security benefit amount
 */
export const calculateSocialSecurity = (
  startSalary: number,
  salaryGrowth: number,
  yearsWorked: number,
  claimingAge: number
): number => {
  if (yearsWorked <= 0 || !startSalary) {
    return 0;
  }

  // Build indexed earnings and compute AIME using highest 35 years
  const { aime } = buildIndexedEarnings(startSalary, salaryGrowth, yearsWorked);
  const monthlyEarnings = aime;

  // Calculate Primary Insurance Amount (PIA) using bend points
  let pia = 0;
  if (monthlyEarnings > 0) {
    pia += Math.min(monthlyEarnings, BEND_POINT_1) * BEND_RATE_1;
  }
  if (monthlyEarnings > BEND_POINT_1) {
    pia += Math.min(monthlyEarnings - BEND_POINT_1, BEND_POINT_2 - BEND_POINT_1) * BEND_RATE_2;
  }
  if (monthlyEarnings > BEND_POINT_2) {
    pia += (monthlyEarnings - BEND_POINT_2) * BEND_RATE_3;
  }

  // Annual benefit at full retirement age
  let annualBenefit = pia * 12;

  // Early claiming reduction
  if (claimingAge < FULL_RETIREMENT_AGE) {
    const yearsEarly = FULL_RETIREMENT_AGE - claimingAge;
    const reductionFactor = 1 - yearsEarly * EARLY_CLAIMING_REDUCTION_RATE;
    annualBenefit *= Math.max(EARLY_CLAIMING_MINIMUM, reductionFactor);
  }

  // Delayed retirement credits (up to age 70)
  if (claimingAge > FULL_RETIREMENT_AGE) {
    const yearsDelayed = Math.min(70, claimingAge) - FULL_RETIREMENT_AGE;
    if (yearsDelayed > 0) {
      annualBenefit *= 1 + yearsDelayed * DELAYED_RETIREMENT_CREDIT;
    }
  }

  return Math.round(annualBenefit);
};

/**
 * Calculate detailed Social Security benefit information
 * Pure function: no side effects
 *
 * @param startSalary - Initial salary
 * @param salaryGrowth - Annual salary growth rate
 * @param yearsWorked - Number of years worked
 * @param claimingAge - Age when claiming
 * @returns Detailed benefit breakdown
 */
export const calculateSocialSecurityBenefit = (
  startSalary: number,
  salaryGrowth: number,
  yearsWorked: number,
  claimingAge: number
): SocialSecurityBenefit => {
  if (yearsWorked <= 0 || !startSalary) {
    return {
      monthlyEarningsAvg: 0,
      primaryInsuranceAmount: 0,
      annualBenefit: 0,
      claimingAge,
      fullRetirementAge: FULL_RETIREMENT_AGE
    };
  }

  const { aime, top35 } = buildIndexedEarnings(startSalary, salaryGrowth, yearsWorked);
  const monthlyEarningsAvg = aime;

  // PIA calculation
  let pia = 0;
  if (monthlyEarningsAvg > 0) {
    pia += Math.min(monthlyEarningsAvg, BEND_POINT_1) * BEND_RATE_1;
  }
  if (monthlyEarningsAvg > BEND_POINT_1) {
    pia += Math.min(monthlyEarningsAvg - BEND_POINT_1, BEND_POINT_2 - BEND_POINT_1) * BEND_RATE_2;
  }
  if (monthlyEarningsAvg > BEND_POINT_2) {
    pia += (monthlyEarningsAvg - BEND_POINT_2) * BEND_RATE_3;
  }

  // Annual benefit at FRA
  let annualBenefit = pia * 12;

  // Early claiming adjustment
  if (claimingAge < FULL_RETIREMENT_AGE) {
    const yearsEarly = FULL_RETIREMENT_AGE - claimingAge;
    const reductionFactor = 1 - yearsEarly * EARLY_CLAIMING_REDUCTION_RATE;
    annualBenefit *= Math.max(EARLY_CLAIMING_MINIMUM, reductionFactor);
  }

  // Delayed retirement credit
  if (claimingAge > FULL_RETIREMENT_AGE) {
    const yearsDelayed = Math.min(70, claimingAge) - FULL_RETIREMENT_AGE;
    if (yearsDelayed > 0) {
      annualBenefit *= 1 + yearsDelayed * DELAYED_RETIREMENT_CREDIT;
    }
  }

  return {
    monthlyEarningsAvg,
    primaryInsuranceAmount: pia,
    annualBenefit: Math.round(annualBenefit),
    claimingAge,
    fullRetirementAge: FULL_RETIREMENT_AGE,
    indexedEarnings: top35,
  };
};

/**
 * Get early claiming reduction factor
 * Useful for UI to display claiming age impact
 *
 * @param claimingAge - Age when claiming
 * @returns Percentage of full benefit (0.7 to 1.0)
 */
export const getClaimingReductionFactor = (claimingAge: number): number => {
  if (claimingAge >= FULL_RETIREMENT_AGE) {
    return 1.0;
  }
  const yearsEarly = FULL_RETIREMENT_AGE - claimingAge;
  const reductionFactor = 1 - yearsEarly * EARLY_CLAIMING_REDUCTION_RATE;
  return Math.max(EARLY_CLAIMING_MINIMUM, reductionFactor);
};
