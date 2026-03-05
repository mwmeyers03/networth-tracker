<script>
  import { globals, michaelExpenses, briannaExpenses, retirementExpenses, specialEvents, salaryAdjustments, formatLabel, calculateSocialSecurity } from '$lib/stores/fireStore.js';

  let expanded = {
    macro: true,
    allocation: true,
    returns: true,
    starting: true,
    salary: true,
    contributions: true,
    expenses: true,
    retirement: true,
    events: true,
    salaryOverride: true,
    taxes: true,
    socialSecurity: true
  };

  let expenseView = 'combined'; // 'michael', 'brianna', 'combined'
  let startingView = 'combined';
  let salaryView = 'combined';
  let contributionsView = 'combined';
  let retirementView = 'combined';
  let socialSecurityView = 'combined';
  let salaryOverrideView = 'combined';
  let michaelNewCategory = '';
  let briannaNewCategory = '';
  let michaelYearsWorked = $globals.michaelYearsWorked || 24;
  let briannaYearsWorked = $globals.briannaYearsWorked || 24;
  
  function resetToDefaults() {
    if (confirm('Are you sure you want to reset all parameters to default values? This will clear your localStorage.')) {
      localStorage.clear();
      location.reload();
    }
  }
  
  // Local state for typing in allocation fields
  let stockAllocInput = '';
  let bondAllocInput = '';
  let cashAllocInput = '';
  
  // Special events form
  let newEvent = { year: 2025, type: 'house', description: '', amount: 0 };
  
  // Salary adjustment form
  let newAdjustment = { year: 2025, michaelSalary: $globals.michaelStartSalary, briannaSalary: $globals.briannaStartSalary };

  $: {
    if (!stockAllocInput && !bondAllocInput && !cashAllocInput) {
      stockAllocInput = ($globals.stockAllocation * 100).toFixed(0);
      bondAllocInput = ($globals.bondAllocation * 100).toFixed(0);
      cashAllocInput = ($globals.cashAllocation * 100).toFixed(0);
    }
  }

  $: allocationTotal = parseNum(stockAllocInput) + parseNum(bondAllocInput) + parseNum(cashAllocInput);

  const addEvent = () => {
    if (newEvent.description && newEvent.amount > 0) {
      const id = Date.now();
      specialEvents.update(events => [...events, { ...newEvent, id }]);
      newEvent = { year: 2025, type: 'house', description: '', amount: 0 };
    }
  };

  const removeEvent = (id) => {
    specialEvents.update(events => events.filter(e => e.id !== id));
  };

  const addSalaryAdjustment = () => {
    salaryAdjustments.update(adj => ({
      ...adj,
      [newAdjustment.year]: {
        michaelSalary: newAdjustment.michaelSalary,
        briannaSalary: newAdjustment.briannaSalary
      }
    }));
  };

  const removeSalaryAdjustment = (year) => {
    salaryAdjustments.update(adj => {
      const newAdj = { ...adj };
      delete newAdj[year];
      return newAdj;
    });
  };

  const toggle = (section) => {
    expanded = { ...expanded, [section]: !expanded[section] };
  };

  const parseNum = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  /** @param {string} view @param {string} person */
  const showPerson = (view, person) => view === person || view === 'combined';

  const toKey = (label) => {
    const cleaned = label.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
    if (!cleaned) return '';
    const parts = cleaned.split(/\s+/);
    return parts
      .map((word, index) => {
        const lower = word.toLowerCase();
        return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join('');
  };

  const addCategory = (person) => {
    if (person === 'michael') {
      const key = toKey(michaelNewCategory);
      if (!key || $michaelExpenses[key] !== undefined) return;
      michaelExpenses.update(exp => ({ ...exp, [key]: 0 }));
      michaelNewCategory = '';
      return;
    }
    const key = toKey(briannaNewCategory);
    if (!key || $briannaExpenses[key] !== undefined) return;
    briannaExpenses.update(exp => ({ ...exp, [key]: 0 }));
    briannaNewCategory = '';
  };

  const calculateMichaelSS = () => {
    globals.update(g => ({ ...g, michaelYearsWorked: michaelYearsWorked }));
  };

  const calculateBriannaSS = () => {
    globals.update(g => ({ ...g, briannaYearsWorked: briannaYearsWorked }));
  };

  $: monthlyMichael = Object.values($michaelExpenses).reduce((a, b) => a + b, 0);
  $: monthlyBrianna = Object.values($briannaExpenses).reduce((a, b) => a + b, 0);
  
  // Combined expenses: sum each category across both people
  $: combinedExpenses = (() => {
    const combined = {};
    // Get all unique keys from both objects
    const allKeys = new Set([...Object.keys($michaelExpenses), ...Object.keys($briannaExpenses)]);
    
    for (const key of allKeys) {
      combined[key] = ($michaelExpenses[key] || 0) + ($briannaExpenses[key] || 0);
    }
    
    return combined;
  })();
</script>

<section class="controls-shell">
  <div class="controls-header">
    <h2>Parameters</h2>
    <button class="reset-btn" on:click={resetToDefaults}>Reset to Defaults</button>
  </div>
  <div class="controls-grid">
    <article class="control-card expenses-card">
      <button class="section-head" on:click={() => toggle('macro')}>
        <span>Macro Environment</span>
        <span>{expanded.macro ? '▴' : '▾'}</span>
      </button>
      {#if expanded.macro}
        <div class="section-body">
          <label>Stock Return (%)
            <input value={($globals.stockReturn * 100).toFixed(1)} on:input={(e) => globals.update(g => ({ ...g, stockReturn: parseNum(e.currentTarget.value) / 100 }))} />
          </label>
          <label>Stock Volatility (%)
            <input value={($globals.stockVolatility * 100).toFixed(1)} on:input={(e) => globals.update(g => ({ ...g, stockVolatility: parseNum(e.currentTarget.value) / 100 }))} />
          </label>
          <label>Bond Return (%)
            <input value={($globals.bondReturn * 100).toFixed(1)} on:input={(e) => globals.update(g => ({ ...g, bondReturn: parseNum(e.currentTarget.value) / 100 }))} />
          </label>
          <label>Bond Volatility (%)
            <input value={($globals.bondVolatility * 100).toFixed(1)} on:input={(e) => globals.update(g => ({ ...g, bondVolatility: parseNum(e.currentTarget.value) / 100 }))} />
          </label>
          <label>Cash Return (%)
            <input value={($globals.cashReturn * 100).toFixed(1)} on:input={(e) => globals.update(g => ({ ...g, cashReturn: parseNum(e.currentTarget.value) / 100 }))} />
          </label>
          <label>Inflation Rate (%)
            <input value={($globals.inflationRate * 100).toFixed(1)} on:input={(e) => globals.update(g => ({ ...g, inflationRate: parseNum(e.currentTarget.value) / 100 }))} />
          </label>
          <label>Stock Allocation (%)
            <input value={Math.round($globals.stockAllocation * 100)} on:input={(e) => {
              const stock = parseNum(e.currentTarget.value) / 100;
              const cash = Math.max(0, Math.min($globals.cashAllocation, 1 - stock));
              const bond = 1 - stock - cash;
              globals.update(g => ({ ...g, stockAllocation: stock, bondAllocation: Math.max(0, bond), cashAllocation: cash }));
            }} />
          </label>
          <label>Bond Allocation (%)
            <input value={Math.round($globals.bondAllocation * 100)} on:input={(e) => {
              const bond = parseNum(e.currentTarget.value) / 100;
              const cash = Math.max(0, Math.min($globals.cashAllocation, 1 - bond));
              const stock = 1 - bond - cash;
              globals.update(g => ({ ...g, bondAllocation: bond, stockAllocation: Math.max(0, stock), cashAllocation: cash }));
            }} />
          </label>
          <label>Cash Allocation (%)
            <input value={Math.round($globals.cashAllocation * 100)} on:input={(e) => {
              const cash = parseNum(e.currentTarget.value) / 100;
              const stock = $globals.stockAllocation;
              const bond = 1 - stock - cash;
              globals.update(g => ({ ...g, cashAllocation: Math.max(0, cash), bondAllocation: Math.max(0, bond) }));
            }} />
          </label>
          <div class="total">Total Allocation: {Math.round(($globals.stockAllocation + $globals.bondAllocation + $globals.cashAllocation) * 100)}%</div>
        </div>
      {/if}
    </article>

    <article class="control-card">
      <button class="section-head" on:click={() => toggle('starting')}>
        <span>Starting Balances</span>
        <span>{expanded.starting ? '▴' : '▾'}</span>
      </button>
      {#if expanded.starting}
        <div class="section-body">
          <div class="expense-toggle">
            <button class:active={startingView === 'michael'} on:click={() => startingView = 'michael'}>Michael</button>
            <button class:active={startingView === 'brianna'} on:click={() => startingView = 'brianna'}>Brianna</button>
            <button class:active={startingView === 'combined'} on:click={() => startingView = 'combined'}>Combined</button>
          </div>

          {#if showPerson(startingView, 'michael')}
            <h4>Michael's Accounts</h4>
            <label>401k ($)
              <input type="number" value={$globals.michael401kStart} on:input={(e) => globals.update(g => ({ ...g, michael401kStart: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Roth IRA ($)
              <input type="number" value={$globals.michaelRothStart} on:input={(e) => globals.update(g => ({ ...g, michaelRothStart: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Brokerage ($)
              <input type="number" value={$globals.michaelBrokerageStart} on:input={(e) => globals.update(g => ({ ...g, michaelBrokerageStart: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Savings ($)
              <input type="number" value={$globals.michaelSavingsStart} on:input={(e) => globals.update(g => ({ ...g, michaelSavingsStart: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>HSA ($)
              <input type="number" value={$globals.michaelHsaStart || 0} on:input={(e) => globals.update(g => ({ ...g, michaelHsaStart: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>529 ($)
              <input type="number" value={$globals.michael529Start || 0} on:input={(e) => globals.update(g => ({ ...g, michael529Start: parseNum(e.currentTarget.value) }))} />
            </label>
            <div class="total">Michael Total: ${($globals.michael401kStart + $globals.michaelRothStart + $globals.michaelBrokerageStart + $globals.michaelSavingsStart + ($globals.michaelHsaStart || 0) + ($globals.michael529Start || 0)).toLocaleString()}</div>
          {/if}

          {#if showPerson(startingView, 'brianna')}
            <h4>Brianna's Accounts</h4>
            <label>401k ($)
              <input type="number" value={$globals.brianna401kStart} on:input={(e) => globals.update(g => ({ ...g, brianna401kStart: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Roth IRA ($)
              <input type="number" value={$globals.briannaRothStart} on:input={(e) => globals.update(g => ({ ...g, briannaRothStart: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Brokerage ($)
              <input type="number" value={$globals.briannaBrokerageStart} on:input={(e) => globals.update(g => ({ ...g, briannaBrokerageStart: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Savings ($)
              <input type="number" value={$globals.briannaSavingsStart} on:input={(e) => globals.update(g => ({ ...g, briannaSavingsStart: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>HSA ($)
              <input type="number" value={$globals.briannaHsaStart || 0} on:input={(e) => globals.update(g => ({ ...g, briannaHsaStart: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>529 ($)
              <input type="number" value={$globals.brianna529Start || 0} on:input={(e) => globals.update(g => ({ ...g, brianna529Start: parseNum(e.currentTarget.value) }))} />
            </label>
            <div class="total">Brianna Total: ${($globals.brianna401kStart + $globals.briannaRothStart + $globals.briannaBrokerageStart + $globals.briannaSavingsStart + ($globals.briannaHsaStart || 0) + ($globals.brianna529Start || 0)).toLocaleString()}</div>
          {/if}

          <div class="total">Combined Net Worth: ${($globals.michael401kStart + $globals.brianna401kStart + $globals.michaelRothStart + $globals.briannaRothStart + $globals.michaelBrokerageStart + $globals.briannaBrokerageStart + $globals.michaelSavingsStart + $globals.briannaSavingsStart + ($globals.michaelHsaStart || 0) + ($globals.briannaHsaStart || 0) + ($globals.michael529Start || 0) + ($globals.brianna529Start || 0)).toLocaleString()}</div>
        </div>
      {/if}
    </article>

    <article class="control-card">
      <button class="section-head" on:click={() => toggle('salary')}>
        <span>Salaries & Growth</span>
        <span>{expanded.salary ? '▴' : '▾'}</span>
      </button>
      {#if expanded.salary}
        <div class="section-body">
          <div class="expense-toggle">
            <button class:active={salaryView === 'michael'} on:click={() => salaryView = 'michael'}>Michael</button>
            <button class:active={salaryView === 'brianna'} on:click={() => salaryView = 'brianna'}>Brianna</button>
            <button class:active={salaryView === 'combined'} on:click={() => salaryView = 'combined'}>Combined</button>
          </div>

          {#if showPerson(salaryView, 'michael')}
            <label>Michael Starting Salary ($)
              <input value={$globals.michaelStartSalary} on:input={(e) => globals.update(g => ({ ...g, michaelStartSalary: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Michael Annual Growth (%)
              <input value={Math.round($globals.michaelSalaryGrowth * 100)} on:input={(e) => globals.update(g => ({ ...g, michaelSalaryGrowth: parseNum(e.currentTarget.value) / 100 }))} />
            </label>
          {/if}

          {#if showPerson(salaryView, 'brianna')}
            <label>Brianna Starting Salary ($)
              <input value={$globals.briannaStartSalary} on:input={(e) => globals.update(g => ({ ...g, briannaStartSalary: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Brianna Annual Growth (%)
              <input value={Math.round($globals.briannaSalaryGrowth * 100)} on:input={(e) => globals.update(g => ({ ...g, briannaSalaryGrowth: parseNum(e.currentTarget.value) / 100 }))} />
            </label>
          {/if}

          <div class="summary-box">
            <span class="summary-label">Combined Starting Salary</span>
            <span class="summary-value">${($globals.michaelStartSalary + $globals.briannaStartSalary).toLocaleString()}/yr</span>
          </div>
        </div>
      {/if}
    </article>

    <article class="control-card">
      <button class="section-head" on:click={() => toggle('contributions')}>
        <span>Core Contributions</span>
        <span>{expanded.contributions ? '▴' : '▾'}</span>
      </button>
      {#if expanded.contributions}
        <div class="section-body">
          <div class="expense-toggle">
            <button class:active={contributionsView === 'michael'} on:click={() => contributionsView = 'michael'}>Michael</button>
            <button class:active={contributionsView === 'brianna'} on:click={() => contributionsView = 'brianna'}>Brianna</button>
            <button class:active={contributionsView === 'combined'} on:click={() => contributionsView = 'combined'}>Combined</button>
          </div>

          {#if showPerson(contributionsView, 'michael')}
            <label>Michael 401K Rate (%)
              <input value={Math.round($globals.michael401kRate * 100)} on:input={(e) => globals.update(g => ({ ...g, michael401kRate: parseNum(e.currentTarget.value) / 100 }))} />
            </label>
            <label>Michael 401K Match (%)
              <input value={Math.round($globals.michael401kMatch * 100)} on:input={(e) => globals.update(g => ({ ...g, michael401kMatch: parseNum(e.currentTarget.value) / 100 }))} />
            </label>
            <label>Michael Roth IRA Yearly ($)
              <input value={$globals.michaelRothYearlyContrib} on:input={(e) => globals.update(g => ({ ...g, michaelRothYearlyContrib: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Michael Brokerage Yearly ($)
              <input value={$globals.michaelBrokerageYearlyContrib} on:input={(e) => globals.update(g => ({ ...g, michaelBrokerageYearlyContrib: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Michael HSA Yearly ($)
              <input value={$globals.michaelHsaYearlyContrib || 0} on:input={(e) => globals.update(g => ({ ...g, michaelHsaYearlyContrib: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Michael 529 Yearly ($)
              <input value={$globals.michael529YearlyContrib || 0} on:input={(e) => globals.update(g => ({ ...g, michael529YearlyContrib: parseNum(e.currentTarget.value) }))} />
            </label>
          {/if}

          {#if showPerson(contributionsView, 'brianna')}
            <label>Brianna 401K Rate (%)
              <input value={Math.round($globals.brianna401kRate * 100)} on:input={(e) => globals.update(g => ({ ...g, brianna401kRate: parseNum(e.currentTarget.value) / 100 }))} />
            </label>
            <label>Brianna 401K Match (%)
              <input value={Math.round($globals.brianna401kMatch * 100)} on:input={(e) => globals.update(g => ({ ...g, brianna401kMatch: parseNum(e.currentTarget.value) / 100 }))} />
            </label>
            <label>Brianna Roth IRA Yearly ($)
              <input value={$globals.briannaRothYearlyContrib} on:input={(e) => globals.update(g => ({ ...g, briannaRothYearlyContrib: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Brianna Brokerage Yearly ($)
              <input value={$globals.briannaBrokerageYearlyContrib} on:input={(e) => globals.update(g => ({ ...g, briannaBrokerageYearlyContrib: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Brianna HSA Yearly ($)
              <input value={$globals.briannaHsaYearlyContrib || 0} on:input={(e) => globals.update(g => ({ ...g, briannaHsaYearlyContrib: parseNum(e.currentTarget.value) }))} />
            </label>
            <label>Brianna 529 Yearly ($)
              <input value={$globals.brianna529YearlyContrib || 0} on:input={(e) => globals.update(g => ({ ...g, brianna529YearlyContrib: parseNum(e.currentTarget.value) }))} />
            </label>
          {/if}

          <label>Healthcare Spend from HSA ($/yr)
            <input value={$globals.healthcareAnnual || 0} on:input={(e) => globals.update(g => ({ ...g, healthcareAnnual: parseNum(e.currentTarget.value) }))} />
          </label>
          <label>Education Spend from 529 ($/yr)
            <input value={$globals.educationAnnual || 0} on:input={(e) => globals.update(g => ({ ...g, educationAnnual: parseNum(e.currentTarget.value) }))} />
          </label>
          <div class="summary-box">
            <span class="summary-label">Combined Annual Contributions</span>
            <span class="summary-value">${(($globals.michaelRothYearlyContrib || 0) + ($globals.briannaRothYearlyContrib || 0) + ($globals.michaelBrokerageYearlyContrib || 0) + ($globals.briannaBrokerageYearlyContrib || 0) + ($globals.michaelHsaYearlyContrib || 0) + ($globals.briannaHsaYearlyContrib || 0) + ($globals.michael529YearlyContrib || 0) + ($globals.brianna529YearlyContrib || 0)).toLocaleString()}/yr</span>
          </div>
        </div>
      {/if}
    </article>

    <article class="control-card">
      <button class="section-head" on:click={() => toggle('expenses')}>
        <span>Monthly Expenses</span>
        <span>{expanded.expenses ? '▴' : '▾'}</span>
      </button>
      {#if expanded.expenses}
        <div class="section-body">
          <div class="expense-toggle">
            <button class:active={expenseView === 'michael'} on:click={() => expenseView = 'michael'}>Michael</button>
            <button class:active={expenseView === 'brianna'} on:click={() => expenseView = 'brianna'}>Brianna</button>
            <button class:active={expenseView === 'combined'} on:click={() => expenseView = 'combined'}>Combined</button>
          </div>
          
          {#if expenseView === 'michael'}
            <h4>Michael Monthly Expenses</h4>
            {#each Object.entries($michaelExpenses) as [key, value]}
              <label>{formatLabel(key)}
                <input {value} on:input={(e) => michaelExpenses.update(exp => ({ ...exp, [key]: parseNum(e.currentTarget.value) }))} />
              </label>
            {/each}
            <div class="add-row">
              <input placeholder="Add category" bind:value={michaelNewCategory} />
              <button on:click={() => addCategory('michael')}>Add</button>
            </div>
            <div class="total">Michael Total: ${monthlyMichael.toFixed(0)}</div>
          {/if}

          {#if expenseView === 'brianna'}
            <h4>Brianna Monthly Expenses</h4>
            {#each Object.entries($briannaExpenses) as [key, value]}
              <label>{formatLabel(key)}
                <input {value} on:input={(e) => briannaExpenses.update(exp => ({ ...exp, [key]: parseNum(e.currentTarget.value) }))} />
              </label>
            {/each}
            <div class="add-row">
              <input placeholder="Add category" bind:value={briannaNewCategory} />
              <button class="purple" on:click={() => addCategory('brianna')}>Add</button>
            </div>
            <div class="total">Brianna Total: ${monthlyBrianna.toFixed(0)}</div>
          {/if}

          {#if expenseView === 'combined'}
            <h4>Combined Monthly Expenses (Itemized Sums)</h4>
            {#each Object.entries(combinedExpenses) as [key, value]}
              <div class="expense-line">{formatLabel(key)}
                <span class="combined-value">${value.toFixed(0)}</span>
              </div>
            {/each}
            <div class="summary-box">
              <span class="summary-label">Combined Monthly Total</span>
              <span class="summary-value">${(monthlyMichael + monthlyBrianna).toFixed(0)}/month</span>
            </div>
            <div class="summary-box">
              <span class="summary-label">Annual Expenses</span>
              <span class="summary-value">${((monthlyMichael + monthlyBrianna) * 12).toLocaleString()}/year</span>
            </div>
          {/if}
        </div>
      {/if}
    </article>

    <article class="control-card">
      <button class="section-head" on:click={() => toggle('retirement')}>
        <span>FIRE / Retirement</span>
        <span>{expanded.retirement ? '▴' : '▾'}</span>
      </button>
      {#if expanded.retirement}
        <div class="section-body">
          <div class="expense-toggle">
            <button class:active={retirementView === 'michael'} on:click={() => retirementView = 'michael'}>Michael</button>
            <button class:active={retirementView === 'brianna'} on:click={() => retirementView = 'brianna'}>Brianna</button>
            <button class:active={retirementView === 'combined'} on:click={() => retirementView = 'combined'}>Combined</button>
          </div>

          {#if showPerson(retirementView, 'michael')}
            <label>Michael Retirement Age
              <input value={$globals.michaelRetirementAge} on:input={(e) => globals.update(g => ({ ...g, michaelRetirementAge: parseNum(e.currentTarget.value) }))} />
            </label>
          {/if}
          {#if showPerson(retirementView, 'brianna')}
            <label>Brianna Retirement Age
              <input value={$globals.briannaRetirementAge} on:input={(e) => globals.update(g => ({ ...g, briannaRetirementAge: parseNum(e.currentTarget.value) }))} />
            </label>
          {/if}
          <div class="summary-box">
            <span class="summary-label">Joint Retirement Trigger Age</span>
            <span class="summary-value">{Math.max($globals.michaelRetirementAge, $globals.briannaRetirementAge)}</span>
          </div>
          <label>Life Expectancy
            <input value={$globals.lifeExpectancy} on:input={(e) => globals.update(g => ({ ...g, lifeExpectancy: parseNum(e.currentTarget.value) }))} />
          </label>
          <label>Withdrawal Method
            <select value={$globals.withdrawalMethod} on:change={(e) => globals.update(g => ({ ...g, withdrawalMethod: e.currentTarget.value }))}>
              <option value="portfolioPercent">Portfolio % (% of current balance)</option>
              <option value="constantDollar">Constant Dollar (fixed amount)</option>
              <option value="oneOverN">One-Over-N (balance / remaining years)</option>
              <option value="endowment">Endowment (5% current balance + inflation)</option>
              <option value="maximize">Maximize (spend all available)</option>
            </select>
          </label>
          {#if $globals.withdrawalMethod === 'portfolioPercent'}
            <label>Withdrawal Rate (%)
              <input value={Math.round($globals.portfolioPercentRate * 100)} on:input={(e) => globals.update(g => ({ ...g, portfolioPercentRate: parseNum(e.currentTarget.value) / 100 }))} />
            </label>
          {:else if $globals.withdrawalMethod === 'constantDollar'}
            <label>Annual Withdrawal Amount ($)
              <input value={$globals.constantDollarAmount} on:input={(e) => globals.update(g => ({ ...g, constantDollarAmount: parseNum(e.currentTarget.value) }))} />
            </label>
          {/if}

          <h4>Early-Retirement Strategies</h4>
          <label class="toggle-row">
            <span>SEPP / 72(t) Distributions</span>
            <input type="checkbox" checked={$globals.enableSEPP} on:change={(e) => globals.update(g => ({ ...g, enableSEPP: e.currentTarget.checked }))} />
          </label>
          {#if $globals.enableSEPP}
            <label>Safe-Harbor Rate (%)
              <input value={($globals.seppRate * 100).toFixed(1)} on:input={(e) => globals.update(g => ({ ...g, seppRate: parseNum(e.currentTarget.value) / 100 }))} />
            </label>
            <div class="strategy-note">Penalty-free 401k withdrawals between retirement &amp; age 59.5 using IRS amortisation method.</div>
          {/if}
          <label class="toggle-row">
            <span>Roth Conversion Ladder</span>
            <input type="checkbox" checked={$globals.enableRothLadder} on:change={(e) => globals.update(g => ({ ...g, enableRothLadder: e.currentTarget.checked }))} />
          </label>
          {#if $globals.enableRothLadder}
            <label>Annual Conversion ($, 0 = auto)
              <input value={$globals.rothLadderAmount} on:input={(e) => globals.update(g => ({ ...g, rothLadderAmount: parseNum(e.currentTarget.value) }))} />
            </label>
            <div class="strategy-note">Converts 401k funds to Roth each year. Funds become penalty-free after a 5-year seasoning period.</div>
          {/if}
        </div>
      {/if}
    </article>

    <article class="control-card">
      <button class="section-head" on:click={() => toggle('taxes')}>
        <span>Taxes & Penalties</span>
        <span>{expanded.taxes ? '▴' : '▾'}</span>
      </button>
      {#if expanded.taxes}
        <div class="section-body">
          <label>State
            <select value={$globals.state} on:change={(e) => globals.update(g => ({ ...g, state: e.currentTarget.value }))}>
              <option value="AL">Alabama (0%)</option>
              <option value="AK">Alaska (0%)</option>
              <option value="AZ">Arizona (4.75%)</option>
              <option value="AR">Arkansas (6.5%)</option>
              <option value="CA">California (9.3%)</option>
              <option value="CO">Colorado (4.85%)</option>
              <option value="CT">Connecticut (6.99%)</option>
              <option value="DE">Delaware (6.6%)</option>
              <option value="FL">Florida (0%)</option>
              <option value="GA">Georgia (5.5%)</option>
              <option value="HI">Hawaii (8.8%)</option>
              <option value="ID">Idaho (5.85%)</option>
              <option value="IL">Illinois (4.95%)</option>
              <option value="IN">Indiana (3.65%)</option>
              <option value="IA">Iowa (8.98%)</option>
              <option value="KS">Kansas (5.7%)</option>
              <option value="KY">Kentucky (6.5%)</option>
              <option value="LA">Louisiana (6%)</option>
              <option value="ME">Maine (8.75%)</option>
              <option value="MD">Maryland (8.75%)</option>
              <option value="MA">Massachusetts (5.05%)</option>
              <option value="MI">Michigan (4.6%)</option>
              <option value="MN">Minnesota (9.85%)</option>
              <option value="MS">Mississippi (5%)</option>
              <option value="MO">Missouri (6.5%)</option>
              <option value="MT">Montana (10%)</option>
              <option value="NE">Nebraska (6.84%)</option>
              <option value="NV">Nevada (0%)</option>
              <option value="NH">New Hampshire (0%)</option>
              <option value="NJ">New Jersey (8.85%)</option>
              <option value="NM">New Mexico (7.7%)</option>
              <option value="NY">New York (8.85%)</option>
              <option value="NC">North Carolina (4.25%)</option>
              <option value="ND">North Dakota (2.9%)</option>
              <option value="OH">Ohio (5.75%)</option>
              <option value="OK">Oklahoma (6.5%)</option>
              <option value="OR">Oregon (9.95%)</option>
              <option value="PA">Pennsylvania (3.07%)</option>
              <option value="RI">Rhode Island (6.375%)</option>
              <option value="SC">South Carolina (7%)</option>
              <option value="SD">South Dakota (0%)</option>
              <option value="TN">Tennessee (0%)</option>
              <option value="TX">Texas (0%)</option>
              <option value="UT">Utah (4.85%)</option>
              <option value="VT">Vermont (8.75%)</option>
              <option value="VA">Virginia (7.75%)</option>
              <option value="WA">Washington (0%)</option>
              <option value="WV">West Virginia (6.5%)</option>
              <option value="WI">Wisconsin (9.93%)</option>
              <option value="WY">Wyoming (0%)</option>
            </select>
            <div class="state-info">State Tax Rate: {($globals.stateTaxRates[$globals.state] * 100).toFixed(2)}%</div>
          </label>
          <label>Capital Gains Tax Rate (%)
            <input type="number" value={Math.round($globals.capitalGainsTaxRate * 100)} on:input={(e) => globals.update(g => ({ ...g, capitalGainsTaxRate: parseNum(e.currentTarget.value) / 100 }))} />
          </label>
          <label>401k Early Withdrawal Penalty (%)
            <input type="number" value={Math.round($globals.earlyWithdrawalPenalty * 100)} on:input={(e) => globals.update(g => ({ ...g, earlyWithdrawalPenalty: parseNum(e.currentTarget.value) / 100 }))} />
          </label>
        </div>
      {/if}
    </article>

    <article class="control-card">
      <button class="section-head" on:click={() => toggle('socialSecurity')}>
        <span>Social Security</span>
        <span>{expanded.socialSecurity ? '▴' : '▾'}</span>
      </button>
      {#if expanded.socialSecurity}
        <div class="section-body">
          <div class="expense-toggle">
            <button class:active={socialSecurityView === 'michael'} on:click={() => socialSecurityView = 'michael'}>Michael</button>
            <button class:active={socialSecurityView === 'brianna'} on:click={() => socialSecurityView = 'brianna'}>Brianna</button>
            <button class:active={socialSecurityView === 'combined'} on:click={() => socialSecurityView = 'combined'}>Combined</button>
          </div>

          {#if showPerson(socialSecurityView, 'michael')}
            <h4>Michael</h4>
            <label>Years Worked (for SS calculation)
              <input type="number" bind:value={michaelYearsWorked} on:change={() => globals.update(g => ({ ...g, michaelYearsWorked: michaelYearsWorked }))} />
            </label>

            <label>Claiming Age
              <input type="number" bind:value={$globals.michaelSocialSecurityAge} />
            </label>
            <div class="ss-calc">
              <strong>Estimated Annual Benefit:</strong> ${calculateSocialSecurity($globals.michaelStartSalary, $globals.michaelSalaryGrowth, michaelYearsWorked, $globals.michaelSocialSecurityAge).toLocaleString()}
            </div>
            <div class="ss-note">Based on: ${($globals.michaelStartSalary).toLocaleString()}/yr starting, {($globals.michaelSalaryGrowth * 100).toFixed(1)}% growth, {michaelYearsWorked} years worked</div>
          {/if}

          {#if showPerson(socialSecurityView, 'brianna')}
            <h4>Brianna</h4>
            <label>Years Worked (for SS calculation)
              <input type="number" bind:value={briannaYearsWorked} on:change={() => globals.update(g => ({ ...g, briannaYearsWorked: briannaYearsWorked }))} />
            </label>

            <label>Claiming Age
              <input type="number" bind:value={$globals.briannaSocialSecurityAge} />
            </label>
            <div class="ss-calc">
              <strong>Estimated Annual Benefit:</strong> ${calculateSocialSecurity($globals.briannaStartSalary, $globals.briannaSalaryGrowth, briannaYearsWorked, $globals.briannaSocialSecurityAge).toLocaleString()}
            </div>
            <div class="ss-note">Based on: ${($globals.briannaStartSalary).toLocaleString()}/yr starting, {($globals.briannaSalaryGrowth * 100).toFixed(1)}% growth, {briannaYearsWorked} years worked</div>
          {/if}

          <div class="summary-box">
            <span class="summary-label">Combined SS Benefit (Annual)</span>
            <span class="summary-value">${(calculateSocialSecurity($globals.michaelStartSalary, $globals.michaelSalaryGrowth, michaelYearsWorked, $globals.michaelSocialSecurityAge) + calculateSocialSecurity($globals.briannaStartSalary, $globals.briannaSalaryGrowth, briannaYearsWorked, $globals.briannaSocialSecurityAge)).toLocaleString()}</span>
          </div>
        </div>
      {/if}
    </article>

    <article class="control-card">
      <button class="section-head" on:click={() => toggle('events')}>
        <span>Special Events (House, Car, etc)</span>
        <span>{expanded.events ? '▴' : '▾'}</span>
      </button>
      {#if expanded.events}
        <div class="section-body">
          <div class="event-form">
            <label>Year
              <input type="number" bind:value={newEvent.year} />
            </label>
            <label>Type
              <select bind:value={newEvent.type}>
                <option value="house">House Purchase</option>
                <option value="car">Car Purchase</option>
                <option value="wedding">Wedding</option>
                <option value="child">Child Expenses</option>
                <option value="education">Education</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>Description
              <input bind:value={newEvent.description} placeholder="e.g., Down payment" />
            </label>
            <label>Amount ($)
              <input type="number" bind:value={newEvent.amount} />
            </label>
            <button on:click={addEvent}>Add Event</button>
          </div>
          
          {#if $specialEvents.length > 0}
            <div class="events-list">
              <h4>Scheduled Events</h4>
              {#each $specialEvents as event}
                <div class="event-item">
                  <div class="event-details">
                    <strong>{event.year}:</strong> {event.description || event.type}
                    <span class="event-amount">${event.amount.toLocaleString()}</span>
                  </div>
                  <button class="remove-btn" on:click={() => removeEvent(event.id)}>×</button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </article>

    <article class="control-card">
      <button class="section-head" on:click={() => toggle('salaryOverride')}>
        <span>Salary Adjustments (Maternity, etc)</span>
        <span>{expanded.salaryOverride ? '▴' : '▾'}</span>
      </button>
      {#if expanded.salaryOverride}
        <div class="section-body">
          <p class="section-note">Override salaries for specific years (e.g., for maternity leave, sabbatical)</p>
          <div class="event-form">
            <div class="expense-toggle">
              <button class:active={salaryOverrideView === 'michael'} on:click={() => salaryOverrideView = 'michael'}>Michael</button>
              <button class:active={salaryOverrideView === 'brianna'} on:click={() => salaryOverrideView = 'brianna'}>Brianna</button>
              <button class:active={salaryOverrideView === 'combined'} on:click={() => salaryOverrideView = 'combined'}>Combined</button>
            </div>
            <label>Year
              <input type="number" bind:value={newAdjustment.year} />
            </label>
            {#if showPerson(salaryOverrideView, 'michael')}
              <label>Michael Salary ($)
                <input type="number" bind:value={newAdjustment.michaelSalary} />
              </label>
            {/if}
            {#if showPerson(salaryOverrideView, 'brianna')}
              <label>Brianna Salary ($)
                <input type="number" bind:value={newAdjustment.briannaSalary} />
              </label>
            {/if}
            <button on:click={addSalaryAdjustment}>Add Adjustment</button>
          </div>
          
          {#if Object.keys($salaryAdjustments).length > 0}
            <div class="events-list">
              <h4>Salary Overrides</h4>
              {#each Object.entries($salaryAdjustments) as [year, adj]}
                <div class="event-item">
                  <div class="event-details">
                    <strong>{year}:</strong> M: ${adj.michaelSalary.toLocaleString()} | B: ${adj.briannaSalary.toLocaleString()}
                  </div>
                  <button class="remove-btn" on:click={() => removeSalaryAdjustment(year)}>×</button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </article>
  </div>
</section>

<style>
  .controls-shell {
    padding: 0.8rem 1rem;
    border-bottom: 1px solid #1f2937;
    background: radial-gradient(circle at 20% 20%, rgba(30, 41, 59, 0.35), transparent 45%),
                radial-gradient(circle at 80% 0%, rgba(15, 118, 110, 0.12), transparent 40%),
                #0b1220;
  }

  .controls-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.9rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid #334155;
  }

  .controls-header h2 {
    margin: 0;
    color: #f1f5f9;
    font-size: 1.2rem;
    font-weight: 700;
  }

  .reset-btn {
    border: 1px solid #dc2626;
    background: rgba(220, 38, 38, 0.1);
    color: #fca5a5;
    padding: 0.4rem 0.8rem;
    border-radius: 0.35rem;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .reset-btn:hover {
    background: rgba(220, 38, 38, 0.2);
    color: #fecaca;
  }

  .controls-grid {
    display: grid;
    gap: 0.7rem;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }

  /* Constrain only expenses section height */
  .control-card.expenses-card .section-body {
    max-height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .control-card.expenses-card label {
    gap: 0.2rem;
    margin-bottom: 0.2rem;
  }

  .control-card {
    border: 1px solid #1f2937;
    border-radius: 0.75rem;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(11, 17, 31, 0.95));
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }

  .section-head {
    width: 100%;
    border: 0;
    color: #e2e8f0;
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
    display: flex;
    justify-content: space-between;
    padding: 0.65rem 0.85rem;
    font-weight: 650;
    cursor: pointer;
    font-size: 0.85rem;
    letter-spacing: 0.01em;
  }

  .section-body {
    padding: 0.6rem;
    display: grid;
    gap: 0.5rem;
  }

  label {
    font-size: 0.7rem;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: grid;
    gap: 0.25rem;
  }

  input {
    width: 100%;
    border: 1px solid #24303f;
    border-radius: 0.45rem;
    padding: 0.5rem;
    background: #0c1627;
    color: #f8fafc;
    font-size: 0.82rem;
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  input:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  }

  h4 {
    margin: 0.4rem 0 0.1rem;
    color: #93c5fd;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .add-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.3rem;
    margin-top: 0.2rem;
  }

  .add-row button {
    border: 0;
    border-radius: 0.35rem;
    background: #2563eb;
    color: #fff;
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
  }



  .ss-note {
    font-size: 0.65rem;
    color: #94a3b8;
    font-style: italic;
    margin-top: 0.15rem;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-direction: row;
    gap: 0.5rem;
  }

  .toggle-row input[type="checkbox"] {
    width: auto;
    accent-color: #10b981;
    transform: scale(1.15);
    cursor: pointer;
  }

  .strategy-note {
    font-size: 0.68rem;
    color: #94a3b8;
    font-style: italic;
    line-height: 1.35;
    margin: -0.15rem 0 0.3rem;
  }

  .add-row button.purple {
    background: #7c3aed;
  }

  .total {
    color: #e2e8f0;
    font-weight: 650;
    font-size: 0.85rem;
    margin-top: 0.2rem;
  }

  .expense-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0.3rem 0;
  }

  .combined-value {
    color: #e2e8f0;
    font-weight: 650;
    font-size: 0.82rem;
    display: block;
    margin-top: 0.1rem;
  }

  .summary-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #24303f;
    background: #0c1627;
    border-radius: 0.45rem;
    padding: 0.55rem 0.65rem;
    color: #e2e8f0;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .summary-label {
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: #cbd5e1;
    font-size: 0.72rem;
    font-weight: 650;
  }

  .summary-value {
    font-size: 0.9rem;
    font-weight: 650;
    color: #e2e8f0;
  }

  input[type="number"] {
    appearance: textfield;
  }

  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  select {
    width: 100%;
    border: 1px solid #24303f;
    border-radius: 0.45rem;
    padding: 0.5rem;
    background: #0c1627;
    color: #f8fafc;
    font-size: 0.88rem;
    box-sizing: border-box;
  }

  .section-note {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0 0 1rem 0;
    font-style: italic;
  }

  .event-form {
    display: grid;
    gap: 0.65rem;
    padding: 0.5rem 0;
  }

  .event-form button {
    border: 0;
    border-radius: 0.45rem;
    background: #2563eb;
    color: #fff;
    padding: 0.6rem;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    margin-top: 0.3rem;
  }

  .events-list {
    margin-top: 1rem;
    border-top: 1px solid #334155;
    padding-top: 0.75rem;
  }

  .event-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(30, 41, 59, 0.5);
    padding: 0.65rem;
    border-radius: 0.4rem;
    margin-bottom: 0.5rem;
  }

  .event-details {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.85rem;
    color: #cbd5e1;
  }

  .event-amount {
    color: #67e8f9;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .remove-btn {
    border: 0;
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    padding: 0.3rem 0.65rem;
    border-radius: 0.3rem;
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1;
  }

  .remove-btn:hover {
    background: rgba(239, 68, 68, 0.4);
  }

  .expense-toggle {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 0.5rem;
  }

  .expense-toggle button {
    flex: 1;
    border: 1px solid #475569;
    background: rgba(51, 65, 85, 0.3);
    color: #cbd5e1;
    padding: 0.4rem 0.6rem;
    border-radius: 0.3rem;
    cursor: pointer;
    font-size: 0.7rem;
    font-weight: 600;
    transition: all 0.15s;
  }

  .expense-toggle button.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
  }

  .expense-toggle button:hover {
    background: rgba(51, 65, 85, 0.5);
  }

</style>
