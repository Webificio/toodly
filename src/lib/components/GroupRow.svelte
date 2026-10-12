<script lang="ts">
	import { ChevronRight, Folder, FolderOpen, FolderPlus, Pencil, Plus } from '@lucide/svelte';
	import { store } from '../store.svelte';
	import { ui } from '../nav.svelte';
	import { dropzone, draggable } from '../dnd.svelte';
	import { expandGroup } from '../groupui.svelte';
	import { t } from '../i18n.svelte';
	import type { Group } from '../types';

	let {
		group,
		depth = 0,
		count = { total: 0, high: 0, medium: 0 },
		collapsed = false,
		ontoggle,
		onaddtask
	}: { group: Group; depth?: number; count?: { total: number; high: number; medium: number }; collapsed?: boolean; ontoggle: () => void; onaddtask: () => void } = $props();

	let over = $state(false);

	function accept(p: any) {
		if (p?.type === 'task') return true;
		return p?.type === 'group' && p.id !== group.id && store.canNest(p.id, group.id);
	}
	async function drop(e: { payload: any }) {
		over = false;
		const p = e.payload;
		if (p.type === 'task') await store.moveToGroup(p.id, group.id);
		else if (p.type === 'group') await store.updateGroup(p.id, { parent_id: group.id });
		expandGroup(group.id);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="group relative"
	use:dropzone={{ accept, over: () => (over = true), leave: () => (over = false), drop }}
	use:draggable={{ payload: () => ({ type: 'group', id: group.id }), label: () => group.name }}
>
	<div
		class="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg pr-2 transition-colors hover:bg-hover {over ? 'bg-accent/15 ring-1 ring-accent/50' : ''}"
		style="padding-left:{6 + depth * 26}px"
		onclick={ontoggle}
	>
		<span class="grid w-4 shrink-0 place-items-center text-faint"><ChevronRight size={14} class="transition-transform duration-150 {collapsed ? '' : 'rotate-90'}" /></span>
		{#if collapsed}<Folder size={16} class="shrink-0 text-accent" />{:else}<FolderOpen size={16} class="shrink-0 text-accent" />{/if}
		<span class="min-w-0 truncate text-[13.5px] font-semibold">{group.name}</span>
		<span class="shrink-0 rounded-full bg-hover px-1.5 text-[11px] text-muted tabular-nums">{count.total}</span>
		{#if count.high > 0}<span class="shrink-0 rounded-full px-1.5 text-[11px] font-semibold text-white tabular-nums" style="background:var(--p3)">{count.high}</span>{/if}
		{#if count.medium > 0}<span class="shrink-0 rounded-full px-1.5 text-[11px] font-semibold text-white tabular-nums" style="background:var(--p2)">{count.medium}</span>{/if}
		<span class="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" data-nodrag onclick={(e) => e.stopPropagation()}>
			<button class="icon-btn size-7" title={t('Aggiungi un task…')} aria-label={t('Aggiungi un task…')} onclick={onaddtask}><Plus size={14} /></button>
			<button class="icon-btn size-7" title={t('Nuovo sottogruppo')} aria-label={t('Nuovo sottogruppo')} onclick={() => (ui.groupEditor = 'new:' + group.id)}><FolderPlus size={14} /></button>
			<button class="icon-btn size-7" title={t('Modifica gruppo')} aria-label={t('Modifica gruppo')} onclick={() => (ui.groupEditor = group.id)}><Pencil size={13} /></button>
		</span>
	</div>
</div>
