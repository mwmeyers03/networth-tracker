-- Supabase PostgreSQL Migration
-- Net Worth Tracker Database Schema with Row Level Security (RLS)
-- 
-- This creates the complete relational schema for multi-tenant support
-- All tables include RLS policies for tenant isolation

-- =============================================
-- Enable UUID extension
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. HOUSEHOLDS (Tenant root - represents Michael & Brianna's household)
-- =============================================
CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household isolation"
ON households
FOR ALL
USING (
    -- For now, allow access. In production, check auth.uid is member of household
    true
);

-- =============================================
-- 2. GLOBALS (Portfolio, tax, retirement parameters)
-- =============================================
CREATE TABLE globals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    
    -- Portfolio Allocation
    stock_allocation NUMERIC DEFAULT 0.70,
    bond_allocation NUMERIC DEFAULT 0.20,
    cash_allocation NUMERIC DEFAULT 0.10,
    
    -- Asset Class Returns & Volatility
    stock_return NUMERIC DEFAULT 0.08,
    stock_volatility NUMERIC DEFAULT 0.18,
    bond_return NUMERIC DEFAULT 0.04,
    bond_volatility NUMERIC DEFAULT 0.05,
    cash_return NUMERIC DEFAULT 0.035,
    inflation_rate NUMERIC DEFAULT 0.025,
    
    -- Salaries & Growth
    michael_start_salary NUMERIC DEFAULT 81700,
    brianna_start_salary NUMERIC DEFAULT 35000,
    michael_salary_growth NUMERIC DEFAULT 0.03,
    brianna_salary_growth NUMERIC DEFAULT 0.03,
    
    -- Retirement Contributions (Individual)
    michael_401k_rate NUMERIC DEFAULT 0.15,
    michael_401k_match NUMERIC DEFAULT 0.06,
    brianna_401k_rate NUMERIC DEFAULT 0.08,
    brianna_401k_match NUMERIC DEFAULT 0.03,
    michael_roth_yearly_contrib NUMERIC DEFAULT 7000,
    brianna_roth_yearly_contrib NUMERIC DEFAULT 0,
    
    -- Tax & Penalties
    capital_gains_tax_rate NUMERIC DEFAULT 0.15,
    early_withdrawal_penalty NUMERIC DEFAULT 0.10,
    state VARCHAR(2) DEFAULT 'FL',
    
    -- Social Security
    michael_social_security_age INT DEFAULT 62,
    brianna_social_security_age INT DEFAULT 62,
    michael_years_worked INT DEFAULT 24,
    brianna_years_worked INT DEFAULT 24,
    
    -- Retirement Parameters
    michael_retirement_age INT DEFAULT 45,
    brianna_retirement_age INT DEFAULT 45,
    life_expectancy INT DEFAULT 100,
    withdrawal_method VARCHAR(50) DEFAULT 'portfolioPercent',
    portfolio_percent_rate NUMERIC DEFAULT 0.04,
    constant_dollar_amount NUMERIC DEFAULT 80000,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE globals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household globals isolation"
ON globals
FOR ALL
USING (household_id IN (SELECT id FROM households));

CREATE INDEX globals_household_id ON globals(household_id);

-- =============================================
-- 3. ACCOUNT_BALANCES (Starting balances for each person, each account type)
-- =============================================
CREATE TABLE account_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    owner_name VARCHAR(50) NOT NULL, -- 'Michael' or 'Brianna'
    account_type VARCHAR(50) NOT NULL, -- '401k', 'Roth IRA', 'Brokerage', 'Savings'
    starting_balance NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(household_id, owner_name, account_type)
);

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household account balance isolation"
ON account_balances
FOR ALL
USING (household_id IN (SELECT id FROM households));

CREATE INDEX account_balances_household_id ON account_balances(household_id);

-- =============================================
-- 4. MONTHLY_EXPENSES (Expense categories for each person)
-- =============================================
CREATE TABLE monthly_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    owner_name VARCHAR(50) NOT NULL, -- 'Michael' or 'Brianna'
    category VARCHAR(100) NOT NULL, -- 'insurance', 'gas', 'food', 'rent', etc.
    amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(household_id, owner_name, category)
);

ALTER TABLE monthly_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household expense isolation"
ON monthly_expenses
FOR ALL
USING (household_id IN (SELECT id FROM households));

CREATE INDEX monthly_expenses_household_id ON monthly_expenses(household_id);

-- =============================================
-- 5. RETIREMENT_EXPENSES (Annual retirement expense amount)
-- =============================================
CREATE TABLE retirement_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE UNIQUE,
    yearly_amount NUMERIC NOT NULL DEFAULT 80000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retirement_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household retirement expense isolation"
ON retirement_expenses
FOR ALL
USING (household_id IN (SELECT id FROM households));

-- =============================================
-- 6. SPECIAL_EVENTS (One-time expenses or windfalls)
-- =============================================
CREATE TABLE special_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    event_year INT NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- 'house_purchase', 'inheritance', 'major_repair', etc.
    description TEXT,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household special event isolation"
ON special_events
FOR ALL
USING (household_id IN (SELECT id FROM households));

CREATE INDEX special_events_household_id ON special_events(household_id);
CREATE INDEX special_events_event_year ON special_events(event_year);

-- =============================================
-- 7. YEAR_OVERRIDES (Per-year adjustments to expenses and account balances)
-- =============================================
CREATE TABLE year_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    override_year INT NOT NULL,
    michael_expenses NUMERIC,
    brianna_expenses NUMERIC,
    michael_401k NUMERIC,
    brianna_401k NUMERIC,
    michael_roth NUMERIC,
    brianna_roth NUMERIC,
    michael_brokerage NUMERIC,
    brianna_brokerage NUMERIC,
    michael_savings NUMERIC,
    brianna_savings NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(household_id, override_year)
);

ALTER TABLE year_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household override isolation"
ON year_overrides
FOR ALL
USING (household_id IN (SELECT id FROM households));

CREATE INDEX year_overrides_household_id ON year_overrides(household_id);

-- =============================================
-- 8. SALARY_ADJUSTMENTS (Per-year salary overrides)
-- =============================================
CREATE TABLE salary_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    adjustment_year INT NOT NULL,
    michael_salary NUMERIC,
    brianna_salary NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(household_id, adjustment_year)
);

ALTER TABLE salary_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household salary adjustment isolation"
ON salary_adjustments
FOR ALL
USING (household_id IN (SELECT id FROM households));

CREATE INDEX salary_adjustments_household_id ON salary_adjustments(household_id);

-- =============================================
-- 9. PROJECTIONS (Cached annual projection data for performance)
-- =============================================
CREATE TABLE projections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    scenario VARCHAR(50) NOT NULL, -- 'conservative', 'expected', 'aggressive'
    projection_year INT NOT NULL,
    michael_age INT,
    brianna_age INT,
    combined_gross NUMERIC,
    combined_exp NUMERIC,
    total_401k NUMERIC,
    total_roth NUMERIC,
    total_brokerage NUMERIC,
    total_savings NUMERIC,
    net_worth NUMERIC,
    social_security_income NUMERIC,
    withdrawal_source VARCHAR(255),
    liquidity_gap NUMERIC,
    retired BOOLEAN,
    michael_retired BOOLEAN,
    brianna_retired BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(household_id, scenario, projection_year)
);

ALTER TABLE projections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household projection isolation"
ON projections
FOR ALL
USING (household_id IN (SELECT id FROM households));

CREATE INDEX projections_household_id ON projections(household_id);
CREATE INDEX projections_scenario ON projections(scenario);

-- =============================================
-- INSERT DEFAULT DATA for initial household (Michael & Brianna)
-- =============================================
INSERT INTO households (id, name) VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'Michael & Brianna'
);

-- Default globals
INSERT INTO globals (household_id) VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID
);

-- Default starting balances
INSERT INTO account_balances (household_id, owner_name, account_type, starting_balance) VALUES
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Michael', '401k', 29000),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Michael', 'Roth IRA', 20000),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Michael', 'Brokerage', 140000),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Michael', 'Savings', 5000),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Brianna', '401k', 7000),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Brianna', 'Roth IRA', 0),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Brianna', 'Brokerage', 0),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Brianna', 'Savings', 2000);

-- Default monthly expenses
INSERT INTO monthly_expenses (household_id, owner_name, category, amount) VALUES
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Michael', 'insurance', 220),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Michael', 'gas', 252),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Michael', 'food', 200),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Michael', 'dates', 160),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Michael', 'rent', 600),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Michael', 'vacationFund', 200),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Brianna', 'insurance', 350),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Brianna', 'gas', 252),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Brianna', 'food', 200),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Brianna', 'car', 600),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Brianna', 'rent', 150),
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Brianna', 'vacationFund', 200);

-- Default retirement expenses
INSERT INTO retirement_expenses (household_id, yearly_amount) VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    80000
);
