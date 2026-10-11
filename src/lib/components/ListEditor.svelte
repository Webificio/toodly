<script lang="ts">
	import { untrack } from 'svelte';
	import { Trash2 } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import { store } from '../store.svelte';
	import { t as tt } from '../i18n.svelte';
	import { ui, go, nav } from '../nav.svelte';
	import { LIST_COLORS } from '../types';

	let open = $state(false);
	let name = $state('');
	let color = $state(LIST_COLORS[0]);
	let editingId = $state<string | null>(null);
	let confirm = $state(false);

	$effect(() => {
		const target = ui.listEditor;
		if (!target) return;
		untrack(() => {
			confirm = false;
			if (target === 'new') {
				editingId = null;
				name = '';
				color = LIST_COLORS[store.lists.length % LIST_COLORS.length];
			} else {
				const l = store.lists.find((x) => x.id === target);
				if (!l) {
					ui.listEditor = null;
					return;
				}
				editingId = l.id;
				name = l.name;
				color = l.color;
			}
			open = true;
		});
	});
	$effect(() => {
		if (!open) ui.listEditor = null;
	});

	const moveTarget = $derived(store.listsSorted.find((l) => l.id !== editingId)?.name ?? '');

	async function save() {
		const n = name.trim();
		if (!n) return;
		if (editingId) await store.updateList(editingId, { name: n, color });
		else {
			const l = await store.createList(n, color);
			go({ scope: 'list:' + l.id });
		}
		open = false;
	}
	async function remove() {
		if (!editingId) return;
		if (!confirm) return (confirm = true);
		const id = editingId;
		open = false;
		if (nav.scope === 'list:' + id) go({ scope: 'all' });
		await store.deleteList(id);
	}
</script>

<Modal bind:open title={editingId ? tt('Modifica lista') : tt('Nuova lista')} width={420}>
	<div class="space-y-4">
		<input class="field" placeholder={tt('Nome della lista')} bind:value={name} onkeydown={(e) => e.key === 'Enter' && save()} />
		<div class="flex flex-wrap gap-2">
			{#each LIST_COLORS as c}
				<button
					aria-label={c}
					class="size-7 rounded-full ring-offset-2 ring-offset-elev transition-transform hover:scale-110 {color === c ? 'ring-2 ring-accent' : ''}"
					style="background:{c}"
					onclick={() => (color = c)}
				></button>
			{/each}
		</div>
		<div class="flex items-center gap-2 pt-1">
			{#if editingId && store.lists.length > 1}
				<button class="btn text-p3" onclick={remove}><Trash2 size={14} />{confirm ? tt('Conferma (i task vanno in «{name}»)', { name: moveTarget }) : tt('Elimina')}</button>
			{/if}
			<button class="btn ml-auto" onclick={() => (open = false)}>{tt('Annulla')}</button>
			<button class="btn btn-primary" disabled={!name.trim()} onclick={save}>{tt('Salva')}</button>
		</div>
	</div>
</Modal>
