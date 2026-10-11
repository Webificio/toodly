<script lang="ts">
	import { untrack } from 'svelte';
	import { Plus, Trash2 } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import Select from './Select.svelte';
	import { store } from '../store.svelte';
	import { t as tt } from '../i18n.svelte';
	import { ui, go, nav } from '../nav.svelte';
	import { filterMatches } from '../views';
	import { PRIORITIES, STATUSES, type Rule, type RuleField } from '../types';

	let open = $state(false);
	let name = $state('');
	let mode = $state<'and' | 'or'>('and');
	let rules = $state<Rule[]>([]);
	let editingId = $state<string | null>(null);

	$effect(() => {
		const target = ui.filterEditor;
		if (!target) return;
		untrack(() => {
			if (target === 'new') {
				editingId = null;
				name = '';
				mode = 'and';
				rules = [
					{ field: 'priority', op: '==', value: '3' },
					{ field: 'due', op: '==', value: 'today' }
				];
			} else {
				const f = store.filters.find((x) => x.id === target);
				if (!f) {
					ui.filterEditor = null;
					return;
				}
				editingId = f.id;
				name = f.name;
				mode = f.match_mode;
				rules = f.rules.map((r) => ({ ...r }));
			}
			open = true;
		});
	});
	$effect(() => {
		if (!open) ui.filterEditor = null;
	});

	const FIELDS = $derived<{ value: RuleField; label: string }[]>([
		{ value: 'priority', label: tt('Priorità') },
		{ value: 'due', label: tt('Scadenza') },
		{ value: 'list', label: tt('Lista') },
		{ value: 'status', label: tt('Stato') },
		{ value: 'completed', label: tt('Completato') },
		{ value: 'blocked', label: tt('In attesa (dipendenze)') },
		{ value: 'title', label: tt('Titolo') }
	]);
	function ops(f: RuleField): { value: string; label: string }[] {
		const is = { value: '==', label: tt('è') };
		const isnt = { value: '!=', label: tt('non è') };
		switch (f) {
			case 'priority': return [is, isnt, { value: '>=', label: tt('almeno') }, { value: '<=', label: tt('al massimo') }];
			case 'due': case 'list': case 'status': return [is, isnt];
			case 'completed': case 'blocked': return [is];
			default: return [{ value: 'contains', label: tt('contiene') }, { value: '!=', label: tt('non contiene') }];
		}
	}
	const DUE = $derived([
		{ value: 'today', label: tt('Oggi') },
		{ value: 'tomorrow', label: tt('Domani') },
		{ value: 'next7', label: tt('Entro 7 giorni') },
		{ value: 'overdue', label: tt('Scaduta') },
		{ value: 'any', label: tt('Ha una scadenza') },
		{ value: 'none', label: tt('Senza scadenza') },
		{ value: 'date', label: tt('Data specifica…') }
	]);

	function valueOptions(f: RuleField) {
		switch (f) {
			case 'priority': return PRIORITIES.map((p) => ({ value: String(p.value), label: p.label, color: `var(--${p.cls})` }));
			case 'list': return store.listsSorted.map((l) => ({ value: l.id, label: l.name, color: l.color }));
			case 'status': return STATUSES.map((s) => ({ value: s.value as string, label: s.label }));
			case 'blocked':
			case 'completed': return [{ value: 'true', label: tt('Sì') }, { value: 'false', label: tt('No') }];
			default: return [];
		}
	}
	function defaultValue(f: RuleField): string {
		return f === 'priority' ? '3' : f === 'due' ? 'today' : f === 'list' ? (store.defaultListId ?? '') : f === 'status' ? 'todo' : f === 'completed' || f === 'blocked' ? 'false' : '';
	}
	function changeField(r: Rule, f: RuleField) {
		r.field = f;
		r.op = ops(f)[0].value;
		r.value = defaultValue(f);
	}

	const count = $derived(store.tasks.filter((t) => !t.completed && filterMatches(t, { id: '', name: '', match_mode: mode, rules, sort: 0, created_at: '' }, store.blockedIds)).length);

	async function save() {
		const n = name.trim();
		if (!n || rules.length === 0) return;
		const id = await store.saveFilter({ id: editingId ?? undefined, name: n, match_mode: mode, rules });
		open = false;
		go({ scope: 'filter:' + id });
	}
	async function remove() {
		if (!editingId) return;
		const id = editingId;
		open = false;
		if (nav.scope === 'filter:' + id) go({ scope: 'all' });
		await store.deleteFilter(id);
	}
</script>

<Modal bind:open title={editingId ? tt('Modifica filtro') : tt('Nuovo filtro personalizzato')} width={600}>
	<div class="space-y-4">
		<input class="field" placeholder={tt('Nome del filtro (es. Urgenti di oggi)')} bind:value={name} />

		<div class="flex items-center gap-2 text-[12.5px]">
			<span class="text-muted">{tt('Mostra i task che soddisfano')}</span>
			<div class="flex rounded-lg bg-hover p-0.5">
				{#each [['and', tt('TUTTE')], ['or', tt('ALMENO UNA')]] as [id, label]}
					<button class="h-7 rounded-md px-2.5 text-[12px] font-semibold {mode === id ? 'bg-panel shadow-sm' : 'text-muted'}" onclick={() => (mode = id as 'and' | 'or')}>{label}</button>
				{/each}
			</div>
			<span class="text-muted">{tt('le regole')}</span>
		</div>

		<div class="space-y-2">
			{#each rules as r, i (i)}
				<div class="flex items-center gap-2">
					<div class="w-36 shrink-0"><Select value={r.field} options={FIELDS} onchange={(v) => changeField(r, v as RuleField)} /></div>
					<div class="w-32 shrink-0"><Select value={r.op} options={ops(r.field)} onchange={(v) => (r.op = v)} /></div>
					<div class="min-w-0 flex-1">
						{#if r.field === 'title'}
							<input class="field" placeholder={tt('testo…')} bind:value={r.value} />
						{:else if r.field === 'due'}
							<div class="flex gap-1.5">
								<Select value={r.value.startsWith('date:') ? 'date' : r.value} options={DUE} onchange={(v) => (r.value = v === 'date' ? 'date:' + new Date().toISOString().slice(0, 10) : v)} />
								{#if r.value.startsWith('date:')}
									<input type="date" class="field w-40" value={r.value.slice(5)} onchange={(e) => (r.value = 'date:' + e.currentTarget.value)} />
								{/if}
							</div>
						{:else}
							<Select value={r.value} options={valueOptions(r.field)} onchange={(v) => (r.value = v)} />
						{/if}
					</div>
					<button class="icon-btn" aria-label={tt('Rimuovi regola')} onclick={() => rules.splice(i, 1)}><Trash2 size={14} /></button>
				</div>
			{/each}
			<button class="btn btn-ghost" onclick={() => rules.push({ field: 'priority', op: '==', value: '3' })}><Plus size={14} />{tt('Aggiungi regola')}</button>
		</div>

		<div class="flex items-center gap-2 border-t border-border pt-4">
			<span class="text-[12px] text-muted">{tt('{n} task aperti corrispondono',{n:count})}</span>
			{#if editingId}<button class="btn ml-auto text-p3" onclick={remove}><Trash2 size={14} />{tt('Elimina')}</button>{/if}
			<button class="btn {editingId ? '' : 'ml-auto'}" onclick={() => (open = false)}>{tt('Annulla')}</button>
			<button class="btn btn-primary" disabled={!name.trim() || rules.length === 0} onclick={save}>{tt('Salva filtro')}</button>
		</div>
	</div>
</Modal>
