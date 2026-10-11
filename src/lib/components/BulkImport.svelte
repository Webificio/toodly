<script lang="ts">
	import { untrack } from 'svelte';
	import { ListPlus } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import Select from './Select.svelte';
	import { store } from '../store.svelte';
	import { ui, nav, showToast } from '../nav.svelte';
	import { parseScope } from '../views';
	import { parseBulk, MAX_TITLE } from '../bulk';
	import { addDays, todayISO } from '../dates';
	import { t as tt } from '../i18n.svelte';

	let open = $state(false);
	let text = $state('');
	let listId = $state('');
	let busy = $state(false);
	let ta = $state<HTMLTextAreaElement>();

	$effect(() => {
		if (!ui.bulkOpen) return;
		untrack(() => {
			const sc = parseScope(nav.scope);
			listId = sc.kind === 'list' ? sc.id : (store.defaultListId ?? '');
			text = '';
			open = true;
			queueMicrotask(() => ta?.focus());
		});
	});
	$effect(() => {
		if (!open) ui.bulkOpen = false;
	});

	const parsed = $derived(parseBulk(text, store.lists));
	const items = $derived(parsed.items);
	const newGroups = $derived.by(() => {
		const known = new Set(store.groups.map((g) => g.name.trim().toLocaleLowerCase()));
		const seen = new Set<string>();
		for (const path of parsed.groups) for (const n of path) {
			const k = n.toLocaleLowerCase();
			if (!known.has(k)) seen.add(k);
		}
		return seen.size;
	});
	const shortened = $derived(items.filter((i) => i.shortened).length);
	const listOptions = $derived([
		...store.listsSorted.map((l) => ({ value: l.id, label: l.name, color: l.color }))
	]);

	async function create() {
		if ((!items.length && !parsed.groups.length) || busy) return;
		busy = true;
		const today = todayISO();
		const base = Date.now();
		try {
			// gruppi: riusa quelli esistenti con lo stesso nome (i nomi sono univoci), crea gli altri
			const byName = new Map(store.groups.map((g) => [g.name.trim().toLocaleLowerCase(), g.id]));
			let gsort = base;
			const resolve = async (path: string[]): Promise<string | null> => {
				let parent: string | null = null;
				for (const name of path) {
					const k = name.toLocaleLowerCase();
					let id = byName.get(k);
					if (!id) {
						id = (await store.createGroup(name, parent, gsort++)).id;
						byName.set(k, id);
					}
					parent = id;
				}
				return parent;
			};
			for (const path of parsed.groups) await resolve(path);
			for (const [i, it] of items.entries()) {
				await store.createTask({
					title: it.title,
					description: it.description,
					priority: it.priority || (nav.scope === 'important' ? 3 : 0),
					list_id: it.list_id ?? (listId || null),
					group_id: await resolve(it.groupPath),
					due_date: it.due_date ?? (nav.scope === 'today' ? today : nav.scope === 'next7' ? addDays(today, 1) : null),
					sort: base + i
				});
			}
			showToast(tt('{n} task creati', { n: items.length }));
			open = false;
		} catch (e) {
			console.error(e);
			showToast(tt('Importazione non riuscita'));
		} finally {
			busy = false;
		}
	}
</script>

<Modal bind:open title={tt('Aggiungi più task da testo')} width={620}>
	<div class="space-y-3 text-[13px]">
		<p class="text-muted">{tt('Incolla o scrivi un task per riga (testo semplice o Markdown): le righe vuote vengono ignorate. Con il Markdown le intestazioni (#, ##, ###…) creano gruppi e sottogruppi che contengono le righe seguenti. Titoli più lunghi di {n} caratteri vengono accorciati e il resto va nella descrizione.', { n: MAX_TITLE })}</p>
		<textarea
			bind:this={ta}
			bind:value={text}
			rows="10"
			placeholder={tt('Un task per riga…\nPreparare la relazione !alta @domani\nChiamare Marco')}
			class="field block min-h-48 w-full resize-y py-2 leading-relaxed"
			onkeydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); create(); } }}
		></textarea>

		<div class="flex items-center gap-2">
			<span class="text-muted">{tt('Lista')}</span>
			<div class="w-48"><Select value={listId} options={listOptions} onchange={(v) => (listId = v)} /></div>
			<span class="text-[12px] text-faint">{tt('(vale anche #lista, !alta, @domani per ogni riga)')}</span>
		</div>

		{#if items.length || parsed.groups.length}
			<div class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2" data-scroll="y">
				{#each items.slice(0, 50) as it}
					<div class="flex items-baseline gap-2" style="padding-left:{it.groupPath.length * 14}px">
						<span class="min-w-0 flex-1 truncate">{it.title}</span>
						{#if it.shortened}<span class="shrink-0 rounded bg-hover px-1.5 text-[11px] text-muted">{tt('+ descrizione')}</span>{/if}
					</div>
				{/each}
				{#if items.length > 50}<div class="text-faint">… +{items.length - 50}</div>{/if}
			</div>
		{/if}

		<div class="flex items-center gap-2 border-t border-border pt-3">
			<span class="text-[12px] text-muted">
				{items.length ? tt('{n} task verranno creati', { n: items.length }) : tt('Nessun task da creare')}{newGroups ? ' · ' + tt('{n} gruppi nuovi', { n: newGroups }) : ''}{shortened ? ' · ' + tt('{n} con titolo accorciato', { n: shortened }) : ''}
			</span>
			<button class="btn ml-auto" onclick={() => (open = false)}>{tt('Annulla')}</button>
			<button class="btn btn-primary" disabled={(!items.length && !parsed.groups.length) || busy} onclick={create}><ListPlus size={14} />{tt('Crea task')}</button>
		</div>
	</div>
</Modal>
