<script lang="ts">
	import { ChevronRight, FolderPlus, Pencil, Plus } from '@lucide/svelte';
	import { store } from '../store.svelte';
	import { ui } from '../nav.svelte';
	import { draggable, dropzone, type DropEvent } from '../dnd.svelte';
	import { expandGroup } from '../groupui.svelte';
	import { t } from '../i18n.svelte';
	import type { GNode } from '../graph';

	/** Nodo di un gruppo (o di un sottogruppo, o dei task «Senza gruppo») nella vista Graph. */
	let { node, ontoggle, onaddtask }: { node: GNode; ontoggle: () => void; onaddtask: () => void } = $props();

	const real = $derived(!!node.group);
	const count = $derived(node.count ?? { total: 0, high: 0, medium: 0 });
	let over = $state(false);

	function accept(p: any) {
		if (p?.type === 'task') return true;
		return real && p?.type === 'group' && p.id !== node.id && store.canNest(p.id, node.id);
	}
	async function drop(e: DropEvent) {
		over = false;
		const p = e.payload;
		if (p.type === 'task') await store.moveToGroup(p.id, real ? node.id : null);
		else if (p.type === 'group') await store.updateGroup(p.id, { parent_id: node.id });
		if (real) expandGroup(node.id);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="group relative h-full"
	use:dropzone={{ accept, over: () => (over = true), leave: () => (over = false), drop }}
	use:draggable={{ payload: () => ({ type: 'group', id: node.id }), label: () => node.name ?? '', disabled: !real }}
>
	<div class="gbox {node.root ? 'gbox-root' : 'gbox-sub'} {node.collapsed ? 'gbox-collapsed' : ''} {over ? 'gbox-over' : ''}" onclick={ontoggle} title={node.name}>
		<span class="grid w-4 shrink-0 place-items-center opacity-80"><ChevronRight size={node.root ? 16 : 14} class="transition-transform duration-150 {node.collapsed ? '' : 'rotate-90'}" /></span>
		<span class="min-w-0 flex-1 truncate text-center">{node.name}</span>
		<span class="flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums">
			<span class="rounded-full bg-black/30 px-1.5">{count.total}</span>
			{#if count.high > 0}<span class="rounded-full px-1.5" style="background:var(--p3)">{count.high}</span>{/if}
			{#if count.medium > 0}<span class="rounded-full px-1.5" style="background:var(--p2)">{count.medium}</span>{/if}
		</span>
	</div>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<span
		class="absolute -top-8 right-0 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-panel px-1 py-0.5 shadow-sm transition-opacity duration-100 pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
		data-nodrag
		data-nodismiss
		onclick={(e) => e.stopPropagation()}
	>
		<button class="icon-btn size-7" title={t('Aggiungi un task…')} aria-label={t('Aggiungi un task…')} onclick={onaddtask}><Plus size={14} /></button>
		{#if real}
			<button class="icon-btn size-7" title={t('Nuovo sottogruppo')} aria-label={t('Nuovo sottogruppo')} onclick={() => (ui.groupEditor = 'new:' + node.id)}><FolderPlus size={14} /></button>
			<button class="icon-btn size-7" title={t('Modifica gruppo')} aria-label={t('Modifica gruppo')} onclick={() => (ui.groupEditor = node.id)}><Pencil size={13} /></button>
		{/if}
	</span>
</div>

<style>
	.gbox {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 10px;
		cursor: pointer;
		overflow: hidden;
		color: #fff;
		text-transform: uppercase;
		background-color: var(--gfill);
		/* trama a griglia leggera, come un foglio millimetrato */
		background-image: linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
		border: 2px solid var(--gborder);
		transition: box-shadow 0.12s, filter 0.12s;
	}
	.gbox:hover {
		filter: brightness(1.08);
	}
	.gbox-root {
		border-radius: var(--r-gr);
		font-size: 16px;
		font-weight: 500;
		letter-spacing: 0.04em;
		background-size: 35px 28px;
	}
	.gbox-sub {
		border-radius: var(--r-gs);
		font-size: 12.5px;
		font-weight: 600;
		letter-spacing: 0.03em;
		background-size: 30px 21px;
	}
	/* chiuso: un «cumulo» di fogli */
	.gbox-collapsed {
		box-shadow: 0 5px 0 -2px var(--gfill), 0 6px 0 -2px var(--gborder);
	}
	.gbox-over {
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--gacc) 55%, transparent);
	}
</style>
