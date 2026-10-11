<script lang="ts">
	import UnscheduledPanel from './UnscheduledPanel.svelte';
	import MonthGrid from './MonthGrid.svelte';
	import WeekGrid from './WeekGrid.svelte';
	import { store } from '../store.svelte';
	import { nav } from '../nav.svelte';
	import { inScope } from '../views';

	// le viste "Oggi" / "Prossimi 7 giorni" limiterebbero il calendario: mostriamo tutto
	const scope = $derived(nav.scope === 'today' || nav.scope === 'next7' ? 'all' : nav.scope);
	const tasks = $derived(store.tasks.filter((t) => inScope(t, scope, store.filters, store.blockedIds)));
</script>

<div class="flex h-full min-h-0">
	<UnscheduledPanel {tasks} />
	{#if nav.cal === 'month'}
		<MonthGrid {tasks} anchor={nav.date} />
	{:else}
		<WeekGrid {tasks} anchor={nav.date} />
	{/if}
</div>
