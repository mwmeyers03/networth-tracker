-- Supabase Schema (RLS enabled) — owner-based tenancy
-- Each household row is owned by auth.uid(); all child rows reference household_id

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) HOUSEHOLDS -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_owner_rw ON households
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Helper: reusable policy condition for household ownership
CREATE OR REPLACE FUNCTION public.is_household_owner(h_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM households h WHERE h.id = h_id AND h.owner_id = auth.uid()
  );
$$;

-- 2) GLOBAL PARAMETERS ------------------------------------------------------
CREATE TABLE IF NOT EXISTS globals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  stock_allocation numeric DEFAULT 0.70,
  bond_allocation numeric DEFAULT 0.20,
  cash_allocation numeric DEFAULT 0.10,
  stock_return numeric DEFAULT 0.08,
  stock_volatility numeric DEFAULT 0.18,
  bond_return numeric DEFAULT 0.04,
  bond_volatility numeric DEFAULT 0.05,
  cash_return numeric DEFAULT 0.035,
  inflation_rate numeric DEFAULT 0.025,
  michael_start_salary numeric DEFAULT 81700,
  brianna_start_salary numeric DEFAULT 35000,
  michael_salary_growth numeric DEFAULT 0.03,
  brianna_salary_growth numeric DEFAULT 0.03,
  michael_401k_rate numeric DEFAULT 0.15,
  michael_401k_match numeric DEFAULT 0.06,
  brianna_401k_rate numeric DEFAULT 0.08,
  brianna_401k_match numeric DEFAULT 0.03,
  michael_roth_yearly_contrib numeric DEFAULT 7000,
  brianna_roth_yearly_contrib numeric DEFAULT 0,
  capital_gains_tax_rate numeric DEFAULT 0.15,
  early_withdrawal_penalty numeric DEFAULT 0.10,
  state varchar(2) DEFAULT 'FL',
  michael_social_security_age int DEFAULT 62,
  brianna_social_security_age int DEFAULT 62,
  michael_years_worked int DEFAULT 24,
  brianna_years_worked int DEFAULT 24,
  michael_retirement_age int DEFAULT 45,
  brianna_retirement_age int DEFAULT 45,
  life_expectancy int DEFAULT 100,
  withdrawal_method varchar(50) DEFAULT 'portfolioPercent',
  portfolio_percent_rate numeric DEFAULT 0.04,
  constant_dollar_amount numeric DEFAULT 80000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS globals_household_idx ON globals(household_id);
ALTER TABLE globals ENABLE ROW LEVEL SECURITY;
CREATE POLICY globals_owner_rw ON globals
  FOR ALL TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- 3) ACCOUNT BALANCES -------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_balances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  owner_name varchar(50) NOT NULL,
  account_type varchar(50) NOT NULL,
  starting_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(household_id, owner_name, account_type)
);

CREATE INDEX IF NOT EXISTS account_balances_household_idx ON account_balances(household_id);
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_balances_owner_rw ON account_balances
  FOR ALL TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- 4) MONTHLY EXPENSES -------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  owner_name varchar(50) NOT NULL,
  category varchar(100) NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(household_id, owner_name, category)
);

CREATE INDEX IF NOT EXISTS monthly_expenses_household_idx ON monthly_expenses(household_id);
ALTER TABLE monthly_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY monthly_expenses_owner_rw ON monthly_expenses
  FOR ALL TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- 5) RETIREMENT EXPENSES ----------------------------------------------------
CREATE TABLE IF NOT EXISTS retirement_expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE UNIQUE,
  yearly_amount numeric NOT NULL DEFAULT 80000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE retirement_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY retirement_expenses_owner_rw ON retirement_expenses
  FOR ALL TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- 6) SPECIAL EVENTS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS special_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  event_year int NOT NULL,
  event_type varchar(100) NOT NULL,
  description text,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS special_events_household_idx ON special_events(household_id);
CREATE INDEX IF NOT EXISTS special_events_year_idx ON special_events(event_year);
ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY special_events_owner_rw ON special_events
  FOR ALL TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- 7) YEAR OVERRIDES ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS year_overrides (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  override_year int NOT NULL,
  michael_expenses numeric,
  brianna_expenses numeric,
  michael_401k numeric,
  brianna_401k numeric,
  michael_roth numeric,
  brianna_roth numeric,
  michael_brokerage numeric,
  brianna_brokerage numeric,
  michael_savings numeric,
  brianna_savings numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(household_id, override_year)
);

CREATE INDEX IF NOT EXISTS year_overrides_household_idx ON year_overrides(household_id);
ALTER TABLE year_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY year_overrides_owner_rw ON year_overrides
  FOR ALL TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- 8) SALARY ADJUSTMENTS -----------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_adjustments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  adjustment_year int NOT NULL,
  michael_salary numeric,
  brianna_salary numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(household_id, adjustment_year)
);

CREATE INDEX IF NOT EXISTS salary_adjustments_household_idx ON salary_adjustments(household_id);
ALTER TABLE salary_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY salary_adjustments_owner_rw ON salary_adjustments
  FOR ALL TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- 9) PROJECTIONS (cached simulation outputs) -------------------------------
CREATE TABLE IF NOT EXISTS projections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  scenario varchar(32) NOT NULL,
  projection_year int NOT NULL,
  michael_age int,
  brianna_age int,
  combined_gross numeric,
  combined_exp numeric,
  total_401k numeric,
  total_roth numeric,
  total_brokerage numeric,
  total_savings numeric,
  net_worth numeric,
  social_security_income numeric,
  withdrawal_source text,
  liquidity_gap numeric,
  retired boolean,
  michael_retired boolean,
  brianna_retired boolean,
  created_at timestamptz DEFAULT now(),
  UNIQUE(household_id, scenario, projection_year)
);

CREATE INDEX IF NOT EXISTS projections_household_idx ON projections(household_id);
ALTER TABLE projections ENABLE ROW LEVEL SECURITY;
CREATE POLICY projections_owner_rw ON projections
  FOR ALL TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));
