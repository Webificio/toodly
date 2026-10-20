<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { CalendarDays, Flag, FolderOpen, Folder, Layers, CheckCheck, Trash2, X, ChevronDown, Timer } from '@lucide/svelte';
	import { store } from '../store.svelte';
	import { showToast, askConfirm } from '../nav.svelte';
	import { selection, clearSelection, selectAll } from '../selection.svelte';
	import { addDays, todayISO } from '../dates';
	import { mIn, mOut } from '../motion';
	import { t as tt } from '../i18n.svelte';
	import DurationField from './DurationField.svelte';
	import { PRIORITIES, STATUSES, type Priority, type Status } from '../types';

	// ignora gli ID non più esistenti (task eliminati da un'altra finestra)
	const ids = $derived([...selection].filter((id) => store.byId.has(id)));

	let datePick = $state(false);
	let dateValue = $state(todayISO());
	let durPick = $state(false);
	let durValue = $state<number | null>(null);

	$effect(() => {
		if (ids.length === 0) {
			datePick = false;
			durPick = false;
		}
	});

	async function setDue(due: string | null) {
		const patch = due ? { due_date: due } : { due_date: null, start_time: null, end_time: null, remind_min: null, recurrence: 'none' as const };
		await store.batch(tt('Scadenza'), async () => {
			for (const id of ids) await store.updateTask(id, patch);
		});
		datePick = false;
		showToast(tt('{n} task aggiornati', { n: ids.length }));
	}
	async function setDuration(min: number | null) {
		await store.batch(tt('Durata stimata'), async () => {
			for (const id of ids) await store.updateTask(id, { duration_min: min });
		});
		durPick = false;
		showToast(tt('{n} task aggiornati', { n: ids.length }));
	}
	async function setPriority(p: Priority) {
		await store.batch(tt('Priorità'), async () => {
			for (const id of ids) await store.updateTask(id, { priority: p });
		});
		showToast(tt('{n} task aggiornati', { n: ids.length }));
	}
	async function setList(l: string | null) {
		await store.batch(tt('Lista'), async () => {
			for (const id of ids) await store.moveToList(id, l);
		});
		showToast(tt('{n} task aggiornati', { n: ids.length }));
	}
	async function setGroup(g: string | null) {
		await store.batch(tt('Gruppo'), async () => {
			for (const id of ids) if (!store.byId.get(id)?.parent_id) await store.moveToGroup(id, g);
		});
		showToast(tt('{n} task aggiornati', { n: ids.length }));
	}
	async function setStatus(s: Status) {
		const blocked = s === 'done' ? ids.filter((id) => store.blockers(id).length) : [];
		await store.batch(tt('Stato'), async () => {
			for (const id of ids) if (!blocked.includes(id)) await store.setStatus(id, s);
		});
		if (blocked.length) showToast(tt('{n} task in attesa non completati', { n: blocked.length }));
		else showToast(tt('{n} task aggiornati', { n: ids.length }));
	}
	function complete() {
		const n = ids.length;
		askConfirm({
			title: tt('Completa task'),
			message: n === 1 ? tt('Sei sicuro di voler marcare il task selezionato come completato?') : tt('Sei sicuro di voler marcare {n} task come completati?', { n }),
			label: tt('Completa'),
			run: () => setStatus('done')
		});
	}
	function remove() {
		const list = [...ids];
		const n = list.length;
		askConfirm({
			title: tt('Elimina task'),
			message: n === 1 ? tt('Sei sicuro di voler eliminare il task selezionato?') : tt('Sei sicuro di voler eliminare {n} task?', { n }),
			label: tt('Elimina'),
			danger: true,
			run: async () => {
				clearSelection();
				await store.batch(
					n === 1 ? tt('Task eliminato') : tt('{n} task eliminati', { n }),
					async () => {
						for (const id of list) if (store.byId.has(id)) await store.deleteTask(id);
					},
					true
				);
			}
		});
	}
</script>

{#if ids.length > 0}
	<div
		data-nodismiss class="fixed bottom-5 left-1/2 z-40 flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 flex-wrap items-center gap-1 rounded-2xl border border-border bg-elev px-2 py-1.5 shadow-pop"
		in:mIn={{ y: 14, duration: 0.24 }}
		out:mOut={{ y: 10, duration: 0.16 }}
	>
		<span class="px-2 text-[12.5px] font-semibold">{tt('{n} selezionati', { n: ids.length })}</span>
		<button class="btn btn-ghost h-8 px-2 text-[12px]" onclick={selectAll}>{tt('Tutti')}</button>
		<button class="btn btn-ghost h-8 px-2 text-[12px]" onclick={clearSelection}>{tt('Nessuno')}</button>
		<span class="mx-1 h-5 w-px bg-border"></span>

		<!-- scadenza -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="btn btn-ghost h-8 px-2"><CalendarDays size={14} />{tt('Scadenza')}<ChevronDown size={12} /></DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content class="menu" side="top" sideOffset={8} align="center">
					<DropdownMenu.Item class="menu-item" onSelect={() => setDue(todayISO())}>{tt('Oggi')}</DropdownMenu.Item>
					<DropdownMenu.Item class="menu-item" onSelect={() => setDue(addDays(todayISO(), 1))}>{tt('Domani')}</DropdownMenu.Item>
					<DropdownMenu.Item class="menu-item" onSelect={() => setDue(addDays(todayISO(), 7))}>{tt('Tra una settimana')}</DropdownMenu.Item>
					<DropdownMenu.Item class="menu-item" onSelect={() => { datePick = true; durPick = false; }}>{tt('Data specifica…')}</DropdownMenu.Item>
					<DropdownMenu.Separator class="menu-sep" />
					<DropdownMenu.Item class="menu-item" onSelect={() => setDue(null)}>{tt('Rimuovi scadenza')}</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>

		<!-- durata stimata -->
		<button class="btn btn-ghost h-8 px-2" onclick={() => { durPick = !durPick; datePick = false; }}><Timer size={14} />{tt('Durata')}</button>

		<!-- priorità -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="btn btn-ghost h-8 px-2"><Flag size={14} />{tt('Priorità')}<ChevronDown size={12} /></DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content class="menu" side="top" sideOffset={8} align="center">
					{#each PRIORITIES as p}
						<DropdownMenu.Item class="menu-item" onSelect={() => setPriority(p.value)}><Flag size={13} style="color:var(--{p.cls})" />{p.label}</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>

		<!-- lista -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="btn btn-ghost h-8 px-2"><FolderOpen size={14} />{tt('Lista')}<ChevronDown size={12} /></DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content class="menu" side="top" sideOffset={8} align="center">
					{#each store.listsSorted as l (l.id)}
						<DropdownMenu.Item class="menu-item" onSelect={() => setList(l.id)}><span class="size-2 rounded-full" style="background:{l.color}"></span>{l.name}</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>

		<!-- gruppo -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="btn btn-ghost h-8 px-2"><Folder size={14} />{tt('Gruppo')}<ChevronDown size={12} /></DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content class="menu max-h-72 overflow-y-auto" side="top" sideOffset={8} align="center">
					<DropdownMenu.Item class="menu-item" onSelect={() => setGroup(null)}>{tt('Nessun gruppo')}</DropdownMenu.Item>
					{#each store.groups.map((g) => ({ id: g.id, label: store.groupPath(g.id) })).sort((a, b) => a.label.localeCompare(b.label)) as g (g.id)}
						<DropdownMenu.Item class="menu-item" onSelect={() => setGroup(g.id)}><Folder size={13} class="text-accent" />{g.label}</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>

		<!-- stato -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="btn btn-ghost h-8 px-2"><Layers size={14} />{tt('Stato')}<ChevronDown size={12} /></DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content class="menu" side="top" sideOffset={8} align="center">
					{#each STATUSES as s}
						<DropdownMenu.Item class="menu-item" onSelect={() => setStatus(s.value)}>{s.label}</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>

		<span class="mx-1 h-5 w-px bg-border"></span>
		<button class="btn btn-ghost h-8 px-2" onclick={complete}><CheckCheck size={14} />{tt('Completa')}</button>
		<button class="btn btn-ghost h-8 px-2" onclick={remove}><Trash2 size={14} />{tt('Elimina')}</button>
		<button class="icon-btn" aria-label={tt('Deseleziona')} title={tt('Deseleziona') + ' (Esc)'} onclick={clearSelection}><X size={16} /></button>

		{#if datePick}
			<div class="flex w-full items-center gap-2 border-t border-border px-2 pt-2 pb-1" in:mIn={{ y: 6, duration: 0.18 }}>
				<input type="date" class="field w-44" bind:value={dateValue} />
				<button class="btn btn-primary h-8" disabled={!dateValue} onclick={() => setDue(dateValue)}>{tt('Applica a {n}', { n: ids.length })}</button>
				<button class="btn btn-ghost h-8" onclick={() => (datePick = false)}>{tt('Annulla')}</button>
			</div>
		{/if}
		{#if durPick}
			<div class="flex w-full flex-wrap items-center gap-2 border-t border-border px-2 pt-2 pb-1" in:mIn={{ y: 6, duration: 0.18 }}>
				<DurationField value={durValue} onchange={(v) => (durValue = v)} />
				<button class="btn btn-primary h-8" onclick={() => setDuration(durValue)}>{tt('Applica a {n}', { n: ids.length })}</button>
				<button class="btn btn-ghost h-8" onclick={() => setDuration(null)}>{tt('Predefinita')}</button>
				<button class="btn btn-ghost h-8" onclick={() => (durPick = false)}>{tt('Annulla')}</button>
			</div>
		{/if}
	</div>
{/if}
