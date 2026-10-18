<script lang="ts">
	import ListView from '../lib/components/ListView.svelte';
	import KanbanView from '../lib/components/KanbanView.svelte';
	import CalendarView from '../lib/components/CalendarView.svelte';
	import GanttView from '../lib/components/GanttView.svelte';
	import GraphView from '../lib/components/GraphView.svelte';
	import OrbitView from '../lib/components/OrbitView.svelte';
	import MetroView from '../lib/components/MetroView.svelte';
	import { nav } from '../lib/nav.svelte';
</script>

{#if nav.mode === 'kanban'}
	<KanbanView />
{:else if nav.mode === 'calendar'}
	<CalendarView />
{:else if nav.mode === 'gantt'}
	<GanttView />
{:else if nav.mode === 'graph'}
	<GraphView />
{:else if nav.mode === 'orbit'}
	<OrbitView />
{:else if nav.mode === 'metro'}
	<MetroView />
{:else}
	<ListView />
{/if}
