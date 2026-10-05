# Snooks — unified FIRE planner

Snooks is a private-by-default retirement and net-worth planner. This branch consolidates the richer FIRE planner into the canonical `mwmeyers03/networth-tracker` repository so the cloud preview, browser app, and portable desktop wrapper share one calculation engine.

## What is unified

- Deterministic annual projections with editable person, salary, expense, housing, tax, and account inputs.
- A surplus waterfall that fills legal tax-advantaged space, then sweeps remaining disposable surplus into taxable brokerage without an arbitrary partner cap.
- Retirement bridge/access modeling for taxable basis, Roth basis, conversion lots, and early-access fallback paths.
- Monte Carlo, historical-sequence, and stress-case retirement tests with explicit `PORTFOLIO_DEPLETED` vs `ACCESS_GATED` diagnostics.
- Annual ledger, assumptions, healthcare/ACA, tax-year, withdrawal-comparison, scenario, and export views.
- Browser-local persistence and JSON backup/restore. No financial data is sent to a server by the planner.
- Existing desktop/portable and legacy tracker code remains in the repository for parity work; the new Vite entry point is the shared UI source.

## Run locally

```bash
npm install
npm run build
npm test
npm run dev
```

The build compiles the headless engine first, then builds the Vite app into `dist/`. The Vercel configuration points to that output directory.

## Data safety

The repository contains generic demo defaults only. Entered plans are stored in the browser profile and can be exported as JSON for backup. Do not commit a backup containing real account numbers or other sensitive identifiers.

## Feature parity roadmap

The canonical app now owns the planner UI and calculation engine. The legacy dashboard, CSV/export helpers, simulation views, and desktop wrapper remain available while their entry points are being redirected to the shared engine. Optional local AI/automation integrations are kept opt-in and are not required for calculations.
