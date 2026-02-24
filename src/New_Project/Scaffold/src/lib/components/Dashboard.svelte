<script>
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';

  import {
    financialData,
    conservativeData,
    aggressiveData,
    formatCur,
  } from '$lib/stores/fireStore.js';
  import {
    simulationResult,
    simulationRunning,
    successRateLabel,
    successRateColor,
  } from '$lib/stores/simulationStore';
  import { buildEnvelopeChartData, buildChartOptions } from '$lib/utils/chartHelpers';

  export let retirementYear = null;

  let data = [];
  let conservativeProjection = [];
  let aggressiveProjection = [];

  $: data                   = $financialData       || [];
  $: conservativeProjection = $conservativeData    || [];
  $: aggressiveProjection   = $aggressiveData      || [];

  // ── Chart canvas ref ───────────────────────────────────────────────────
  let canvasEl;
  let chart = null;

  // ── Retirement markers ─────────────────────────────────────────────────
  $: michaelRetirementYear = data.find(d => d?.michaelRetired)?.year ?? null;
  $: briannaRetirementYear = data.find(d => d?.briannaRetired)?.year ?? null;

  // ── Summary stats ──────────────────────────────────────────────────────
  $: maxNetWorth = data.length ? Math.max(...data.map(d => d?.netWorth || 0)) : 0;
  $: peakYear    = data.find(d => d?.netWorth === maxNetWorth)?.year ?? '—';

  // ── Legend visibility toggles ──────────────────────────────────────────
  let showP10_90       = true;
  let showP25_75       = true;
  let showMedian       = true;
  let showExpected     = true;
  let showConservative = false;
  let showAggressive   = false;

  onMount(() => {
    if (!canvasEl) return;
    chart = new Chart(canvasEl, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: buildChartOptions(1_000_000),
    });
    updateChart();
  });

  onDestroy(() => {
    chart?.destroy();
    chart = null;
  });

  $: if (chart && data.length)      updateChart();
  $: if (chart && $simulationResult) updateChart();

  function updateChart() {
    if (!chart) return;

    const chartData = buildEnvelopeChartData(
      data.map(d => ({ year: d.year, netWorth: d.netWorth })),
      conservativeProjection.map(d => ({ year: d.year, netWorth: d.netWorth })),
      aggressiveProjection.map(d => ({ year: d.year, netWorth: d.netWorth })),
      $simulationResult,
      michaelRetirementYear ?? briannaRetirementYear ?? undefined,
    );

    const visMap = {
      'P90 (Best 10%)':      showP10_90,
      'P10 (Worst 10%)':     showP10_90,
      'P75':                 showP25_75,
      'P25':                 showP25_75,
      'Median (Historical)': showMedian,
      'Expected':            showExpected,
      'Conservative':        showConservative,
      'Aggressive':          showAggressive,
    };

    chart.data.labels   = chartData.labels;
    chart.data.datasets = chartData.datasets.map(ds => ({
      ...ds,
      hidden: visMap[ds.label] === false,
    }));
    chart.options = buildChartOptions(maxNetWorth || 1_000_000);
    chart.update('none');
  }

  function toggle(name) {
    if (name === 'p1090')    showP10_90       = !showP10_90;
    if (name === 'p2575')    showP25_75       = !showP25_75;
    if (name === 'median')   showMedian       = !showMedian;
    if (name === 'expected') showExpected     = !showExpected;
    if (name === 'cons')     showConservative = !showConservative;
    if (name === 'agg')      showAggressive   = !showAggressive;
    updateChart();
  }

  $: successColor = $successRateColor;
</script>

<article class="dashboard">

  <!-- ── Header ───────────────────────────────────────────────────────── -->
  <div class="dash-header">
    <h2>Net Worth Projection</h2>
    <div class="header-right">
      {#if $simulationRunning}
        <span class="pill running">Running simulation…</span>
      {:else if $simulationResult}
        <span class="pill success"
              class:green={successColor === 'green'}
              class:yellow={successColor === 'yellow'}
              class:red={successColor === 'red'}>
          {$successRateLabel} historical success
        </span>
      {/if}
    </div>
  </div>

  <!-- ── Chart ────────────────────────────────────────────────────────── -->
  <div class="chart-wrap">
    <canvas bind:this={canvasEl}></canvas>
  </div>

  <!-- ── Legend toggles ───────────────────────────────────────────────── -->
  <div class="legend">
    <button class="legend-btn" class:active={showP10_90}       on:click={() => toggle('p1090')}>
      <span class="swatch band-wide"></span>P10–P90
    </button>
    <button class="legend-btn" class:active={showP25_75}       on:click={() => toggle('p2575')}>
      <span class="swatch band-narrow"></span>P25–P75
    </button>
    <button class="legend-btn" class:active={showMedian}       on:click={() => toggle('median')}>
      <span class="swatch swatch-median"></span>Median
    </button>
    <button class="legend-btn" class:active={showExpected}     on:click={() => toggle('expected')}>
      <span class="swatch swatch-expected"></span>Expected
    </button>
    <button class="legend-btn" class:active={showConservative} on:click={() => toggle('cons')}>
      <span class="swatch swatch-conservative"></span>Conservative
    </button>
    <button class="legend-btn" class:active={showAggressive}   on:click={() => toggle('agg')}>
      <span class="swatch swatch-aggressive"></span>Aggressive
    </button>

    {#if michaelRetirementYear}
      <span class="retire-marker michael">M retires {michaelRetirementYear}</span>
    {/if}
    {#if briannaRetirementYear && briannaRetirementYear !== michaelRetirementYear}
      <span class="retire-marker brianna">B retires {briannaRetirementYear}</span>
    {/if}
  </div>

  <!-- ── Summary stats ────────────────────────────────────────────────── -->
  {#if data.length}
    <div class="summary">
      <div class="stat">
        <span class="stat-label">Starting Net Worth</span>
        <span class="stat-value">{formatCur(data[0]?.netWorth)}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Peak Net Worth</span>
        <span class="stat-value">{formatCur(maxNetWorth)}</span>
        <span class="stat-sub">{peakYear}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Final Year Net Worth</span>
        <span class="stat-value">{formatCur(data[data.length - 1]?.netWorth)}</span>
      </div>
      {#if $simulationResult}
        <div class="stat">
          <span class="stat-label">Historical Cohorts</span>
          <span class="stat-value">{$simulationResult.totalCohorts}</span>
        </div>
      {/if}
    </div>
  {/if}

</article>

<style>
  .dashboard { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.75rem; }

  .dash-header { display: flex; justify-content: space-between; align-items: center; }

  h2 { margin: 0; color: #f1f5f9; font-size: 1.05rem; font-weight: 700; }

  .header-right { display: flex; align-items: center; gap: 0.5rem; }

  .pill {
    font-size: 0.68rem; font-weight: 700; padding: 0.3rem 0.7rem;
    border-radius: 999px; border: 1px solid #334155;
    color: #94a3b8; background: rgba(30,41,59,0.6); letter-spacing: 0.03em;
  }
  .pill.running { color: #f59e0b; border-color: #713f12; background: rgba(113,63,18,0.2); }
  .pill.success.green  { color: #4ade80; border-color: #166534; background: rgba(22,101,52,0.2);  }
  .pill.success.yellow { color: #fbbf24; border-color: #713f12; background: rgba(113,63,18,0.2); }
  .pill.success.red    { color: #f87171; border-color: #7f1d1d; background: rgba(127,29,29,0.2); }

  .chart-wrap {
    width: 100%; height: 320px;
    background: rgba(15,23,42,0.6); border: 1px solid #334155;
    border-radius: 0.5rem; padding: 0.6rem; box-sizing: border-box;
  }

  canvas { width: 100% !important; height: 100% !important; }

  .legend { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }

  .legend-btn {
    display: flex; align-items: center; gap: 0.35rem;
    padding: 0.3rem 0.55rem; border-radius: 0.35rem;
    border: 1px solid #334155; background: transparent;
    color: #64748b; font-size: 0.68rem; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
  }
  .legend-btn.active { color: #e2e8f0; border-color: #475569; background: rgba(51,65,85,0.4); }
  .legend-btn:hover  { border-color: #475569; color: #cbd5e1; }

  .swatch { width: 20px; height: 8px; border-radius: 3px; }
  .swatch.band-wide         { background: rgba(139,92,246,0.35); }
  .swatch.band-narrow       { background: rgba(139,92,246,0.6); }
  .swatch.swatch-median     { background: rgba(167,139,250,0.95); height: 3px; }
  .swatch.swatch-expected   { background: rgba(59,130,246,0.85);  height: 3px; }
  .swatch.swatch-conservative { height: 2px;
    background: repeating-linear-gradient(90deg,rgba(251,146,60,0.8) 0 5px, transparent 5px 9px); }
  .swatch.swatch-aggressive   { height: 2px;
    background: repeating-linear-gradient(90deg,rgba(16,185,129,0.8) 0 5px, transparent 5px 9px); }

  .retire-marker {
    font-size: 0.65rem; font-weight: 600;
    padding: 0.25rem 0.55rem; border-radius: 0.35rem; border: 1px dashed;
  }
  .retire-marker.michael { color: #60a5fa; border-color: #60a5fa; background: rgba(96,165,250,0.07);  }
  .retire-marker.brianna { color: #c084fc; border-color: #c084fc; background: rgba(192,132,252,0.07); }

  .summary { display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap: 0.55rem; }

  .stat {
    background: rgba(15,23,42,0.5); border: 1px solid #334155; border-radius: 0.5rem;
    padding: 0.65rem 0.8rem; display: flex; flex-direction: column; gap: 0.15rem;
  }
  .stat-label { color: #94a3b8; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-value { color: #67e8f9; font-size: 0.95rem; font-weight: 700; }
  .stat-sub   { color: #475569; font-size: 0.6rem; }
</style>
