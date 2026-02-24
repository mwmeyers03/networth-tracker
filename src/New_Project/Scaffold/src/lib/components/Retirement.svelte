<script>
  import {
    globals,
    financialData,
    retirementExpenses,
    formatCur,
    normalRandom,
    calculateFederalTax,
    calculatePortfolioReturn,
    calculatePortfolioVolatility,
    START_YEAR,
    END_YEAR,
    MICHAEL_START_AGE,
    BRIANNA_START_AGE
  } from '$lib/stores/fireStore.js';

  let data = [];
  $: data = $financialData || [];

  $: retirementYear = data.find((d) => d.retired)?.year || null;
  $: retirementNetWorth = data.find((d) => d.retired)?.netWorth || 0;
  $: fireNumber = $retirementExpenses.yearlyAmount / 0.04;

  // Infographics metrics
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

  const runMonteCarlo = (data, numRuns = 500) => {
    if (!data || data.length === 0) return { success: 0, total: numRuns };

    const michaelRetirementAge = $globals.michaelRetirementAge;
    const briannaRetirementAge = $globals.briannaRetirementAge;
    const retirementYear = START_YEAR + Math.max(michaelRetirementAge - MICHAEL_START_AGE, briannaRetirementAge - BRIANNA_START_AGE);
    const marketReturn = calculatePortfolioReturn($globals);
    const marketStdDev = calculatePortfolioVolatility($globals);
    const inflationRate = $globals.inflationRate;
    const yearlyExpenses = $retirementExpenses.yearlyAmount;
    const michaelSalaryGrowth = $globals.michaelSalaryGrowth;
    const briannaSalaryGrowth = $globals.briannaSalaryGrowth;
    const michael401kRate = $globals.michael401kRate;
    const michael401kMatch = $globals.michael401kMatch;
    const brianna401kRate = $globals.brianna401kRate;
    const brianna401kMatch = $globals.brianna401kMatch;
    const lifeExpectancy = $globals.lifeExpectancy;

    const initialMichaelExpenses = data[0]?.mExp || 0;
    const initialBriannaExpenses = data[0]?.bExp || 0;
    const initialMichaelSalary = 81700;
    const initialBriannaSalary = 35000;

    let successCount = 0;

    for (let run = 0; run < numRuns; run++) {
      let m401kBal = ($globals.michael401kStart || 0);
      let b401kBal = ($globals.brianna401kStart || 0);
      let mRothBal = ($globals.michaelRothStart || 0);
      let bRothBal = ($globals.briannaRothStart || 0);
      let mBrokerageBal = ($globals.michaelBrokerageStart || 0);
      let bBrokerageBal = ($globals.briannaBrokerageStart || 0);
      let mSavingsBal = ($globals.michaelSavingsStart || 0);
      let bSavingsBal = ($globals.briannaSavingsStart || 0);

      let michaelSalary = initialMichaelSalary;
      let briannaSalary = initialBriannaSalary;
      let mExp = initialMichaelExpenses;
      let bExp = initialBriannaExpenses;

      let failed = false;

      for (let year = START_YEAR; year <= END_YEAR; year++) {
        const michaelAge = MICHAEL_START_AGE + (year - START_YEAR);
        const briannaAge = BRIANNA_START_AGE + (year - START_YEAR);
        const michaelRetired = michaelAge >= michaelRetirementAge;
        const briannaRetired = briannaAge >= briannaRetirementAge;
        const bothRetired = michaelRetired && briannaRetired;

        const randomReturn = marketReturn + normalRandom() * marketStdDev;

        m401kBal *= 1 + randomReturn;
        b401kBal *= 1 + randomReturn;
        mRothBal *= 1 + randomReturn;
        bRothBal *= 1 + randomReturn;
        mBrokerageBal *= 1 + randomReturn;
        bBrokerageBal *= 1 + randomReturn;

        if (!bothRetired) {
          if (!michaelRetired && year > START_YEAR) {
            michaelSalary *= 1 + michaelSalaryGrowth;
          }
          if (!briannaRetired && year > START_YEAR) {
            briannaSalary *= 1 + briannaSalaryGrowth;
          }

          if (year > START_YEAR) {
            mExp *= 1 + inflationRate;
            bExp *= 1 + inflationRate;
          }

          const mSalary = michaelRetired ? 0 : michaelSalary;
          const bSalary = briannaRetired ? 0 : briannaSalary;

          const m401kAdded = mSalary > 0 ? mSalary * michael401kRate + mSalary * michael401kMatch : 0;
          const b401kAdded = bSalary > 0 ? bSalary * brianna401kRate : 0;

          m401kBal += m401kAdded;
          b401kBal += b401kAdded;
          mRothBal += Math.min($globals.michaelRothYearlyContrib || 3500, 7000);
          bRothBal += Math.min($globals.briannaRothYearlyContrib || 3500, 7000);
          mBrokerageBal += ($globals.michaelBrokerageYearlyContrib || 1250);
          bBrokerageBal += ($globals.briannaBrokerageYearlyContrib || 1250);

          const mTakeHome = mSalary > 0 ? calculateFederalTax(mSalary, m401kAdded) : 0;
          const bTakeHome = bSalary > 0 ? calculateFederalTax(bSalary, b401kAdded) : 0;

          const mSavingsContrib = mTakeHome - mExp * 12 - Math.min($globals.michaelRothYearlyContrib || 3500, 7000) - ($globals.michaelBrokerageYearlyContrib || 1250);
          const bSavingsContrib = bTakeHome - bExp * 12 - Math.min($globals.briannaRothYearlyContrib || 3500, 7000) - ($globals.briannaBrokerageYearlyContrib || 1250);

          mSavingsBal += mSavingsContrib;
          bSavingsBal += bSavingsContrib;
        } else {
          let needed = yearlyExpenses;

          // Withdrawal sequence: Savings -> Brokerage -> 401k -> Roth
          if (mSavingsBal >= needed) {
            mSavingsBal -= needed;
            needed = 0;
          } else {
            needed -= mSavingsBal;
            mSavingsBal = 0;
          }

          if (needed > 0) {
            if (bSavingsBal >= needed) {
              bSavingsBal -= needed;
              needed = 0;
            } else {
              needed -= bSavingsBal;
              bSavingsBal = 0;
            }
          }

          if (needed > 0 && mBrokerageBal > 0) {
            const take = Math.min(mBrokerageBal, needed);
            const capitalGainsTax = take * 0.15;
            mBrokerageBal -= (take + capitalGainsTax);
            needed -= take;
          }

          if (needed > 0 && bBrokerageBal > 0) {
            const take = Math.min(bBrokerageBal, needed);
            const capitalGainsTax = take * 0.15;
            bBrokerageBal -= (take + capitalGainsTax);
            needed -= take;
          }

          if (needed > 0) {
            if (michaelAge >= 59.5 && m401kBal > 0) {
              const take = Math.min(m401kBal, needed);
              m401kBal -= take;
              needed -= take;
            }
            if (needed > 0 && briannaAge >= 59.5 && b401kBal > 0) {
              const take = Math.min(b401kBal, needed);
              b401kBal -= take;
              needed -= take;
            }
          }

          if (needed > 0 && (michaelAge >= 59.5 || briannaAge >= 59.5)) {
            if (needed > 0 && mRothBal > 0) {
              const take = Math.min(mRothBal, needed);
              mRothBal -= take;
              needed -= take;
            }
            if (needed > 0 && bRothBal > 0) {
              const take = Math.min(bRothBal, needed);
              bRothBal -= take;
              needed -= take;
            }
          }

          if (needed > 0) {
            failed = true;
            break;
          }
        }

        m401kBal = Math.max(0, m401kBal);
        b401kBal = Math.max(0, b401kBal);
        mRothBal = Math.max(0, mRothBal);
        bRothBal = Math.max(0, bRothBal);
        mBrokerageBal = Math.max(0, mBrokerageBal);
        bBrokerageBal = Math.max(0, bBrokerageBal);
        mSavingsBal = Math.max(0, mSavingsBal);
        bSavingsBal = Math.max(0, bSavingsBal);

        if (michaelAge >= lifeExpectancy && briannaAge >= lifeExpectancy) {
          break;
        }
      }

      if (!failed) {
        successCount++;
      }
    }

    return { success: successCount, total: numRuns };
  };

  $: monteCarloResult = runMonteCarlo(data);
  $: successRate = ((monteCarloResult.success / monteCarloResult.total) * 100).toFixed(1);
</script>

<article class="retirement">
  <h2>📊 Retirement Plan Overview</h2>

  <!-- Withdrawal Strategy Selector -->
  <div class="strategy-selector">
    <h3>💰 Withdrawal Strategy</h3>
    <div class="selector-group">
      <label for="withdrawal-method">Method:</label>
      <select id="withdrawal-method" bind:value={$globals.withdrawalMethod}>
        <option value="portfolioPercent">Portfolio % (Inflation Adjusted)</option>
        <option value="constantDollar">Constant Dollar Amount</option>
        <option value="oneOverN">One-Over-N (Deplete Portfolio)</option>
        <option value="endowment">Endowment Model</option>
        <option value="maximize">Maximize Spending</option>
      </select>
    </div>

    {#if $globals.withdrawalMethod === 'portfolioPercent'}
      <div class="selector-group">
        <label for="portfolio-rate">Withdrawal Rate:</label>
        <input id="portfolio-rate" type="number" step="0.001" min="0" max="0.1" bind:value={$globals.portfolioPercentRate} />
        <span class="input-suffix">{($globals.portfolioPercentRate * 100).toFixed(1)}%</span>
      </div>
      <p class="strategy-description">
        Starting withdrawal: {($globals.portfolioPercentRate * 100).toFixed(1)}% of initial balance, adjusted for inflation annually
      </p>
    {:else if $globals.withdrawalMethod === 'constantDollar'}
      <div class="selector-group">
        <label for="constant-amount">Annual Amount:</label>
        <input id="constant-amount" type="number" step="1000" min="0" bind:value={$globals.constantDollarAmount} />
        <span class="input-suffix">${$globals.constantDollarAmount.toLocaleString()}/year</span>
      </div>
      <p class="strategy-description">
        Fixed withdrawal: ${$globals.constantDollarAmount.toLocaleString()} per year
      </p>
    {:else if $globals.withdrawalMethod === 'oneOverN'}
      <p class="strategy-description">
        Withdraws balance divided by remaining years each year - depletes portfolio by life expectancy
      </p>
    {:else if $globals.withdrawalMethod === 'endowment'}
      <p class="strategy-description">
        Sustainable withdrawal model based on endowment spending principles (5% + inflation)
      </p>
    {:else if $globals.withdrawalMethod === 'maximize'}
      <p class="strategy-description">
        Withdraws entire portfolio during retirement - not sustainable long-term
      </p>
    {/if}
  </div>

  <!-- Plan At A Glance -->
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
  .retirement {
    padding: 2rem;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-radius: 0.75rem;
  }

  h2 {
    margin: 0 0 1.5rem 0;
    padding-bottom: 1rem;
    border-bottom: 2px solid #3b82f6;
    color: #f1f5f9;
    font-size: 1.5rem;
    font-weight: 700;
  }

  h3 {
    margin: 1.8rem 0 1rem 0;
    color: #f1f5f9;
    font-size: 1.15rem;
    font-weight: 650;
  }

  h4 {
    margin: 0 0 0.5rem 0;
    color: #dbeafe;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .strategy-selector {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .strategy-selector h3 {
    margin-top: 0;
  }

  .selector-group {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1rem 0;
  }

  .selector-group label {
    color: #94a3b8;
    font-size: 0.9rem;
    min-width: 120px;
  }

  .selector-group select,
  .selector-group input[type="number"] {
    flex: 1;
    max-width: 300px;
    padding: 0.5rem;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.35rem;
    color: #f1f5f9;
    font-size: 0.9rem;
  }

  .selector-group select:focus,
  .selector-group input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .input-suffix {
    color: #94a3b8;
    font-size: 0.85rem;
  }

  .strategy-description {
    margin: 0.5rem 0 0 0;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.1);
    border-left: 3px solid #3b82f6;
    border-radius: 0.25rem;
    color: #cbd5e1;
    font-size: 0.85rem;
    line-height: 1.5;
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
    color: #78350f;
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

  .no-data {
    color: #64748b;
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
