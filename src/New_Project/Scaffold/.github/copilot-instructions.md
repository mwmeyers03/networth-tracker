# Copilot Instructions

## Project Overview

**Net Worth Tracker / FIRE Simulator** — A SvelteKit 2 + Svelte 5 app for Financial Independence / Retire Early (FIRE) planning. Modeled around two people (Michael & Brianna). Deployable as a Vercel web app, PWA, or Tauri desktop app.

---

## Commands

```bash
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build

npm run tauri:dev    # Run as Tauri desktop app
npm run tauri:build  # Build Tauri desktop bundle
```

There is no test suite or linter configured.

---

## Architecture

### Deployment Targets

`svelte.config.js` selects the adapter at build time:
- `TAURI_BUILD=1` → `adapter-static` (SPA mode, `build/`)
- `VERCEL=1` → `adapter-vercel`
- Local / other → `adapter-static` with `fallback: 'index.html'`

The app is also a **PWA** (via `vite-plugin-pwa`) and registered as `autoUpdate`.

### Data Flow

```
fireStore.js (Svelte stores)
  ├─ globals, michaelExpenses, briannaExpenses, retirementExpenses
  │   └─ localStore() wrapper → auto-persisted to localStorage
  │   └─ createSupabaseStore() → synced to Supabase (when configured)
  │
  └─ ProjectionWorkerManager (Web Worker)
       ├─ projection.worker.ts → buildProjection() (engine/projection.ts)
       │     → returns { conservativeData, financialData, aggressiveData }
       └─ financialData / conservativeData / aggressiveData (derived stores)

simulationStore.ts
  ├─ Subscribes to globals + retirementExpenses + financialData
  ├─ Debounces 500 ms → SimulationWorkerManager
  │     └─ simulation.worker.ts (historical backtest over real S&P 500 returns)
  └─ Exports: simulationResult, simulationProgress, simulationRunning,
              successRateLabel, safeWithdrawalRateLabel, successRateColor
```

### Engine (`src/lib/engine/`)

All engine functions are **pure TypeScript** — no Svelte store dependencies:

| File | Purpose |
|------|---------|
| `projection.ts` | `buildProjection()` — 42-year year-by-year projection (2025–2065) |
| `taxes.ts` | `calculateFederalTax()` — 2024 brackets + FICA + state tax |
| `socialSecurity.ts` | Social Security benefit estimation |
| `withdrawals.ts` | Three strategies: `calculateConstantDollar`, `calculateVPW`, `calculateGuytonKlinger` |
| `projection.worker.ts` | Web Worker wrapper for `buildProjection` |
| `simulation.worker.ts` | Historical backtest worker |
| `data/historicalReturns.ts` | Real S&P 500 / bond return sequences |

**Withdrawal draw-down order** (sequential): savings → brokerage (capital-gains tax) → 401k (ordinary income + early-penalty if age < 59½) → Roth.

**Projection income states** per person per year: `'working' | 'sabbatical' | 'partTime' | 'retired'`. A `yearOverrides` map can override any year.

### Stores (`src/lib/stores/`)

| Store / Export | Description |
|---------------|-------------|
| `globals` | Market assumptions, salaries, allocations, ages, withdrawal method |
| `michaelExpenses` / `briannaExpenses` | Monthly expense objects (keyed by category name) |
| `retirementExpenses` | `{ yearlyAmount }` |
| `financialData` | Expected-case projection (derived, computed via worker) |
| `conservativeData` / `aggressiveData` | Pessimistic / optimistic projections |
| `simulationResult` | Historical backtest result from `simulationStore.ts` |

`localStore()` in `fireStore.js` merges stored values with `initialValue` defaults — **new fields added to `initialValue` will appear on existing user sessions** without wiping saved data.

### Supabase Integration

- **Optional** — app works fully offline with localStorage fallback.
- Configure via `.env.local`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `supabaseClient.ts` exports typed CRUD helpers for all tables plus real-time subscription helpers.
- `DEFAULT_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000001'` is used for the single household.
- `supabaseStore.ts` provides `createSupabaseStore<T>()` and `createSupabaseArrayStore<T>()` — both hydrate from Supabase, fall back to localStorage, debounce writes, and subscribe to Postgres real-time changes.
- Schema is in `supabase_schema.sql` at the project root.

### Key Conventions

- **`$lib` alias** maps to `src/lib/`. Import engine functions via `import { buildProjection } from '$lib/engine'` or the barrel `$lib/engine/index.ts`.
- **SSR safety**: all browser-specific code (localStorage, Web Workers, Supabase subscriptions) is guarded with `if (browser)` from `$app/environment`.
- **Mixed JS/TS**: `fireStore.js` is plain JS; engine and stores that use types are `.ts`. New store files should be `.ts`.
- **Pure CSS only** — no Tailwind or CSS framework; styles are scoped per Svelte component.
- **No router pages** beyond `+page.svelte`; tab navigation is handled in-component with a local state variable.
- **Worker managers are singletons** — `projectionWorkerManager.ts` exports a lazy `getProjectionManager()` function; `simulationWorkerManager.ts` exports a `simulationManager` singleton. Do not instantiate new managers per component.
- **`localStore` merge behavior**: always keep default values in `localStore()` calls up-to-date; stored JSON is shallow-merged with `initialValue` so new keys are backfilled automatically.
- **Withdrawal method** is stored in `globals.withdrawalMethod` as a string (`'constantDollar' | 'vpw' | 'guytonKlinger'`) and must match the branch logic in `projection.ts`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | No | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anon public key |
| `TAURI_BUILD` | Build-time | Set to `1` for Tauri static build |
| `VERCEL` | Build-time | Auto-set by Vercel platform |
