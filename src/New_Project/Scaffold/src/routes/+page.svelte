<script>
	import Controls from '$lib/components/Controls.svelte';
	import Dashboard from '$lib/components/Dashboard.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Ledger from '$lib/components/LedgerNew.svelte';
	import Retirement from '$lib/components/Retirement.svelte';
	import Calculations from '$lib/components/Calculations.svelte';
	import { financialData } from '$lib/stores/fireStore.js';

	let activeTab = 'parameters';
	let retirementYear = null;

	$: if ($financialData) {
		const firstRetired = $financialData.find((d) => d.retired);
		retirementYear = firstRetired?.year || null;
	}
	
	function changeTab(tab) {
		activeTab = tab;
	}
</script>

<svelte:head>
	<title>FIRE Calculator - Net Worth Projection</title>
</svelte:head>

<main>
	<header>
		<h1>FIRE Calculator</h1>
		<nav>
			<button class:active={activeTab === 'parameters'} on:click={() => changeTab('parameters')}>Parameters</button>
			<button class:active={activeTab === 'dashboard'} on:click={() => changeTab('dashboard')}>Dashboard</button>
			<button class:active={activeTab === 'retirement'} on:click={() => changeTab('retirement')}>Retirement</button>
			<button class:active={activeTab === 'ledger'} on:click={() => changeTab('ledger')}>Ledger</button>
			<button class:active={activeTab === 'calculations'} on:click={() => changeTab('calculations')}>Calculations</button>
		</nav>
	</header>

	{#if activeTab === 'parameters'}
		<Controls />
	{:else if activeTab === 'dashboard'}
		<div class="dashboard-layout">
			<Sidebar />
			<div class="dashboard-main">
				<Dashboard {retirementYear} />
			</div>
		</div>
	{:else if activeTab === 'retirement'}
		<Retirement />
	{:else if activeTab === 'ledger'}
		<Ledger />
	{:else if activeTab === 'calculations'}
		<Calculations />
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		background: linear-gradient(180deg, #0a0e27 0%, #1a1f3a 100%);
		color: #e2e8f0;
		min-height: 100vh;
	}

	main {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	header {
		padding: 1.2rem 1.5rem;
		background: rgba(15, 23, 42, 0.8);
		border-bottom: 1px solid #1f2937;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	h1 {
		margin: 0;
		color: #f8fafc;
		font-size: 1.7rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	nav {
		display: flex;
		gap: 0.5rem;
	}

	nav button {
		border: 0;
		background: rgba(51, 65, 85, 0.3);
		color: #cbd5e1;
		padding: 0.6rem 1.1rem;
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 0.88rem;
		font-weight: 600;
		transition: background 0.15s, color 0.15s;
	}

	nav button:hover {
		background: rgba(51, 65, 85, 0.5);
		color: #f1f5f9;
	}

	nav button.active {
		background: linear-gradient(135deg, #2563eb, #7c3aed);
		color: #fff;
	}

	/* Dashboard two-column layout */
	.dashboard-layout {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.dashboard-main {
		flex: 1;
		overflow-y: auto;
		min-width: 0;
	}
</style>
