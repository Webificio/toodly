<script lang="ts">
	import ListView from '../lib/components/ListView.svelte';
	import KanbanView from '../lib/components/KanbanView.svelte';
	import CalendarView from '../lib/components/CalendarView.svelte';
	import GanttView from '../lib/components/GanttView.svelte';
	import GraphView from '../lib/components/GraphView.svelte';
	import OrbitView from '../lib/components/OrbitView.svelte';
	import MetroView from '../lib/components/MetroView.svelte';
	import CorkView from '../lib/components/CorkView.svelte';
	import RoadView from '../lib/components/RoadView.svelte';
	import MatrixView from '../lib/components/MatrixView.svelte';
	import MosaicView from '../lib/components/MosaicView.svelte';
	import RidgeView from '../lib/components/RidgeView.svelte';
	import GroveView from '../lib/components/GroveView.svelte';
	import SlotView from '../lib/components/SlotView.svelte';
	import BudgetView from '../lib/components/BudgetView.svelte';
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
{:else if nav.mode === 'cork'}
	<CorkView />
{:else if nav.mode === 'road'}
	<RoadView />
{:else if nav.mode === 'matrix'}
	<MatrixView />
{:else if nav.mode === 'mosaic'}
	<MosaicView />
{:else if nav.mode === 'ridge'}
	<RidgeView />
{:else if nav.mode === 'grove'}
	<GroveView />
{:else if nav.mode === 'slot'}
	<SlotView />
{:else if nav.mode === 'budget'}
	<BudgetView />
{:else}
	<ListView />
{/if}
