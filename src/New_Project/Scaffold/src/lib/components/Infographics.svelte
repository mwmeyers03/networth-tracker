<script>
  import { globals, financialData, START_YEAR } from '$lib/stores/fireStore.js';

  let data = [];
  $: data = $financialData || [];

  // Calculate key metrics
  $: retirementYear = data.find(d => d.retired)?.year || null;
  $: retirementAge = retirementYear ? $globals.michaelRetirementAge : null;
  $: yearsRetired = retirementYear ? $globals.lifeExpectancy - retirementAge : 0;
  $: ssAge = $globals.michaelSocialSecurityAge || 62;
  $: ssStartYear = retirementYear ? retirementYear + (ssAge - retirementAge) : null;
  $: endingBalance = data[data.length - 1]?.netWorth || 0;
  $: startingBalance = data[0]?.netWorth || 0;
  $: balanceRetentionRate = startingBalance ? (endingBalance / startingBalance * 100) : 0;

  // Determine if plan is sustainable
  let sustainability = 'unknown';
  let liquidityGap = false;
  
  $: {
    liquidityGap = data.some(d => d.liquidityGap > 0);
    if (endingBalance > 0 && !liquidityGap) {
      sustainability = 'sustainable';
    } else if (endingBalance <= 0 || liquidityGap) {
      sustainability = 'unsustainable';
    } else {
      sustainability = 'marginal';
    }
  }

  const getSustainabilityIcon = (s) => {
    switch (s) {
      case 'sustainable': return '✅';
      case 'unsustainable': return '⚠️';
      case 'marginal': return '⚡';
      default: return '❓';
    }
  };

  const getSustainabilityLabel = (s) => {
    switch (s) {
      case 'sustainable': return 'Sustainable';
      case 'unsustainable': return 'At Risk';
      case 'marginal': return 'Marginal';
      default: return 'Unknown';
    }
  };
</script>

<article class="infographics">
  <h2>📊 Plan At A Glance</h2>
  
  <div class="infographic-grid">
    <!-- Retirement Timeline -->
    <div class="info-card timeline">
      <div class="card-header">⏱️ Retirement Timeline</div>
      <div class="card-body">
        {#if retirementYear}
          <div class="timeline-item">
            <span class="label">Retirement Begins</span>
            <span class="value">{retirementYear} (Age {retirementAge})</span>
          </div>
          <div class="timeline-item">
            <span class="label">Years in Retirement</span>
            <span class="value">{yearsRetired} years</span>
          </div>
          <div class="timeline-item">
            <span class="label">Social Security Starts</span>
            <span class="value">{ssStartYear} (Age {ssAge})</span>
          </div>
          <div class="timeline-item">
            <span class="label">Life Expectancy</span>
            <span class="value">Age {$globals.lifeExpectancy}</span>
          </div>
        {:else}
          <p class="no-data">Not yet retired in projection</p>
        {/if}
      </div>
    </div>

    <!-- Sustainability Status -->
    <div class="info-card status {sustainability}">
      <div class="card-header">📈 Plan Status</div>
      <div class="card-body">
        <div class="status-indicator">
          <span class="icon">{getSustainabilityIcon(sustainability)}</span>
          <span class="label">{getSustainabilityLabel(sustainability)}</span>
        </div>
        {#if liquidityGap}
          <div class="warning">⚠️ Plan has years with insufficient funds</div>
        {/if}
        <div class="metric">
          <span class="label">Ending Balance</span>
          <span class="value">${(endingBalance / 1_000_000).toFixed(2)}M</span>
        </div>
        <div class="metric">
          <span class="label">Balance Retention</span>
          <span class="value">{balanceRetentionRate.toFixed(0)}%</span>
        </div>
      </div>
    </div>

    <!-- Withdrawal Strategy -->
    <div class="info-card strategy">
      <div class="card-header">💰 Withdrawal Strategy</div>
      <div class="card-body">
        <div class="strategy-item">
          <span class="method">
            {#if $globals.withdrawalMethod === 'portfolioPercent'}
              Portfolio % Method
            {:else if $globals.withdrawalMethod === 'constantDollar'}
              Constant Dollar
            {:else if $globals.withdrawalMethod === 'oneOverN'}
              One-Over-N
            {:else if $globals.withdrawalMethod === 'endowment'}
              Endowment Model
            {:else if $globals.withdrawalMethod === 'maximize'}
              Maximize Spending
            {:else}
              {$globals.withdrawalMethod}
            {/if}
          </span>
        </div>
        
        {#if $globals.withdrawalMethod === 'portfolioPercent'}
          <div class="description">
            Starting withdrawal: {($globals.portfolioPercentRate * 100).toFixed(1)}% of initial balance,
            adjusted for inflation annually
          </div>
        {:else if $globals.withdrawalMethod === 'constantDollar'}
          <div class="description">
            Fixed withdrawal: ${($globals.constantDollarAmount).toLocaleString()} per year
          </div>
        {:else if $globals.withdrawalMethod === 'oneOverN'}
          <div class="description">
            Withdraws balance divided by remaining years each year
          </div>
        {:else if $globals.withdrawalMethod === 'endowment'}
          <div class="description">
            Sustainable withdrawal model based on endowment spending principles
          </div>
        {:else if $globals.withdrawalMethod === 'maximize'}
          <div class="description">
            Withdraws entire portfolio during retirement
          </div>
        {/if}
      </div>
    </div>

    <!-- Key Assumptions -->
    <div class="info-card assumptions">
      <div class="card-header">⚙️ Key Assumptions</div>
      <div class="card-body">
        <div class="assumption">
          <span class="label">Stock Return (Expected)</span>
          <span class="value">{($globals.stockReturn * 100).toFixed(1)}%</span>
        </div>
        <div class="assumption">
          <span class="label">Bond Return</span>
          <span class="value">{($globals.bondReturn * 100).toFixed(1)}%</span>
        </div>
        <div class="assumption">
          <span class="label">Inflation Rate</span>
          <span class="value">{($globals.inflationRate * 100).toFixed(1)}%</span>
        </div>
        <div class="assumption">
          <span class="label">Portfolio Allocation</span>
          <span class="value">
            {parseInt($globals.stockAllocation * 100)}% / {parseInt($globals.bondAllocation * 100)}% / {parseInt($globals.cashAllocation * 100)}%
          </span>
        </div>
      </div>
    </div>
  </div>

  <div class="explanation-section">
    <h3>📚 How It Works</h3>
    <div class="explanation-grid">
      <div class="explanation-card">
        <h4>Working Years</h4>
        <p>Both Michael and Brianna contribute to their retirement accounts (401k, Roth IRA, Brokerage, Savings) until age {$globals.michaelRetirementAge}.</p>
      </div>
      
      <div class="explanation-card">
        <h4>Withdrawal Years</h4>
        <p>Starting at age {$globals.michaelRetirementAge}, living expenses are covered through portfolio withdrawals and Social Security.</p>
      </div>
      
      <div class="explanation-card">
        <h4>Social Security</h4>
        <p>Social Security begins at age {ssAge}, calculated based on work history and earnings. Reduces the amount needed from portfolio withdrawals.</p>
      </div>
      
      <div class="explanation-card">
        <h4>Withdrawal Sequence</h4>
        <p>Accounts are accessed in order: Savings → Brokerage → 401k → Roth IRA, to minimize taxes and penalties.</p>
      </div>
    </div>
  </div>
</article>

<style>
  .infographics {
    padding: 2rem;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-radius: 0.75rem;
  }

  h2 {
    margin-top: 0;
    padding-bottom: 1rem;
    border-bottom: 2px solid #3b82f6;
    color: #f1f5f9;
  }

  .infographic-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin: 2rem 0;
  }

  .info-card {
    background: #1e293b;
    border-radius: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    border-left: 4px solid #3b82f6;
  }

  .info-card.sustainability {
    border-left-color: #10b981;
  }

  .info-card.status.sustainable {
    border-left-color: #10b981;
  }

  .info-card.status.unsustainable {
    border-left-color: #ef4444;
    background: linear-gradient(to right, rgba(239, 68, 68, 0.15), #1e293b);
  }

  .info-card.status.marginal {
    border-left-color: #f59e0b;
    background: linear-gradient(to right, rgba(245, 158, 11, 0.15), #1e293b);
  }

  .card-header {
    background: linear-gradient(135deg, #1e3a8a 0%, #312e81 100%);
    padding: 1rem;
    font-weight: 600;
    color: #dbeafe;
  }

  .card-body {
    padding: 1rem;
  }

  .timeline-item,
  .assumption {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #334155;
  }

  .timeline-item:last-child,
  .assumption:last-child {
    border-bottom: none;
  }

  .label {
    font-size: 0.9rem;
    color: #94a3b8;
  }

  .value {
    font-weight: 600;
    color: #f1f5f9;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .status-indicator .icon {
    font-size: 2rem;
  }

  .status-indicator .label {
    font-size: 1.1rem;
    font-weight: 600;
    color: #f1f5f9;
    border: none;
  }

  .warning {
    background: #fef3c7;
    border-left: 3px solid #f59e0b;
    padding: 0.75rem;
    margin-bottom: 1rem;
    border-radius: 0.25rem;
    font-size: 0.9rem;
  }

  .metric {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    margin-top: 0.5rem;
  }

  .strategy-item {
    margin-bottom: 1rem;
  }

  .method {
    font-weight: 600;
    color: #f1f5f9;
  }

  .description {
    font-size: 0.9rem;
    color: #94a3b8;
    margin-top: 0.5rem;
    line-height: 1.5;
  }

  .no-data {
    color: #9ca3af;
    font-style: italic;
  }

  .explanation-section {
    margin-top: 3rem;
    padding: 2rem;
    background: #1e293b;
    border-radius: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .explanation-section h3 {
    margin-top: 0;
    color: #f1f5f9;
  }

  .explanation-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .explanation-card {
    padding: 1rem;
    background: linear-gradient(135deg, #1e3a8a 0%, #4c1d95 100%);
    border-radius: 0.5rem;
    border-left: 4px solid #3b82f6;
  }

  .explanation-card h4 {
    margin: 0 0 0.5rem 0;
    color: #dbeafe;
  }

  .explanation-card p {
    margin: 0;
    font-size: 0.9rem;
    color: #cbd5e1;
    line-height: 1.5;
  }
</style>
