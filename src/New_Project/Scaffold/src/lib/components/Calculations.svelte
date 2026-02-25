<script>
  import katex from 'katex';
  import {
    globals,
    financialData,
    calculatePortfolioReturn,
    calculatePortfolioVolatility,
    michaelSocialSecurityAnnual,
    briannaSocialSecurityAnnual,
  } from '$lib/stores/fireStore.js';

  // Helpers
  /** Render a KaTeX expression to an HTML string. */
  const tex  = (expr)         => katex.renderToString(expr, { throwOnError: false });
  const texD = (expr)         => katex.renderToString(expr, { throwOnError: false, displayMode: true });
  const fmt  = (n, dp = 2)    => (n * 100).toFixed(dp) + '%';
  const cur  = (n)            => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  // Derived store values
  $: R_p   = calculatePortfolioReturn($globals);
  $: sigma = calculatePortfolioVolatility($globals);
  $: R_c   = R_p - sigma * 0.67;
  $: R_a   = R_p + sigma * 0.67;

  $: retirementRow = $financialData?.find(d => d.retired) || null;
  $: retirementPortfolio = retirementRow?.netWorth ?? 0;

  $: r_real = Math.max(0.001, R_p - $globals.inflationRate);
  $: n_rem  = Math.max(1, $globals.lifeExpectancy - Math.max($globals.michaelRetirementAge, $globals.briannaRetirementAge));
  $: amortFactor = r_real / (1 - Math.pow(1 + r_real, -n_rem));
  $: vpwSample = retirementPortfolio * amortFactor;

  $: W_base_gk  = ($globals.constantDollarAmount || 0) * (1 + $globals.inflationRate);
  $: R_init_gk  = retirementPortfolio > 0 ? ($globals.constantDollarAmount || 0) / retirementPortfolio : 0.04;
</script>

<svelte:head>
  <!-- KaTeX stylesheet — served from the installed package via Vite -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
</svelte:head>

<article class="calculations">
  <h2>Calculation Methodology</h2>

  <!-- 1. PORTFOLIO RETURN -->
  <section class="calc-section">
    <h3>Portfolio Return</h3>

    <div class="formula-box">
      <p class="formula-label">Expected weighted return</p>
      {@html texD('R_p = w_s \\cdot r_s + w_b \\cdot r_b + w_c \\cdot r_c')}
      <div class="live-vals">
        <span class="var"><strong>{@html tex('R_p')}</strong> = {fmt(R_p)}</span>
        <span class="var"><strong>{@html tex('w_s')}</strong> = {fmt($globals.stockAllocation, 1)} stocks</span>
        <span class="var"><strong>{@html tex('w_b')}</strong> = {fmt($globals.bondAllocation, 1)} bonds</span>
        <span class="var"><strong>{@html tex('w_c')}</strong> = {fmt($globals.cashAllocation, 1)} cash</span>
      </div>
    </div>

    <div class="formula-box">
      <p class="formula-label">Portfolio volatility (MPT, \(\rho = 0.30\))</p>
      {@html texD('\\sigma_p = \\sqrt{(w_s \\sigma_s)^2 + (w_b \\sigma_b)^2 + 2\\,w_s w_b \\sigma_s \\sigma_b \\rho}')}
      <div class="live-vals">
        <span class="var"><strong>{@html tex('\\sigma_p')}</strong> = {fmt(sigma)}</span>
        <span class="var">Conservative: {fmt(R_c)} &nbsp;({@html tex('-0.67\\sigma')})</span>
        <span class="var">Aggressive: {fmt(R_a)} &nbsp;({@html tex('+0.67\\sigma')})</span>
      </div>
    </div>
  </section>

  <!-- 2. WITHDRAWAL STRATEGIES -->
  <section class="calc-section">
    <h3>Withdrawal Strategies</h3>

    <!-- 2a. Constant Dollar -->
    <div class="formula-box strategy">
      <p class="formula-label strat-name">Constant Dollar <span class="source">(Bengen 1994)</span></p>
      <p class="explanation">The initial dollar amount is fixed at retirement and inflated by CPI each year to maintain purchasing power. This is the basis of the "4% rule."</p>
      {@html texD('W_t = W_0 \\times \\prod_{k=1}^{t}(1 + i_k)')}
      <p class="explanation note">For a constant inflation rate {@html tex('i_k = i')}: {@html tex('W_t = W_0 \\cdot (1+i)^t')}</p>
      {#if $globals.withdrawalMethod === 'constantDollar'}
        <div class="live-vals active">
          <span class="var"><strong>Active strategy</strong></span>
          <span class="var">{@html tex('W_0')} = {cur($globals.constantDollarAmount)}/yr</span>
          <span class="var">{@html tex('i')} = {fmt($globals.inflationRate)} CPI</span>
        </div>
      {/if}
    </div>

    <!-- 2b. Portfolio % -->
    <div class="formula-box strategy">
      <p class="formula-label strat-name">Fixed Percentage of Portfolio</p>
      <p class="explanation">A fixed percentage is withdrawn from <em>the current year's balance</em>. Withdrawals naturally shrink in down markets, protecting the portfolio during bad sequences.</p>
      {@html texD('W_t = B_t \\times p')}
      <p class="explanation note">{@html tex('B_t')} is updated each year after market returns and the prior year's withdrawal.</p>
      {#if $globals.withdrawalMethod === 'portfolioPercent'}
        <div class="live-vals active">
          <span class="var"><strong>Active strategy</strong></span>
          <span class="var">{@html tex('p')} = {fmt($globals.portfolioPercentRate)}</span>
          {#if retirementPortfolio > 0}
            <span class="var">Example {@html tex('W_t')}: {cur(retirementPortfolio * $globals.portfolioPercentRate)}/yr at retirement balance</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- 2c. VPW -->
    <div class="formula-box strategy">
      <p class="formula-label strat-name">Variable Percentage Withdrawal <span class="source">(Bogleheads VPW)</span></p>
      <p class="explanation">Amortises the current portfolio balance over the remaining planning horizon using the expected real return. The rate rises with age, ensuring the portfolio is substantially depleted by end-of-plan while not running out too soon.</p>
      {@html texD('W_t = B_t \\times \\frac{r}{1 - (1+r)^{-n}}')}
      <div class="var-defs">
        <span>{@html tex('B_t')} = current portfolio balance (post-return, pre-withdrawal)</span>
        <span>{@html tex('r')} = expected real return = nominal return − inflation rate</span>
        <span>{@html tex('n')} = remaining years = life expectancy âˆ’ current age</span>
      </div>
      {#if $globals.withdrawalMethod === 'vpw'}
        <div class="live-vals active">
          <span class="var"><strong>Active strategy</strong></span>
          <span class="var">{@html tex('r')} = {fmt(r_real)} ({fmt(R_p)} − {fmt($globals.inflationRate)})</span>
          <span class="var">{@html tex('n')} = {n_rem} yrs remaining</span>
          <span class="var">Amort. factor = {(amortFactor * 100).toFixed(2)}%</span>
          {#if retirementPortfolio > 0}
            <span class="var">Year-1 {@html tex('W_t')} â‰ˆ {cur(vpwSample)}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- 2d. Guyton-Klinger -->
    <div class="formula-box strategy">
      <p class="formula-label strat-name">Guyton-Klinger Guardrails <span class="source">(Guyton & Klinger 2006)</span></p>
      <p class="explanation">Starts with an inflation-adjusted base withdrawal, then applies two guardrail rules to keep the withdrawal rate inside a corridor around the initial rate.</p>

      <p class="sub-label">Step 1 — Inflation adjustment</p>
      {@html texD('W_{\\text{base}} = W_{t-1} \\times (1 + i_t)')}

      <p class="sub-label">Step 2 — Compute current withdrawal rate</p>
      {@html texD('R_t = \\frac{W_{\\text{base}}}{B_t}')}

      <p class="sub-label">Step 3 — Capital Preservation Rule (not in final 15 yrs)</p>
      {@html texD('\\text{If } R_t > R_{\\text{init}} \\times 1.2 \\;\\Rightarrow\\; W_t = W_{\\text{base}} \\times 0.9')}

      <p class="sub-label">Step 4 — Prosperity Rule</p>
      {@html texD('\\text{If } R_t < R_{\\text{init}} \\times 0.8 \\;\\Rightarrow\\; W_t = W_{\\text{base}} \\times 1.1')}

      {#if $globals.withdrawalMethod === 'guytonKlinger'}
        <div class="live-vals active">
          <span class="var"><strong>Active strategy</strong></span>
          <span class="var">{@html tex('W_0')} = {cur($globals.constantDollarAmount)}/yr</span>
          {#if retirementPortfolio > 0}
            <span class="var">{@html tex('R_{\\text{init}}')} = {(R_init_gk * 100).toFixed(2)}%</span>
            <span class="var">Ceiling ({@html tex('R_{\\text{init}} \\times 1.2')}) = {(R_init_gk * 1.2 * 100).toFixed(2)}%</span>
            <span class="var">Floor ({@html tex('R_{\\text{init}} \\times 0.8')}) = {(R_init_gk * 0.8 * 100).toFixed(2)}%</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- 2e. 1/N -->
    <div class="formula-box strategy">
      <p class="formula-label strat-name">1 ÷ Years Remaining</p>
      <p class="explanation">Divides the current portfolio by the years left in the plan. Withdrawal increases as the portfolio shrinks and time shortens — fully liquidates at end-of-plan by construction.</p>
      {@html texD('W_t = \\frac{B_t}{n_t}')}
      {#if $globals.withdrawalMethod === 'oneOverN'}
        <div class="live-vals active">
          <span class="var"><strong>Active strategy</strong></span>
          <span class="var">{@html tex('n_t')} = {n_rem} yrs at retirement</span>
          {#if retirementPortfolio > 0}
            <span class="var">Year-1 {@html tex('W_t')} â‰ˆ {cur(retirementPortfolio / n_rem)}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- 2f. Endowment -->
    <div class="formula-box strategy">
      <p class="formula-label strat-name">Endowment Model (5%)</p>
      <p class="explanation">Mirrors university endowment spending policy: withdraw 5% of the <em>initial</em> retirement balance, then inflation-adjust every year. Spending never reacts to portfolio performance â€” stable income, but no downside protection.</p>
      {@html texD('W_t = (B_{\\text{init}} \\times 0.05) \\times (1+i)^t')}
      {#if $globals.withdrawalMethod === 'endowment'}
        <div class="live-vals active">
          <span class="var"><strong>Active strategy</strong></span>
          {#if retirementPortfolio > 0}
            <span class="var">Year-1 {@html tex('W_t')} = {cur(retirementPortfolio * 0.05)}</span>
          {/if}
        </div>
      {/if}
    </div>
  </section>

  <!-- 3. TAX ENGINE -->
  <section class="calc-section">
    <h3>Tax Engine</h3>

    <div class="formula-box">
      <p class="formula-label">Federal income tax (2024 MFJ progressive brackets)</p>
      {@html texD('T_{\\text{fed}} = \\sum_{k} \\text{rate}_k \\times \\max(0,\\, \\min(Y, L_{k}) - L_{k-1})')}
      <p class="explanation note">
        Standard deduction $15,750; FICA 7.65%; State: {$globals.state} ({fmt($globals.stateTaxRates?.[$globals.state] ?? 0, 1)})
      </p>
      <div class="bracket-table">
        {#each [[0,11925,'10%'],[11925,48475,'12%'],[48475,103350,'22%'],[103350,197300,'24%'],[197300,250525,'32%'],[250525,626350,'35%'],[626350,Infinity,'37%']] as [lo, hi, rate]}
          <div class="bracket-row">
            <span class="rate">{rate}</span>
            <span class="range">${lo.toLocaleString()} - {hi === Infinity ? 'inf' : '$' + hi.toLocaleString()}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="formula-box">
      <p class="formula-label">Capital gains tax on brokerage withdrawals</p>
      {@html texD('\\text{Gross needed} = \\frac{W_{\\text{net}}}{1 - t_{\\text{cg}}}')}
      <div class="live-vals">
        <span class="var">{@html tex('t_{\\text{cg}}')} = {fmt($globals.capitalGainsTaxRate, 0)}</span>
      </div>
    </div>

    <div class="formula-box">
      <p class="formula-label">Early 401k withdrawal penalty (before age 59.5)</p>
      {@html texD('B_{\\text{net}} = B - W_{\\text{take}} \\times (1 + \\pi)')}
      <p class="explanation note">{@html tex('\\pi')} = {fmt($globals.earlyWithdrawalPenalty, 0)} penalty on top of ordinary income tax.</p>
    </div>

    <div class="formula-box">
      <p class="formula-label">Required Minimum Distributions (age 73+)</p>
      {@html texD('\\text{RMD}_t = \\frac{B_{401k,t}}{D_t}, \\quad D_{73} = 26.5,\\; D_{t} = D_{t-1} - 1')}
      <p class="explanation note">RMD overrides the strategy withdrawal if larger. Surplus is deposited to savings.</p>
    </div>
  </section>

  <!-- 4. SEQUENTIAL DRAW-DOWN ORDER -->
  <section class="calc-section">
    <h3>Sequential Draw-down Order</h3>
    <div class="formula-box">
      <p class="explanation">Each year's withdrawal target is satisfied by drawing from accounts in this order:</p>
      <ol class="draw-order">
        <li><strong>Savings</strong> - no tax, immediate liquidity</li>
        <li><strong>Brokerage</strong> - {fmt($globals.capitalGainsTaxRate, 0)} capital gains tax; gross-up applied</li>
        <li><strong>401k / Trad. IRA</strong> - ordinary income; +{fmt($globals.earlyWithdrawalPenalty, 0)} penalty if age &lt; 59.5</li>
        <li><strong>Roth IRA</strong> - tax-free; preserved longest for compounding</li>
        <li><strong>Liquidity gap</strong> - all accounts depleted; plan fails this year</li>
      </ol>
    </div>
  </section>

  <!-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
  <!-- 5. SOCIAL SECURITY                                                     -->
  <!-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
  <section class="calc-section">
    <h3>Social Security</h3>
    <div class="formula-box">
      <p class="explanation">Estimated from AIME (Average Indexed Monthly Earnings) using the SSA bend-point formula. Applied as income starting at the specified claim age, reducing the portfolio withdrawal needed.</p>
      <div class="live-vals">
        <span class="var">Michael (age {$globals.michaelSocialSecurityAge}+): {cur($michaelSocialSecurityAnnual ?? 0)}/yr</span>
        <span class="var">Brianna (age {$globals.briannaSocialSecurityAge}+): {cur($briannaSocialSecurityAnnual ?? 0)}/yr</span>
      </div>
    </div>
  </section>

</article>

<style>
  .calculations {
    padding: 1.5rem 2rem;
    max-width: 940px;
    margin: 0 auto;
  }

  h2 {
    color: #f1f5f9;
    font-size: 1.5rem;
    font-weight: 800;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid #3b82f6;
    padding-bottom: 0.5rem;
  }

  h3 {
    color: #60a5fa;
    font-size: 1.05rem;
    font-weight: 700;
    margin-bottom: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .calc-section {
    margin-bottom: 2.2rem;
  }

  /* â”€â”€ Formula boxes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .formula-box {
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid #334155;
    border-radius: 0.6rem;
    padding: 1.1rem 1.3rem;
    margin-bottom: 0.8rem;
  }

  .formula-box.strategy {
    border-left: 3px solid #6366f1;
  }

  .formula-label {
    color: #93c5fd;
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 0.6rem 0;
  }

  .strat-name {
    font-size: 0.9rem;
    color: #a5b4fc;
  }

  .source {
    font-weight: 400;
    color: #64748b;
    font-size: 0.8rem;
  }

  .sub-label {
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0.9rem 0 0.3rem 0;
  }

  .explanation {
    color: #94a3b8;
    font-size: 0.82rem;
    margin: 0.4rem 0;
    line-height: 1.55;
  }

  .explanation.note {
    font-style: italic;
    color: #64748b;
    font-size: 0.78rem;
  }

  .var-defs {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-top: 0.5rem;
    color: #64748b;
    font-size: 0.78rem;
  }

  /* â”€â”€ Live value chips â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .live-vals {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.6rem;
  }

  .live-vals.active {
    border-top: 1px solid #6366f1;
    padding-top: 0.6rem;
    margin-top: 0.7rem;
  }

  .var {
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 0.3rem;
    padding: 0.25rem 0.55rem;
    font-size: 0.75rem;
    color: #c7d2fe;
  }

  /* â”€â”€ Bracket table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .bracket-table {
    display: grid;
    grid-template-columns: 50px 1fr;
    gap: 0.3rem;
    margin-top: 0.6rem;
  }

  .bracket-row {
    display: contents;
  }

  .rate {
    background: rgba(59, 130, 246, 0.15);
    border-radius: 0.3rem 0 0 0.3rem;
    padding: 0.25rem 0.5rem;
    color: #93c5fd;
    font-size: 0.75rem;
    font-weight: 700;
    text-align: center;
  }

  .range {
    background: rgba(30, 41, 59, 0.4);
    border-radius: 0 0.3rem 0.3rem 0;
    padding: 0.25rem 0.6rem;
    color: #94a3b8;
    font-size: 0.75rem;
  }

  /* â”€â”€ Sequential draw-down â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  .draw-order {
    color: #cbd5e1;
    font-size: 0.83rem;
    line-height: 1.8;
    margin: 0.5rem 0 0 0;
    padding-left: 1.6rem;
  }

  .draw-order li {
    margin-bottom: 0.3rem;
  }

  /* â”€â”€ KaTeX overrides â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  :global(.katex) {
    color: #e2e8f0;
    font-size: 1em;
  }

  :global(.katex-display) {
    margin: 0.6rem 0;
    overflow-x: auto;
  }
</style>
