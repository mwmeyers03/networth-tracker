<script>
  import { financialData, conservativeData, aggressiveData, formatCur, globals, START_YEAR } from '$lib/stores/fireStore.js';

  let data = [];
  let conservativeProjection = [];
  let aggressiveProjection = [];
  let globals$ = {};
  let showExportMenu = false;
  const scenarioAllocations = {
    conservative: { stockAllocation: 0.60, bondAllocation: 0.30, cashAllocation: 0.10 },
    expected: { stockAllocation: 0.70, bondAllocation: 0.20, cashAllocation: 0.10 },
    aggressive: { stockAllocation: 0.80, bondAllocation: 0.10, cashAllocation: 0.10 }
  };

  $: data = $financialData || [];
  $: conservativeProjection = $conservativeData || [];
  $: aggressiveProjection = $aggressiveData || [];
  $: globals$ = $globals || {};

  /**
   * @param {{ stockAllocation: number; bondAllocation: number; cashAllocation: number }} allocation
   */
  const scenarioReturn = (allocation) => {
    /** @type {any} */
    const g = globals$ || {};
    return (
      (g.stockReturn || 0) * allocation.stockAllocation +
      (g.bondReturn || 0) * allocation.bondAllocation +
      (g.cashReturn || 0) * allocation.cashAllocation
    );
  };

  $: expectedReturnPct = (scenarioReturn(scenarioAllocations.expected) * 100).toFixed(2);
  $: conservativeReturnPct = (scenarioReturn(scenarioAllocations.conservative) * 100).toFixed(2);
  $: aggressiveReturnPct = (scenarioReturn(scenarioAllocations.aggressive) * 100).toFixed(2);

  // Calculate scenario metrics
  $: expectedMetrics = calculateMetrics(data);
  $: conservativeMetrics = calculateMetrics(conservativeProjection);
  $: aggressiveMetrics = calculateMetrics(aggressiveProjection);

  /** @param {any[]} projection */
  const calculateMetrics = (projection) => {
    if (!projection || projection.length === 0) {
      return {
        yearsToRetirement: 'N/A',
        finalNetWorth: 0,
        minNetWorth: 0,
        maxNetWorth: 0,
        status: 'No data',
        successProbability: 'N/A',
        failureYear: 'N/A',
        balanceRetentionRate: 'N/A'
      };
    }

    // Find when both are retired
    const bothRetiredIdx = projection.findIndex(d => d.michaelRetired && d.briannaRetired);
    const yearsToRetirement = bothRetiredIdx >= 0 ? bothRetiredIdx : projection.length;
    const retirementYear = bothRetiredIdx >= 0 ? projection[bothRetiredIdx].year : 'N/A';

    // Get final net worth
    const finalEntry = projection[projection.length - 1];
    const finalNetWorth = finalEntry?.netWorth || 0;

    // Find min and max net worth
    let minNetWorth = Math.min(...projection.map(d => d?.netWorth || 0));
    let maxNetWorth = Math.max(...projection.map(d => d?.netWorth || 0));

    // Calculate success probability (percentage of years where portfolio is positive)
    const retirementStart = bothRetiredIdx >= 0 ? bothRetiredIdx : 0;
    const retirementYears = projection.slice(retirementStart);
    const positiveYears = retirementYears.filter(d => (d?.netWorth || 0) > 0).length;
    const successProbability = retirementYears.length > 0 ? Math.round((positiveYears / retirementYears.length) * 100) : 0;

    // Find failure year (first year with negative net worth during retirement)
    const failureIdx = retirementYears.findIndex(d => (d?.netWorth || 0) < 0);
    const failureYear = failureIdx >= 0 ? retirementYears[failureIdx].year : 'Never';

    const retirementNetWorthRaw = projection[retirementStart]?.netWorth || 0;
    const retirementNetWorth = Math.max(0, retirementNetWorthRaw);
    const endingBalance = finalNetWorth;

    const rawRetention = retirementNetWorth > 0 ? (endingBalance / retirementNetWorth) * 100 : null;
    const balanceRetentionRate = rawRetention === null
      ? 'N/A'
      : Math.max(0, Math.min(999, rawRetention)).toFixed(1);

    // Determine success status
    const status = finalNetWorth < 0 ? 'Unsustainable' : minNetWorth < 0 ? 'At Risk' : 'Sustainable';

    return {
      yearsToRetirement: typeof yearsToRetirement === 'number' ? yearsToRetirement : 'N/A',
      retirementYear,
      finalNetWorth,
      minNetWorth,
      maxNetWorth,
      status,
      successProbability,
      failureYear,
      balanceRetentionRate
    };
  };

  /** @param {string} status */
  const getStatusColor = (status) => {
    if (status === 'Sustainable') return '#10b981';
    if (status === 'At Risk') return '#f59e0b';
    return '#ef4444';
  };

  /** @param {string} status */
  const getStatusIcon = (status) => {
    if (status === 'Sustainable') return '✓';
    if (status === 'At Risk') return '⚠';
    return '✗';
  };

  /** @param {string | number} value */
  const asPercent = (value) => value === 'N/A' ? 'N/A' : `${value}%`;

  /** @param {'csv' | 'json'} format */
  const exportScenarios = (format) => {
    if (format === 'csv') {
      exportCSV();
    } else if (format === 'json') {
      exportJSON();
    }
    showExportMenu = false;
  };

  const exportCSV = () => {
    let csv = 'Scenario Comparison Report\n';
    csv += 'Generated: ' + new Date().toLocaleDateString() + '\n\n';
    csv += 'Scenario,Portfolio Return,Years to Retirement,Retirement Year,Final Net Worth,Min Net Worth,Success Probability,Failure Year,Ending Balance %,Status\n';
    
    csv += `Conservative,${conservativeReturnPct}%,${conservativeMetrics.yearsToRetirement},${conservativeMetrics.retirementYear},${conservativeMetrics.finalNetWorth},${conservativeMetrics.minNetWorth},${conservativeMetrics.successProbability}%,${conservativeMetrics.failureYear},${asPercent(conservativeMetrics.balanceRetentionRate)},${conservativeMetrics.status}\n`;
    csv += `Expected,${expectedReturnPct}%,${expectedMetrics.yearsToRetirement},${expectedMetrics.retirementYear},${expectedMetrics.finalNetWorth},${expectedMetrics.minNetWorth},${expectedMetrics.successProbability}%,${expectedMetrics.failureYear},${asPercent(expectedMetrics.balanceRetentionRate)},${expectedMetrics.status}\n`;
    csv += `Aggressive,${aggressiveReturnPct}%,${aggressiveMetrics.yearsToRetirement},${aggressiveMetrics.retirementYear},${aggressiveMetrics.finalNetWorth},${aggressiveMetrics.minNetWorth},${aggressiveMetrics.successProbability}%,${aggressiveMetrics.failureYear},${asPercent(aggressiveMetrics.balanceRetentionRate)},${aggressiveMetrics.status}\n`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', `fire-scenarios-${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const exportJSON = () => {
    const report = {
      generatedDate: new Date().toISOString(),
      scenarios: {
        conservative: { return: `${conservativeReturnPct}%`, ...conservativeMetrics },
        expected: { return: `${expectedReturnPct}%`, ...expectedMetrics },
        aggressive: { return: `${aggressiveReturnPct}%`, ...aggressiveMetrics }
      }
    };

    const element = document.createElement('a');
    element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2)));
    element.setAttribute('download', `fire-scenarios-${new Date().toISOString().split('T')[0]}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
</script>

<article class="scenarios">
  <div class="scenarios-header">
    <h2>Withdrawal Strategy Outlook</h2>
    <div class="export-container">
      <button class="export-btn" on:click={() => showExportMenu = !showExportMenu}>
        📥 Export Report
      </button>
      {#if showExportMenu}
        <div class="export-menu">
          <button on:click={() => exportScenarios('csv')}>📊 CSV</button>
          <button on:click={() => exportScenarios('json')}>📄 JSON</button>
        </div>
      {/if}
    </div>
  </div>
  
  <div class="scenarios-grid">
    <!-- Conservative Scenario -->
    <div class="scenario-card">
      <div class="scenario-header conservative">
        <h3>Conservative</h3>
        <p class="allocation">60% Stocks, 30% Bonds, 10% Cash</p>
      </div>
      
      <div class="scenario-body">
        <div class="metric">
          <span class="label">Portfolio Return</span>
          <span class="value">{conservativeReturnPct}%</span>
        </div>
        
        <div class="metric">
          <span class="label">Success Probability</span>
          <span class="value success-prob">{conservativeMetrics.successProbability}%</span>
        </div>

        <div class="success-bar">
          <div class="success-bar-fill" style="width: {conservativeMetrics.successProbability}%"></div>
        </div>
        
        <div class="metric">
          <span class="label">Years to Retirement</span>
          <span class="value">
            {typeof conservativeMetrics.yearsToRetirement === 'number' 
              ? conservativeMetrics.yearsToRetirement 
              : '∞'}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Retirement Year</span>
          <span class="value">
            {conservativeMetrics.retirementYear !== 'N/A' 
              ? conservativeMetrics.retirementYear 
              : 'N/A'}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Final Net Worth</span>
          <span class="value">{formatCur(conservativeMetrics.finalNetWorth)}</span>
        </div>
        
        <div class="metric">
          <span class="label">Min Net Worth</span>
          <span class="value warning={conservativeMetrics.minNetWorth < 0}">
            {formatCur(conservativeMetrics.minNetWorth)}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Failure Year</span>
          <span class="value" style="color: {conservativeMetrics.failureYear === 'Never' ? '#10b981' : '#ef4444'}">
            {conservativeMetrics.failureYear}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Ending Balance %</span>
          <span class="value">{asPercent(conservativeMetrics.balanceRetentionRate)}</span>
        </div>
        
        <div class="status-row">
          <span class="status-label">Status:</span>
          <span class="status-badge" style="background-color: {getStatusColor(conservativeMetrics.status)}">
            {getStatusIcon(conservativeMetrics.status)} {conservativeMetrics.status}
          </span>
        </div>
      </div>
    </div>

    <!-- Expected Scenario -->
    <div class="scenario-card">
      <div class="scenario-header expected">
        <h3>Expected</h3>
        <p class="allocation">70% Stocks, 20% Bonds, 10% Cash</p>
      </div>
      
      <div class="scenario-body">
        <div class="metric">
          <span class="label">Portfolio Return</span>
          <span class="value">{expectedReturnPct}%</span>
        </div>
        
        <div class="metric">
          <span class="label">Success Probability</span>
          <span class="value success-prob">{expectedMetrics.successProbability}%</span>
        </div>

        <div class="success-bar">
          <div class="success-bar-fill" style="width: {expectedMetrics.successProbability}%"></div>
        </div>
        
        <div class="metric">
          <span class="label">Years to Retirement</span>
          <span class="value">
            {typeof expectedMetrics.yearsToRetirement === 'number' 
              ? expectedMetrics.yearsToRetirement 
              : '∞'}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Retirement Year</span>
          <span class="value">
            {expectedMetrics.retirementYear !== 'N/A' 
              ? expectedMetrics.retirementYear 
              : 'N/A'}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Final Net Worth</span>
          <span class="value">{formatCur(expectedMetrics.finalNetWorth)}</span>
        </div>
        
        <div class="metric">
          <span class="label">Min Net Worth</span>
          <span class="value warning={expectedMetrics.minNetWorth < 0}">
            {formatCur(expectedMetrics.minNetWorth)}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Failure Year</span>
          <span class="value" style="color: {expectedMetrics.failureYear === 'Never' ? '#10b981' : '#ef4444'}">
            {expectedMetrics.failureYear}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Ending Balance %</span>
          <span class="value">{asPercent(expectedMetrics.balanceRetentionRate)}</span>
        </div>
        
        <div class="status-row">
          <span class="status-label">Status:</span>
          <span class="status-badge" style="background-color: {getStatusColor(expectedMetrics.status)}">
            {getStatusIcon(expectedMetrics.status)} {expectedMetrics.status}
          </span>
        </div>
      </div>
    </div>

    <!-- Aggressive Scenario -->
    <div class="scenario-card">
      <div class="scenario-header aggressive">
        <h3>Aggressive</h3>
        <p class="allocation">80% Stocks, 10% Bonds, 10% Cash</p>
      </div>
      
      <div class="scenario-body">
        <div class="metric">
          <span class="label">Portfolio Return</span>
          <span class="value">{aggressiveReturnPct}%</span>
        </div>
        
        <div class="metric">
          <span class="label">Success Probability</span>
          <span class="value success-prob">{aggressiveMetrics.successProbability}%</span>
        </div>

        <div class="success-bar">
          <div class="success-bar-fill" style="width: {aggressiveMetrics.successProbability}%"></div>
        </div>
        
        <div class="metric">
          <span class="label">Years to Retirement</span>
          <span class="value">
            {typeof aggressiveMetrics.yearsToRetirement === 'number' 
              ? aggressiveMetrics.yearsToRetirement 
              : '∞'}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Retirement Year</span>
          <span class="value">
            {aggressiveMetrics.retirementYear !== 'N/A' 
              ? aggressiveMetrics.retirementYear 
              : 'N/A'}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Final Net Worth</span>
          <span class="value">{formatCur(aggressiveMetrics.finalNetWorth)}</span>
        </div>
        
        <div class="metric">
          <span class="label">Min Net Worth</span>
          <span class="value warning={aggressiveMetrics.minNetWorth < 0}">
            {formatCur(aggressiveMetrics.minNetWorth)}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Failure Year</span>
          <span class="value" style="color: {aggressiveMetrics.failureYear === 'Never' ? '#10b981' : '#ef4444'}">
            {aggressiveMetrics.failureYear}
          </span>
        </div>
        
        <div class="metric">
          <span class="label">Ending Balance %</span>
          <span class="value">{asPercent(aggressiveMetrics.balanceRetentionRate)}</span>
        </div>
        
        <div class="status-row">
          <span class="status-label">Status:</span>
          <span class="status-badge" style="background-color: {getStatusColor(aggressiveMetrics.status)}">
            {getStatusIcon(aggressiveMetrics.status)} {aggressiveMetrics.status}
          </span>
        </div>
      </div>
    </div>
  </div>

  <div class="interpretation">
    <h3>Understanding the Outlook</h3>
    <ul>
      <li><strong>Portfolio Return:</strong> Expected annual return based on allocation and market assumptions</li>
      <li><strong>Success Probability:</strong> Percentage of retirement years where your portfolio will be positive (100% = safest)</li>
      <li><strong>Years to Retirement:</strong> How many years until both reach their retirement age targets</li>
      <li><strong>Retirement Year:</strong> The calendar year you can achieve your retirement goal</li>
      <li><strong>Final Net Worth:</strong> Total wealth at the end of the 42-year projection period</li>
      <li><strong>Min Net Worth:</strong> Lowest point in the portfolio during retirement years (watch for negatives)</li>
      <li><strong>Failure Year:</strong> First year your portfolio would go negative (or "Never" if it stays positive)</li>
      <li><strong>Ending Balance %:</strong> Final portfolio balance as a percent of balance at retirement start</li>
      <li><strong>Status:</strong>
        <span style="display: inline-block; color: #10b981;">✓ Sustainable</span> = Plan works through life expectancy,
        <span style="display: inline-block; color: #f59e0b;">⚠ At Risk</span> = Portfolio dips into negatives temporarily,
        <span style="display: inline-block; color: #ef4444;">✗ Unsustainable</span> = Plan runs out of money
      </li>
    </ul>
  </div>
</article>

<style>
  .scenarios {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .scenarios-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .scenarios-header h2 {
    margin: 0;
    color: #f1f5f9;
    font-size: 1.5rem;
  }

  .export-container {
    position: relative;
  }

  .export-btn {
    padding: 0.6rem 1rem;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .export-btn:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .export-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid #334155;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    z-index: 10;
  }

  .export-menu button {
    display: block;
    width: 100%;
    padding: 0.75rem 1.25rem;
    background: transparent;
    color: #e2e8f0;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    text-align: left;
    transition: background 0.2s ease;
  }

  .export-menu button:hover {
    background: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
  }

  .scenarios-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .scenario-card {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%);
    border: 1px solid #334155;
    border-radius: 0.75rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
  }

  .scenario-card:hover {
    border-color: #475569;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  }

  .scenario-header {
    padding: 1.5rem;
    border-bottom: 2px solid;
  }

  .scenario-header.conservative {
    border-bottom-color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
  }

  .scenario-header.expected {
    border-bottom-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.05);
  }

  .scenario-header.aggressive {
    border-bottom-color: #ef4444;
    background: rgba(239, 68, 68, 0.05);
  }

  .scenario-header h3 {
    margin: 0 0 0.5rem 0;
    color: #f1f5f9;
    font-size: 1.25rem;
  }

  .scenario-header .allocation {
    margin: 0;
    color: #94a3b8;
    font-size: 0.85rem;
  }

  .scenario-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
  }

  .metric {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #334155;
  }

  .metric:last-of-type {
    border-bottom: none;
    padding-bottom: 0;
  }

  .metric .label {
    color: #94a3b8;
    font-size: 0.9rem;
  }

  .metric .value {
    color: #e2e8f0;
    font-weight: 600;
    font-size: 1rem;
  }

  .metric .value.warning {
    color: #f59e0b;
  }

  .metric .value.success-prob {
    color: #10b981;
    font-weight: 700;
    font-size: 1.1rem;
  }

  .success-bar {
    height: 8px;
    background: rgba(15, 23, 42, 0.5);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .success-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 2px solid #334155;
  }

  .status-label {
    color: #94a3b8;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .status-badge {
    padding: 0.4rem 0.8rem;
    border-radius: 0.35rem;
    color: white;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .interpretation {
    background: rgba(30, 41, 59, 0.4);
    border: 1px solid #334155;
    border-radius: 0.75rem;
    padding: 1.5rem;
  }

  .interpretation h3 {
    margin: 0 0 1rem 0;
    color: #93c5fd;
    font-size: 1.1rem;
  }

  .interpretation ul {
    margin: 0;
    padding-left: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .interpretation li {
    color: #cbd5e1;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .interpretation strong {
    color: #f1f5f9;
  }
</style>
