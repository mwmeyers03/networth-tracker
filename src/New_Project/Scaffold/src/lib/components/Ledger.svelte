<script>
  import { financialData, formatCur } from '$lib/stores/fireStore.js';

  let data = [];
  $: data = $financialData || [];
</script>

<article class="ledger">
  <h2>Financial Data Ledger</h2>
  <div class="table-shell">
    <table>
      <thead>
        <tr>
          <th>Year</th>
          <th>M Age</th>
          <th>B Age</th>
          <th>Combined Income</th>
          <th>Yearly Expenses</th>
          <th>401k Balances</th>
          <th>Roth Balance</th>
          <th>Brokerage</th>
          <th>Savings</th>
          <th>Net Worth</th>
        </tr>
      </thead>
      <tbody>
        {#each data as row}
          <tr class:retired={row.retired}>
            <td>{row.year}</td>
            <td>{row.michaelAge}</td>
            <td>{row.briannaAge}</td>
            <td>{formatCur(row.combinedGross)}</td>
            <td>{formatCur(row.combinedExp)}</td>
            <td>{formatCur(row.total401k)}</td>
            <td>{formatCur(row.rothBal)}</td>
            <td>{formatCur(row.brokerageBal)}</td>
            <td>{formatCur(row.savingsBal)}</td>
            <td class="net-worth">{formatCur(row.netWorth)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</article>

<style>
  .ledger {
    padding: 1.5rem;
  }

  h2 {
    margin: 0 0 1rem 0;
    color: #f1f5f9;
    font-size: 1.3rem;
    font-weight: 700;
  }

  .table-shell {
    max-height: 640px;
    overflow-y: auto;
    overflow-x: auto;
    border: 1px solid #334155;
    border-radius: 0.6rem;
    background: rgba(15, 23, 42, 0.6);
  }

  table {
    width: 100%;
    min-width: 900px;
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

  @media (max-width: 768px) {
    .ledger {
      padding: 1rem;
    }

    h2 {
      font-size: 1.05rem;
    }

    .table-shell {
      max-height: none;
    }
  }
</style>
