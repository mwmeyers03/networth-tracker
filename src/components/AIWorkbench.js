import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Cpu,
  Download,
  Rocket,
  Sparkles,
  Wand2,
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

const DEFAULT_SIM_PROMPT =
  'Run a stress simulation for retiring at 48/49 with 6% inflation for 3 years, then recommend safer assumptions.';
const DEFAULT_EDIT_PROMPT =
  'Update assumptions for a conservative plan: 6.5% market return, 3% inflation, retirement age 52 for both, retirement spend 90000.';

const aiJsonInstructions = (mode) => {
  const base = [
    'Return only valid JSON. Do not include markdown fences.',
    'When editing, only modify fields that need to change.',
    'Use numeric values for money, rates, and ages.',
    '',
    'Allowed top-level shape:',
    '{',
    '  "summary": "string",',
    '  "highlights": ["string"],',
    '  "warnings": ["string"],',
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
    base.unshift('Focus on simulation quality, downside risk, and actionability.');
  } else {
    base.unshift('Focus on actionable app-state edits for the user request.');
  }

  return base.join('\n');
};

const AIWorkbench = () => {
  const {
    applyAIPatch,
    briannaExpenses,
    financialData,
    formatCur,
    globals,
    michaelExpenses,
    retirementExpenses,
  } = useData();

  const [mode, setMode] = useState('simulate');
  const [modelTier, setModelTier] = useState('cpu');
  const [prompt, setPrompt] = useState(DEFAULT_SIM_PROMPT);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [applyStatus, setApplyStatus] = useState('');
  const [bootingOllama, setBootingOllama] = useState(false);

  const activeModel = modelTier === 'gpu' ? MODEL_GPU : MODEL_CPU;

  const contextSnapshot = useMemo(() => {
    const firstYear = financialData[0] || null;
    const retirementYear = financialData.find((row) => row.retired) || null;
    const peak = financialData.reduce(
      (acc, row) => (row.netWorth > acc.netWorth ? row : acc),
      financialData[0] || { netWorth: 0, year: null }
    );

    return {
      runtime: isElectron ? 'electron-desktop' : 'web',
      llmMode: LLM_MODE,
      globals,
      michaelExpenses,
      briannaExpenses,
      retirementExpenses,
      projectionSummary: {
        startYear: firstYear?.year,
        startNetWorth: firstYear?.netWorth,
        retirementYear: retirementYear?.year,
        retirementNetWorth: retirementYear?.netWorth,
        peakYear: peak?.year,
        peakNetWorth: peak?.netWorth,
      },
      projectionPreview: financialData.slice(0, 12).map((row) => ({
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

    const assembledPrompt = [
      aiJsonInstructions(mode),
      '',
      'Current app state JSON:',
      JSON.stringify(contextSnapshot),
      '',
      'User request:',
      prompt.trim(),
    ].join('\n');

    const response = await queryGemma(assembledPrompt, activeModel, {
      expectJson: true,
      timeoutMs: modelTier === 'gpu' ? 120000 : 45000,
      mode: isElectron ? 'local' : 'auto',
      tier: modelTier,
    });

    setResult(response);
    setLoading(false);
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

  const canApplyEdits =
    !!result?.success &&
    result?.data &&
    typeof result.data === 'object' &&
    result.data.edits &&
    typeof result.data.edits === 'object';

  const handleApply = () => {
    if (!canApplyEdits) return;

    const outcome = applyAIPatch(result.data.edits);
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

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-6">
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bot size={18} className="text-sky-400" />
              Gemma Workbench
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Run simulation prompts and apply structured app-wide edits.
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button
              type="button"
              onClick={() => {
                setMode('simulate');
                if (!prompt.trim()) setPrompt(DEFAULT_SIM_PROMPT);
              }}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                mode === 'simulate'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles size={13} className="inline mr-1" />
              Simulate
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('edit');
                if (!prompt.trim()) setPrompt(DEFAULT_EDIT_PROMPT);
              }}
              className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                mode === 'edit'
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wand2 size={13} className="inline mr-1" />
              Edit Program State
            </button>
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
              Fast CPU ({MODEL_CPU})
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
              Deep GPU ({MODEL_GPU})
            </button>
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          placeholder={mode === 'simulate' ? DEFAULT_SIM_PROMPT : DEFAULT_EDIT_PROMPT}
          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm outline-none focus:ring-2 focus:ring-sky-500/40"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runPrompt}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold"
          >
            {loading ? 'Running...' : 'Run Gemma Query'}
          </button>
          <button
            type="button"
            onClick={() => setPrompt(mode === 'simulate' ? DEFAULT_SIM_PROMPT : DEFAULT_EDIT_PROMPT)}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold"
          >
            Load Example
          </button>
          {isElectron && (
            <button
              type="button"
              onClick={ensureOllama}
              disabled={bootingOllama}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold"
            >
              {bootingOllama ? 'Starting Ollama...' : 'Start Ollama'}
            </button>
          )}
          {canApplyEdits && (
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
            >
              Apply Edits to App
            </button>
          )}
          {result && (
            <button
              type="button"
              onClick={downloadResult}
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1"
            >
              <Download size={13} />
              Save Result JSON
            </button>
          )}
        </div>

        {applyStatus && (
          <div className="mt-3 rounded-lg border border-emerald-600/40 bg-emerald-500/10 text-emerald-300 text-xs px-3 py-2">
            {applyStatus}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-2">Last Gemma Result</h3>
          {!result && <p className="text-xs text-slate-400">No query run yet.</p>}
          {result && (
            <div className="space-y-2 text-xs">
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
              <p className="text-slate-300">
                Model: <span className="font-semibold text-slate-100">{result.model}</span>
              </p>
              {result.resolvedModel && result.resolvedModel !== result.model && (
                <p className="text-slate-300">
                  Resolved model: <span className="font-semibold text-sky-300">{result.resolvedModel}</span>
                </p>
              )}
              <p className="text-slate-300">
                Latency: <span className="font-semibold text-slate-100">{result.latencyMs} ms</span>
              </p>
              {result.warning && (
                <p className="text-amber-300 break-words">{result.warning}</p>
              )}
              {result.error && (
                <p className="text-rose-300 break-words">{result.error}</p>
              )}
              {result.success && result.data && (
                <pre className="max-h-56 overflow-auto bg-slate-900 border border-slate-700 rounded-lg p-2 text-[11px] text-slate-200 whitespace-pre-wrap break-words">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIWorkbench;
