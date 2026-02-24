<script>
  import { globals, retirementExpenses } from '$lib/stores/fireStore.js';
  import {
    simulationResult,
    simulationRunning,
    simulationProgress,
    successRateLabel,
    safeWithdrawalRateLabel,
    successRateColor,
  } from '$lib/stores/simulationStore';

  // ── Local allocation input state (mirrors Controls.svelte approach) ──────
  let stockInput = '';
  let bondInput = '';
  let cashInput = '';

  $: if (!stockInput && !bondInput && !cashInput) {
    stockInput = ($globals.stockAllocation * 100).toFixed(0);
    bondInput  = ($globals.bondAllocation  * 100).toFixed(0);
    cashInput  = ($globals.cashAllocation  * 100).toFixed(0);
  }

  const parseNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  $: allocTotal = parseNum(stockInput) + parseNum(bondInput) + parseNum(cashInput);

  function commitAllocation() {
    const s = parseNum(stockInput) / 100;
    const b = parseNum(bondInput)  / 100;
    const c = parseNum(cashInput)  / 100;
    if (Math.abs(s + b + c - 1) < 0.01) {
      globals.update(g => ({ ...g, stockAllocation: s, bondAllocation: b, cashAllocation: c }));
    }
  }

  const METHODS = [
    { value: 'portfolioPercent', label: '% of Portfolio' },
    { value: 'constantDollar',  label: 'Constant Dollar (SWR)' },
    { value: 'vpw',             label: 'Variable % (VPW)' },
    { value: 'guytonKlinger',   label: 'Guyton-Klinger' },
    { value: 'oneOverN',        label: '1 ÷ Years Remaining' },
    { value: 'endowment',       label: 'Endowment (5%)' },
  ];

  $: successColor = $successRateColor;
</script>

<aside class="sidebar">
  <div class="sidebar-inner">

    <!-- ── Success rate badge ─────────────────────────────────────────── -->
    <div class="badge-section">
      <div class="badge-row">
        <div class="badge success-badge" class:green={successColor === 'green'}
             class:yellow={successColor === 'yellow'} class:red={successColor === 'red'}>
          <span class="badge-label">Success Rate</span>
          <span class="badge-value">{$successRateLabel}</span>
        </div>
        <div class="badge swr-badge">
          <span class="badge-label">Safe WR</span>
          <span class="badge-value">{$safeWithdrawalRateLabel}</span>
        </div>
      </div>

      {#if $simulationRunning}
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width: {Math.round($simulationProgress * 100)}%"></div>
        </div>
        <p class="running-label">Running {Math.round($simulationProgress * 100)}% historical cohorts…</p>
      {:else if $simulationResult}
        <p class="cohort-label">{$simulationResult.successfulCohorts} / {$simulationResult.totalCohorts} cohorts survived</p>
      {/if}
    </div>

    <div class="divider"></div>

    <!-- ── Retirement ages ───────────────────────────────────────────── -->
    <section class="control-section">
      <h3>Retirement Ages</h3>
      <div class="field">
        <label for="sb-m-ret">Michael</label>
        <div class="input-row">
          <input id="sb-m-ret" type="range" min="35" max="70"
            value={$globals.michaelRetirementAge}
            on:input={e => globals.update(g => ({ ...g, michaelRetirementAge: +e.target.value }))} />
          <span class="range-val">{$globals.michaelRetirementAge}</span>
        </div>
      </div>
      <div class="field">
        <label for="sb-b-ret">Brianna</label>
        <div class="input-row">
          <input id="sb-b-ret" type="range" min="35" max="70"
            value={$globals.briannaRetirementAge}
            on:input={e => globals.update(g => ({ ...g, briannaRetirementAge: +e.target.value }))} />
          <span class="range-val">{$globals.briannaRetirementAge}</span>
        </div>
      </div>
    </section>

    <div class="divider"></div>

    <!-- ── Withdrawal strategy ───────────────────────────────────────── -->
    <section class="control-section">
      <h3>Withdrawal Strategy</h3>
      <select
        value={$globals.withdrawalMethod}
        on:change={e => globals.update(g => ({ ...g, withdrawalMethod: e.target.value }))}>
        {#each METHODS as m}
          <option value={m.value}>{m.label}</option>
        {/each}
      </select>

      {#if $globals.withdrawalMethod === 'portfolioPercent'}
        <div class="field mt">
          <label for="sb-pct-rate">Rate ({($globals.portfolioPercentRate * 100).toFixed(1)}%)</label>
          <input id="sb-pct-rate" type="range" min="2" max="8" step="0.1"
            value={$globals.portfolioPercentRate * 100}
            on:input={e => globals.update(g => ({ ...g, portfolioPercentRate: +e.target.value / 100 }))} />
        </div>
      {:else if $globals.withdrawalMethod === 'constantDollar' || $globals.withdrawalMethod === 'guytonKlinger'}
        <div class="field mt">
          <label for="sb-ret-exp">Annual Spending (fixed $)</label>
          <input id="sb-ret-exp" type="number" min="0" step="1000"
            value={$retirementExpenses.yearlyAmount}
            on:change={e => {
              const v = +e.target.value;
              retirementExpenses.update(r => ({ ...r, yearlyAmount: v }));
              globals.update(g => ({ ...g, constantDollarAmount: v }));
            }} />
        </div>
      {/if}
    </section>

    <div class="divider"></div>

    <!-- ── Asset allocation ──────────────────────────────────────────── -->
    <section class="control-section">
      <h3>Asset Allocation
        <span class="alloc-total" class:error={Math.abs(allocTotal - 100) > 0.5}>
          {allocTotal}%
        </span>
      </h3>

      <div class="field">
        <label for="sb-stock">Stocks
          <span class="alloc-hint">{stockInput}%</span>
        </label>
        <input id="sb-stock" type="range" min="0" max="100"
          bind:value={stockInput}
          on:change={commitAllocation} />
      </div>
      <div class="field">
        <label for="sb-bond">Bonds
          <span class="alloc-hint">{bondInput}%</span>
        </label>
        <input id="sb-bond" type="range" min="0" max="100"
          bind:value={bondInput}
          on:change={commitAllocation} />
      </div>
      <div class="field">
        <label for="sb-cash">Cash
          <span class="alloc-hint">{cashInput}%</span>
        </label>
        <input id="sb-cash" type="range" min="0" max="100"
          bind:value={cashInput}
          on:change={commitAllocation} />
      </div>

      {#if Math.abs(allocTotal - 100) > 0.5}
        <p class="alloc-warn">Must sum to 100%</p>
      {/if}
    </section>

    <div class="divider"></div>

    <!-- ── Final-balance quick stats ─────────────────────────────────── -->
    {#if $simulationResult}
      <section class="control-section">
        <h3>Historical Outcomes</h3>
        <div class="outcome-grid">
          <div class="outcome">
            <span class="outcome-label">Worst Final</span>
            <span class="outcome-val red-text">
              {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format($simulationResult.worstCaseFinalBalance)}
            </span>
          </div>
          <div class="outcome">
            <span class="outcome-label">Median Final</span>
            <span class="outcome-val">
              {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format($simulationResult.medianFinalBalance)}
            </span>
          </div>
          <div class="outcome">
            <span class="outcome-label">Best Final</span>
            <span class="outcome-val green-text">
              {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format($simulationResult.bestCaseFinalBalance)}
            </span>
          </div>
        </div>
      </section>
    {/if}

  </div>
</aside>

<style>
  .sidebar {
    width: 240px;
    min-width: 240px;
    background: rgba(15, 23, 42, 0.7);
    border-right: 1px solid #1e293b;
    overflow-y: auto;
    height: 100%;
    flex-shrink: 0;
  }

  .sidebar-inner {
    padding: 1rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .divider {
    height: 1px;
    background: #1e293b;
    margin: 0.9rem 0;
  }

  /* ── Badge section ──────────────────────────────────────────────────── */
  .badge-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .badge-row {
    display: flex;
    gap: 0.5rem;
  }

  .badge {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.55rem 0.4rem;
    border-radius: 0.5rem;
    border: 1px solid #334155;
    background: rgba(30, 41, 59, 0.6);
    gap: 0.15rem;
  }

  .badge-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .badge-value {
    font-size: 1.05rem;
    font-weight: 800;
    color: #e2e8f0;
  }

  .success-badge.green  { border-color: #166534; background: rgba(22,101,52,0.2); }
  .success-badge.green .badge-value { color: #4ade80; }
  .success-badge.yellow { border-color: #713f12; background: rgba(113,63,18,0.2); }
  .success-badge.yellow .badge-value { color: #fbbf24; }
  .success-badge.red    { border-color: #7f1d1d; background: rgba(127,29,29,0.2); }
  .success-badge.red .badge-value   { color: #f87171; }

  .swr-badge .badge-value { color: #67e8f9; }

  .progress-bar-wrap {
    height: 4px;
    background: #1e293b;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    border-radius: 2px;
    transition: width 0.15s ease;
  }

  .running-label, .cohort-label {
    font-size: 0.62rem;
    color: #64748b;
    margin: 0;
    text-align: center;
  }

  /* ── Control sections ───────────────────────────────────────────────── */
  .control-section h3 {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #64748b;
    margin: 0 0 0.7rem 0;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .field {
    margin-bottom: 0.65rem;
  }

  .field.mt {
    margin-top: 0.5rem;
  }

  label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.72rem;
    color: #94a3b8;
    margin-bottom: 0.25rem;
  }

  .alloc-hint {
    font-size: 0.7rem;
    color: #67e8f9;
    font-weight: 600;
  }

  input[type="range"] {
    width: 100%;
    cursor: pointer;
    accent-color: #6366f1;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .input-row input[type="range"] {
    flex: 1;
  }

  .range-val {
    font-size: 0.78rem;
    font-weight: 700;
    color: #67e8f9;
    min-width: 1.8rem;
    text-align: right;
  }

  select {
    width: 100%;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid #334155;
    color: #e2e8f0;
    padding: 0.4rem 0.5rem;
    border-radius: 0.4rem;
    font-size: 0.75rem;
    cursor: pointer;
  }

  input[type="number"] {
    width: 100%;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid #334155;
    color: #e2e8f0;
    padding: 0.4rem 0.5rem;
    border-radius: 0.4rem;
    font-size: 0.75rem;
    box-sizing: border-box;
  }

  .alloc-total {
    font-size: 0.65rem;
    font-weight: 700;
    color: #4ade80;
    margin-left: auto;
  }

  .alloc-total.error { color: #f87171; }

  .alloc-warn {
    font-size: 0.65rem;
    color: #f87171;
    margin: 0.2rem 0 0 0;
  }

  /* ── Historical outcome grid ────────────────────────────────────────── */
  .outcome-grid {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .outcome {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.35rem 0.5rem;
    background: rgba(30,41,59,0.5);
    border-radius: 0.3rem;
    border: 1px solid #1e293b;
  }

  .outcome-label {
    font-size: 0.67rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .outcome-val {
    font-size: 0.75rem;
    font-weight: 700;
    color: #e2e8f0;
  }

  .red-text   { color: #f87171 !important; }
  .green-text { color: #4ade80 !important; }
</style>
