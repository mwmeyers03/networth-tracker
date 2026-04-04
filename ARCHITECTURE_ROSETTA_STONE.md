# Net Worth Tracker - Architecture Rosetta Stone

This document is the canonical reference for how the app is structured, how the AI pipeline works, and how to extend it without breaking behavior.

## 1) System Goals

- Keep financial projection logic deterministic and auditable.
- Let AI explain and operate on projections, but never replace core math.
- Support both browser and desktop EXE runtimes.
- Maintain a strict contract for AI responses so UI rendering stays reliable.
- Prefer quantitative output (tables/charts) over long prose.

## 2) Runtime Topology

### Web Runtime

- React app via `react-scripts`.
- AI route mode defaults to `auto`.
- Local Ollama can be blocked by HTTPS mixed-content rules.
- Fallback provider can be used via HTTPS endpoints.

### Desktop Runtime (Electron)

- Main process in `electron/main.js`.
- Renderer uses same React app build.
- Desktop can call local Ollama directly.
- Extra desktop-only features: screenshot capture, process orchestration hooks.

## 3) Core Modules

- `src/contexts/DataContext.js`
  - Single source of truth for assumptions, expenses, overrides, projections.
  - Owns deterministic simulation and Monte Carlo generation.
- `src/components/AIWorkbench.js`
  - Prompt composition, AI request flow, deterministic merge, report rendering.
  - Interactive chart and table surface for scenario analysis.
- `src/utils/queryGemma.js`
  - LLM transport/router, endpoint fallback logic, response normalization.

## 4) Financial Engine Contracts

### Projection Engine

Primary deterministic projection path is based on yearly roll-forward across:

- Income and growth
- Inflation-adjusted expense model
- Account-level balances (401k, Roth, brokerage, cash)
- Retirement drawdown and liquidity-gap detection

### Scenario Evaluation Contract

`evaluateScenario()` returns:

- `inputs`: parsed scenario overrides
- `baseline`: summary metrics for current assumptions
- `scenario`: summary metrics for simulated overrides
- `baselinePreview`: compact baseline rows
- `scenarioPreview`: compact scenario rows
- `comparisonSeries`: aligned year-by-year baseline/scenario metrics
- `allocationComparison`: retirement-year allocation comparison

These fields are used both for AI context and chart/table rendering.

## 5) AI Pipeline Contract

### Request Build

`AIWorkbench` composes a prompt with:

- Instruction schema
- Current deterministic context snapshot
- Parsed scenario override payload
- Prior response context (optional)
- User request text

### Response Parsing

`queryGemma()` attempts strict JSON parsing first.

If model output is malformed/non-JSON:

- Falls back to text normalization
- Builds a structured object with conservative fields
- Preserves response in a renderable shape

### Deterministic Merge

After model response:

- Deterministic local scenario values are merged in.
- Quantitative values are treated as authoritative.
- Model text is retained as supplementary analysis.
- Chart specs are merged with deterministic chart defaults.

## 6) Chart and Table Architecture

### Chart Sources

The chart layer can render from:

- `comparisonSeries`
- `allocationComparison`
- `scenarioPreview`
- Inline chart data when provided

### Chart Spec Contract

Chart specs support:

- `chartType`: `line | area | bar`
- `xKey`
- `series[]`: `key`, `label`, `color`, `format`
- `dataSource` (preferred) or inline `data`

### Rendering Rules

- Prefer dataSource-based specs to avoid oversized payloads.
- Deduplicate chart specs by `id`/`title`.
- Keep baseline/scenario toggles user-controlled.
- Keep a rolling year-window control for yearly charts.

## 7) Anti-Wordiness Rules

- Normalize model text into concise points.
- Deduplicate semantically similar lines.
- Clamp list lengths per section.
- Require each deep-analysis point to provide new value.
- Favor measurable actions and explicit numerical impact.

## 8) Action and Continuation Behavior

- Continuation actions are sanitized before execution.
- Invalid payloads are rejected with UI status messaging.
- Running continuation sets mode/prompt explicitly and executes immediately.
- Run buttons should be disabled while request is in flight.

## 9) Standard Extension Checklist

When adding any new AI feature:

1. Extend deterministic engine first if numeric logic is needed.
2. Add schema fields to AI instruction contract.
3. Add normalization/parsing logic for new fields.
4. Add deterministic merge strategy for those fields.
5. Add UI rendering with graceful empty-state behavior.
6. Validate both web and desktop runtime behavior.
7. Build and smoke-test packaging artifacts.

## 10) Build and Validation Commands

From repo root:

- Web build: `npm run build`
- Desktop build: `npm run electron:build`
- Dev desktop: `npm run electron:dev`

If `electron:dev` fails from parent folder, run it from `networth-tracker` directly.

## 11) Debug Triage Guide

### If AI looks vague

- Check deterministic merge occurred.
- Verify numerical/table/chart sections are present.
- Confirm scenario parsing extracted requested overrides.

### If action buttons do nothing

- Verify sanitized action text is non-empty.
- Verify loading state is not blocking repeated clicks.
- Verify `runPrompt` receives explicit override prompt and mode.

### If graphs do not render

- Verify chart specs have series keys matching dataset fields.
- Verify chart data source exists in deterministic payload.
- Verify filtered chart series is not empty due to toggles.

## 12) Stability Principles

- Deterministic financial math is the source of truth.
- AI is a structured explanation/guidance layer.
- Every user-facing recommendation should trace to data.
- Every new feature must preserve fallback-safe rendering.
