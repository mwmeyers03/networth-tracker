/**
 * Supabase Client Configuration
 * Initializes the Supabase client with automatic household context management
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// These should be in your .env.local file
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Default household ID (Michael & Brianna)
export const DEFAULT_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Type definitions for all tables
 */

export interface Household {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Globals {
  id: string;
  household_id: string;
  stock_allocation: number;
  bond_allocation: number;
  cash_allocation: number;
  stock_return: number;
  stock_volatility: number;
  bond_return: number;
  bond_volatility: number;
  cash_return: number;
  inflation_rate: number;
  michael_start_salary: number;
  brianna_start_salary: number;
  michael_salary_growth: number;
  brianna_salary_growth: number;
  michael_401k_rate: number;
  michael_401k_match: number;
  brianna_401k_rate: number;
  brianna_401k_match: number;
  michael_roth_yearly_contrib: number;
  brianna_roth_yearly_contrib: number;
  capital_gains_tax_rate: number;
  early_withdrawal_penalty: number;
  state: string;
  michael_social_security_age: number;
  brianna_social_security_age: number;
  michael_years_worked: number;
  brianna_years_worked: number;
  michael_retirement_age: number;
  brianna_retirement_age: number;
  life_expectancy: number;
  withdrawal_method: string;
  portfolio_percent_rate: number;
  constant_dollar_amount: number;
  created_at: string;
  updated_at: string;
}

export interface AccountBalance {
  id: string;
  household_id: string;
  owner_name: string;
  account_type: string;
  starting_balance: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyExpense {
  id: string;
  household_id: string;
  owner_name: string;
  category: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface RetirementExpense {
  id: string;
  household_id: string;
  yearly_amount: number;
  created_at: string;
  updated_at: string;
}

export interface SpecialEvent {
  id: string;
  household_id: string;
  event_year: number;
  event_type: string;
  description?: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface YearOverride {
  id: string;
  household_id: string;
  override_year: number;
  michael_expenses?: number;
  brianna_expenses?: number;
  michael_401k?: number;
  brianna_401k?: number;
  michael_roth?: number;
  brianna_roth?: number;
  michael_brokerage?: number;
  brianna_brokerage?: number;
  michael_savings?: number;
  brianna_savings?: number;
  created_at: string;
  updated_at: string;
}

export interface SalaryAdjustment {
  id: string;
  household_id: string;
  adjustment_year: number;
  michael_salary?: number;
  brianna_salary?: number;
  created_at: string;
  updated_at: string;
}

export interface Projection {
  id: string;
  household_id: string;
  scenario: 'conservative' | 'expected' | 'aggressive';
  projection_year: number;
  michael_age?: number;
  brianna_age?: number;
  combined_gross?: number;
  combined_exp?: number;
  total_401k?: number;
  total_roth?: number;
  total_brokerage?: number;
  total_savings?: number;
  net_worth?: number;
  social_security_income?: number;
  withdrawal_source?: string;
  liquidity_gap?: number;
  retired?: boolean;
  michael_retired?: boolean;
  brianna_retired?: boolean;
  created_at: string;
}

/**
 * Query Functions - Household Data
 */

export async function fetchGlobals(householdId: string = DEFAULT_HOUSEHOLD_ID): Promise<Globals | null> {
  const { data, error } = await supabase
    .from('globals')
    .select('*')
    .eq('household_id', householdId)
    .single();

  if (error) {
    console.error('Error fetching globals:', error);
    return null;
  }
  return data;
}

export async function fetchAccountBalances(
  householdId: string = DEFAULT_HOUSEHOLD_ID
): Promise<AccountBalance[]> {
  const { data, error } = await supabase
    .from('account_balances')
    .select('*')
    .eq('household_id', householdId);

  if (error) {
    console.error('Error fetching account balances:', error);
    return [];
  }
  return data || [];
}

export async function fetchMonthlyExpenses(
  householdId: string = DEFAULT_HOUSEHOLD_ID
): Promise<MonthlyExpense[]> {
  const { data, error } = await supabase
    .from('monthly_expenses')
    .select('*')
    .eq('household_id', householdId);

  if (error) {
    console.error('Error fetching monthly expenses:', error);
    return [];
  }
  return data || [];
}

export async function fetchRetirementExpenses(
  householdId: string = DEFAULT_HOUSEHOLD_ID
): Promise<RetirementExpense | null> {
  const { data, error } = await supabase
    .from('retirement_expenses')
    .select('*')
    .eq('household_id', householdId)
    .single();

  if (error) {
    console.error('Error fetching retirement expenses:', error);
    return null;
  }
  return data;
}

export async function fetchSpecialEvents(
  householdId: string = DEFAULT_HOUSEHOLD_ID
): Promise<SpecialEvent[]> {
  const { data, error } = await supabase
    .from('special_events')
    .select('*')
    .eq('household_id', householdId)
    .order('event_year', { ascending: true });

  if (error) {
    console.error('Error fetching special events:', error);
    return [];
  }
  return data || [];
}

export async function fetchYearOverrides(
  householdId: string = DEFAULT_HOUSEHOLD_ID
): Promise<YearOverride[]> {
  const { data, error } = await supabase
    .from('year_overrides')
    .select('*')
    .eq('household_id', householdId)
    .order('override_year', { ascending: true });

  if (error) {
    console.error('Error fetching year overrides:', error);
    return [];
  }
  return data || [];
}

export async function fetchSalaryAdjustments(
  householdId: string = DEFAULT_HOUSEHOLD_ID
): Promise<SalaryAdjustment[]> {
  const { data, error } = await supabase
    .from('salary_adjustments')
    .select('*')
    .eq('household_id', householdId)
    .order('adjustment_year', { ascending: true });

  if (error) {
    console.error('Error fetching salary adjustments:', error);
    return [];
  }
  return data || [];
}

/**
 * Update Functions
 */

export async function updateGlobals(
  householdId: string,
  updates: Partial<Globals>
): Promise<void> {
  const { error } = await supabase
    .from('globals')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('household_id', householdId);

  if (error) {
    console.error('Error updating globals:', error);
  }
}

export async function updateMonthlyExpense(
  id: string,
  amount: number,
  householdId: string = DEFAULT_HOUSEHOLD_ID
): Promise<void> {
  const { error } = await supabase
    .from('monthly_expenses')
    .update({
      amount,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) {
    console.error('Error updating monthly expense:', error);
  }
}

export async function updateRetirementExpenses(
  householdId: string,
  yearlyAmount: number
): Promise<void> {
  const { error } = await supabase
    .from('retirement_expenses')
    .update({
      yearly_amount: yearlyAmount,
      updated_at: new Date().toISOString()
    })
    .eq('household_id', householdId);

  if (error) {
    console.error('Error updating retirement expenses:', error);
  }
}

/**
 * Create Functions
 */

export async function createSpecialEvent(
  householdId: string,
  event: Omit<SpecialEvent, 'id' | 'household_id' | 'created_at' | 'updated_at'>
): Promise<SpecialEvent | null> {
  const { data, error } = await supabase
    .from('special_events')
    .insert({
      household_id: householdId,
      event_year: event.event_year,
      event_type: event.event_type,
      description: event.description,
      amount: event.amount
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating special event:', error);
    return null;
  }
  return data;
}

export async function createYearOverride(
  householdId: string,
  override: Omit<YearOverride, 'id' | 'household_id' | 'created_at' | 'updated_at'>
): Promise<YearOverride | null> {
  const { data, error } = await supabase
    .from('year_overrides')
    .insert({
      household_id: householdId,
      override_year: override.override_year,
      ...override
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating year override:', error);
    return null;
  }
  return data;
}

/**
 * Delete Functions
 */

export async function deleteSpecialEvent(
  id: string,
  householdId: string = DEFAULT_HOUSEHOLD_ID
): Promise<void> {
  const { error } = await supabase
    .from('special_events')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) {
    console.error('Error deleting special event:', error);
  }
}

export async function deleteYearOverride(
  id: string,
  householdId: string = DEFAULT_HOUSEHOLD_ID
): Promise<void> {
  const { error } = await supabase
    .from('year_overrides')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);

  if (error) {
    console.error('Error deleting year override:', error);
  }
}

/**
 * Real-time Subscription Helpers
 */

export function subscribeToGlobals(
  householdId: string,
  callback: (globals: Globals) => void
): ReturnType<typeof supabase.on> {
  return supabase
    .channel(`globals:${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'globals',
        filter: `household_id=eq.${householdId}`
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as Globals);
        }
      }
    )
    .subscribe();
}

export function subscribeToMonthlyExpenses(
  householdId: string,
  callback: (expenses: MonthlyExpense[]) => void
): ReturnType<typeof supabase.on> {
  return supabase
    .channel(`expenses:${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'monthly_expenses',
        filter: `household_id=eq.${householdId}`
      },
      async () => {
        const expenses = await fetchMonthlyExpenses(householdId);
        callback(expenses);
      }
    )
    .subscribe();
}

export function subscribeToSpecialEvents(
  householdId: string,
  callback: (events: SpecialEvent[]) => void
): ReturnType<typeof supabase.on> {
  return supabase
    .channel(`events:${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'special_events',
        filter: `household_id=eq.${householdId}`
      },
      async () => {
        const events = await fetchSpecialEvents(householdId);
        callback(events);
      }
    )
    .subscribe();
}
