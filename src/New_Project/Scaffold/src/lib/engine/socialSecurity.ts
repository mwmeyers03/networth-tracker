/**
 * Social Security Calculation Engine
 * Implements U.S. Social Security benefit formula with bend points and early claiming adjustments
 */

import type { SocialSecurityBenefit } from '../types/financial';

// 2024 Social Security bend points (monthly earnings thresholds)
const BEND_POINT_1 = 1174;
const BEND_POINT_2 = 7078;

// Bend point replacement rates
const BEND_RATE_1 = 0.9;   // 90% of first bend point
const BEND_RATE_2 = 0.32;  // 32% of second band
const BEND_RATE_3 = 0.15;  // 15% above second bend point

// Full Retirement Age (FRA) assumptions
const FULL_RETIREMENT_AGE = 67; // Current generation
const EARLY_CLAIMING_REDUCTION_RATE = 0.06667; // ~6.67% per year before FRA
const EARLY_CLAIMING_MINIMUM = 0.7; // Minimum 70% of full benefit at age 62

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

  // Build salary progression for the years worked
  let totalSalary = 0;
  for (let i = 0; i < yearsWorked; i++) {
    const yearSalary = startSalary * Math.pow(1 + salaryGrowth, i);
    totalSalary += yearSalary;
  }

  const avgAnnualSalary = totalSalary / yearsWorked;
  const monthlyEarnings = avgAnnualSalary / 12;

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

  // Adjust for early claiming (claiming before full retirement age reduces benefit)
  if (claimingAge < FULL_RETIREMENT_AGE) {
    const yearsEarly = FULL_RETIREMENT_AGE - claimingAge;
    const reductionFactor = 1 - yearsEarly * EARLY_CLAIMING_REDUCTION_RATE;
    annualBenefit *= Math.max(EARLY_CLAIMING_MINIMUM, reductionFactor);
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

  // Average earnings calculation
  let totalSalary = 0;
  for (let i = 0; i < yearsWorked; i++) {
    const yearSalary = startSalary * Math.pow(1 + salaryGrowth, i);
    totalSalary += yearSalary;
  }
  const avgAnnualSalary = totalSalary / yearsWorked;
  const monthlyEarningsAvg = avgAnnualSalary / 12;

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

  return {
    monthlyEarningsAvg,
    primaryInsuranceAmount: pia,
    annualBenefit: Math.round(annualBenefit),
    claimingAge,
    fullRetirementAge: FULL_RETIREMENT_AGE
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
