<script>
  import { financialData, formatCur, globals, michaelExpenses, briannaExpenses, salaryAdjustments, retirementExpenses } from '$lib/stores/fireStore.js';

  let data = [];
  let editingYear = null;
  let activeView = 'combined'; // 'combined', 'michael', 'brianna'
  let editValues = {};
  
  $: data = $financialData || [];
  $: editingYearData = editingYear ? data.find(d => d.year === editingYear) : null;

  const startEdit = (year) => {
    const yearData = data.find(d => d.year === year);
    if (!yearData) return;
    editingYear = year;
    const existing = $salaryAdjustments[year] || {};
    editValues = {
      michaelSalary: Math.round(existing.michaelSalary !== undefined ? existing.michaelSalary : yearData.mSalary),
      briannaSalary: Math.round(existing.briannaSalary !== undefined ? existing.briannaSalary : yearData.bSalary),
      michaelExpenses: Math.round(yearData.mExp * 12),
      briannaExpenses: Math.round(yearData.bExp * 12),
      michael401k: Math.round(yearData.m401kBal),
      brianna401k: Math.round(yearData.b401kBal),
      michaelRoth: Math.round(yearData.mRothBal),
      briannaRoth: Math.round(yearData.bRothBal),
      michaelBrokerage: Math.round(yearData.mBrokerageBal),
      briannaBrokerage: Math.round(yearData.bBrokerageBal),
      michaelSavings: Math.round(yearData.mSavingsBal),
      briannaSavings: Math.round(yearData.bSavingsBal)
    };
  };

  const saveEdit = () => {
    if (!editingYear) return;
    
    const roundedValues = {
      michaelSalary: Math.round(editValues.michaelSalary),
      briannaSalary: Math.round(editValues.briannaSalary),
      michaelExpenses: Math.round(editValues.michaelExpenses),
      briannaExpenses: Math.round(editValues.briannaExpenses),
      michael401k: Math.round(editValues.michael401k),
      brianna401k: Math.round(editValues.brianna401k),
      michaelRoth: Math.round(editValues.michaelRoth),
      briannaRoth: Math.round(editValues.briannaRoth),
      michaelBrokerage: Math.round(editValues.michaelBrokerage),
      briannaBrokerage: Math.round(editValues.briannaBrokerage),
      michaelSavings: Math.round(editValues.michaelSavings),
      briannaSavings: Math.round(editValues.briannaSavings)
    };
    
    salaryAdjustments.update(adj => ({
      ...adj,
      [editingYear]: {
        michaelSalary: roundedValues.michaelSalary,
        briannaSalary: roundedValues.briannaSalary
      }
    }));
    
    const michaelMonthlyExp = roundedValues.michaelExpenses / 12;
    const briannaMonthlyExp = roundedValues.briannaExpenses / 12;
    
    michaelExpenses.update(exp => ({
      ...exp,
      [editingYear]: michaelMonthlyExp
    }));
    
    briannaExpenses.update(exp => ({
      ...exp,
      [editingYear]: briannaMonthlyExp
    }));
    
    globals.update(g => ({
      ...g,
      yearOverrides: {
        ...(g.yearOverrides || {}),
        [editingYear]: {
          michael401k: roundedValues.michael401k,
          brianna401k: roundedValues.brianna401k,
          michaelRoth: roundedValues.michaelRoth,
          briannaRoth: roundedValues.briannaRoth,
          michaelBrokerage: roundedValues.michaelBrokerage,
          briannaBrokerage: roundedValues.briannaBrokerage,
          michaelSavings: roundedValues.michaelSavings,
          briannaSavings: roundedValues.briannaSavings
        }
      }
    }));
    
    editingYear = null;
    editValues = {};
  };

  const cancelEdit = () => {
    editingYear = null;
    editValues = {};
  };

  const parseNum = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
</script>

<article class="ledger">
  <div class="ledger-header">
    <h2>Financial Data Ledger</h2>
    <div class="view-toggle">
      <button class:active={activeView === 'combined'} on:click={() => activeView = 'combined'}>Combined</button>
      <button class:active={activeView === 'michael'} on:click={() => activeView = 'michael'}>Michael</button>
      <button class:active={activeView === 'brianna'} on:click={() => activeView = 'brianna'}>Brianna</button>
    </div>
  </div>

  <div class="table-shell">
    {#if activeView === 'combined'}
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Age</th>
            <th>Combined Income</th>
            <th>Yearly Expenses</th>
            <th>Status</th>
            <th>Social Security</th>
            <th>Total 401k</th>
            <th>Total Roth</th>
            <th>Total Brokerage</th>
            <th>Total Savings</th>
            <th>Withdrawal Source</th>
            <th>Net Worth</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data as row}
            <tr class:retired={row.retired} class:editing={editingYear === row.year}>
              <td><span class="year-cell">{row.year}</span></td>
              <td>{Math.round((row.michaelAge + row.briannaAge) / 2)}</td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michaelSalary} class="inline-edit" placeholder="M Salary" />
                  <input type="number" bind:value={editValues.briannaSalary} class="inline-edit" placeholder="B Salary" />
                {:else}
                  {formatCur(row.combinedGross)}
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michaelExpenses} class="inline-edit" placeholder="M Exp" />
                  <input type="number" bind:value={editValues.briannaExpenses} class="inline-edit" placeholder="B Exp" />
                {:else}
                  {formatCur(row.actualWithdrawalAmount ?? row.combinedExp)}
                  {#if row.retired && row.actualWithdrawalAmount !== row.combinedExp}
                    <span class="dynamic-tag" title="Dynamically calculated withdrawal">(dynamic)</span>
                  {/if}
                {/if}
              </td>
              <td class="status">{row.retired ? '🏖️ Retired' : 'Working'}</td>
              <td class="ss-income">{row.socialSecurityIncome ? '+' + formatCur(row.socialSecurityIncome) : '-'}</td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michael401k} class="inline-edit" placeholder="M 401k" />
                  <span class="divider">/</span>
                  <input type="number" bind:value={editValues.brianna401k} class="inline-edit" placeholder="B 401k" />
                {:else}
                  <span class="split-tip" data-tip="M: {formatCur(row.m401kBal)} | B: {formatCur(row.b401kBal)}">{formatCur(row.total401k)}</span>
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michaelRoth} class="inline-edit" placeholder="M Roth" />
                  <span class="divider">/</span>
                  <input type="number" bind:value={editValues.briannaRoth} class="inline-edit" placeholder="B Roth" />
                {:else}
                  <span class="split-tip" data-tip="M: {formatCur(row.mRothBal)} | B: {formatCur(row.bRothBal)}">{formatCur(row.totalRoth)}</span>
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michaelBrokerage} class="inline-edit" placeholder="M Broker" />
                  <span class="divider">/</span>
                  <input type="number" bind:value={editValues.briannaBrokerage} class="inline-edit" placeholder="B Broker" />
                {:else}
                  <span class="split-tip" data-tip="M: {formatCur(row.mBrokerageBal)} | B: {formatCur(row.bBrokerageBal)}">{formatCur(row.totalBrokerage)}</span>
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michaelSavings} class="inline-edit" placeholder="M Savings" />
                  <span class="divider">/</span>
                  <input type="number" bind:value={editValues.briannaSavings} class="inline-edit" placeholder="B Savings" />
                {:else}
                  <span class="split-tip" data-tip="M: {formatCur(row.mSavingsBal)} | B: {formatCur(row.bSavingsBal)}">{formatCur(row.totalSavings)}</span>
                {/if}
              </td>
              <td class="withdrawal">{row.withdrawalSource || 'Active'}</td>
              <td class="net-worth">{formatCur(row.netWorth)}</td>
              <td class="actions">
                {#if editingYear === row.year}
                  <button class="save-btn" on:click={saveEdit} title="Save changes">✓</button>
                  <button class="cancel-btn" on:click={cancelEdit} title="Cancel">✕</button>
                {:else}
                  <button class="edit-btn" on:click={() => startEdit(row.year)} title="Edit this year">✎</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else if activeView === 'michael'}
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Age</th>
            <th>Salary</th>
            <th>Expenses</th>
            <th>Status</th>
            <th>401k</th>
            <th>Roth</th>
            <th>Brokerage</th>
            <th>Savings</th>
            <th>Net Worth</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data as row}
            <tr class:retired={row.michaelRetired} class:editing={editingYear === row.year}>
              <td><span class="year-cell">{row.year}</span></td>
              <td>{row.michaelAge}</td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michaelSalary} class="inline-edit" />
                {:else}
                  {formatCur(row.mSalary)}
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michaelExpenses} class="inline-edit" />
                {:else}
                  {formatCur(row.mExp * 12)}
                {/if}
              </td>
              <td class="status">{row.michaelRetired ? '🏖️ Retired' : 'Working'}</td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michael401k} class="inline-edit" />
                {:else}
                  {formatCur(row.m401kBal)}
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michaelRoth} class="inline-edit" />
                {:else}
                  {formatCur(row.mRothBal)}
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michaelBrokerage} class="inline-edit" />
                {:else}
                  {formatCur(row.mBrokerageBal)}
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.michaelSavings} class="inline-edit" />
                {:else}
                  {formatCur(row.mSavingsBal)}
                {/if}
              </td>
              <td class="net-worth">{formatCur(row.michaelNetWorth)}</td>
              <td class="actions">
                {#if editingYear === row.year}
                  <button class="save-btn" on:click={saveEdit} title="Save changes">✓</button>
                  <button class="cancel-btn" on:click={cancelEdit} title="Cancel">✕</button>
                {:else}
                  <button class="edit-btn" on:click={() => startEdit(row.year)} title="Edit this year">✎</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Age</th>
            <th>Salary</th>
            <th>Expenses</th>
            <th>Status</th>
            <th>401k</th>
            <th>Roth</th>
            <th>Brokerage</th>
            <th>Savings</th>
            <th>Net Worth</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data as row}
            <tr class:retired={row.briannaRetired} class:editing={editingYear === row.year}>
              <td><span class="year-cell">{row.year}</span></td>
              <td>{row.briannaAge}</td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.briannaSalary} class="inline-edit" />
                {:else}
                  {formatCur(row.bSalary)}
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.briannaExpenses} class="inline-edit" />
                {:else}
                  {formatCur(row.bExp * 12)}
                {/if}
              </td>
              <td class="status">{row.briannaRetired ? '🏖️ Retired' : 'Working'}</td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.brianna401k} class="inline-edit" />
                {:else}
                  {formatCur(row.b401kBal)}
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.briannaRoth} class="inline-edit" />
                {:else}
                  {formatCur(row.bRothBal)}
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.briannaBrokerage} class="inline-edit" />
                {:else}
                  {formatCur(row.bBrokerageBal)}
                {/if}
              </td>
              <td>
                {#if editingYear === row.year}
                  <input type="number" bind:value={editValues.briannaSavings} class="inline-edit" />
                {:else}
                  {formatCur(row.bSavingsBal)}
                {/if}
              </td>
              <td class="net-worth">{formatCur(row.briannaNetWorth)}</td>
              <td class="actions">
                {#if editingYear === row.year}
                  <button class="save-btn" on:click={saveEdit} title="Save changes">✓</button>
                  <button class="cancel-btn" on:click={cancelEdit} title="Cancel">✕</button>
                {:else}
                  <button class="edit-btn" on:click={() => startEdit(row.year)} title="Edit this year">✎</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</article>

<style>
  .ledger {
    padding: 1.5rem;
  }

  .ledger-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  h2 {
    margin: 0;
    color: #f1f5f9;
    font-size: 1.3rem;
    font-weight: 700;
  }

  .view-toggle {
    display: flex;
    gap: 0.5rem;
  }

  .view-toggle button {
    border: 1px solid #475569;
    background: rgba(51, 65, 85, 0.3);
    color: #cbd5e1;
    padding: 0.5rem 1rem;
    border-radius: 0.4rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    transition: all 0.15s;
  }

  .view-toggle button:hover {
    background: rgba(51, 65, 85, 0.5);
  }

  .view-toggle button.active {
    background: linear-gradient(135deg, #2563eb, #7c3aed);
    color: #fff;
    border-color: transparent;
  }

  .table-shell {
    max-height: 640px;
    overflow-y: auto;
    border: 1px solid #334155;
    border-radius: 0.6rem;
    background: rgba(15, 23, 42, 0.6);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    position: sticky;
    top: 0;
    background: #1e293b;
    z-index: 2;
  }

  th {
    padding: 0.7rem 0.6rem;
    text-align: left;
    color: #cbd5e1;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #334155;
  }

  td {
    padding: 0.55rem 0.6rem;
    font-size: 0.82rem;
    color: #e2e8f0;
    border-bottom: 1px solid #1e293b;
  }

  tbody tr:hover {
    background: rgba(59, 130, 246, 0.08);
  }

  .retired {
    background: rgba(251, 146, 60, 0.06);
  }

  .retired:hover {
    background: rgba(251, 146, 60, 0.12);
  }

  .net-worth {
    font-weight: 650;
    color: #67e8f9;
  }



  .status {
    font-size: 0.75rem;
    font-weight: 600;
  }



  .edit-btn, .save-btn, .cancel-btn {
    border: none;
    border-radius: 0.35rem;
    padding: 0.5rem 0.8rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .edit-btn {
    background: #3b82f6;
    color: white;
  }

  .edit-btn:hover {
    background: #2563eb;
  }

  .save-btn {
    background: #10b981;
    color: white;
  }

  .save-btn:hover {
    background: #059669;
  }

  .cancel-btn {
    background: #ef4444;
    color: white;
  }

  .cancel-btn:hover {
    background: #dc2626;
  }







  .withdrawal {
    font-size: 0.75rem;
    color: #86efac;
    font-weight: 600;
  }

  .dynamic-tag {
    display: block;
    font-size: 0.65rem;
    color: #a78bfa;
    font-style: italic;
    margin-top: 0.1rem;
  }

  /* Tooltip for combined M/B splits ─────────────────────────────────── */
  .split-tip {
    position: relative;
    cursor: help;
    border-bottom: 1px dashed #475569;
  }

  .split-tip::after {
    content: attr(data-tip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    background: rgba(15, 23, 42, 0.97);
    border: 1px solid #475569;
    border-radius: 0.35rem;
    padding: 0.3rem 0.55rem;
    font-size: 0.65rem;
    color: #cbd5e1;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0,0,0,0.45);
  }

  .split-tip:hover::after {
    opacity: 1;
  }

  tr.editing {
    background-color: rgba(99, 102, 241, 0.15);
  }

  .inline-edit {
    width: 100%;
    padding: 0.4rem;
    border: 1px solid #6366f1;
    background-color: #1f2937;
    color: #e2e8f0;
    border-radius: 0.3rem;
    font-size: 0.9rem;
    margin-bottom: 0.3rem;
  }

  .inline-edit:focus {
    outline: none;
    border-color: #a5b4fc;
    box-shadow: 0 0 0 3px rgba(165, 180, 252, 0.1);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .edit-btn {
    background-color: #3b82f6;
    color: white;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 0.3rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .edit-btn:hover {
    background-color: #2563eb;
  }

  .save-btn {
    background-color: #10b981;
    color: white;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 0.3rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .save-btn:hover {
    background-color: #059669;
  }

  .cancel-btn {
    background-color: #ef4444;
    color: white;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 0.3rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .cancel-btn:hover {
    background-color: #dc2626;
  }

  .year-cell {
    font-weight: 600;
    color: #a5b4fc;
  }
</style>
