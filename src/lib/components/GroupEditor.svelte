<script lang="ts">
	import { untrack } from 'svelte';
	import { Trash2 } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import Select from './Select.svelte';
	import { store } from '../store.svelte';
	import { ui, askConfirm } from '../nav.svelte';
	import { expandGroup } from '../groupui.svelte';
	import { t as tt } from '../i18n.svelte';

	let open = $state(false);
	let name = $state('');
	let parentId = $state('');
	let editingId = $state<string | null>(null);
	let error = $state('');

	$effect(() => {
		const target = ui.groupEditor;
		if (!target) return;
		untrack(() => {
			if (target === 'new' || target.startsWith('new:')) {
				editingId = null;
				error = '';
				name = '';
				parentId = target.startsWith('new:') ? target.slice(4) : '';
			} else {
				const g = store.groupsById.get(target);
				if (!g) {
					ui.groupEditor = null;
					return;
				}
				editingId = g.id;
				error = '';
				name = g.name;
				parentId = g.parent_id ?? '';
			}
			open = true;
		});
	});
	$effect(() => {
		if (!open) ui.groupEditor = null;
	});

	const parentOptions = $derived([
		{ value: '', label: tt('Livello principale') },
		...store.groups
			.filter((g) => !editingId || store.canNest(editingId, g.id))
			.map((g) => ({ value: g.id, label: store.groupPath(g.id) }))
			.sort((a, b) => a.label.localeCompare(b.label))
	]);

	async function save() {
		const n = name.trim();
		if (!n) {
			error = tt('Il nome del gruppo è obbligatorio');
			return;
		}
		const key = n.toLocaleLowerCase();
		if (store.groups.some((g) => g.id !== editingId && g.name.trim().toLocaleLowerCase() === key)) {
			error = tt('Esiste già un gruppo con questo nome');
			return;
		}
		const parent = parentId || null;
		if (editingId) await store.updateGroup(editingId, { name: n, parent_id: parent });
		else await store.createGroup(n, parent);
		if (parent) expandGroup(parent);
		open = false;
	}
	function remove() {
		if (!editingId) return;
		const g = store.groupsById.get(editingId);
		if (!g) return;
		open = false;
		askConfirm({
			title: tt('Elimina gruppo'),
			message: tt('Sei sicuro di voler eliminare il gruppo «{name}»? Task e sottogruppi non vengono eliminati: salgono al livello superiore.', { name: g.name }),
			label: tt('Elimina'),
			danger: true,
			run: () => store.deleteGroup(g.id)
		});
	}
</script>

<Modal bind:open title={editingId ? tt('Modifica gruppo') : tt('Nuovo gruppo')} width={440}>
	<div class="space-y-4 text-[13px]">
		<input class="field" placeholder={tt('Nome del gruppo')} bind:value={name} oninput={() => (error = '')} onkeydown={(e) => e.key === 'Enter' && save()} />
		{#if error}<div class="-mt-2 text-[11.5px] text-p3">{error}</div>{/if}
		<div class="flex items-center gap-2">
			<span class="w-28 shrink-0 text-muted">{tt('Dentro')}</span>
			<div class="min-w-0 flex-1"><Select value={parentId} options={parentOptions} onchange={(v) => (parentId = v)} /></div>
		</div>
		<div class="flex items-center gap-2 pt-1">
			{#if editingId}<button class="btn text-p3" onclick={remove}><Trash2 size={14} />{tt('Elimina')}</button>{/if}
			<button class="btn ml-auto" onclick={() => (open = false)}>{tt('Annulla')}</button>
			<button class="btn btn-primary" onclick={save}>{tt('Salva')}</button>
		</div>
	</div>
</Modal>
