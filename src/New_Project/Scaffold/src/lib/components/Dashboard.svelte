<script>
  import { onMount, onDestroy } from 'svelte';
  import Chart from 'chart.js/auto';

  import {
    financialData,
    formatCur,
  } from '$lib/stores/fireStore.js';
  import {
    simulationResult,
    simulationRunning,
    successRateLabel,
    successRateColor,
  } from '$lib/stores/simulationStore';
  import { buildStackedAccountChartData, buildChartOptions } from '$lib/utils/chartHelpers';
  import Papa from 'papaparse';
  import jsPDF from 'jspdf';

  export let retirementYear = null;

  let data = [];
  $: data = $financialData || [];

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
  let showSavings = true;
  let showBrokerage = true;
  let show401k = true;
  let showRoth = true;
  let showHsa = true;
  let showTotal = true;

  onMount(async () => {
    if (!canvasEl) return;
    const { default: zoomPlugin } = await import('chartjs-plugin-zoom');
    Chart.register(zoomPlugin);
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

    const chartData = buildStackedAccountChartData(data);

    const visMap = {
      'Savings': showSavings,
      'Brokerage': showBrokerage,
      '401k': show401k,
      'Roth': showRoth,
      'HSA/529': showHsa,
      'Total Net Worth': showTotal,
    };

    chart.data.labels   = chartData.labels;
    chart.data.datasets = chartData.datasets.map(ds => ({
      ...ds,
      hidden: visMap[ds.label] === false,
    }));
    const breakdownByYear = Object.fromEntries(data.map(d => [d.year, d]));
    chart.options = buildChartOptions(maxNetWorth || 1_000_000, breakdownByYear, true);
    chart.update('none');
  }

  function toggle(name) {
    if (name === 'savings')   showSavings   = !showSavings;
    if (name === 'brokerage') showBrokerage = !showBrokerage;
    if (name === '401k')      show401k      = !show401k;
    if (name === 'roth')      showRoth      = !showRoth;
    if (name === 'hsa')       showHsa       = !showHsa;
    if (name === 'total')     showTotal     = !showTotal;
    updateChart();
  }

  $: successColor = $successRateColor;

  function exportCsv() {
    if (!data.length) return;
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `networth-ledger-${new Date().toISOString().slice(0,10)}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    if (!data.length) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Net Worth Projection', 14, 16);
    doc.setFontSize(10);
    const summary = [
      `Start: ${formatCur(data[0]?.netWorth)}`,
      `Peak: ${formatCur(maxNetWorth)}`,
      `End: ${formatCur(data[data.length - 1]?.netWorth)}`
    ];
    doc.text(summary.join('  •  '), 14, 24);

    let y = 32;
    doc.setFontSize(9);
    doc.text('Year  |  Income  |  Expenses  |  Net Worth', 14, y);
    y += 6;

    data.slice(0, 18).forEach((r) => {
      const line = `${r.year}  |  ${formatCur(r.combinedGross)}  |  ${formatCur(r.combinedExp)}  |  ${formatCur(r.netWorth)}`;
      doc.text(line, 14, y);
      y += 6;
    });

    doc.save(`networth-summary-${new Date().toISOString().slice(0,10)}.pdf`);
  }
</script>

<article class="dashboard">

  <!-- ── Header ───────────────────────────────────────────────────────── -->
  <div class="dash-header">
    <h2>Net Worth Projection</h2>
    <div class="header-right">
      <div class="export-group">
        <button class="ghost" on:click={exportCsv}>Export CSV</button>
        <button class="ghost" on:click={exportPdf}>Export PDF</button>
      </div>
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
    <button class="legend-btn" class:active={showTotal} on:click={() => toggle('total')}>
      <span class="swatch swatch-total"></span>Total Net Worth
    </button>
    <button class="legend-btn" class:active={showSavings} on:click={() => toggle('savings')}>
      <span class="swatch swatch-savings"></span>Savings
    </button>
    <button class="legend-btn" class:active={showBrokerage} on:click={() => toggle('brokerage')}>
      <span class="swatch swatch-brokerage"></span>Brokerage
    </button>
    <button class="legend-btn" class:active={show401k} on:click={() => toggle('401k')}>
      <span class="swatch swatch-401k"></span>401k
    </button>
    <button class="legend-btn" class:active={showRoth} on:click={() => toggle('roth')}>
      <span class="swatch swatch-roth"></span>Roth
    </button>
    <button class="legend-btn" class:active={showHsa} on:click={() => toggle('hsa')}>
      <span class="swatch swatch-hsa"></span>HSA / 529
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

  .export-group { display: flex; gap: 0.3rem; }

  .ghost {
    border: 1px solid #334155;
    background: rgba(51,65,85,0.25);
    color: #cbd5e1;
    padding: 0.35rem 0.6rem;
    border-radius: 0.4rem;
    font-size: 0.72rem;
    cursor: pointer;
  }

  .ghost:hover { border-color: #475569; color: #e2e8f0; }

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
  .swatch.swatch-total      { background: repeating-linear-gradient(90deg, rgba(226,232,240,0.9) 0 5px, transparent 5px 9px); height: 3px; }
  .swatch.swatch-savings    { background: rgba(94,234,212,0.5); }
  .swatch.swatch-brokerage  { background: rgba(59,130,246,0.5); }
  .swatch.swatch-401k       { background: rgba(250,204,21,0.45); }
  .swatch.swatch-roth       { background: rgba(236,72,153,0.5); }
  .swatch.swatch-hsa        { background: rgba(34,197,94,0.45); }

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
