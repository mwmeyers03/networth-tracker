/**
 * chartHelpers.ts
 * ---------------
 * Pure functions that convert projection data + simulation results into
 * Chart.js dataset configurations for the Dashboard envelope chart.
 *
 * All functions return plain objects — no Chart.js import required here,
 * keeping this file testable without a DOM.
 */

import type { SimulationResult } from '../types/simulation';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectionRow {
  year: number;
  netWorth: number;
}

export interface EnvelopeChartData {
  labels: string[];
  datasets: ChartDatasetSpec[];
}

/** Minimal spec that mirrors Chart.js DatasetConfiguration. */
export interface ChartDatasetSpec {
  label: string;
  data: (number | null)[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  borderDash?: number[];
  fill: boolean | string;
  pointRadius: number;
  tension: number;
  spanGaps: boolean;
  order: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a simulation percentile array onto the full calendar-year x-axis. */
const alignSimToCalendar = (
  years: number[],
  retirementYear: number,
  percentileArr: number[],
): (number | null)[] =>
  years.map((yr) => {
    if (yr < retirementYear) return null;
    const idx = yr - retirementYear;
    return idx < percentileArr.length ? percentileArr[idx] : null;
  });

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build a complete Chart.js-compatible dataset configuration for the
 * net-worth envelope chart.
 *
 * Dataset order (matters for Chart.js fill between datasets):
 *   0  – P90 upper bound      (fill: false)
 *   1  – P10 lower bound      (fill: '-1' → fills band to P90)
 *   2  – P75 upper quartile   (fill: false)
 *   3  – P25 lower quartile   (fill: '-1' → fills band to P75)
 *   4  – P50 median           (solid line, no fill)
 *   5  – Expected (deterministic)
 *   6  – Conservative (deterministic, dashed)
 *   7  – Aggressive (deterministic, dashed)
 */
export function buildEnvelopeChartData(
  expectedData: ProjectionRow[],
  conservativeData: ProjectionRow[],
  aggressiveData: ProjectionRow[],
  simResult: SimulationResult | null,
  retirementYear?: number,
): EnvelopeChartData {
  const labels = expectedData.map((d) => String(d.year));
  const years = expectedData.map((d) => d.year);

  // Anchor the simulation percentile bands to the actual retirement year.
  // simResult.p50[0] = portfolio value at retirement onset.
  // If no retirementYear is provided we fall back to the first data year
  // (old behaviour, which incorrectly anchors bands to the present).
  const simAnchorYear = retirementYear ?? (years[0] ?? 2024);

  // Build simulation series (null before retirement, data after)
  const p90 = simResult
    ? alignSimToCalendar(years, simAnchorYear, simResult.p90)
    : years.map(() => null);
  const p75 = simResult
    ? alignSimToCalendar(years, simAnchorYear, simResult.p75)
    : years.map(() => null);
  const p50 = simResult
    ? alignSimToCalendar(years, simAnchorYear, simResult.p50)
    : years.map(() => null);
  const p25 = simResult
    ? alignSimToCalendar(years, simAnchorYear, simResult.p25)
    : years.map(() => null);
  const p10 = simResult
    ? alignSimToCalendar(years, simAnchorYear, simResult.p10)
    : years.map(() => null);

  const datasets: ChartDatasetSpec[] = [
    // ── Simulation band: P90 (outer, upper) ──────────────────────────────
    {
      label: 'P90 (Best 10%)',
      data: p90,
      borderColor: 'transparent',
      backgroundColor: 'rgba(139,92,246,0.0)',
      borderWidth: 0,
      fill: false,
      pointRadius: 0,
      tension: 0.3,
      spanGaps: true,
      order: 10,
    },
    // ── Simulation band: P10 fills to P90 ────────────────────────────────
    {
      label: 'P10 (Worst 10%)',
      data: p10,
      borderColor: 'transparent',
      backgroundColor: 'rgba(139,92,246,0.15)',
      borderWidth: 0,
      fill: '-1',
      pointRadius: 0,
      tension: 0.3,
      spanGaps: true,
      order: 10,
    },
    // ── Simulation band: P75 (inner, upper) ──────────────────────────────
    {
      label: 'P75',
      data: p75,
      borderColor: 'transparent',
      backgroundColor: 'rgba(139,92,246,0.0)',
      borderWidth: 0,
      fill: false,
      pointRadius: 0,
      tension: 0.3,
      spanGaps: true,
      order: 9,
    },
    // ── Simulation band: P25 fills to P75 ────────────────────────────────
    {
      label: 'P25',
      data: p25,
      borderColor: 'transparent',
      backgroundColor: 'rgba(139,92,246,0.18)',
      borderWidth: 0,
      fill: '-1',
      pointRadius: 0,
      tension: 0.3,
      spanGaps: true,
      order: 9,
    },
    // ── Median line ───────────────────────────────────────────────────────
    {
      label: 'Median (Historical)',
      data: p50,
      borderColor: 'rgba(167,139,250,0.95)',
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      fill: false,
      pointRadius: 0,
      tension: 0.3,
      spanGaps: true,
      order: 2,
    },
    // ── Deterministic: Expected ───────────────────────────────────────────
    {
      label: 'Expected',
      data: expectedData.map((d) => d.netWorth),
      borderColor: 'rgba(59,130,246,0.85)',
      backgroundColor: 'transparent',
      borderWidth: 2,
      fill: false,
      pointRadius: 0,
      tension: 0.3,
      spanGaps: true,
      order: 1,
    },
    // ── Deterministic: Conservative (dashed) ─────────────────────────────
    {
      label: 'Conservative',
      data: conservativeData.map((d) => d.netWorth),
      borderColor: 'rgba(251,146,60,0.55)',
      backgroundColor: 'transparent',
      borderWidth: 1.2,
      borderDash: [5, 4],
      fill: false,
      pointRadius: 0,
      tension: 0.3,
      spanGaps: true,
      order: 1,
    },
    // ── Deterministic: Aggressive (dashed) ───────────────────────────────
    {
      label: 'Aggressive',
      data: aggressiveData.map((d) => d.netWorth),
      borderColor: 'rgba(16,185,129,0.55)',
      backgroundColor: 'transparent',
      borderWidth: 1.2,
      borderDash: [5, 4],
      fill: false,
      pointRadius: 0,
      tension: 0.3,
      spanGaps: true,
      order: 1,
    },
  ];

  return { labels, datasets };
}

/**
 * Build the Chart.js options object for the envelope chart.
 * Uses the dark colour palette of the existing UI.
 */
export function buildChartOptions(maxNetWorth: number) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: false, // custom legend is rendered in HTML
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.95)',
        titleColor: '#60a5fa',
        bodyColor: '#e2e8f0',
        borderColor: '#475569',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx: any) => {
            const value: number = ctx.raw ?? 0;
            if (value === null) return '';
            return ` ${ctx.dataset.label}: ${new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          maxTicksLimit: 12,
          maxRotation: 0,
        },
        grid: { color: 'rgba(51,65,85,0.4)' },
      },
      y: {
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          callback: (value: any) => {
            if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
            if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
            return `$${value}`;
          },
        },
        grid: { color: 'rgba(51,65,85,0.4)' },
        suggestedMax: maxNetWorth * 1.05,
        min: 0,
      },
    },
  };
}
