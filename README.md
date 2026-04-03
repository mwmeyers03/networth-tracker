# Net Worth Tracker (Web + Desktop EXE)

Net Worth Tracker is a CRA + Electron app for retirement forecasting, yearly ledger editing, and Monte Carlo analysis.

This repo supports:

- Web deployment (Vercel/static host)
- Desktop Windows installer (.exe) via Electron
- Local Ollama/Gemma integration
- AI Workbench tab for simulation prompts and structured app-state edits

## Features

- Dashboard, ledger, retirement, and budget views
- Monte Carlo simulation with percentile fan chart
- Ollama status badge in the top header
- Settings drawer closes with the Esc key
- AI Workbench:
  - Run Gemma prompts in app
  - Simulate strategy/risk scenarios
  - Apply structured edits across app state (globals, expenses, retirement spend, ledger overrides)

## Prerequisites

- Node.js 18+
- npm 9+
- Ollama installed locally for desktop/local AI mode

Optional for web fallback:

- A cloud LLM proxy endpoint compatible with JSON request/response

## Environment setup

Copy `.env.example` to `.env` (or `.env.local`) and configure values:

```bash
REACT_APP_OLLAMA_BASE_URL=http://localhost:11434/api/generate
REACT_APP_MODEL_CPU=gemma4:4b
REACT_APP_MODEL_GPU=gemma4:26b-moe
REACT_APP_SYSTEM_PROMPT=Never store sensitive data. Respond only with valid JSON not markdown fences.
REACT_APP_LLM_MODE=auto
REACT_APP_CLOUD_LLM_URL=
```

If using local Ollama, pull models once:

```bash
ollama pull gemma4:4b
ollama pull gemma4:26b-moe
```

Start Ollama:

```bash
ollama serve
```

## Run in development

Install dependencies:

```bash
npm install
```

Web only:

```bash
npm start
```

Desktop + web together:

```bash
npm run electron:dev
```

## Build Windows EXE

Generate installer:

```bash
npm run electron:build
```

Output folder:

- `dist/Net Worth Tracker Setup*.exe`

Unpacked desktop build for quick testing:

```bash
npm run electron:build:dir
```

## AI Workbench usage

Open the `AI` tab.

1. Choose mode:
   - `Simulate` for scenario analysis
   - `Edit Program State` for direct structured updates
2. Choose model tier:
   - CPU model for speed
   - GPU model for deeper planning
3. Enter prompt and run query.
4. If response includes `edits`, click `Apply Edits to App`.

## Important behavior and limits

- AI edits are applied to simulation state, not source code files.
- AI can update:
  - global assumptions
  - Michael/Brianna expense categories
  - retirement yearly spend
  - yearly ledger overrides
- Web parity is preserved for core functionality.
- LLM provider parity is configurable:
  - Desktop can use local Ollama
  - Web can use local Ollama or cloud proxy fallback

## Troubleshooting

- If `No AI` badge appears, verify Ollama is running and reachable at `/api/tags`.
- If a query fails, inspect the AI result panel for endpoint error details.
- If EXE build fails on first run, re-run `npm install` then `npm run electron:build`.
