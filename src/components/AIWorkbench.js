import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
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
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useData } from '../contexts/DataContext';
import {
  isElectron,
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

const QUICK_FOLLOW_UPS = [
  'Recalculate with explicit formulas and intermediate numeric steps for every recommendation.',
  'Create a downside-case scenario table with year-by-year balance trajectory and failure points.',
  'Give a concrete 12-month action plan with dollar targets, contribution amounts, and checkpoints.',
];

const SPEED_PRESETS = {
  turbo: {
    label: 'Turbo',
    summary: 'Fast but still detailed',
    timeoutMs: 45000,
    minAnalysisPoints: 5,
    reasoningEffort: 'low',
    cpuOptions: { num_predict: 420, num_ctx: 1536, temperature: 0.08 },
    gpuOptions: { num_predict: 620, num_ctx: 2048, temperature: 0.08 },
  },
  balanced: {
    label: 'Balanced',
    summary: 'Thorough without excessive latency',
    timeoutMs: 85000,
    minAnalysisPoints: 8,
    reasoningEffort: 'medium',
    cpuOptions: { num_predict: 760, num_ctx: 2048, temperature: 0.1 },
    gpuOptions: { num_predict: 1000, num_ctx: 3072, temperature: 0.1 },
  },
  deep: {
    label: 'Deep',
    summary: 'Most comprehensive analysis',
    timeoutMs: 140000,
    minAnalysisPoints: 12,
    reasoningEffort: 'high',
    cpuOptions: { num_predict: 1100, num_ctx: 3072, temperature: 0.12 },
    gpuOptions: { num_predict: 1500, num_ctx: 4096, temperature: 0.12 },
  },
};

const cleanDisplayText = (value) => String(value ?? '')
  .replace(/\r/g, '\n')
  .replace(/```(?:json)?/gi, '')
  .replace(/```/g, '')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/^#{1,6}\s*/gm, '')
  .replace(/\s+/g, ' ')
  .trim();

const splitIntoReadablePoints = (value) => {
  const cleaned = cleanDisplayText(value);
  if (!cleaned) return [];

  const withSectionBreaks = cleaned
    .replace(/([A-Z][A-Za-z0-9 /()_-]{2,40}:)\s*/g, '\n$1 ')
    .replace(/(?:^|\s)[-*]\s+/g, '\n')
    .replace(/\s*[•]\s+/g, '\n');

  const rawParts = withSectionBreaks
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const points = [];

  rawParts.forEach((part) => {
    if (part.length <= 220) {
      points.push(part);
      return;
    }

    const sentences = part.match(/[^.!?]+[.!?]?/g)
      ?.map((segment) => segment.trim())
      .filter(Boolean) || [part];

    sentences.forEach((sentence) => {
      if (sentence.length <= 220) {
        points.push(sentence);
      } else {
        points.push(`${sentence.slice(0, 219)}...`);
      }
    });
  });

  return [...new Set(points)].slice(0, 30);
};

const stringifyStructuredValue = (value) => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value
      .map((entry) => stringifyStructuredValue(entry))
      .filter(Boolean)
      .join(' | ');
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${stringifyStructuredValue(val)}`)
      .filter(Boolean)
      .join(' | ')
      .trim();
  }

  return String(value);
};

const toList = (value) => {
  if (!value) return [];

  const items = Array.isArray(value) ? value : [value];

  const lines = items.flatMap((item) => {
    if (typeof item === 'string') {
      return splitIntoReadablePoints(item);
    }

    if (item && typeof item === 'object') {
      return splitIntoReadablePoints(stringifyStructuredValue(item));
    }

    return splitIntoReadablePoints(String(item ?? ''));
  });

  return [...new Set(lines.filter(Boolean))];
};

const toPromptString = (value) => {
  const asText = typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? stringifyStructuredValue(value)
      : String(value ?? '');

  return cleanDisplayText(asText);
};

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const formatUsdInline = (value) => {
  const num = toFiniteNumber(value);
  if (num === null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
};

const formatSignedUsdInline = (value) => {
  const num = toFiniteNumber(value);
  if (num === null) return 'N/A';
  const sign = num > 0 ? '+' : '';
  return `${sign}${formatUsdInline(num)}`;
};

const formatRatioInline = (value) => {
  const num = toFiniteNumber(value);
  return num === null ? 'N/A' : `${num.toFixed(2)}x`;
};

const formatPctInline = (value) => {
  const num = toFiniteNumber(value);
  return num === null ? 'N/A' : `${num.toFixed(1)}%`;
};

const formatYearInline = (value) => {
  const num = toFiniteNumber(value);
  return num === null ? 'N/A' : String(Math.round(num));
};

const normalizeNumericResults = (value) => {
  if (!value) return [];

  const rows = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).map(([metric, rawValue]) => ({ metric, value: rawValue }))
      : [];

  return rows
    .map((row, index) => {
      if (typeof row === 'string') {
        return {
          id: `nr-${index}`,
          metric: row,
          value: null,
          unit: '',
          formula: '',
          confidence: '',
          note: '',
        };
      }

      if (!row || typeof row !== 'object') {
        const num = toFiniteNumber(row);
        return {
          id: `nr-${index}`,
          metric: `Metric ${index + 1}`,
          value: num,
          unit: '',
          formula: '',
          confidence: '',
          note: '',
        };
      }

      return {
        id: String(row.id || row.metric || row.name || `nr-${index}`),
        metric: String(row.metric || row.name || `Metric ${index + 1}`),
        value: toFiniteNumber(row.value ?? row.amount ?? row.result ?? row.number),
        unit: String(row.unit || row.units || row.format || '').trim(),
        formula: String(row.formula || row.calculation || row.method || '').trim(),
        confidence: String(row.confidence || row.certainty || '').trim(),
        note: String(row.note || row.reason || row.explanation || '').trim(),
      };
    })
    .filter((row) => row.metric || row.value !== null || row.note);
};

const normalizeScenarioRows = (value) => {
  if (!value) return [];

  const rows = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).map(([scenario, details]) => ({ scenario, ...(details || {}) }))
      : [];

  return rows
    .map((row, index) => {
      if (typeof row === 'string') {
        return {
          id: `sc-${index}`,
          scenario: row,
          retirementYear: null,
          retirementNetWorth: null,
          successRatePct: null,
          depletionYear: null,
          notes: '',
        };
      }

      const safe = row && typeof row === 'object' ? row : {};

      return {
        id: String(safe.id || safe.scenario || safe.name || `sc-${index}`),
        scenario: String(safe.scenario || safe.name || `Scenario ${index + 1}`),
        retirementYear: toFiniteNumber(safe.retirementYear ?? safe.fireYear ?? safe.retireYear),
        retirementNetWorth: toFiniteNumber(
          safe.retirementNetWorth ?? safe.retireNetWorth ?? safe.netWorthAtRetirement
        ),
        successRatePct: toFiniteNumber(safe.successRatePct ?? safe.successRate ?? safe.probability),
        depletionYear: toFiniteNumber(safe.depletionYear ?? safe.failureYear ?? safe.shortfallYear),
        notes: String(safe.notes || safe.note || safe.explanation || '').trim(),
      };
    })
    .filter((row) => row.scenario || row.notes);
};

const truncate = (value, len = 180) => {
  const text = String(value || '').trim();
  if (text.length <= len) return text;
  return `${text.slice(0, len - 1)}...`;
};

const canonicalizeLine = (value) => cleanDisplayText(value)
  .toLowerCase()
  .replace(/\$[\d,]+(?:\.\d+)?/g, '$amount')
  .replace(/[0-9]+(?:\.[0-9]+)?%/g, 'pct')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const compactUniqueList = (items, maxItems = 10) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const seen = new Set();
  const compacted = [];

  items.forEach((item) => {
    if (compacted.length >= maxItems) return;
    const cleaned = cleanDisplayText(item);
    if (!cleaned) return;

    const key = canonicalizeLine(cleaned);
    if (!key || seen.has(key)) return;

    seen.add(key);
    compacted.push(cleaned);
  });

  return compacted;
};

const CHART_COLORS = ['#38bdf8', '#22c55e', '#f59e0b', '#a78bfa', '#f97316', '#14b8a6'];

const normalizeChartSeries = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (typeof item === 'string') {
        const key = cleanDisplayText(item);
        if (!key) return null;

        return {
          key,
          label: key,
          color: CHART_COLORS[index % CHART_COLORS.length],
          format: 'number',
        };
      }

      if (!item || typeof item !== 'object') return null;

      const key = cleanDisplayText(item.key || item.dataKey || item.field || '');
      if (!key) return null;

      return {
        key,
        label: cleanDisplayText(item.label || item.name || key),
        color: cleanDisplayText(item.color || item.stroke || CHART_COLORS[index % CHART_COLORS.length]) || CHART_COLORS[index % CHART_COLORS.length],
        format: cleanDisplayText(item.format || item.unit || 'number').toLowerCase(),
      };
    })
    .filter(Boolean);
};

const normalizeChartSpecs = (value) => {
  if (!value) return [];
  const rows = Array.isArray(value) ? value : [value];

  return rows
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;

      const chartType = cleanDisplayText(row.chartType || row.type || 'line').toLowerCase();
      const normalizedType = ['line', 'area', 'bar'].includes(chartType) ? chartType : 'line';

      const series = normalizeChartSeries(row.series);

      return {
        id: cleanDisplayText(row.id || row.title || `chart-${index}`) || `chart-${index}`,
        title: cleanDisplayText(row.title || row.name || `Chart ${index + 1}`) || `Chart ${index + 1}`,
        description: cleanDisplayText(row.description || row.notes || ''),
        chartType: normalizedType,
        xKey: cleanDisplayText(row.xKey || row.x || 'year') || 'year',
        dataSource: cleanDisplayText(row.dataSource || row.dataset || '').toLowerCase(),
        data: Array.isArray(row.data) ? row.data : [],
        series,
      };
    })
    .filter((spec) => spec && (spec.series.length > 0 || spec.data.length > 0));
};

const buildDeterministicChartSpecs = (report) => {
  if (!report || typeof report !== 'object') return [];

  const comparisonSeries = Array.isArray(report.comparisonSeries) ? report.comparisonSeries : [];
  const allocationComparison = Array.isArray(report.allocationComparison) ? report.allocationComparison : [];

  const specs = [
    {
      id: 'det-net-worth-comparison',
      title: 'Net Worth Projection (Baseline vs Scenario)',
      description: 'Yearly trajectory comparison for total net worth.',
      chartType: 'line',
      xKey: 'year',
      dataSource: 'comparisonseries',
      series: [
        { key: 'baselineNetWorth', label: 'Baseline Net Worth', color: '#38bdf8', format: 'currency' },
        { key: 'scenarioNetWorth', label: 'Scenario Net Worth', color: '#22c55e', format: 'currency' },
      ],
    },
    {
      id: 'det-income-expense-stress',
      title: 'Income vs Expense Stress View',
      description: 'Tracks annual cash inflow/outflow impact under scenario assumptions.',
      chartType: 'area',
      xKey: 'year',
      dataSource: 'comparisonseries',
      series: [
        { key: 'scenarioIncome', label: 'Scenario Income', color: '#14b8a6', format: 'currency' },
        { key: 'scenarioExpenses', label: 'Scenario Expenses', color: '#f97316', format: 'currency' },
      ],
    },
    {
      id: 'det-retirement-allocation',
      title: 'Retirement Asset Mix Comparison',
      description: 'Compares baseline vs scenario retirement-year asset composition.',
      chartType: 'bar',
      xKey: 'bucket',
      dataSource: 'allocationcomparison',
      series: [
        { key: 'baseline', label: 'Baseline', color: '#60a5fa', format: 'currency' },
        { key: 'scenario', label: 'Scenario', color: '#34d399', format: 'currency' },
      ],
    },
  ];

  if (!comparisonSeries.length && !allocationComparison.length) {
    return [];
  }

  return specs;
};

const resolveChartData = (spec, report) => {
  if (Array.isArray(spec?.data) && spec.data.length > 0) return spec.data;

  const source = String(spec?.dataSource || '').toLowerCase();

  if (source === 'comparisonseries') {
    return Array.isArray(report?.comparisonSeries) ? report.comparisonSeries : [];
  }

  if (source === 'allocationcomparison') {
    return Array.isArray(report?.allocationComparison) ? report.allocationComparison : [];
  }

  if (source === 'scenariopreview') {
    return Array.isArray(report?.scenarioPreview) ? report.scenarioPreview : [];
  }

  if (Array.isArray(report?.comparisonSeries) && report.comparisonSeries.length > 0) {
    return report.comparisonSeries;
  }

  return [];
};

const parseScenarioFromPrompt = (promptText) => {
  const text = String(promptText || '');
  const parsed = {};

  const retirementAgeMatch = text.match(/retir(?:e|ing)\s+at\s+(\d{2})(?:\s*\/\s*(\d{2}))?/i);
  if (retirementAgeMatch) {
    const michaelAge = toFiniteNumber(retirementAgeMatch[1]);
    const briannaAge = toFiniteNumber(retirementAgeMatch[2] || retirementAgeMatch[1]);
    if (michaelAge !== null) parsed.michaelRetirementAge = michaelAge;
    if (briannaAge !== null) parsed.briannaRetirementAge = briannaAge;
  }

  const inflationShockMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*inflation(?:\s*for\s*(\d+)\s*years?)?/i);
  if (inflationShockMatch) {
    const ratePct = toFiniteNumber(inflationShockMatch[1]);
    const years = toFiniteNumber(inflationShockMatch[2]);
    if (ratePct !== null) parsed.inflationShockRate = ratePct / 100;
    if (years !== null) {
      parsed.inflationShockYears = Math.max(0, Math.floor(years));
    } else if (ratePct !== null) {
      parsed.inflationShockYears = 3;
    }
  }

  const inflationRateMatch = text.match(/inflation\s*(?:rate)?[^0-9]{0,8}(\d+(?:\.\d+)?)\s*%/i);
  if (inflationRateMatch) {
    const inflationPct = toFiniteNumber(inflationRateMatch[1]);
    if (inflationPct !== null) parsed.inflationRate = inflationPct / 100;
  }

  const withdrawalMatch = text.match(/withdrawal\s*rate[^0-9]{0,8}(\d+(?:\.\d+)?)\s*%/i);
  if (withdrawalMatch) {
    const withdrawalPct = toFiniteNumber(withdrawalMatch[1]);
    if (withdrawalPct !== null) parsed.withdrawalRate = withdrawalPct / 100;
  }

  const marketReturnMatch = text.match(/market\s*return[^0-9]{0,8}(\d+(?:\.\d+)?)\s*%/i);
  if (marketReturnMatch) {
    const marketPct = toFiniteNumber(marketReturnMatch[1]);
    if (marketPct !== null) parsed.marketReturn = marketPct / 100;
  }

  const retirementSpendMatch = text.match(/(?:retirement\s*spend|annual\s*spend|yearly\s*spend|spend)\D{0,12}\$?\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  if (retirementSpendMatch) {
    const spend = toFiniteNumber(String(retirementSpendMatch[1]).replace(/,/g, ''));
    if (spend !== null) parsed.retirementYearlyAmount = spend;
  }

  return parsed;
};

const hasScenarioOverrides = (report) => {
  if (!report || typeof report !== 'object') return false;
  const inputs = report.inputs || {};

  return (
    toFiniteNumber(inputs.inflationRate) !== null ||
    toFiniteNumber(inputs.inflationShockRate) !== null ||
    (toFiniteNumber(inputs.inflationShockYears) !== null && Number(inputs.inflationShockYears) > 0) ||
    toFiniteNumber(inputs.michaelRetirementAge) !== null ||
    toFiniteNumber(inputs.briannaRetirementAge) !== null ||
    toFiniteNumber(inputs.withdrawalRate) !== null ||
    toFiniteNumber(inputs.marketReturn) !== null ||
    toFiniteNumber(inputs.retirementYearlyAmount) !== null
  );
};

const buildDeterministicNumericalRows = (report) => {
  if (!report || typeof report !== 'object') return [];

  const base = report.baseline || {};
  const scenario = report.scenario || {};

  const rows = [
    {
      id: 'det-base-retire-net-worth',
      metric: 'Baseline retirement net worth',
      value: toFiniteNumber(base.retirementNetWorth),
      unit: 'USD',
      formula: 'From local projection: net worth in first retirement year under current assumptions.',
      confidence: 'high',
      note: '',
    },
    {
      id: 'det-scenario-retire-net-worth',
      metric: 'Scenario retirement net worth',
      value: toFiniteNumber(scenario.retirementNetWorth),
      unit: 'USD',
      formula: 'From local projection: net worth in first retirement year under requested scenario.',
      confidence: 'high',
      note: '',
    },
    {
      id: 'det-retire-net-worth-delta',
      metric: 'Retirement net worth delta (scenario - baseline)',
      value:
        toFiniteNumber(scenario.retirementNetWorth) !== null && toFiniteNumber(base.retirementNetWorth) !== null
          ? Number(scenario.retirementNetWorth) - Number(base.retirementNetWorth)
          : null,
      unit: 'USD',
      formula: 'Scenario retirement net worth minus baseline retirement net worth.',
      confidence: 'high',
      note: '',
    },
    {
      id: 'det-base-coverage-ratio',
      metric: 'Baseline withdrawal coverage ratio',
      value: toFiniteNumber(base.withdrawalCoverageRatio),
      unit: 'x',
      formula: '(Retirement net worth * withdrawal rate) / retirement yearly spend.',
      confidence: 'high',
      note: '',
    },
    {
      id: 'det-scenario-coverage-ratio',
      metric: 'Scenario withdrawal coverage ratio',
      value: toFiniteNumber(scenario.withdrawalCoverageRatio),
      unit: 'x',
      formula: '(Scenario retirement net worth * scenario withdrawal rate) / scenario yearly spend.',
      confidence: 'high',
      note: '',
    },
    {
      id: 'det-scenario-end-net-worth',
      metric: 'Scenario end-of-horizon net worth',
      value: toFiniteNumber(scenario.endNetWorth),
      unit: 'USD',
      formula: 'Projected net worth at final horizon year from local deterministic model.',
      confidence: 'high',
      note: '',
    },
    {
      id: 'det-scenario-min-net-worth',
      metric: 'Scenario minimum net worth',
      value: toFiniteNumber(scenario.minNetWorth),
      unit: 'USD',
      formula: 'Minimum annual net worth observed in local deterministic projection.',
      confidence: 'high',
      note: '',
    },
  ];

  return rows.filter((row) => row.value !== null);
};

const buildDeterministicScenarioRows = (report) => {
  if (!report || typeof report !== 'object') return [];

  const base = report.baseline || {};
  const scenario = report.scenario || {};

  return [
    {
      id: 'det-scenario-base',
      scenario: 'baseline',
      retirementYear: toFiniteNumber(base.retirementYear),
      retirementNetWorth: toFiniteNumber(base.retirementNetWorth),
      successRatePct: null,
      depletionYear: toFiniteNumber(base.firstLiquidityGapYear ?? base.firstNonPositiveNetWorthYear),
      notes: 'Current app assumptions.',
    },
    {
      id: 'det-scenario-requested',
      scenario: 'requested',
      retirementYear: toFiniteNumber(scenario.retirementYear),
      retirementNetWorth: toFiniteNumber(scenario.retirementNetWorth),
      successRatePct: null,
      depletionYear: toFiniteNumber(scenario.firstLiquidityGapYear ?? scenario.firstNonPositiveNetWorthYear),
      notes: 'Parsed scenario prompt assumptions evaluated locally.',
    },
  ];
};

const buildDeterministicActions = (report, snapshot = null) => {
  if (!report || typeof report !== 'object') return [];
  const base = report.baseline || {};
  const scenario = report.scenario || {};
  const inputs = report.inputs || {};
  const actions = [];

  const scenarioCoverage = toFiniteNumber(scenario.withdrawalCoverageRatio);
  const scenarioRetirementNetWorth = toFiniteNumber(scenario.retirementNetWorth);
  const scenarioWithdrawalRate =
    toFiniteNumber(inputs.withdrawalRate) ?? toFiniteNumber(snapshot?.keyAssumptions?.withdrawalRate);
  const scenarioRetirementSpend =
    toFiniteNumber(inputs.retirementYearlyAmount) ?? toFiniteNumber(snapshot?.keyAssumptions?.retirementYearlyAmount);

  if (
    scenarioCoverage !== null &&
    scenarioCoverage < 1 &&
    scenarioRetirementNetWorth !== null &&
    scenarioWithdrawalRate !== null &&
    scenarioRetirementSpend !== null
  ) {
    const sustainableSpend = scenarioRetirementNetWorth * scenarioWithdrawalRate;
    const reductionNeeded = Math.max(0, scenarioRetirementSpend - sustainableSpend);

    if (reductionNeeded > 0) {
      actions.push(
        `Lower retirement spend by about ${formatUsdInline(reductionNeeded)} per year (from ${formatUsdInline(
          scenarioRetirementSpend
        )} to ${formatUsdInline(sustainableSpend)}) to reach at least 1.00x coverage.`
      );
    }
  }

  if (
    toFiniteNumber(base.withdrawalCoverageRatio) !== null &&
    toFiniteNumber(scenario.withdrawalCoverageRatio) !== null &&
    Number(scenario.withdrawalCoverageRatio) < Number(base.withdrawalCoverageRatio)
  ) {
    actions.push(
      `Coverage drops from ${formatRatioInline(base.withdrawalCoverageRatio)} to ${formatRatioInline(
        scenario.withdrawalCoverageRatio
      )}; push retirement age back 1-2 years or increase annual contributions to recover this gap.`
    );
  }

  if (toFiniteNumber(scenario.firstLiquidityGapYear) !== null) {
    actions.push(
      `Address projected liquidity gap by ${formatYearInline(
        scenario.firstLiquidityGapYear
      )} with a staged cash buffer and lower pre-retirement spending.`
    );
  }

  if (
    toFiniteNumber(scenario.retirementNetWorth) !== null &&
    toFiniteNumber(base.retirementNetWorth) !== null
  ) {
    const delta = Number(scenario.retirementNetWorth) - Number(base.retirementNetWorth);
    actions.push(
      `Scenario retirement net worth change is ${formatSignedUsdInline(
        delta
      )}; test contribution increases and delayed retirement until this delta is no longer negative.`
    );
  }

  actions.push('Run a comparison with retirement age +2 years and review the retirement net worth delta.');
  return [...new Set(actions)].slice(0, 8);
};

const buildDeterministicDeepAnalysis = (report, snapshot = null) => {
  if (!report || typeof report !== 'object') return [];

  const base = report.baseline || {};
  const scenario = report.scenario || {};
  const monte = snapshot?.monteCarloSummary || {};
  const diagnostics = snapshot?.numericDiagnostics || {};

  const points = [];

  if (
    toFiniteNumber(base.retirementNetWorth) !== null &&
    toFiniteNumber(scenario.retirementNetWorth) !== null
  ) {
    const delta = Number(scenario.retirementNetWorth) - Number(base.retirementNetWorth);
    points.push(
      `Retirement-year net worth moves from ${formatUsdInline(base.retirementNetWorth)} to ${formatUsdInline(
        scenario.retirementNetWorth
      )} (${formatSignedUsdInline(delta)} change).`
    );
  }

  if (
    toFiniteNumber(base.retirementYear) !== null ||
    toFiniteNumber(scenario.retirementYear) !== null
  ) {
    points.push(
      `Baseline retirement year is ${formatYearInline(base.retirementYear)}; scenario retirement year is ${formatYearInline(
        scenario.retirementYear
      )}.`
    );
  }

  if (
    toFiniteNumber(base.withdrawalCoverageRatio) !== null ||
    toFiniteNumber(scenario.withdrawalCoverageRatio) !== null
  ) {
    points.push(
      `Withdrawal coverage ratio shifts from ${formatRatioInline(base.withdrawalCoverageRatio)} to ${formatRatioInline(
        scenario.withdrawalCoverageRatio
      )}; values below 1.00x indicate spend pressure.`
    );
  }

  if (toFiniteNumber(scenario.firstLiquidityGapYear) !== null) {
    points.push(
      `Scenario shows first liquidity gap around ${formatYearInline(
        scenario.firstLiquidityGapYear
      )}, signaling when current withdrawal path becomes underfunded.`
    );
  }

  if (toFiniteNumber(scenario.minNetWorth) !== null) {
    points.push(
      `Scenario minimum projected net worth is ${formatUsdInline(scenario.minNetWorth)} in ${formatYearInline(
        scenario.minYear
      )}.`
    );
  }

  if (toFiniteNumber(diagnostics.baseSavingsRate) !== null) {
    points.push(
      `Current pre-retirement savings rate is ${(Number(diagnostics.baseSavingsRate) * 100).toFixed(
        1
      )}% based on first-year income and expenses.`
    );
  }

  if (
    toFiniteNumber(monte.baselineSuccessRate) !== null ||
    toFiniteNumber(monte.conservativeSuccessRate) !== null ||
    toFiniteNumber(monte.aggressiveSuccessRate) !== null
  ) {
    points.push(
      `Monte Carlo success rates: baseline ${formatPctInline(
        monte.baselineSuccessRate
      )}, conservative ${formatPctInline(monte.conservativeSuccessRate)}, aggressive ${formatPctInline(
        monte.aggressiveSuccessRate
      )}.`
    );
  }

  return [...new Set(points.filter(Boolean))].slice(0, 14);
};

const buildDeterministicScenarioResults = (report) => {
  if (!report || typeof report !== 'object') return [];

  const base = report.baseline || {};
  const scenario = report.scenario || {};

  const rows = [];

  if (
    toFiniteNumber(base.retirementNetWorth) !== null &&
    toFiniteNumber(scenario.retirementNetWorth) !== null
  ) {
    const delta = Number(scenario.retirementNetWorth) - Number(base.retirementNetWorth);
    rows.push(
      `Retirement net worth: ${formatUsdInline(base.retirementNetWorth)} -> ${formatUsdInline(
        scenario.retirementNetWorth
      )} (${formatSignedUsdInline(delta)}).`
    );
  }

  if (
    toFiniteNumber(base.withdrawalCoverageRatio) !== null &&
    toFiniteNumber(scenario.withdrawalCoverageRatio) !== null
  ) {
    rows.push(
      `Coverage ratio: ${formatRatioInline(base.withdrawalCoverageRatio)} -> ${formatRatioInline(
        scenario.withdrawalCoverageRatio
      )}.`
    );
  }

  if (toFiniteNumber(scenario.firstLiquidityGapYear) !== null) {
    rows.push(`First scenario liquidity gap year: ${formatYearInline(scenario.firstLiquidityGapYear)}.`);
  }

  if (toFiniteNumber(scenario.endNetWorth) !== null) {
    rows.push(`End-of-horizon scenario net worth: ${formatUsdInline(scenario.endNetWorth)}.`);
  }

  return [...new Set(rows)].slice(0, 10);
};

const buildDeterministicWarnings = (report, snapshot = null) => {
  if (!report || typeof report !== 'object') return [];

  const scenario = report.scenario || {};
  const warnings = [];

  if (
    toFiniteNumber(scenario.withdrawalCoverageRatio) !== null &&
    Number(scenario.withdrawalCoverageRatio) < 1
  ) {
    warnings.push('Scenario withdrawal coverage is below 1.00x, indicating retirement spend exceeds sustainable withdrawals.');
  }

  if (toFiniteNumber(scenario.firstLiquidityGapYear) !== null) {
    warnings.push(`Liquidity shortfall appears by ${formatYearInline(scenario.firstLiquidityGapYear)} under the current scenario.`);
  }

  if (
    toFiniteNumber(snapshot?.monteCarloSummary?.conservativeSuccessRate) !== null &&
    Number(snapshot.monteCarloSummary.conservativeSuccessRate) < 70
  ) {
    warnings.push('Conservative Monte Carlo success is below 70%, suggesting limited downside resilience.');
  }

  return [...new Set(warnings)].slice(0, 6);
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
    'Give a thorough answer that directly addresses the user request.',
    'Do not provide generic filler. Tie every recommendation to the provided plan context.',
    'Avoid repeating the same idea in different words. Keep each bullet uniquely informative.',
    'Each deepAnalysis item should be one concise sentence and avoid paragraph-length text.',
    'Use deterministicLocalScenario values from context as authoritative when available.',
    'Do not replace deterministic values with guessed values.',
    `Include at least ${speedPreset.minAnalysisPoints} concrete items in answer.deepAnalysis.`,
    'Always include answer.numericalResults with real numeric values and formulas.',
    'Include answer.chartSpecs with practical visualizations using existing context datasets.',
    'Prefer chart dataSource values of comparisonSeries or allocationComparison over large inline arrays.',
    'Use currency amounts in USD with plain numbers (no commas).',
    'For any recommendation, include at least one quantifiable expected impact.',
    'If a value is uncertain, state the assumption and still provide a best-effort estimate.',
    'When editing, only include fields that should actually change.',
    '',
    'Output shape:',
    '{',
    '  "answer": {',
    '    "directAnswer": "string",',
    '    "executiveSummary": "string",',
    '    "deepAnalysis": ["string"],',
    '    "scenarioResults": ["string"],',
    '    "assumptions": ["string"],',
    '    "risks": ["string"],',
    '    "recommendations": ["string"],',
    '    "numericalResults": [',
    '      { "metric": "string", "value": 0, "unit": "USD|%|years", "formula": "string", "confidence": "high|medium|low", "note": "string" }',
    '    ],',
    '    "chartSpecs": [',
    '      { "title": "string", "description": "string", "chartType": "line|area|bar", "xKey": "year", "dataSource": "comparisonSeries|allocationComparison", "series": [ { "key": "scenarioNetWorth", "label": "Scenario Net Worth", "color": "#22c55e", "format": "currency|percent|number" } ] }',
    '    ],',
    '    "scenarioTable": [',
    '      { "scenario": "base|stress|recommended", "retirementYear": 0, "retirementNetWorth": 0, "successRatePct": 0, "depletionYear": 0, "notes": "string" }',
    '    ],',
    '    "nextActions": ["string"],',
    '    "followUps": ["string"],',
    '    "warnings": ["string"]',
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
    base.unshift('Focus on scenario math, downside resilience, sequencing risk, and practical tradeoffs.');
    base.unshift('Simulation mode: include scenarioResults with before/after outcomes and why they move.');
    base.unshift('Simulation mode: include at least 3 scenarioTable rows with explicit numeric values.');
  } else if (mode === 'edit') {
    base.unshift('Edit mode: explain each suggested change and include an actionable edits object.');
  } else {
    base.unshift('Question mode: answer first, then provide supporting analysis and clear recommendations.');
  }

  return base.join('\n');
};

const normalizeAssistantData = (data) => {
  if (!data || typeof data !== 'object') {
    return {
      directAnswer: '',
      executiveSummary: '',
      deepAnalysis: [],
      scenarioResults: [],
      assumptions: [],
      risks: [],
      recommendations: [],
      numericalResults: [],
      chartSpecs: [],
      scenarioTable: [],
      followUps: [],
      warnings: [],
      nextActions: [],
      edits: null,
    };
  }

  const answer = data.answer && typeof data.answer === 'object' ? data.answer : data;

  const directAnswer =
    truncate(cleanDisplayText(String(
      answer.directAnswer ||
      answer.summary ||
      data.directAnswer ||
      data.summary ||
      answer.message ||
      ''
    )), 520);

  const executiveSummary =
    truncate(cleanDisplayText(String(
      answer.executiveSummary ||
      answer.summary ||
      data.executiveSummary ||
      data.summary ||
      ''
    )), 760);

  const deepAnalysis = compactUniqueList(toList(
    answer.deepAnalysis ||
    answer.analysis ||
    answer.keyPoints ||
    answer.highlights ||
    data.deepAnalysis ||
    data.analysis ||
    data.highlights ||
    data.keyPoints
  ), 12);

  const scenarioResults = compactUniqueList(toList(
    answer.scenarioResults ||
    answer.scenarioReadout ||
    data.scenarioResults ||
    data.scenarioReadout
  ), 10);

  const assumptions = compactUniqueList(toList(
    answer.assumptions ||
    answer.assumptionsReviewed ||
    data.assumptions ||
    data.assumptionsReviewed
  ), 8);

  const risks = compactUniqueList(toList(
    answer.risks ||
    answer.riskRegister ||
    data.risks ||
    data.riskRegister
  ), 8);

  const recommendations = compactUniqueList(toList(
    answer.recommendations ||
    answer.actionPlan ||
    data.recommendations ||
    data.actionPlan
  ), 8);

  const numericalResults = normalizeNumericResults(
    answer.numericalResults ||
    answer.metrics ||
    answer.quantitativeResults ||
    data.numericalResults ||
    data.metrics ||
    data.quantitativeResults
  );

  const scenarioTable = normalizeScenarioRows(
    answer.scenarioTable ||
    answer.scenarios ||
    data.scenarioTable ||
    data.scenarios
  );

  const chartSpecs = normalizeChartSpecs(
    answer.chartSpecs ||
    answer.charts ||
    data.chartSpecs ||
    data.charts
  );

  const warnings = compactUniqueList(toList(answer.warnings || data.warnings), 6);
  const nextActions = compactUniqueList(toList(
    answer.nextActions ||
    answer.actions ||
    data.nextActions ||
    data.actions
  ), 10);

  const followUps = compactUniqueList(toList(
    answer.followUps ||
    answer.followUpQuestions ||
    data.followUps ||
    data.followUpQuestions
  ), 10);

  const edits = data.edits && typeof data.edits === 'object' ? data.edits : null;

  return {
    directAnswer,
    executiveSummary,
    deepAnalysis,
    scenarioResults,
    assumptions,
    risks,
    recommendations,
    numericalResults,
    chartSpecs,
    scenarioTable,
    warnings,
    nextActions,
    followUps,
    edits,
  };
};

const AIWorkbench = ({ compact = false }) => {
  const {
    applyAIPatch,
    briannaExpenses,
    evaluateScenario,
    financialData,
    formatCur,
    globals,
    monteCarloAggressive,
    monteCarloBaseline,
    monteCarloConservative,
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
  const [activeChartId, setActiveChartId] = useState('');
  const [chartWindowYears, setChartWindowYears] = useState(35);
  const [showBaselineSeries, setShowBaselineSeries] = useState(true);
  const [showScenarioSeries, setShowScenarioSeries] = useState(true);

  const activeModel = modelTier === 'gpu' ? MODEL_GPU : MODEL_CPU;
  const effectiveRouteMode = isElectron ? 'local' : 'auto';
  const speedPreset = SPEED_PRESETS[speed] || SPEED_PRESETS.balanced;

  const formatMetricValue = useCallback((row) => {
    if (!row) return '-';
    if (row.value === null || row.value === undefined || Number.isNaN(row.value)) {
      return row.note || '-';
    }

    const unit = String(row.unit || '').toLowerCase();
    const metric = String(row.metric || '').toLowerCase();

    if (unit.includes('%') || unit === 'pct' || unit === 'percent') {
      return `${row.value.toFixed(2)}%`;
    }

    if (
      unit.includes('usd') ||
      unit.includes('$') ||
      metric.includes('worth') ||
      metric.includes('balance') ||
      metric.includes('income') ||
      metric.includes('expense') ||
      metric.includes('contribution')
    ) {
      return formatCur(row.value);
    }

    if (unit.includes('year')) {
      return `${Math.round(row.value)} years`;
    }

    return Number.isInteger(row.value)
      ? row.value.toLocaleString('en-US')
      : row.value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }, [formatCur]);

  const formatChartValue = useCallback((value, formatHint = 'number') => {
    const num = toFiniteNumber(value);
    if (num === null) return '-';

    const hint = String(formatHint || 'number').toLowerCase();
    if (hint.includes('currency') || hint.includes('usd') || hint.includes('dollar')) {
      return formatCur(num);
    }
    if (hint.includes('percent') || hint.includes('pct')) {
      return `${num.toFixed(1)}%`;
    }

    return Number.isInteger(num)
      ? num.toLocaleString('en-US')
      : num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }, [formatCur]);

  const contextSnapshot = useMemo(() => {
    const firstYear = financialData[0] || null;
    const lastYear = financialData[financialData.length - 1] || null;
    const retirementYear = financialData.find((row) => row.retired) || null;
    const retiredRows = financialData.filter((row) => row.retired);
    const peak = financialData.reduce(
      (acc, row) => (row.netWorth > acc.netWorth ? row : acc),
      financialData[0] || { netWorth: 0, year: null }
    );
    const trough = financialData.reduce(
      (acc, row) => (row.netWorth < acc.netWorth ? row : acc),
      financialData[0] || { netWorth: 0, year: null }
    );

    const michaelMonthly = Object.values(michaelExpenses).reduce((sum, val) => sum + Number(val || 0), 0);
    const briannaMonthly = Object.values(briannaExpenses).reduce((sum, val) => sum + Number(val || 0), 0);

    const yearsSpan =
      firstYear && lastYear && Number.isFinite(firstYear.year) && Number.isFinite(lastYear.year)
        ? Math.max(1, lastYear.year - firstYear.year)
        : null;

    const cagr =
      yearsSpan && firstYear?.netWorth > 0 && lastYear?.netWorth > 0
        ? Math.pow(lastYear.netWorth / firstYear.netWorth, 1 / yearsSpan) - 1
        : null;

    const firstZeroNetWorthYear = financialData.find((row) => row.netWorth <= 0)?.year || null;
    const firstLiquidityGapYear = financialData.find((row) => row.liquidityGap > 0)?.year || null;

    const baseIncome = Number(firstYear?.combinedGross || 0);
    const baseExpenses = Number(firstYear?.combinedExp || 0);
    const baseSavings = baseIncome - baseExpenses;
    const baseSavingsRate = baseIncome > 0 ? baseSavings / baseIncome : null;

    const retirementCoverageRatio =
      retirementYear && retirementExpenses.yearlyAmount > 0
        ? (retirementYear.netWorth * globals.withdrawalRate) / retirementExpenses.yearlyAmount
        : null;

    const monteCarloSummary = {
      baselineSuccessRate: Number(monteCarloBaseline?.successRate ?? 0),
      conservativeSuccessRate: Number(monteCarloConservative?.successRate ?? 0),
      aggressiveSuccessRate: Number(monteCarloAggressive?.successRate ?? 0),
      baselineMedianFinalPortfolio: Number(monteCarloBaseline?.medianFinalPortfolio ?? 0),
      conservativeMedianFinalPortfolio: Number(monteCarloConservative?.medianFinalPortfolio ?? 0),
      aggressiveMedianFinalPortfolio: Number(monteCarloAggressive?.medianFinalPortfolio ?? 0),
    };

    return {
      runtime: isElectron ? 'electron-desktop' : 'web',
      llmMode: effectiveRouteMode,
      projectionSummary: {
        startYear: firstYear?.year,
        startNetWorth: firstYear?.netWorth,
        endYear: lastYear?.year,
        endNetWorth: lastYear?.netWorth,
        retirementYear: retirementYear?.year,
        retirementNetWorth: retirementYear?.netWorth,
        peakYear: peak?.year,
        peakNetWorth: peak?.netWorth,
        troughYear: trough?.year,
        troughNetWorth: trough?.netWorth,
      },
      numericDiagnostics: {
        yearsSpan,
        cagr,
        baseIncome,
        baseExpenses,
        baseSavings,
        baseSavingsRate,
        retirementCoverageRatio,
        firstZeroNetWorthYear,
        firstLiquidityGapYear,
      },
      monteCarloSummary,
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
      projectionPreview: financialData.slice(0, 18).map((row) => ({
        year: row.year,
        netWorth: Math.round(row.netWorth),
        expenses: Math.round(row.combinedExp),
        income: Math.round(row.combinedGross),
        liquidityGap: Math.round(row.liquidityGap || 0),
        retired: !!row.retired,
      })),
      retirementPhasePreview: retiredRows.slice(0, 18).map((row) => ({
        year: row.year,
        netWorth: Math.round(row.netWorth),
        total401k: Math.round(row.total401k),
        rothBal: Math.round(row.rothBal),
        brokerageBal: Math.round(row.brokerageBal),
        savingsBal: Math.round(row.savingsBal),
        liquidityGap: Math.round(row.liquidityGap || 0),
      })),
    };
  }, [
    briannaExpenses,
    financialData,
    globals,
    effectiveRouteMode,
    monteCarloAggressive,
    monteCarloBaseline,
    monteCarloConservative,
    michaelExpenses,
    retirementExpenses,
  ]);

  const enrichResponseWithDeterministic = useCallback((
    response,
    deterministicReport,
    snapshot = null,
    preferDeterministicLead = false
  ) => {
    if (!response || !deterministicReport) return response;

    const existingData = response.data && typeof response.data === 'object'
      ? response.data
      : {};

    if (!response.success) {
      return {
        ...response,
        data: {
          ...existingData,
          deterministicLocalScenario: deterministicReport,
        },
      };
    }
    const existingAnswer = existingData.answer && typeof existingData.answer === 'object'
      ? existingData.answer
      : {};

    const deterministicNumericalResults = buildDeterministicNumericalRows(deterministicReport);
    const deterministicScenarioRows = buildDeterministicScenarioRows(deterministicReport);
    const deterministicActions = buildDeterministicActions(deterministicReport, snapshot);
    const deterministicDeepAnalysis = buildDeterministicDeepAnalysis(deterministicReport, snapshot);
    const deterministicScenarioResults = buildDeterministicScenarioResults(deterministicReport);
    const deterministicWarnings = buildDeterministicWarnings(deterministicReport, snapshot);
    const deterministicChartSpecs = buildDeterministicChartSpecs(deterministicReport);
    const scenarioOverridePresent = hasScenarioOverrides(deterministicReport);
    const shouldPrioritizeDeterministic = preferDeterministicLead || scenarioOverridePresent;

    const baselineRetirementNetWorth = toFiniteNumber(deterministicReport?.baseline?.retirementNetWorth);
    const scenarioRetirementNetWorth = toFiniteNumber(deterministicReport?.scenario?.retirementNetWorth);
    const retirementDelta =
      baselineRetirementNetWorth !== null && scenarioRetirementNetWorth !== null
        ? scenarioRetirementNetWorth - baselineRetirementNetWorth
        : null;

    const deterministicDirectAnswer =
      baselineRetirementNetWorth !== null && scenarioRetirementNetWorth !== null
        ? `Local scenario math: retirement net worth is ${formatUsdInline(
          baselineRetirementNetWorth
        )} baseline vs ${formatUsdInline(scenarioRetirementNetWorth)} scenario (${formatSignedUsdInline(
          retirementDelta
        )}).`
        : 'Local deterministic scenario math was merged into this response.';

    const deterministicExecutiveSummary = [
      `Retirement year baseline ${formatYearInline(deterministicReport?.baseline?.retirementYear)} vs scenario ${formatYearInline(
        deterministicReport?.scenario?.retirementYear
      )}.`,
      `Coverage baseline ${formatRatioInline(deterministicReport?.baseline?.withdrawalCoverageRatio)} vs scenario ${formatRatioInline(
        deterministicReport?.scenario?.withdrawalCoverageRatio
      )}.`,
      toFiniteNumber(deterministicReport?.scenario?.firstLiquidityGapYear) !== null
        ? `Scenario liquidity gap appears by ${formatYearInline(deterministicReport.scenario.firstLiquidityGapYear)}.`
        : '',
    ].filter(Boolean).join(' ');

    const modelDirectAnswer = cleanDisplayText(existingAnswer.directAnswer || existingData.directAnswer || '');
    const modelExecutiveSummary = cleanDisplayText(existingAnswer.executiveSummary || existingData.executiveSummary || '');

    const modelActions = toList(existingAnswer.nextActions || existingData.nextActions);
    const modelDeepAnalysis = toList(existingAnswer.deepAnalysis || existingData.deepAnalysis);
    const modelScenarioResults = toList(existingAnswer.scenarioResults || existingData.scenarioResults);
    const modelWarnings = toList(existingAnswer.warnings || existingData.warnings);
    const modelChartSpecs = normalizeChartSpecs(existingAnswer.chartSpecs || existingData.chartSpecs);

    const mergedChartSpecsRaw = shouldPrioritizeDeterministic
      ? [...deterministicChartSpecs, ...modelChartSpecs]
      : [...modelChartSpecs, ...deterministicChartSpecs];

    const seenChartKeys = new Set();
    const mergedChartSpecs = mergedChartSpecsRaw
      .filter((spec) => {
        const key = String(spec.id || spec.title || '').toLowerCase();
        if (!key || seenChartKeys.has(key)) return false;
        seenChartKeys.add(key);
        return true;
      })
      .slice(0, 6);

    const mergedActions = shouldPrioritizeDeterministic
      ? compactUniqueList([...deterministicActions, ...modelActions], 12)
      : compactUniqueList([...modelActions, ...deterministicActions.slice(0, 2)], 12);

    const mergedDeepAnalysis = shouldPrioritizeDeterministic
      ? compactUniqueList([...deterministicDeepAnalysis, ...modelDeepAnalysis], 16)
      : compactUniqueList([...modelDeepAnalysis, ...deterministicDeepAnalysis], 16);

    const mergedScenarioResults = shouldPrioritizeDeterministic
      ? compactUniqueList([...deterministicScenarioResults, ...modelScenarioResults], 12)
      : compactUniqueList([...modelScenarioResults, ...deterministicScenarioResults], 12);

    const mergedWarnings = shouldPrioritizeDeterministic
      ? compactUniqueList([...deterministicWarnings, ...modelWarnings], 8)
      : compactUniqueList([...modelWarnings, ...deterministicWarnings], 8);

    const mergedAnswer = {
      ...existingAnswer,
      directAnswer: shouldPrioritizeDeterministic
        ? deterministicDirectAnswer
        : (modelDirectAnswer || deterministicDirectAnswer),
      executiveSummary: shouldPrioritizeDeterministic
        ? cleanDisplayText(modelExecutiveSummary || deterministicExecutiveSummary)
        : cleanDisplayText(modelExecutiveSummary || deterministicExecutiveSummary),
      deepAnalysis: mergedDeepAnalysis,
      scenarioResults: mergedScenarioResults,
      numericalResults: [
        ...deterministicNumericalResults,
        ...(Array.isArray(existingAnswer.numericalResults) ? existingAnswer.numericalResults : []),
      ],
      scenarioTable: deterministicScenarioRows.length > 0
        ? deterministicScenarioRows
        : (Array.isArray(existingAnswer.scenarioTable) ? existingAnswer.scenarioTable : []),
      chartSpecs: mergedChartSpecs,
      nextActions: mergedActions,
      warnings: mergedWarnings,
    };

    const mergedData = {
      ...existingData,
      answer: mergedAnswer,
      deterministicLocalScenario: deterministicReport,
    };

    return {
      ...response,
      data: mergedData,
      warning: [
        response.warning,
        'Deterministic local simulation values were merged into this response.',
      ].filter(Boolean).join(' '),
    };
  }, []);

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

  const runPrompt = async (overridePrompt = null, forcedMode = null) => {
    if (loading) return;

    const hasPromptOverride = typeof overridePrompt === 'string';
    const effectiveMode = forcedMode || mode;
    const effectivePrompt = String(hasPromptOverride ? overridePrompt : prompt).trim();

    if (!effectivePrompt) {
      setResult({
        success: false,
        error: 'Prompt cannot be empty.',
        model: activeModel,
        latencyMs: 0,
      });
      return;
    }

    if (hasPromptOverride) {
      setPrompt(effectivePrompt);
    }

    setApplyStatus('');
    setLoading(true);

    try {
      const parsedScenario = parseScenarioFromPrompt(effectivePrompt);
      const deterministicScenario = evaluateScenario(parsedScenario);

      const contextPayload = effectiveMode === 'ask'
        ? {
            runtime: contextSnapshot.runtime,
            llmMode: contextSnapshot.llmMode,
            projectionSummary: contextSnapshot.projectionSummary,
            numericDiagnostics: contextSnapshot.numericDiagnostics,
            monteCarloSummary: contextSnapshot.monteCarloSummary,
            keyAssumptions: contextSnapshot.keyAssumptions,
            projectionPreview: contextSnapshot.projectionPreview,
            deterministicLocalScenario: deterministicScenario,
          }
        : {
            ...contextSnapshot,
            deterministicLocalScenario: deterministicScenario,
          };

      const contextBlocks = [];
      contextBlocks.push('Current app context JSON:');
      contextBlocks.push(JSON.stringify(contextPayload));

      if (selectedText) {
        contextBlocks.push('Highlighted text context:');
        contextBlocks.push(selectedText);
      }

      if (result?.success && result?.data) {
        contextBlocks.push('Previous assistant response JSON:');
        contextBlocks.push(JSON.stringify(result.data));
      }

      const assembledPrompt = [
        buildInstructions(effectiveMode, speedPreset),
        '',
        ...contextBlocks,
        '',
        'User request:',
        effectivePrompt,
      ].join('\n');

      const baseGenerationOptions = modelTier === 'gpu'
        ? speedPreset.gpuOptions
        : speedPreset.cpuOptions;

      const generationOptions = {
        ...baseGenerationOptions,
        max_tokens: baseGenerationOptions.num_predict,
        reasoning_effort: speedPreset.reasoningEffort,
      };

      const response = await queryGemma(assembledPrompt, activeModel, {
        expectJson: true,
        timeoutMs: modelTier === 'gpu' ? speedPreset.timeoutMs + 45000 : speedPreset.timeoutMs,
        mode: isElectron ? 'local' : 'auto',
        tier: modelTier,
        images: screenshotDataUrl ? [screenshotDataUrl] : undefined,
        generationOptions,
      });

      setResult(
        enrichResponseWithDeterministic(
          response,
          deterministicScenario,
          contextSnapshot,
          effectiveMode === 'simulate'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const loadActionIntoPrompt = (actionText) => {
    const cleaned = toPromptString(actionText);
    if (cleaned.toLowerCase() === '[object object]') {
      setApplyStatus('That continuation payload is invalid. Try another item.');
      return;
    }
    if (!cleaned) {
      setApplyStatus('Continuation text was empty.');
      return;
    }
    setMode('ask');
    setPrompt(cleaned);
    setApplyStatus('Action loaded into prompt. Click Ask Copilot to run it.');
  };

  const runActionNow = async (actionText) => {
    const cleaned = toPromptString(actionText);
    if (cleaned.toLowerCase() === '[object object]') {
      setApplyStatus('That continuation payload is invalid. Try another item.');
      return;
    }
    if (!cleaned) {
      setApplyStatus('Continuation text was empty.');
      return;
    }

    setMode('ask');
    setPrompt(cleaned);
    setApplyStatus(`Running continuation: ${truncate(cleaned, 90)}`);
    await runPrompt(cleaned, 'ask');
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

  const deterministicScenario = result?.data?.deterministicLocalScenario || null;
  const deterministicScenarioDelta =
    toFiniteNumber(deterministicScenario?.scenario?.retirementNetWorth) !== null &&
    toFiniteNumber(deterministicScenario?.baseline?.retirementNetWorth) !== null
      ? Number(deterministicScenario.scenario.retirementNetWorth) - Number(deterministicScenario.baseline.retirementNetWorth)
      : null;

  const analysisCoverage = useMemo(() => {
    const startYear = toFiniteNumber(contextSnapshot.projectionSummary.startYear);
    const endYear = toFiniteNumber(contextSnapshot.projectionSummary.endYear);
    const horizonYears =
      startYear !== null && endYear !== null
        ? Math.max(0, endYear - startYear + 1)
        : null;

    return {
      horizonYears,
      projectionRows: financialData.length,
      assumptionCount: Object.keys(contextSnapshot.keyAssumptions || {}).length,
      hasSelectedText: !!selectedText,
      hasScreenshot: !!screenshotDataUrl,
    };
  }, [
    contextSnapshot.keyAssumptions,
    contextSnapshot.projectionSummary.endYear,
    contextSnapshot.projectionSummary.startYear,
    financialData.length,
    selectedText,
    screenshotDataUrl,
  ]);

  const renderableChartSpecs = useMemo(() => {
    const base = Array.isArray(normalizedResult.chartSpecs) ? normalizedResult.chartSpecs : [];
    const deterministic = buildDeterministicChartSpecs(deterministicScenario);
    const combined = [...base, ...deterministic];

    const seen = new Set();
    return combined
      .filter((spec) => {
        const key = String(spec?.id || spec?.title || '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [normalizedResult.chartSpecs, deterministicScenario]);

  useEffect(() => {
    if (!renderableChartSpecs.length) {
      setActiveChartId('');
      return;
    }

    if (!activeChartId || !renderableChartSpecs.some((spec) => spec.id === activeChartId)) {
      setActiveChartId(renderableChartSpecs[0].id);
    }
  }, [activeChartId, renderableChartSpecs]);

  const activeChartSpec = useMemo(
    () => renderableChartSpecs.find((spec) => spec.id === activeChartId) || renderableChartSpecs[0] || null,
    [renderableChartSpecs, activeChartId]
  );

  const activeChartDataRaw = useMemo(() => {
    if (!activeChartSpec) return [];
    return resolveChartData(activeChartSpec, deterministicScenario);
  }, [activeChartSpec, deterministicScenario]);

  const activeChartData = useMemo(() => {
    if (!activeChartSpec || !Array.isArray(activeChartDataRaw)) return [];

    if (activeChartSpec.xKey !== 'year') {
      return activeChartDataRaw;
    }

    const years = activeChartDataRaw
      .map((row) => toFiniteNumber(row?.year))
      .filter((year) => year !== null);

    if (!years.length) {
      return activeChartDataRaw;
    }

    const maxYear = Math.max(...years);
    const minYear = maxYear - chartWindowYears + 1;

    return activeChartDataRaw.filter((row) => {
      const year = toFiniteNumber(row?.year);
      return year === null || year >= minYear;
    });
  }, [activeChartSpec, activeChartDataRaw, chartWindowYears]);

  const activeChartSeries = useMemo(() => {
    if (!activeChartSpec) return [];

    return activeChartSpec.series.filter((series) => {
      const key = String(series.key || '').toLowerCase();
      if (!showBaselineSeries && key.includes('baseline')) return false;
      if (!showScenarioSeries && key.includes('scenario')) return false;
      return true;
    });
  }, [activeChartSpec, showBaselineSeries, showScenarioSeries]);

  const canAdjustChartWindow = useMemo(() => {
    if (!activeChartSpec || activeChartSpec.xKey !== 'year') return false;
    return activeChartDataRaw.some((row) => toFiniteNumber(row?.year) !== null);
  }, [activeChartSpec, activeChartDataRaw]);

  const tableComparisonRows = useMemo(() => {
    const rows = Array.isArray(deterministicScenario?.comparisonSeries)
      ? deterministicScenario.comparisonSeries
      : [];

    if (!rows.length) return [];

    return rows.slice(-12).map((row) => ({
      year: row.year,
      baselineNetWorth: toFiniteNumber(row.baselineNetWorth),
      scenarioNetWorth: toFiniteNumber(row.scenarioNetWorth),
      baselineExpenses: toFiniteNumber(row.baselineExpenses),
      scenarioExpenses: toFiniteNumber(row.scenarioExpenses),
      baselineLiquidityGap: toFiniteNumber(row.baselineLiquidityGap),
      scenarioLiquidityGap: toFiniteNumber(row.scenarioLiquidityGap),
    }));
  }, [deterministicScenario]);

  const activeChartElement = useMemo(() => {
    if (!activeChartSpec || !activeChartData.length || !activeChartSeries.length) {
      return null;
    }

    const defaultFormat = activeChartSeries[0]?.format || 'number';

    const tooltipRenderer = ({ active, payload, label }) => {
      if (!active || !payload || !payload.length) return null;

      return (
        <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-2.5 shadow-xl text-[11px]">
          <p className="text-slate-300 font-semibold mb-1">{activeChartSpec.xKey}: {label}</p>
          <div className="space-y-1">
            {payload.map((entry) => (
              <div key={`${entry.dataKey}-${entry.value}`} className="flex items-center justify-between gap-3">
                <span className="font-medium" style={{ color: entry.color || '#cbd5e1' }}>
                  {entry.name}
                </span>
                <span className="text-slate-100 font-semibold">
                  {formatChartValue(entry.value, entry?.payload?.[`${entry.dataKey}Format`] || defaultFormat)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    const commonProps = {
      data: activeChartData,
      margin: { top: 10, right: 16, left: 0, bottom: 8 },
    };

    const axisX = (
      <XAxis
        dataKey={activeChartSpec.xKey}
        stroke="#475569"
        tick={{ fontSize: 11, fill: '#94a3b8' }}
        axisLine={false}
        tickLine={false}
      />
    );

    const axisY = (
      <YAxis
        tickFormatter={(value) => formatChartValue(value, defaultFormat)}
        stroke="#475569"
        tick={{ fontSize: 11, fill: '#94a3b8' }}
        axisLine={false}
        tickLine={false}
        width={68}
      />
    );

    if (activeChartSpec.chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            {axisX}
            {axisY}
            <RechartTooltip content={tooltipRenderer} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {activeChartSeries.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                fill={series.color || CHART_COLORS[index % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (activeChartSpec.chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            {axisX}
            {axisY}
            <RechartTooltip content={tooltipRenderer} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {activeChartSeries.map((series, index) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color || CHART_COLORS[index % CHART_COLORS.length]}
                fill={series.color || CHART_COLORS[index % CHART_COLORS.length]}
                fillOpacity={0.18}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
          {axisX}
          {axisY}
          <RechartTooltip content={tooltipRenderer} />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          {activeChartSeries.map((series, index) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color || CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }, [activeChartSpec, activeChartData, activeChartSeries, formatChartValue]);

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
              Route mode: <span className="text-slate-200 font-semibold">{effectiveRouteMode}</span>
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
            onClick={() => runPrompt()}
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
              Ask a question to get a full analysis report with scenario outcomes, risks, recommendations, and optional app edits.
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
                <span className="text-slate-300">
                  Route:{' '}
                  <span className="font-semibold text-slate-100">{result.endpoint || 'n/a'}</span>
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

              {!result.success && (
                <div className="rounded-lg border border-cyan-600/40 bg-cyan-500/10 px-3 py-2 text-cyan-100">
                  <p className="text-[11px] uppercase tracking-wide text-cyan-300 mb-1">Local Numeric Snapshot</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                      <p className="text-slate-500">Base Success</p>
                      <p className="text-slate-200 font-semibold">{contextSnapshot.monteCarloSummary.baselineSuccessRate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                      <p className="text-slate-500">Conservative</p>
                      <p className="text-slate-200 font-semibold">{contextSnapshot.monteCarloSummary.conservativeSuccessRate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                      <p className="text-slate-500">Aggressive</p>
                      <p className="text-slate-200 font-semibold">{contextSnapshot.monteCarloSummary.aggressiveSuccessRate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                      <p className="text-slate-500">Start Net Worth</p>
                      <p className="text-slate-200 font-semibold">{formatCur(contextSnapshot.projectionSummary.startNetWorth || 0)}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                      <p className="text-slate-500">Retire Net Worth</p>
                      <p className="text-slate-200 font-semibold">{formatCur(contextSnapshot.projectionSummary.retirementNetWorth || 0)}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                      <p className="text-slate-500">Scenario Retire Net Worth</p>
                      <p className="text-slate-200 font-semibold">
                        {toFiniteNumber(deterministicScenario?.scenario?.retirementNetWorth) !== null
                          ? formatCur(deterministicScenario.scenario.retirementNetWorth)
                          : '-'}
                      </p>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                      <p className="text-slate-500">Scenario Delta</p>
                      <p className="text-slate-200 font-semibold">
                        {deterministicScenarioDelta !== null ? formatCur(deterministicScenarioDelta) : '-'}
                      </p>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                      <p className="text-slate-500">Coverage Ratio</p>
                      <p className="text-slate-200 font-semibold">
                        {toFiniteNumber(deterministicScenario?.scenario?.withdrawalCoverageRatio) !== null
                          ? `${Number(deterministicScenario.scenario.withdrawalCoverageRatio).toFixed(2)}x`
                          : contextSnapshot.numericDiagnostics.retirementCoverageRatio !== null
                            ? `${contextSnapshot.numericDiagnostics.retirementCoverageRatio.toFixed(2)}x`
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {result.success && (
                <>
                  <div className="rounded-lg border border-slate-600/40 bg-slate-900/70 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Analysis Coverage</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-slate-950/60 border border-slate-700 rounded-md px-2 py-1.5">
                        <p className="text-slate-500">Projection Horizon</p>
                        <p className="text-slate-200 font-semibold">
                          {analysisCoverage.horizonYears !== null ? `${analysisCoverage.horizonYears} years` : '-'}
                        </p>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-700 rounded-md px-2 py-1.5">
                        <p className="text-slate-500">Rows Analyzed</p>
                        <p className="text-slate-200 font-semibold">{analysisCoverage.projectionRows}</p>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-700 rounded-md px-2 py-1.5">
                        <p className="text-slate-500">Assumptions Used</p>
                        <p className="text-slate-200 font-semibold">{analysisCoverage.assumptionCount}</p>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-700 rounded-md px-2 py-1.5">
                        <p className="text-slate-500">Extra Context</p>
                        <p className="text-slate-200 font-semibold">
                          {analysisCoverage.hasSelectedText || analysisCoverage.hasScreenshot ? 'Included' : 'None'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {renderableChartSpecs.length > 0 && (
                    <div className="rounded-xl border border-slate-600/50 bg-slate-900/80 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-300 flex items-center gap-1.5">
                          <BarChart3 size={12} className="text-emerald-300" />
                          Interactive Simulation Lab
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {activeChartSpec ? `${activeChartSpec.chartType.toUpperCase()} chart` : 'No chart selected'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {renderableChartSpecs.map((spec) => (
                          <button
                            key={spec.id}
                            type="button"
                            onClick={() => setActiveChartId(spec.id)}
                            className={`px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition-colors ${
                              activeChartSpec?.id === spec.id
                                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                                : 'bg-slate-950/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {truncate(spec.title, 36)}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setShowBaselineSeries((prev) => !prev)}
                          className={`px-2.5 py-2 rounded-md border text-[11px] font-semibold ${
                            showBaselineSeries
                              ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                              : 'bg-slate-950/60 border-slate-700 text-slate-400'
                          }`}
                        >
                          {showBaselineSeries ? 'Hide Baseline Series' : 'Show Baseline Series'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowScenarioSeries((prev) => !prev)}
                          className={`px-2.5 py-2 rounded-md border text-[11px] font-semibold ${
                            showScenarioSeries
                              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                              : 'bg-slate-950/60 border-slate-700 text-slate-400'
                          }`}
                        >
                          {showScenarioSeries ? 'Hide Scenario Series' : 'Show Scenario Series'}
                        </button>

                        {canAdjustChartWindow ? (
                          <label className="rounded-md border border-slate-700 bg-slate-950/60 px-2.5 py-2 text-[11px] text-slate-300 flex flex-col gap-1">
                            <span className="text-slate-400">Window: {chartWindowYears} years</span>
                            <input
                              type="range"
                              min={10}
                              max={90}
                              value={chartWindowYears}
                              onChange={(e) => setChartWindowYears(Math.max(10, Math.min(90, Number(e.target.value) || 35)))}
                              className="accent-emerald-400"
                            />
                          </label>
                        ) : (
                          <div className="rounded-md border border-slate-700 bg-slate-950/60 px-2.5 py-2 text-[11px] text-slate-500">
                            Window control available for yearly charts.
                          </div>
                        )}
                      </div>

                      <div className="h-[300px] w-full rounded-lg border border-slate-700 bg-slate-950/40 p-2">
                        {activeChartElement || (
                          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                            No chart data available for this selection.
                          </div>
                        )}
                      </div>

                      {activeChartSpec?.description && (
                        <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                          {activeChartSpec.description}
                        </p>
                      )}
                    </div>
                  )}

                  {tableComparisonRows.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-emerald-300 mb-1">Projection Comparison Table (Recent Years)</p>
                      <div className="overflow-x-auto rounded-md border border-emerald-500/30">
                        <table className="min-w-full text-xs">
                          <thead className="bg-emerald-500/10 text-emerald-200">
                            <tr>
                              <th className="text-left px-2 py-1.5">Year</th>
                              <th className="text-left px-2 py-1.5">Base Net Worth</th>
                              <th className="text-left px-2 py-1.5">Scenario Net Worth</th>
                              <th className="text-left px-2 py-1.5">Base Liquidity Gap</th>
                              <th className="text-left px-2 py-1.5">Scenario Liquidity Gap</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableComparisonRows.map((row) => (
                              <tr key={`cmp-${row.year}`} className="border-t border-emerald-500/20 bg-slate-900/70 text-emerald-50">
                                <td className="px-2 py-1.5 align-top">{row.year}</td>
                                <td className="px-2 py-1.5 align-top">{row.baselineNetWorth !== null ? formatCur(row.baselineNetWorth) : '-'}</td>
                                <td className="px-2 py-1.5 align-top font-semibold">{row.scenarioNetWorth !== null ? formatCur(row.scenarioNetWorth) : '-'}</td>
                                <td className="px-2 py-1.5 align-top">{row.baselineLiquidityGap !== null ? formatCur(row.baselineLiquidityGap) : '-'}</td>
                                <td className="px-2 py-1.5 align-top">{row.scenarioLiquidityGap !== null ? formatCur(row.scenarioLiquidityGap) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {normalizedResult.directAnswer ? (
                    <div className="rounded-lg border border-sky-600/40 bg-sky-500/10 px-3 py-2 text-sky-100">
                      <p className="text-[11px] uppercase tracking-wide text-sky-300 mb-1">Direct Answer</p>
                      <p className="text-sm text-white leading-relaxed">{cleanDisplayText(normalizedResult.directAnswer)}</p>
                    </div>
                  ) : null}

                  {normalizedResult.executiveSummary ? (
                    <div className="rounded-lg border border-indigo-600/40 bg-indigo-500/10 px-3 py-2 text-indigo-100">
                      <p className="text-[11px] uppercase tracking-wide text-indigo-300 mb-1">Executive Summary</p>
                      <p className="text-sm text-white leading-relaxed">{cleanDisplayText(normalizedResult.executiveSummary)}</p>
                    </div>
                  ) : null}

                  {normalizedResult.deepAnalysis.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Deep Analysis</p>
                      <ul className="space-y-2">
                        {normalizedResult.deepAnalysis.map((point, index) => (
                          <li
                            key={`${index}-${point}`}
                            className="text-slate-100 bg-slate-900/80 border border-slate-700 rounded-md px-2.5 py-2"
                          >
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-semibold">
                                {index + 1}
                              </span>
                              <span className="leading-relaxed">{point}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizedResult.scenarioResults.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-cyan-300 mb-1">Scenario Results</p>
                      <ul className="space-y-2">
                        {normalizedResult.scenarioResults.map((row, index) => (
                          <li
                            key={`${index}-${row}`}
                            className="text-cyan-100 bg-cyan-500/10 border border-cyan-500/30 rounded-md px-2.5 py-2"
                          >
                            <span className="text-cyan-300 font-semibold mr-2">#{index + 1}</span>
                            {row}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizedResult.assumptions.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-300 mb-1">Assumptions Reviewed</p>
                      <ul className="space-y-1.5">
                        {normalizedResult.assumptions.map((item, index) => (
                          <li key={`assumption-${index}`} className="text-slate-100 bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizedResult.risks.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-rose-300 mb-1">Risks</p>
                      <ul className="space-y-1.5">
                        {normalizedResult.risks.map((risk, index) => (
                          <li key={`risk-${index}`} className="text-rose-100 bg-rose-500/10 border border-rose-500/30 rounded-md px-2 py-1.5">
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizedResult.recommendations.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-violet-300 mb-1">Recommendations</p>
                      <ul className="space-y-1.5">
                        {normalizedResult.recommendations.map((rec, index) => (
                          <li key={`recommendation-${index}`} className="text-violet-100 bg-violet-500/10 border border-violet-500/30 rounded-md px-2 py-1.5">
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizedResult.numericalResults.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-cyan-300 mb-1">Numerical Results</p>
                      <div className="overflow-x-auto rounded-md border border-cyan-500/30">
                        <table className="min-w-full text-xs">
                          <thead className="bg-cyan-500/10 text-cyan-200">
                            <tr>
                              <th className="text-left px-2 py-1.5">Metric</th>
                              <th className="text-left px-2 py-1.5">Value</th>
                              <th className="text-left px-2 py-1.5">Formula</th>
                            </tr>
                          </thead>
                          <tbody>
                            {normalizedResult.numericalResults.map((row) => (
                              <tr key={row.id} className="border-t border-cyan-500/20 bg-slate-900/70 text-cyan-50">
                                <td className="px-2 py-1.5 align-top">{row.metric}</td>
                                <td className="px-2 py-1.5 align-top font-semibold">{formatMetricValue(row)}</td>
                                <td className="px-2 py-1.5 align-top text-cyan-100/80">
                                  {row.formula || row.note || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {normalizedResult.scenarioTable.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-indigo-300 mb-1">Scenario Table</p>
                      <div className="overflow-x-auto rounded-md border border-indigo-500/30">
                        <table className="min-w-full text-xs">
                          <thead className="bg-indigo-500/10 text-indigo-200">
                            <tr>
                              <th className="text-left px-2 py-1.5">Scenario</th>
                              <th className="text-left px-2 py-1.5">Retire Year</th>
                              <th className="text-left px-2 py-1.5">Retire Net Worth</th>
                              <th className="text-left px-2 py-1.5">Success</th>
                              <th className="text-left px-2 py-1.5">Depletion Year</th>
                            </tr>
                          </thead>
                          <tbody>
                            {normalizedResult.scenarioTable.map((row) => (
                              <tr key={row.id} className="border-t border-indigo-500/20 bg-slate-900/70 text-indigo-50">
                                <td className="px-2 py-1.5 align-top">{row.scenario}</td>
                                <td className="px-2 py-1.5 align-top">{row.retirementYear ?? '-'}</td>
                                <td className="px-2 py-1.5 align-top">
                                  {row.retirementNetWorth !== null ? formatCur(row.retirementNetWorth) : '-'}
                                </td>
                                <td className="px-2 py-1.5 align-top">
                                  {row.successRatePct !== null ? `${row.successRatePct.toFixed(1)}%` : '-'}
                                </td>
                                <td className="px-2 py-1.5 align-top">{row.depletionYear ?? '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {normalizedResult.warnings.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-amber-300 mb-1">Warnings</p>
                      <ul className="space-y-1.5">
                        {normalizedResult.warnings.map((warning, index) => (
                          <li key={`warning-${index}`} className="text-amber-100 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizedResult.nextActions.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-emerald-300 mb-1">Next Actions</p>
                      <ul className="space-y-2">
                        {normalizedResult.nextActions.map((action, index) => (
                          <li key={`next-action-${index}`} className="text-emerald-100 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2 py-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="leading-relaxed">{action}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => loadActionIntoPrompt(action)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
                                >
                                  Use
                                </button>
                                <button
                                  type="button"
                                  onClick={() => runActionNow(action)}
                                  disabled={loading}
                                  className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[11px]"
                                >
                                  Run
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizedResult.followUps.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-blue-300 mb-1">Follow-Ups</p>
                      <ul className="space-y-2">
                        {normalizedResult.followUps.map((item, index) => (
                          <li key={`follow-up-${index}`} className="text-blue-100 bg-blue-500/10 border border-blue-500/30 rounded-md px-2 py-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="leading-relaxed">{item}</span>
                              <button
                                type="button"
                                onClick={() => runActionNow(item)}
                                disabled={loading}
                                className="px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[11px] shrink-0"
                              >
                                Run
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-300 mb-1">Quick Continuations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_FOLLOW_UPS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => runActionNow(suggestion)}
                          disabled={loading}
                          className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-slate-200 text-[11px] border border-slate-700"
                        >
                          {truncate(suggestion, 52)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {editSummaryRows.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-violet-300 mb-1">Proposed Edits</p>
                      <ul className="space-y-1.5">
                        {editSummaryRows.map((row, index) => (
                          <li key={`edit-summary-${index}`} className="text-violet-100 bg-violet-500/10 border border-violet-500/30 rounded-md px-2 py-1.5">
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
