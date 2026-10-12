<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { Search, CornerDownLeft, X } from '@lucide/svelte';
	import { tick } from 'svelte';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { nav, ui, go } from '../nav.svelte';
	import { relativeDay } from '../dates';
	import { mIn, mOut } from '../motion';
	import { PRIORITIES, type Task } from '../types';

	let open = $state(false);
	let query = $state('');
	let listId = $state('');
	let prio = $state<number | null>(null);
	let withDone = $state(false);
	let cursor = $state(0);
	let input = $state<HTMLInputElement>();
	let listEl = $state<HTMLDivElement>();

	$effect(() => {
		open = ui.searchOpen;
	});
	$effect(() => {
		if (!open) ui.searchOpen = false;
		else {
			cursor = 0;
			tick().then(() => input?.focus());
		}
	});

	/** minuscolo e senza accenti: «perche» trova «perché» */
	const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	const plain = (md: string) => md.replace(/[#>*_`~\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim();

	interface Hit {
		task: Task;
		score: number;
		snippet: string;
	}
	const hits = $derived.by((): Hit[] => {
		const tokens = norm(query).split(/\s+/).filter(Boolean);
		const pool = store.tasks.filter((x) => (withDone || !x.completed) && (!listId || x.list_id === listId) && (prio === null || x.priority === prio));
		if (!tokens.length) {
			// senza testo: gli ultimi modificati
			return [...pool].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8).map((task) => ({ task, score: 0, snippet: '' }));
		}
		const out: Hit[] = [];
		for (const task of pool) {
			const title = norm(task.title);
			const descRaw = plain(task.description);
			const desc = norm(descRaw);
			const tagText = task.tags.join(' ');
			let score = 0;
			let ok = true;
			for (const tok of tokens) {
				const ti = title.indexOf(tok);
				if (ti >= 0) score += ti === 0 ? 30 : /\s/.test(title[ti - 1] ?? ' ') ? 20 : 10;
				else if (tagText.includes(tok.replace(/^#/, ''))) score += 8;
				else if (desc.includes(tok)) score += 3;
				else {
					ok = false;
					break;
				}
			}
			if (!ok) continue;
			let snippet = '';
			if (!tokens.every((tok) => title.includes(tok))) {
				const i = desc.indexOf(tokens.find((tok) => desc.includes(tok)) ?? '');
				if (i >= 0) snippet = (i > 30 ? '…' : '') + descRaw.slice(Math.max(0, i - 30), i + 70);
			}
			if (!task.completed) score += 2;
			out.push({ task, score, snippet });
		}
		return out.sort((a, b) => b.score - a.score || b.task.updated_at.localeCompare(a.task.updated_at)).slice(0, 40);
	});

	$effect(() => {
		hits;
		cursor = 0;
	});

	function where(task: Task): string {
		const parts: string[] = [];
		const list = store.listOf(task.list_id);
		if (list) parts.push(list.name);
		const g = task.group_id ? store.groupsById.get(task.group_id) : null;
		if (g) parts.push(g.name);
		const parent = task.parent_id ? store.byId.get(task.parent_id) : null;
		if (parent) parts.push('↳ ' + parent.title);
		if (task.due_date) parts.push(relativeDay(task.due_date));
		return parts.join(' · ');
	}

	function pick(h: Hit | undefined) {
		if (!h) return;
		const task = h.task;
		open = false;
		// vai alla lista del task (se serve) e apri il dettaglio
		if (task.list_id && nav.scope !== 'list:' + task.list_id && nav.scope !== 'all') go({ scope: 'list:' + task.list_id });
		else if (nav.scope === 'today' || nav.scope === 'next7') go({ scope: 'all' });
		tick().then(() => (ui.selectedTaskId = task.id));
	}

	function onkey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			cursor = Math.min(hits.length - 1, cursor + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			cursor = Math.max(0, cursor - 1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			pick(hits[cursor]);
		} else return;
		tick().then(() => listEl?.querySelector('[data-active=true]')?.scrollIntoView({ block: 'nearest' }));
	}

	/** titolo con le parole cercate evidenziate */
	function marks(title: string): { text: string; hit: boolean }[] {
		const tokens = norm(query).split(/\s+/).filter(Boolean);
		if (!tokens.length) return [{ text: title, hit: false }];
		const n = norm(title);
		const flags = new Array(title.length).fill(false);
		for (const tok of tokens) {
			let i = n.indexOf(tok);
			while (i >= 0) {
				for (let k = i; k < i + tok.length; k++) flags[k] = true;
				i = n.indexOf(tok, i + tok.length);
			}
		}
		const out: { text: string; hit: boolean }[] = [];
		for (let i = 0; i < title.length; i++) {
			const last = out[out.length - 1];
			if (last && last.hit === flags[i]) last.text += title[i];
			else out.push({ text: title[i], hit: flags[i] });
		}
		return out;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay forceMount>
			{#snippet child({ props, open })}
				{#if open}
					<div {...props} class="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" in:mIn={{ duration: 0.15 }} out:mOut={{ duration: 0.12 }}></div>
				{/if}
			{/snippet}
		</Dialog.Overlay>
		<div class="pointer-events-none fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
			<Dialog.Content forceMount>
				{#snippet child({ props, open })}
					{#if open}
						<div
							{...props}
							class="pointer-events-auto flex max-h-[70vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-elev shadow-pop"
							in:mIn={{ y: -8, scale: 0.98, duration: 0.2 }}
							out:mOut={{ y: -6, scale: 0.98, duration: 0.12 }}
						>
							<Dialog.Title class="sr-only">{t('Cerca')}</Dialog.Title>
							<div class="flex items-center gap-2.5 border-b border-border px-4">
								<Search size={16} class="shrink-0 text-muted" />
								<input
									bind:this={input}
									bind:value={query}
									onkeydown={onkey}
									class="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
									placeholder={t('Cerca nei task…')}
									aria-label={t('Cerca nei task…')}
								/>
								{#if query}<button class="icon-btn size-6" aria-label={t('Cancella')} onclick={() => { query = ''; input?.focus(); }}><X size={14} /></button>{/if}
							</div>

							<div class="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2 text-[12px]">
								<select class="h-7 rounded-md border border-border bg-panel px-1.5 outline-none" bind:value={listId} aria-label={t('Lista')}>
									<option value="">{t('Tutte le liste')}</option>
									{#each store.listsSorted as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
								</select>
								<div class="flex rounded-md bg-hover p-0.5">
									<button class="h-6 rounded px-2 {prio === null ? 'bg-panel shadow-sm' : 'text-muted hover:text-fg'}" onclick={() => (prio = null)}>{t('Tutte')}</button>
									{#each PRIORITIES.filter((p) => p.value > 0) as p (p.value)}
										<button class="flex h-6 items-center gap-1 rounded px-2 {prio === p.value ? 'bg-panel shadow-sm' : 'text-muted hover:text-fg'}" onclick={() => (prio = prio === p.value ? null : p.value)}>
											<span class="size-2 rounded-full" style="background:var(--p{p.value})"></span>{p.label}
										</button>
									{/each}
								</div>
								<label class="ml-auto flex cursor-pointer items-center gap-1.5 text-muted select-none">
									<input type="checkbox" bind:checked={withDone} class="accent-[var(--accent)]" />{t('Includi completati')}
								</label>
							</div>

							<div bind:this={listEl} class="min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox" aria-label={t('Risultati')}>
								{#if !query.trim()}
									<div class="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-faint uppercase">{t('Modificati di recente')}</div>
								{/if}
								{#each hits as h, i (h.task.id)}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<div
										role="option"
										aria-selected={i === cursor}
										data-active={i === cursor}
										tabindex="-1"
										class="flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 {i === cursor ? 'bg-active' : 'hover:bg-hover'}"
										onmousemove={() => (cursor = i)}
										onclick={() => pick(h)}
									>
										<span class="mt-[5px] size-2.5 shrink-0 rounded-full" style="background:var(--p{h.task.priority})"></span>
										<div class="min-w-0 flex-1">
											<div class="truncate text-[13.5px] {h.task.completed ? 'text-muted line-through' : ''}">
												{#each marks(h.task.title) as m}{#if m.hit}<mark class="rounded-sm bg-accent/25 px-px text-inherit">{m.text}</mark>{:else}{m.text}{/if}{/each}
											</div>
											{#if h.snippet}<div class="truncate text-[12px] text-muted">{h.snippet}</div>{/if}
											<div class="truncate text-[11.5px] text-faint">{where(h.task)}</div>
										</div>
										{#if i === cursor}<CornerDownLeft size={14} class="mt-1 shrink-0 text-faint" />{/if}
									</div>
								{:else}
									<p class="px-3 py-8 text-center text-[13px] text-muted">{t('Nessun risultato')}</p>
								{/each}
							</div>

							<div class="flex items-center gap-3 border-t border-border px-4 py-1.5 text-[11.5px] text-faint">
								<span>↑↓ {t('per scorrere')}</span><span>↵ {t('per aprire')}</span><span>Esc {t('per chiudere')}</span>
								<span class="ml-auto">{hits.length} {t('risultati')}</span>
							</div>
						</div>
					{/if}
				{/snippet}
			</Dialog.Content>
		</div>
	</Dialog.Portal>
</Dialog.Root>
