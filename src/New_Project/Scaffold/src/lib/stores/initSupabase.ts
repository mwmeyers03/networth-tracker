/**
 * Supabase Stores Initialization
 * Hydrates stores from Supabase on app startup
 * Must be called from root layout (+layout.svelte)
 */

import { browser } from '$app/environment';
import type { Writable } from 'svelte/store';
import type { Globals } from '../supabaseClient';
import {
  fetchGlobals,
  fetchMonthlyExpenses,
  fetchRetirementExpenses,
  fetchSpecialEvents,
  fetchYearOverrides,
  fetchSalaryAdjustments,
  subscribeToGlobals,
  subscribeToMonthlyExpenses,
  subscribeToSpecialEvents,
  DEFAULT_HOUSEHOLD_ID
} from '../supabaseClient';

/**
 * Initialize Supabase stores on app startup
 * Hydrates all stores with data from Supabase
 * Sets up real-time subscriptions
 *
 * Must be called from app root layout in +layout.svelte:
 * ```
 * import { initializeSupabaseStores } from '$lib/stores/initSupabase';
 * 
 * onMount(() => {
 *   initializeSupabaseStores();
 * });
 * ```
 */
export async function initializeSupabaseStores(householdId: string = DEFAULT_HOUSEHOLD_ID) {
  if (!browser) return;

  try {
    // Dynamic imports to avoid circular dependencies
    const { globals, michaelExpenses, briannaExpenses, retirementExpenses, specialEvents, salaryAdjustments } = await import('./fireStore');

    // Load globals from Supabase
    const globalsData = await fetchGlobals(householdId);
    if (globalsData) {
      // Convert snake_case DB columns to camelCase
      const transformed = {
        stockAllocation: globalsData.stock_allocation,
        bondAllocation: globalsData.bond_allocation,
        cashAllocation: globalsData.cash_allocation,
        stockReturn: globalsData.stock_return,
        stockVolatility: globalsData.stock_volatility,
        bondReturn: globalsData.bond_return,
        bondVolatility: globalsData.bond_volatility,
        cashReturn: globalsData.cash_return,
        inflationRate: globalsData.inflation_rate,
        michael401kStart: 29000, // From account_balances
        brianna401kStart: 7000,
        michaelRothStart: 20000,
        briannaRothStart: 0,
        michaelBrokerageStart: 140000,
        briannaBrokerageStart: 0,
        michaelSavingsStart: 5000,
        briannaSavingsStart: 2000,
        michaelStartSalary: globalsData.michael_start_salary,
        briannaStartSalary: globalsData.brianna_start_salary,
        michaelSalaryGrowth: globalsData.michael_salary_growth,
        briannaSalaryGrowth: globalsData.brianna_salary_growth,
        michael401kRate: globalsData.michael_401k_rate,
        michael401kMatch: globalsData.michael_401k_match,
        brianna401kRate: globalsData.brianna_401k_rate,
        brianna401kMatch: globalsData.brianna_401k_match,
        michaelRothYearlyContrib: globalsData.michael_roth_yearly_contrib,
        briannaRothYearlyContrib: globalsData.brianna_roth_yearly_contrib,
        capitalGainsTaxRate: globalsData.capital_gains_tax_rate,
        earlyWithdrawalPenalty: globalsData.early_withdrawal_penalty,
        state: globalsData.state,
        michaelSocialSecurityAge: globalsData.michael_social_security_age,
        briannaSocialSecurityAge: globalsData.brianna_social_security_age,
        michaelYearsWorked: globalsData.michael_years_worked,
        briannaYearsWorked: globalsData.brianna_years_worked,
        michaelRetirementAge: globalsData.michael_retirement_age,
        briannaRetirementAge: globalsData.brianna_retirement_age,
        lifeExpectancy: globalsData.life_expectancy,
        withdrawalMethod: globalsData.withdrawal_method,
        portfolioPercentRate: globalsData.portfolio_percent_rate,
        constantDollarAmount: globalsData.constant_dollar_amount,
        yearOverrides: {}, // Will be populated from year_overrides table
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
        }
      };
      globals.update(g => ({ ...g, ...transformed }));
    }

    // Load monthly expenses from Supabase
    const expenses = await fetchMonthlyExpenses(householdId);
    if (expenses && expenses.length > 0) {
      // Transform DB format to store format (by owner)
      const michaelExpenses__ = {};
      const briannaExpenses__ = {};

      for (const exp of expenses) {
        if (exp.owner_name === 'Michael') {
          michaelExpenses__[exp.category] = exp.amount;
        } else if (exp.owner_name === 'Brianna') {
          briannaExpenses__[exp.category] = exp.amount;
        }
      }

      if (Object.keys(michaelExpenses__).length > 0) {
        michaelExpenses.set(michaelExpenses__);
      }
      if (Object.keys(briannaExpenses__).length > 0) {
        briannaExpenses.set(briannaExpenses__);
      }
    }

    // Load retirement expenses from Supabase
    const retireExp = await fetchRetirementExpenses(householdId);
    if (retireExp) {
      retirementExpenses.set({ yearlyAmount: retireExp.yearly_amount });
    }

    // Load special events from Supabase
    const events = await fetchSpecialEvents(householdId);
    if (events && events.length > 0) {
      specialEvents.set(events);
    }

    // Load salary adjustments from Supabase
    const salaryAdj = await fetchSalaryAdjustments(householdId);
    if (salaryAdj && salaryAdj.length > 0) {
      const adjustmentsObj = {};
      for (const adj of salaryAdj) {
        adjustmentsObj[adj.adjustment_year] = {
          michaelSalary: adj.michael_salary,
          briannaSalary: adj.brianna_salary
        };
      }
      // Note: fireStore doesn't have a direct salaryAdjustments store export
      // This would need to be added for full Supabase support
    }

    // Load year overrides from Supabase
    const yearOverrides = await fetchYearOverrides(householdId);
    if (yearOverrides && yearOverrides.length > 0) {
      const overridesObj = {};
      for (const override of yearOverrides) {
        overridesObj[override.override_year] = {
          michaelExpenses: override.michael_expenses,
          briannaExpenses: override.brianna_expenses,
          michael401k: override.michael_401k,
          brianna401k: override.brianna_401k,
          michaelRoth: override.michael_roth,
          briannaRoth: override.brianna_roth,
          michaelBrokerage: override.michael_brokerage,
          briannaBrokerage: override.brianna_brokerage,
          michaelSavings: override.michael_savings,
          briannaSavings: override.brianna_savings
        };
      }
      // Update globals with yearOverrides
      globals.update(g => ({
        ...g,
        yearOverrides: overridesObj
      }));
    }

    // Set up real-time subscriptions
    subscribeToGlobals(householdId, (updatedGlobals) => {
      // Convert snake_case to camelCase and update store
      const transformed = convertGlobalsFromDB(updatedGlobals);
      globals.update(g => ({ ...g, ...transformed }));
    });

    subscribeToMonthlyExpenses(householdId, (updatedExpenses) => {
      // Re-distribute expenses by owner
      const michaelExpenses__ = {};
      const briannaExpenses__ = {};

      for (const exp of updatedExpenses) {
        if (exp.owner_name === 'Michael') {
          michaelExpenses__[exp.category] = exp.amount;
        } else if (exp.owner_name === 'Brianna') {
          briannaExpenses__[exp.category] = exp.amount;
        }
      }

      michaelExpenses.set(michaelExpenses__);
      briannaExpenses.set(briannaExpenses__);
    });

    subscribeToSpecialEvents(householdId, (updatedEvents) => {
      specialEvents.set(updatedEvents);
    });

    console.log('✅ Supabase stores initialized successfully');
  } catch (err) {
    console.warn('⚠️ Failed to initialize Supabase stores, using localStorage fallback:', err);
  }
}

/**
 * Helper to convert DB snake_case columns to store camelCase
 */
function convertGlobalsFromDB(dbGlobals: any) {
  return {
    stockAllocation: dbGlobals.stock_allocation ?? 0.70,
    bondAllocation: dbGlobals.bond_allocation ?? 0.20,
    cashAllocation: dbGlobals.cash_allocation ?? 0.10,
    stockReturn: dbGlobals.stock_return ?? 0.08,
    stockVolatility: dbGlobals.stock_volatility ?? 0.18,
    bondReturn: dbGlobals.bond_return ?? 0.04,
    bondVolatility: dbGlobals.bond_volatility ?? 0.05,
    cashReturn: dbGlobals.cash_return ?? 0.035,
    inflationRate: dbGlobals.inflation_rate ?? 0.025,
    michaelStartSalary: dbGlobals.michael_start_salary ?? 81700,
    briannaStartSalary: dbGlobals.brianna_start_salary ?? 35000,
    michaelSalaryGrowth: dbGlobals.michael_salary_growth ?? 0.03,
    briannaSalaryGrowth: dbGlobals.brianna_salary_growth ?? 0.03,
    michael401kRate: dbGlobals.michael_401k_rate ?? 0.15,
    michael401kMatch: dbGlobals.michael_401k_match ?? 0.06,
    brianna401kRate: dbGlobals.brianna_401k_rate ?? 0.08,
    brianna401kMatch: dbGlobals.brianna_401k_match ?? 0.03,
    michaelRothYearlyContrib: dbGlobals.michael_roth_yearly_contrib ?? 7000,
    briannaRothYearlyContrib: dbGlobals.brianna_roth_yearly_contrib ?? 0,
    capitalGainsTaxRate: dbGlobals.capital_gains_tax_rate ?? 0.15,
    earlyWithdrawalPenalty: dbGlobals.early_withdrawal_penalty ?? 0.10,
    state: dbGlobals.state ?? 'FL',
    michaelSocialSecurityAge: dbGlobals.michael_social_security_age ?? 62,
    briannaSocialSecurityAge: dbGlobals.brianna_social_security_age ?? 62,
    michaelYearsWorked: dbGlobals.michael_years_worked ?? 24,
    briannaYearsWorked: dbGlobals.brianna_years_worked ?? 24,
    michaelRetirementAge: dbGlobals.michael_retirement_age ?? 45,
    briannaRetirementAge: dbGlobals.brianna_retirement_age ?? 45,
    lifeExpectancy: dbGlobals.life_expectancy ?? 100,
    withdrawalMethod: dbGlobals.withdrawal_method ?? 'portfolioPercent',
    portfolioPercentRate: dbGlobals.portfolio_percent_rate ?? 0.04,
    constantDollarAmount: dbGlobals.constant_dollar_amount ?? 80000
  };
}
