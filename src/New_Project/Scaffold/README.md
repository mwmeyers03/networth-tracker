# FIRE Calculator - SvelteKit Edition

A dark-themed Financial Independence / Retire Early (FIRE) calculator built with SvelteKit. Features real-time projections, Monte Carlo simulations, and persistent state management.

## Features

✅ **Horizontal Controls Panel** - Collapsible sections organized in a responsive grid  
✅ **Dynamic Expense Categories** - Add custom expense categories for each person  
✅ **Real-Time Financial Projections** - Year-by-year net worth trajectory through 2065  
✅ **Monte Carlo Simulation** - 500-run volatility analysis with success rate calculation  
✅ **Federal Tax Calculations** - 2024 tax brackets with FICA  
✅ **Retirement Withdrawal Sequencing** - Savings → Brokerage → 401k → Roth (with age penalties)  
✅ **Local Storage Persistence** - All inputs auto-saved to browser localStorage  
✅ **Dark Minimal UI** - Gradient backgrounds, smooth transitions, clean typography

## Architecture

### Component Structure

```
src/
├── routes/
│   ├── +layout.svelte          # Root layout
│   └── +page.svelte            # Main page (tab navigation)
├── lib/
│   ├── components/
│   │   ├── Controls.svelte     # Collapsible controls panel
│   │   ├── Dashboard.svelte    # Net worth chart + summary stats
│   │   ├── Ledger.svelte       # Year-by-year data table
│   │   └── Retirement.svelte   # FIRE metrics + Monte Carlo results
│   └── stores/
│       └── fireStore.js        # Centralized state + financial logic
```

### Store Design

**fireStore.js** exports:
- `globals` - Market assumptions, salary growth, contribution rates, retirement ages
- `michaelExpenses` / `briannaExpenses` - Monthly expense categories (dynamic)
- `retirementExpenses` - Post-retirement yearly spending target
- `financialData` - Derived store computing 42-year projection (2024-2065)
- `calculateFederalTax()` - 2024 brackets + FICA calculation
- `formatCur()` / `formatLabel()` / `normalRandom()` - Utility functions

All stores use `localStore()` wrapper for automatic localStorage persistence.

### Financial Engine Logic

**buildFinancialData()** (derived store computation):
1. Iterate through START_YEAR (2024) → END_YEAR (2065)
2. For each year:
   - Apply salary growth (pre-retirement only)
   - Grow portfolio balances at marketReturn
   - Calculate 401k contributions + employer match
   - Add Roth IRA + brokerage contributions
   - Compute federal tax on gross income (less pre-tax 401k)
   - Save remainder to savings account
   - If retired: withdraw from savings → brokerage → 401k → Roth (age rules apply)
   - Track liquidity gap if withdrawals exceed balances
3. Return array of 42 year-objects with netWorth, retired flag, balances

**runMonteCarlo(data, numRuns=500)**:
- Clone initial conditions
- For each simulation run:
  - Replace fixed marketReturn with `marketReturn + normalRandom() * marketStdDev`
  - Re-run full projection logic
  - Mark as failed if any year has liquidity gap
- Return success rate percentage

### localStorage Schema

Keys stored in browser localStorage:
- `fire-globals` - JSON of globals object
- `fire-michael-expenses` - JSON of michaelExpenses object
- `fire-brianna-expenses` - JSON of briannaExpenses object
- `fire-retirement-expenses` - JSON of retirementExpenses object

Updates persist automatically on every change (Svelte store reactivity).

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Tech Stack

- **SvelteKit 2.50.2** - Full-stack meta-framework
- **Svelte 5.51.0** - Reactive UI compiler
- **Vite 7.3.1** - Build tool with HMR
- **Pure CSS** - Scoped component styles (no Tailwind)

## Configuration

Edit default values in `src/lib/stores/fireStore.js`:
- **START_YEAR / END_YEAR** - Projection timeline
- **MICHAEL_START_AGE / BRIANNA_START_AGE** - Initial ages
- **localStore() defaults** - Initial values for globals/expenses

Federal tax brackets are hardcoded in `calculateFederalTax()` for 2024 married filing jointly.

## Browser Compatibility

Requires browsers with:
- ES2020 support (optional chaining, nullish coalescing)
- localStorage API
- CSS Grid + Custom Properties

Tested on Chrome 120+, Firefox 121+, Edge 120+.

## Future Enhancements

Potential additions:
- [ ] Export to CSV/PDF
- [ ] Chart zoom/pan controls
- [ ] Chart hover tooltips showing year details
- [ ] Mobile responsive breakpoints (< 768px)
- [ ] Comparison mode (side-by-side scenarios)
- [ ] State machine income modeling
- [ ] HSA / 529 / Mega Backdoor Roth support
- [ ] Tax-loss harvesting simulation
- [ ] Historical backtest mode (real S&P 500 returns)

## License

MIT
