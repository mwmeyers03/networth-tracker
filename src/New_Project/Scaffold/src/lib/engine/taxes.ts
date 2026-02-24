/**
 * Tax Calculation Engine
 * Pure functions for federal, FICA, and state tax calculations
 */

import type { TaxBreakdown } from '../types/financial';

/**
 * Calculate federal income tax, FICA, and state/local tax
 * Pure function: no side effects
 *
 * @param grossIncome - Total earned income before deductions
 * @param preTax401k - Pre-tax 401k contribution amount
 * @param state - Two-letter state abbreviation
 * @param stateTaxRates - Map of state codes to tax rates
 * @returns Net take-home pay after all taxes
 */
export const calculateFederalTax = (
  grossIncome: number,
  preTax401k: number = 0,
  state: string = 'CA',
  stateTaxRates: Record<string, number> = {}
): number => {
  const standardDeduction = 15750; // 2024 standard deduction
  const taxableIncome = Math.max(0, grossIncome - preTax401k - standardDeduction);

  // 2024 Federal Income Tax Brackets (Single Filer)
  let federalTax = 0;
  if (taxableIncome > 626350) {
    federalTax += (taxableIncome - 626350) * 0.37;
  }
  if (taxableIncome > 250525) {
    federalTax += (Math.min(taxableIncome, 626350) - 250525) * 0.35;
  }
  if (taxableIncome > 197300) {
    federalTax += (Math.min(taxableIncome, 250525) - 197300) * 0.32;
  }
  if (taxableIncome > 103350) {
    federalTax += (Math.min(taxableIncome, 197300) - 103350) * 0.24;
  }
  if (taxableIncome > 48475) {
    federalTax += (Math.min(taxableIncome, 103350) - 48475) * 0.22;
  }
  if (taxableIncome > 11925) {
    federalTax += (Math.min(taxableIncome, 48475) - 11925) * 0.12;
  }
  if (taxableIncome > 0) {
    federalTax += Math.min(taxableIncome, 11925) * 0.1;
  }

  // FICA (Social Security 6.2% + Medicare 1.45%)
  const fica = grossIncome * 0.0765;

  // State/Local Tax
  const stateRate = stateTaxRates[state] || 0;
  const stateLocalTax = taxableIncome * stateRate;

  // Net after-tax income
  const netAfterTax = grossIncome - preTax401k - federalTax - fica - stateLocalTax;

  return netAfterTax;
};

/**
 * Breakdown tax components for detailed reporting
 *
 * @param grossIncome - Total earned income before deductions
 * @param preTax401k - Pre-tax 401k contribution amount
 * @param state - Two-letter state abbreviation
 * @param stateTaxRates - Map of state codes to tax rates
 * @returns Detailed tax breakdown
 */
export const calculateTaxBreakdown = (
  grossIncome: number,
  preTax401k: number = 0,
  state: string = 'CA',
  stateTaxRates: Record<string, number> = {}
): TaxBreakdown => {
  const standardDeduction = 15750;
  const taxableIncome = Math.max(0, grossIncome - preTax401k - standardDeduction);

  let federalIncomeTax = 0;
  if (taxableIncome > 626350) federalIncomeTax += (taxableIncome - 626350) * 0.37;
  if (taxableIncome > 250525) federalIncomeTax += (Math.min(taxableIncome, 626350) - 250525) * 0.35;
  if (taxableIncome > 197300) federalIncomeTax += (Math.min(taxableIncome, 250525) - 197300) * 0.32;
  if (taxableIncome > 103350) federalIncomeTax += (Math.min(taxableIncome, 197300) - 103350) * 0.24;
  if (taxableIncome > 48475) federalIncomeTax += (Math.min(taxableIncome, 103350) - 48475) * 0.22;
  if (taxableIncome > 11925) federalIncomeTax += (Math.min(taxableIncome, 48475) - 11925) * 0.12;
  if (taxableIncome > 0) federalIncomeTax += Math.min(taxableIncome, 11925) * 0.1;

  const fica = grossIncome * 0.0765;
  const stateRate = stateTaxRates[state] || 0;
  const stateLocalTax = taxableIncome * stateRate;
  const totalTax = federalIncomeTax + fica + stateLocalTax;

  return {
    federalIncomeTax,
    fica,
    stateLocalTax,
    totalTax,
    netAfterTax: grossIncome - preTax401k - totalTax
  };
};
