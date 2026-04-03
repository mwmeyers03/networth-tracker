import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  FileText,
  Highlighter,
  ImagePlus,
  MessageSquare,
  Rocket,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import {
  isElectron,
  LLM_MODE,
  MODEL_CPU,
  MODEL_GPU,
  queryGemma,
} from '../utils/queryGemma';

const GLOBAL_EDITABLE_KEYS = [
  'marketReturn',
  'marketReturnStdDev',
  'inflationRate',
  'michaelStartingSalary',
  'briannaStartingSalary',
  'michaelSalaryGrowth',
  'briannaSalaryGrowth',
  'michael401kRate',
  'michael401kMatch',
  'brianna401kRate',
  'rothYearlyContrib',
  'brokerageYearlyContrib',
  'michaelRetirementAge',
  'briannaRetirementAge',
  'lifeExpectancy',
  'withdrawalRate',
];

const DEFAULT_PROMPTS = {
  ask: 'What are the 3 highest-risk assumptions in my plan right now and what should I change first?',
  simulate:
    'Run a stress simulation for retiring at 48/49 with 6% inflation for 3 years, then recommend safer assumptions.',
  edit:
    'Update assumptions for a conservative plan: 6.5% market return, 3% inflation, retirement age 52 for both, retirement spend 90000.',
};

const MODE_ITEMS = [
  { id: 'ask', label: 'Ask', icon: MessageSquare },
  { id: 'simulate', label: 'Simulate', icon: Sparkles },
  { id: 'edit', label: 'Edit', icon: Wand2 },
];

const SPEED_PRESETS = {
  turbo: {
    label: 'Turbo',
    summary: 'Shortest answers, lowest latency',
    timeoutMs: 35000,
    maxKeyPoints: 3,
    cpuOptions: { num_predict: 220, num_ctx: 1024, temperature: 0.05 },
    gpuOptions: { num_predict: 300, num_ctx: 1536, temperature: 0.05 },
  },
  balanced: {
    label: 'Balanced',
    summary: 'Good quality and speed',
    timeoutMs: 60000,
    maxKeyPoints: 5,
    cpuOptions: { num_predict: 420, num_ctx: 1536, temperature: 0.12 },
    gpuOptions: { num_predict: 560, num_ctx: 2048, temperature: 0.12 },
  },
  deep: {
    label: 'Deep',
    summary: 'Most thorough, highest latency',
    timeoutMs: 120000,
    maxKeyPoints: 7,
    cpuOptions: { num_predict: 700, num_ctx: 2048, temperature: 0.18 },
    gpuOptions: { num_predict: 1000, num_ctx: 3072, temperature: 0.18 },
  },
};

const toList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const truncate = (value, len = 180) => {
  const text = String(value || '').trim();
  if (text.length <= len) return text;
  return `${text.slice(0, len - 1)}...`;
};

const summarizeEdits = (edits) => {
  if (!edits || typeof edits !== 'object') return [];

  const rows = [];

  if (edits.globals && typeof edits.globals === 'object') {
    rows.push(`Globals: ${Object.keys(edits.globals).length} field(s)`);
  }
  if (edits.michaelExpenses && typeof edits.michaelExpenses === 'object') {
    rows.push(`Michael expenses: ${Object.keys(edits.michaelExpenses).length} field(s)`);
  }
  if (edits.briannaExpenses && typeof edits.briannaExpenses === 'object') {
    rows.push(`Brianna expenses: ${Object.keys(edits.briannaExpenses).length} field(s)`);
  }
  if (edits.retirementExpenses) {
    rows.push('Retirement expenses: yearly amount update');
  }
  if (edits.overrides && typeof edits.overrides === 'object') {
    const overrideCount = Object.values(edits.overrides).reduce((sum, value) => {
      if (!value || typeof value !== 'object') return sum;
      return sum + Object.keys(value).length;
    }, 0);
    rows.push(`Ledger overrides: ${overrideCount} field(s)`);
  }

  return rows;
};

const buildInstructions = (mode, speedPreset) => {
  const base = [
    'Return only valid JSON. Do not include markdown fences.',
    'Use concise, actionable wording.',
    `Keep summary to at most 2 sentences and keyPoints to at most ${speedPreset.maxKeyPoints} bullets.`,
    'When editing, only include fields that should actually change.',
    '',
    'Output shape:',
    '{',
    '  "answer": {',
    '    "summary": "string",',
    '    "keyPoints": ["string"],',
    '    "warnings": ["string"],',
    '    "nextActions": ["string"]',
    '  },',
    '  "edits": {',
    '    "globals": { ... },',
    '    "michaelExpenses": { ... },',
    '    "briannaExpenses": { ... },',
    '    "retirementExpenses": { "yearlyAmount": number },',
    '    "overrides": { "2035": { "brokerageBal": number } }',
    '  }',
    '}',
    '',
    `Editable globals keys: ${GLOBAL_EDITABLE_KEYS.join(', ')}`,
  ];

  if (mode === 'simulate') {
    base.unshift('Focus on downside risk and simulation robustness.');
  } else if (mode === 'edit') {
    base.unshift('Focus on actionable, safe app-state edits.');
  } else {
    base.unshift('Focus on answering the user question clearly and directly.');
  }

  return base.join('\n');
};

const normalizeAssistantData = (data) => {
  if (!data || typeof data !== 'object') {
    return {
      summary: '',
      keyPoints: [],
      warnings: [],
      nextActions: [],
      edits: null,
    };
  }

  const answer = data.answer && typeof data.answer === 'object' ? data.answer : data;

  const summary =
    String(
      answer.summary ||
      data.summary ||
      answer.message ||
      ''
    ).trim();

  const keyPoints = toList(
    answer.keyPoints ||
    answer.highlights ||
    data.highlights ||
    data.keyPoints
  );

  const warnings = toList(answer.warnings || data.warnings);
  const nextActions = toList(
    answer.nextActions ||
    answer.actions ||
    data.nextActions ||
    data.actions
  );

  const edits = data.edits && typeof data.edits === 'object' ? data.edits : null;

  return { summary, keyPoints, warnings, nextActions, edits };
};

const AIWorkbench = ({ compact = false }) => {
  const {
    applyAIPatch,
    briannaExpenses,
    financialData,
    formatCur,
    globals,
    michaelExpenses,
    retirementExpenses,
  } = useData();

  const [mode, setMode] = useState('ask');
  const [modelTier, setModelTier] = useState('cpu');
  const [speed, setSpeed] = useState('balanced');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS.ask);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [applyStatus, setApplyStatus] = useState('');
  const [bootingOllama, setBootingOllama] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const activeModel = modelTier === 'gpu' ? MODEL_GPU : MODEL_CPU;
  const speedPreset = SPEED_PRESETS[speed] || SPEED_PRESETS.balanced;

  const contextSnapshot = useMemo(() => {
    const firstYear = financialData[0] || null;
    const retirementYear = financialData.find((row) => row.retired) || null;
    const peak = financialData.reduce(
      (acc, row) => (row.netWorth > acc.netWorth ? row : acc),
      financialData[0] || { netWorth: 0, year: null }
    );

    const michaelMonthly = Object.values(michaelExpenses).reduce((sum, val) => sum + Number(val || 0), 0);
    const briannaMonthly = Object.values(briannaExpenses).reduce((sum, val) => sum + Number(val || 0), 0);

    return {
      runtime: isElectron ? 'electron-desktop' : 'web',
      llmMode: LLM_MODE,
      projectionSummary: {
        startYear: firstYear?.year,
        startNetWorth: firstYear?.netWorth,
        retirementYear: retirementYear?.year,
        retirementNetWorth: retirementYear?.netWorth,
        peakYear: peak?.year,
        peakNetWorth: peak?.netWorth,
      },
      keyAssumptions: {
        marketReturn: globals.marketReturn,
        inflationRate: globals.inflationRate,
        michaelRetirementAge: globals.michaelRetirementAge,
        briannaRetirementAge: globals.briannaRetirementAge,
        withdrawalRate: globals.withdrawalRate,
        retirementYearlyAmount: retirementExpenses.yearlyAmount,
        michaelMonthlyExpenses: michaelMonthly,
        briannaMonthlyExpenses: briannaMonthly,
      },
      globals,
      michaelExpenses,
      briannaExpenses,
      retirementExpenses,
      projectionPreview: financialData.slice(0, 10).map((row) => ({
        year: row.year,
        netWorth: Math.round(row.netWorth),
        expenses: Math.round(row.combinedExp),
        income: Math.round(row.combinedGross),
        retired: !!row.retired,
      })),
    };
  }, [
    briannaExpenses,
    financialData,
    globals,
    michaelExpenses,
    retirementExpenses,
  ]);

  const normalizedResult = useMemo(
    () => normalizeAssistantData(result?.success ? result.data : null),
    [result]
  );

  const editSummaryRows = useMemo(
    () => summarizeEdits(normalizedResult.edits),
    [normalizedResult.edits]
  );

  const canApplyEdits =
    !!result?.success &&
    !!normalizedResult.edits &&
    editSummaryRows.length > 0;

  const captureHighlightedText = () => {
    const selected = String(window.getSelection?.()?.toString?.() || '').trim();
    if (!selected) {
      setApplyStatus('No highlighted text found. Select text in the app first.');
      return;
    }
    setSelectedText(selected);
    setApplyStatus('Highlighted text added as context.');
  };

  const captureScreenshot = async () => {
    if (!window.electronAPI?.capturePageSnapshot) {
      setApplyStatus('Screenshot context is available in the desktop app only.');
      return;
    }

    setCapturingScreenshot(true);
    const shot = await window.electronAPI.capturePageSnapshot().catch(() => ({
      ok: false,
      message: 'Failed to capture screenshot.',
    }));
    setCapturingScreenshot(false);

    if (!shot?.ok || !shot?.dataUrl) {
      setApplyStatus(shot?.message || 'Failed to capture screenshot.');
      return;
    }

    setScreenshotDataUrl(shot.dataUrl);
    setApplyStatus('Screenshot attached for the next query.');
  };

  const ensureOllama = async () => {
    if (!window.electronAPI?.ensureOllamaRunning) return;
    setBootingOllama(true);
    const status = await window.electronAPI.ensureOllamaRunning().catch(() => ({
      ok: false,
      message: 'Failed to start Ollama from Electron.',
    }));
    setBootingOllama(false);
    setApplyStatus(status.ok ? 'Ollama is ready.' : (status.message || 'Ollama is not available.'));
  };

  const runPrompt = async () => {
    if (!prompt.trim()) {
      setResult({
        success: false,
        error: 'Prompt cannot be empty.',
        model: activeModel,
        latencyMs: 0,
      });
      return;
    }

    setApplyStatus('');
    setLoading(true);

    const contextPayload = mode === 'ask'
      ? {
          runtime: contextSnapshot.runtime,
          llmMode: contextSnapshot.llmMode,
          projectionSummary: contextSnapshot.projectionSummary,
          keyAssumptions: contextSnapshot.keyAssumptions,
        }
      : contextSnapshot;

    const contextBlocks = [];
    contextBlocks.push('Current app context JSON:');
    contextBlocks.push(JSON.stringify(contextPayload));

    if (selectedText) {
      contextBlocks.push('Highlighted text context:');
      contextBlocks.push(selectedText);
    }

    const assembledPrompt = [
      buildInstructions(mode, speedPreset),
      '',
      ...contextBlocks,
      '',
      'User request:',
      prompt.trim(),
    ].join('\n');

    const generationOptions = modelTier === 'gpu'
      ? speedPreset.gpuOptions
      : speedPreset.cpuOptions;

    const response = await queryGemma(assembledPrompt, activeModel, {
      expectJson: true,
      timeoutMs: modelTier === 'gpu' ? speedPreset.timeoutMs + 45000 : speedPreset.timeoutMs,
      mode: isElectron ? 'local' : 'auto',
      tier: modelTier,
      images: screenshotDataUrl ? [screenshotDataUrl] : undefined,
      generationOptions,
    });

    setResult(response);
    setLoading(false);
  };

  const handleApply = () => {
    if (!canApplyEdits) return;

    const outcome = applyAIPatch(normalizedResult.edits);
    if (!outcome.applied) {
      setApplyStatus('No valid changes found in the AI response.');
      return;
    }

    const c = outcome.counts;
    setApplyStatus(
      `Applied updates: globals ${c.globals}, Michael expenses ${c.michaelExpenses}, Brianna expenses ${c.briannaExpenses}, retirement ${c.retirementExpenses}, overrides ${c.overrides}.`
    );
  };

  const downloadResult = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemma-result-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rootClass = compact
    ? 'h-full flex flex-col gap-3'
    : 'max-w-7xl mx-auto space-y-5 pb-6';

  return (
    <div className={rootClass}>
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bot size={18} className="text-sky-400" />
              AI Copilot
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ask questions, run simulations, and apply edits on the fly.
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>
              Runtime: <span className="text-slate-200 font-semibold">{isElectron ? 'Desktop EXE' : 'Web'}</span>
            </p>
            <p>
              Route mode: <span className="text-slate-200 font-semibold">{LLM_MODE}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 mb-2">
          <div className="xl:col-span-2 flex rounded-lg overflow-hidden border border-slate-700">
            {MODE_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id);
                  setPrompt(DEFAULT_PROMPTS[id]);
                }}
                className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                  mode === id
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={13} className="inline mr-1" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button
              type="button"
              onClick={() => setModelTier('cpu')}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                modelTier === 'cpu'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu size={13} className="inline mr-1" />
              CPU
            </button>
            <button
              type="button"
              onClick={() => setModelTier('gpu')}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                modelTier === 'gpu'
                  ? 'bg-fuchsia-500/20 text-fuchsia-300'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Rocket size={13} className="inline mr-1" />
              GPU
            </button>
          </div>
        </div>

        <div className="flex rounded-lg overflow-hidden border border-slate-700 mb-3">
          {Object.entries(SPEED_PRESETS).map(([id, cfg]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSpeed(id)}
              className={`flex-1 px-3 py-2 text-[11px] font-semibold transition-colors ${
                speed === id
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
              title={cfg.summary}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={compact ? 4 : 6}
          placeholder={DEFAULT_PROMPTS[mode]}
          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-sky-500/40"
        />

        {(selectedText || screenshotDataUrl) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedText && (
              <div className="text-[11px] bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-300 flex items-center gap-2">
                <Highlighter size={12} className="text-sky-400" />
                <span>{truncate(selectedText, 100)}</span>
                <button
                  type="button"
                  onClick={() => setSelectedText('')}
                  className="text-slate-500 hover:text-slate-300"
                  title="Clear highlighted context"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {screenshotDataUrl && (
              <div className="text-[11px] bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-300 flex items-center gap-2">
                <ImagePlus size={12} className="text-violet-400" />
                <span>Screenshot attached</span>
                <button
                  type="button"
                  onClick={() => setScreenshotDataUrl('')}
                  className="text-slate-500 hover:text-slate-300"
                  title="Clear screenshot"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runPrompt}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold"
          >
            {loading ? 'Thinking...' : 'Ask Copilot'}
          </button>
          <button
            type="button"
            onClick={captureHighlightedText}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold"
          >
            Use Highlighted Text
          </button>
          <button
            type="button"
            onClick={captureScreenshot}
            disabled={capturingScreenshot}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold"
          >
            {capturingScreenshot ? 'Capturing...' : 'Attach Screenshot'}
          </button>
          {isElectron && (
            <button
              type="button"
              onClick={ensureOllama}
              disabled={bootingOllama}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold"
            >
              {bootingOllama ? 'Starting Ollama...' : 'Start Ollama'}
            </button>
          )}
          {canApplyEdits && (
            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              Apply Edits
            </button>
          )}
          {result && (
            <button
              type="button"
              onClick={downloadResult}
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1"
            >
              <Download size={13} />
              Save JSON
            </button>
          )}
        </div>

        {applyStatus && (
          <div className="mt-3 rounded-lg border border-sky-600/40 bg-sky-500/10 text-sky-200 text-xs px-3 py-2">
            {applyStatus}
          </div>
        )}
      </div>

      <div className={compact ? 'space-y-3' : 'grid grid-cols-1 lg:grid-cols-2 gap-4'}>
        {!compact && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-2">Current Snapshot</h3>
            <div className="space-y-1 text-xs text-slate-300">
              <p>
                Start net worth: <span className="text-sky-300 font-semibold">{formatCur(contextSnapshot.projectionSummary.startNetWorth || 0)}</span>
              </p>
              <p>
                Retirement year: <span className="text-violet-300 font-semibold">{contextSnapshot.projectionSummary.retirementYear || 'N/A'}</span>
              </p>
              <p>
                Retirement net worth: <span className="text-emerald-300 font-semibold">{formatCur(contextSnapshot.projectionSummary.retirementNetWorth || 0)}</span>
              </p>
              <p>
                Peak net worth: <span className="text-amber-300 font-semibold">{formatCur(contextSnapshot.projectionSummary.peakNetWorth || 0)}</span>
              </p>
              <p className="pt-2 text-slate-400">
                Model: <span className="text-slate-200">{activeModel}</span>
              </p>
              <p className="text-slate-400">
                Speed preset: <span className="text-slate-200">{speedPreset.label}</span>
              </p>
            </div>
          </div>
        )}

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-2">Assistant Result</h3>
          {!result && (
            <p className="text-xs text-slate-400">
              Ask a question to get a structured answer with key points, warnings, and optional app edits.
            </p>
          )}

          {result && (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${
                    result.success
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {result.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {result.success ? 'Success' : 'Failed'}
                </div>
                <span className="text-slate-300">
                  Model: <span className="font-semibold text-slate-100">{result.resolvedModel || result.model}</span>
                </span>
                <span className="text-slate-300">
                  Latency: <span className="font-semibold text-slate-100">{result.latencyMs} ms</span>
                </span>
                {result.metrics?.tokensPerSecond ? (
                  <span className="text-slate-300">
                    Speed: <span className="font-semibold text-emerald-300">{result.metrics.tokensPerSecond} tok/s</span>
                  </span>
                ) : null}
              </div>

              {result.metrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                    <p className="text-slate-500">Load</p>
                    <p className="text-slate-200 font-semibold">{result.metrics.loadMs ?? '-'} ms</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                    <p className="text-slate-500">Prompt</p>
                    <p className="text-slate-200 font-semibold">{result.metrics.promptMs ?? '-'} ms</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                    <p className="text-slate-500">Generate</p>
                    <p className="text-slate-200 font-semibold">{result.metrics.generationMs ?? '-'} ms</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                    <p className="text-slate-500">Tokens</p>
                    <p className="text-slate-200 font-semibold">{result.metrics.generatedTokens ?? '-'}</p>
                  </div>
                </div>
              )}

              {result.warning && (
                <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 text-amber-200 px-3 py-2 break-words">
                  {result.warning}
                </div>
              )}

              {result.error && (
                <div className="rounded-lg border border-rose-600/40 bg-rose-500/10 text-rose-200 px-3 py-2 break-words">
                  {result.error}
                </div>
              )}

              {result.success && (
                <>
                  {normalizedResult.summary ? (
                    <div className="rounded-lg border border-sky-600/40 bg-sky-500/10 px-3 py-2 text-sky-100">
                      <p className="text-[11px] uppercase tracking-wide text-sky-300 mb-1">Summary</p>
                      <p className="text-sm text-white leading-relaxed">{normalizedResult.summary}</p>
                    </div>
                  ) : null}

                  {normalizedResult.keyPoints.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Key Points</p>
                      <ul className="space-y-1.5">
                        {normalizedResult.keyPoints.map((point) => (
                          <li key={point} className="text-slate-200 bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizedResult.warnings.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-amber-300 mb-1">Warnings</p>
                      <ul className="space-y-1.5">
                        {normalizedResult.warnings.map((warning) => (
                          <li key={warning} className="text-amber-100 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizedResult.nextActions.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-emerald-300 mb-1">Next Actions</p>
                      <ul className="space-y-1.5">
                        {normalizedResult.nextActions.map((action) => (
                          <li key={action} className="text-emerald-100 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2 py-1.5">
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {editSummaryRows.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-violet-300 mb-1">Proposed Edits</p>
                      <ul className="space-y-1.5">
                        {editSummaryRows.map((row) => (
                          <li key={row} className="text-violet-100 bg-violet-500/10 border border-violet-500/30 rounded-md px-2 py-1.5">
                            {row}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowRaw((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-slate-300 hover:text-slate-100"
                  >
                    <FileText size={13} />
                    {showRaw ? 'Hide Raw JSON' : 'Show Raw JSON'}
                    {showRaw ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {showRaw && (
                    <pre className="max-h-64 overflow-auto bg-slate-900 border border-slate-700 rounded-lg p-2 text-[11px] text-slate-200 whitespace-pre-wrap break-words">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIWorkbench;
