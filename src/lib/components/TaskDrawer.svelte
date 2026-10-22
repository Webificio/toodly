<script lang="ts">
	import { open as pickFiles } from '@tauri-apps/plugin-dialog';
	import { Switch } from 'bits-ui';
	import { uiprefs, toggleSection } from '../uiprefs.svelte';
	import { ensureNotificationPermission } from '../reminders.svelte';
	import { Timer, Hourglass, Link2, CheckCircle2, Circle, ArrowLeft, FileText, Flag, Paperclip, Plus, Trash2, X, Repeat, Clock, CalendarDays, Layers, FolderOpen, Folder, CalendarPlus, ChartGantt, Bell, ChevronRight, LayoutTemplate, Eye, Hash, Diamond, ALargeSmall, CaseSensitive, CaseUpper, CaseLower } from '@lucide/svelte';
	import Checkbox from './Checkbox.svelte';
	import AttachmentPreview from './AttachmentPreview.svelte';
	import Select from './Select.svelte';
	import MarkdownEditor from './MarkdownEditor.svelte';
	import QuickInput from './QuickInput.svelte';
	import { store } from '../store.svelte';
	import { normTag } from '../tags';
	import { saveTemplateFrom } from '../templates.svelte';
	import { t as tt, i18n, locale } from '../i18n.svelte';
	import { Wallet } from '@lucide/svelte';
	import MoneyField from './MoneyField.svelte';
	import { DEFAULT_VAT, VAT_RATES, currencyOf, figuresOf, formatAmount, formatMoney, rateOf, summarize, totalsOf } from '../money';
	import { formatHours } from '../duration';
	import DurationField from './DurationField.svelte';
	import { durationOf } from '../ridge';
	import { ui, showToast } from '../nav.svelte';
	import { mIn, mOut } from '../motion';
	import { renderMarkdown } from '../markdown';
	import { recurrenceDays, parseISO, formatBytes, formatStamp, toMinutes, fromMinutes, todayISO, taskStart } from '../dates';
	import { PRIORITIES, RECURRENCES, STATUSES, type Priority, type Recurrence, type Status } from '../types';

	const task = $derived(ui.selectedTaskId ? store.byId.get(ui.selectedTaskId) : undefined);
	const parent = $derived(task?.parent_id ? store.byId.get(task.parent_id) : undefined);
	const subs = $derived(task ? store.children(task.id) : []);
	const prereqs = $derived(task ? store.prereqs(task.id) : []);
	const dependents = $derived(task ? store.dependents(task.id) : []);
	const blockers = $derived(task && !task.completed ? store.blockers(task.id) : []);
	const depCandidates = $derived(
		task
			? store.tasks
					.filter((t) => t.id !== task.id && !t.completed && !prereqs.some((p) => p.id === t.id) && !store.wouldCycle(task.id, t.id))
					.map((t) => ({ value: t.id, label: t.title, color: store.listOf(t.list_id)?.color ?? 'var(--p0)' }))
			: []
	);
	async function addDep(id: string) {
		if (!task || !id) return;
		if (!(await store.addDep(task.id, id))) showToast(tt('Dipendenza circolare: non consentita'));
	}
	const notes = $derived(task ? store.notesOf(task.id) : []);
	const files = $derived(task ? store.attachmentsOf(task.id) : []);

	const listOptions = $derived([
		...store.listsSorted.map((l) => ({ value: l.id, label: l.name, color: l.color }))
	]);

	const groupOptions = $derived([
		{ value: '', label: tt('Nessun gruppo') },
		...store.groups.map((g) => ({ value: g.id, label: store.groupPath(g.id) })).sort((a, b) => a.label.localeCompare(b.label))
	]);

	const closed = (k: string) => uiprefs.closedSections.includes(k);

	// ---- economia ----
	const taskList = $derived(task ? store.listOf(task.list_id) : undefined);
	const cur = $derived(currencyOf(taskList));
	const fig = $derived(task ? figuresOf(task, taskList) : null);
	const dec = $derived<',' | '.'>(locale().startsWith('en') ? '.' : ',');
	const fm = (c: number) => formatMoney(c, cur, locale());
	const withSubs = $derived.by(() => {
		if (!task) return null;
		const d = store.descendants(task.id);
		return d.length ? summarize(totalsOf([task, ...d], (id) => store.listOf(id)), tt, locale()) : null;
	});
	const vatOptions = $derived([
		{ value: '', label: tt('Come la lista ({n}%)', { n: taskList?.vat_rate ?? DEFAULT_VAT }) },
		...VAT_RATES.map((r) => ({ value: String(r), label: r + '%' }))
	]);

	const recurOptions = $derived([
		...RECURRENCES.filter((r) => r.value !== 'yearly' && r.value !== 'weekdays' && r.value !== 'monthend'),
		...RECURRENCES.filter((r) => r.value === 'weekdays' || r.value === 'monthend'),
		{ value: 'dow', label: tt('Giorni della settimana…') },
		...RECURRENCES.filter((r) => r.value === 'yearly')
	]);
	// lunedì … domenica (getDay: 0 = domenica)
	const WEEKDAYS = $derived(
		[1, 2, 3, 4, 5, 6, 0].map((d) => {
			const ref = new Date(2024, 0, 7 + d); // 7 gen 2024 = domenica
			return {
				d,
				short: ref.toLocaleDateString(i18n.lang === 'en' ? 'en' : 'it', { weekday: 'short' }).slice(0, 2),
				full: ref.toLocaleDateString(i18n.lang === 'en' ? 'en' : 'it', { weekday: 'long' })
			};
		})
	);
	function toggleWeekday(d: number) {
		if (!task) return;
		const cur = recurrenceDays(task.recurrence);
		const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
		if (!next.length) return; // almeno un giorno
		store.updateTask(task.id, { recurrence: 'dow:' + next.sort((a, b) => a - b).join(',') });
	}

	let previewId = $state<string | null>(null);
	let tagDraft = $state('');
	function addTags(raw: string) {
		if (!task) return;
		const add = raw.split(/[\s,]+/).map(normTag).filter(Boolean);
		tagDraft = '';
		if (!add.length) return;
		const next = [...new Set([...task.tags, ...add])];
		if (next.length !== task.tags.length) store.updateTask(task.id, { tags: next });
	}
	function removeTag(g: string) {
		if (task) store.updateTask(task.id, { tags: task.tags.filter((x) => x !== g) });
	}

	let confirmDelete = $state(false);
	let newNote = $state('');
	let titleEl = $state<HTMLInputElement>();
	let titleDraft = $state('');
	let lastId = '';

	$effect(() => {
		if (task && task.id !== lastId) {
			lastId = task.id;
			titleDraft = task.title;
			confirmDelete = false;
			newNote = '';
			previewId = null;
			if (task.title === 'Nuovo task' || task.title === 'New task') queueMicrotask(() => { titleEl?.focus(); titleEl?.select(); });
		}
	});

	function saveTitle() {
		if (!task) return;
		const t = titleDraft.trim();
		if (!t) titleDraft = task.title;
		else if (t !== task.title) store.updateTask(task.id, { title: t });
	}

	type TitleCase = 'first' | 'words' | 'upper' | 'lower';
	/** Cambia le maiuscole del titolo e lo salva subito (se non resta vuoto). */
	function applyCase(mode: TitleCase) {
		const v = titleDraft;
		if (!v.trim()) return;
		if (mode === 'upper') titleDraft = v.toLocaleUpperCase();
		else if (mode === 'lower') titleDraft = v.toLocaleLowerCase();
		else if (mode === 'first') titleDraft = v.toLocaleLowerCase().replace(/\p{L}/u, (c) => c.toLocaleUpperCase());
		else titleDraft = v.toLocaleLowerCase().replace(/(^|[\s\-'’/(])(\p{L})/gu, (_, a, c) => a + c.toLocaleUpperCase());
		saveTitle();
		titleEl?.focus();
	}
	/** Svuota il titolo: resta obbligatorio, quindi se si esce senza scriverne uno torna il precedente. */
	function clearTitle() {
		titleDraft = '';
		titleEl?.focus();
	}

	const remindOptions = $derived([
		{ value: '', label: tt('Nessuno') },
		{ value: '0', label: tt("All'ora di inizio") },
		{ value: '5', label: tt('5 minuti prima') },
		{ value: '10', label: tt('10 minuti prima') },
		{ value: '15', label: tt('15 minuti prima') },
		{ value: '30', label: tt('30 minuti prima') },
		{ value: '60', label: tt('1 ora prima') },
		{ value: '120', label: tt('2 ore prima') },
		{ value: '1440', label: tt('1 giorno prima') },
		{ value: '2880', label: tt('2 giorni prima') }
	]);

	function setStartDate(v: string, el: HTMLInputElement) {
		if (!task) return;
		if (v && task.due_date && v > task.due_date) {
			showToast(tt("La data di inizio non può seguire la scadenza"));
			el.value = taskStart(task);
			return;
		}
		store.updateTask(task.id, { start_date: v || null });
	}

	function setStart(v: string) {
		if (!task) return;
		const patch: Record<string, string | null> = { start_time: v || null };
		if (v && !task.due_date) patch.due_date = todayISO();
		if (v && !task.end_time) patch.end_time = fromMinutes(Math.min((toMinutes(v) ?? 0) + 60, 1439));
		if (!v) patch.end_time = null;
		store.updateTask(task.id, patch);
	}
	function setEnd(v: string) {
		if (!task) return;
		if (v && task.start_time && (toMinutes(v) ?? 0) <= (toMinutes(task.start_time) ?? 0)) {
			showToast(tt("L'ora di fine deve seguire quella di inizio"));
			return;
		}
		store.updateTask(task.id, { end_time: v || null });
	}

	async function addFiles() {
		if (!task) return;
		const res = await pickFiles({ multiple: true, directory: false });
		if (!res) return;
		const paths = Array.isArray(res) ? res : [res];
		for (const p of paths) {
			try {
				await store.addAttachment(task.id, typeof p === 'string' ? p : (p as { path: string }).path);
			} catch (e) {
				showToast(tt('Impossibile allegare il file'));
				console.error(e);
			}
		}
	}

	async function openFile(path: string) {
		try {
			await store.openAttachment(path);
		} catch {
			showToast(tt('Impossibile aprire il file'));
		}
	}

	function addNote() {
		const t = newNote.trim();
		if (!t || !task) return;
		store.addNote(task.id, t);
		newNote = '';
	}

	async function remove() {
		if (!task) return;
		if (!confirmDelete) {
			confirmDelete = true;
			setTimeout(() => (confirmDelete = false), 3000);
			return;
		}
		const id = task.id;
		ui.selectedTaskId = parent?.id ?? null;
		await store.deleteTask(id);
	}
</script>

{#snippet head(key: string, label: string, count: string = '')}
	<button
		class="flex w-full items-center gap-1.5 rounded text-left text-[12px] font-semibold tracking-wide text-muted uppercase hover:text-fg"
		aria-expanded={!closed(key)}
		onclick={() => toggleSection(key)}
	>
		<ChevronRight size={13} class="transition-transform duration-150 {closed(key) ? '' : 'rotate-90'}" />{label}
		{#if count}<span class="font-normal normal-case">· {count}</span>{/if}
	</button>
{/snippet}

{#if task}
	<aside
		data-drawer
		class="absolute top-0 right-0 z-30 flex h-full w-[600px] max-w-full flex-col border-l border-border bg-panel shadow-pop"
		in:mIn={{ x: 56, duration: 0.32 }}
		out:mOut={{ x: 56, duration: 0.2 }}
	>
		<header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
			<Checkbox checked={task.completed} blocked={blockers.length > 0} color="var(--p{task.priority})" onchange={(v) => store.setCompleted(task.id, v)} />
			{#if parent}
				<button class="btn btn-ghost h-7 px-2" onclick={() => (ui.selectedTaskId = parent.id)}><ArrowLeft size={14} />{parent.title.slice(0, 22)}</button>
			{/if}
			<div class="ml-auto flex items-center gap-1">
				<button class="icon-btn" onclick={() => { if (task && saveTemplateFrom(task.id)) showToast(tt('Modello salvato')); }} title={tt('Salva come modello')} aria-label={tt('Salva come modello')}><LayoutTemplate size={15} /></button>
				<button class="btn {confirmDelete ? 'border-p3 text-p3' : 'btn-ghost'} h-7 px-2" onclick={remove} title={tt('Elimina task')}>
					<Trash2 size={14} />{#if confirmDelete}{tt('Conferma')}{/if}
				</button>
				<button class="icon-btn" onclick={() => (ui.selectedTaskId = null)} aria-label={tt('Chiudi')}><X size={16} /></button>
			</div>
		</header>

		{#if blockers.length}
			<div class="flex items-start gap-2 border-b border-p2/30 bg-p2/10 px-5 py-2 text-[12.5px] text-p2" in:mIn={{ y: -6 }}>
				<Hourglass size={14} class="mt-0.5 shrink-0" />
				<span>{tt('In attesa di')}: <strong>{blockers.map((b) => b.title).join(', ')}</strong></span>
			</div>
		{/if}
		<div class="flex-1 space-y-5 overflow-y-auto px-5 py-4" data-scroll="y">
			{#key task.id}
				<div class="flex items-start gap-2">
					<input
						bind:this={titleEl}
						bind:value={titleDraft}
						onblur={saveTitle}
						onkeydown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
						class="min-w-0 flex-1 bg-transparent text-[19px] leading-snug font-semibold outline-none placeholder:text-faint {task.completed ? 'text-muted line-through' : ''}"
						placeholder={tt('Titolo del task')}
					/>
					<!-- mousedown bloccato: l'input non perde il focus (e non salva) prima del click -->
					<div class="flex shrink-0 items-center gap-0.5" role="toolbar" tabindex="-1" aria-label={tt('Maiuscole del titolo')} onmousedown={(e) => e.preventDefault()}>
						<button class="icon-btn size-6" title={tt('Prima lettera maiuscola')} aria-label={tt('Prima lettera maiuscola')} onclick={() => applyCase('first')}><ALargeSmall size={15} /></button>
						<button class="icon-btn size-6" title={tt('Maiuscola Ogni Parola')} aria-label={tt('Maiuscola Ogni Parola')} onclick={() => applyCase('words')}><CaseSensitive size={15} /></button>
						<button class="icon-btn size-6" title={tt('TUTTO MAIUSCOLO')} aria-label={tt('TUTTO MAIUSCOLO')} onclick={() => applyCase('upper')}><CaseUpper size={15} /></button>
						<button class="icon-btn size-6" title={tt('tutto minuscolo')} aria-label={tt('tutto minuscolo')} onclick={() => applyCase('lower')}><CaseLower size={15} /></button>
						<button class="icon-btn size-6" title={tt('Cancella il titolo')} aria-label={tt('Cancella il titolo')} onclick={clearTitle}><X size={14} /></button>
					</div>
				</div>
			{/key}

			<!-- organizzazione -->
			<section>
				{@render head('org', tt('Organizzazione'))}
				{#if !closed('org')}
				<div class="mt-2 grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2.5 text-[12.5px]">
				<span class="flex items-center gap-1.5 text-muted"><Flag size={14} />{tt('Priorità')}</span>
				<div class="flex gap-1">
					{#each PRIORITIES as p}
						<button
							class="flex h-7 flex-1 items-center justify-center gap-1 rounded-md border text-[12px] transition-colors {task.priority === p.value ? 'border-transparent font-semibold text-white' : 'border-border text-muted hover:bg-hover'}"
							style={task.priority === p.value ? `background:var(--${p.cls})` : ''}
							onclick={() => store.updateTask(task.id, { priority: p.value as Priority })}
						>
							<Flag size={12} style={task.priority === p.value ? '' : `color:var(--${p.cls})`} />{p.label}
						</button>
					{/each}
				</div>

				<span class="flex items-center gap-1.5 text-muted"><FolderOpen size={14} />{tt('Lista')}</span>
				<Select value={task.list_id ?? store.defaultListId ?? ''} options={listOptions} onchange={(v) => store.moveToList(task.id, v || null)} />

				{#if !task.parent_id}
					<span class="flex items-center gap-1.5 text-muted"><Folder size={14} />{tt('Gruppo')}</span>
					<Select value={task.group_id ?? ''} options={groupOptions} onchange={(v) => store.moveToGroup(task.id, v || null)} />
				{/if}

				<span class="flex items-center gap-1.5 text-muted"><Layers size={14} />{tt('Stato')}</span>
				<Select value={task.completed ? 'done' : task.status} options={STATUSES.map((s) => ({ value: s.value, label: s.label }))} onchange={(v) => store.setStatus(task.id, v as Status)} />

				<span class="flex items-center gap-1.5 text-muted"><Hash size={14} />{tt('Etichette')}</span>
				<div class="flex min-w-0 flex-wrap items-center gap-1">
					{#each task.tags as g (g)}
						<span class="inline-flex items-center gap-0.5 rounded-full bg-hover py-px pr-0.5 pl-2 text-[12px] text-accent">#{g}<button class="icon-btn size-5" aria-label={tt('Rimuovi etichetta')} onclick={() => removeTag(g)}><X size={11} /></button></span>
					{/each}
					<input
						class="field min-w-[90px] flex-1"
						list="toodly-tags"
						placeholder={tt('Aggiungi etichetta…')}
						bind:value={tagDraft}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); addTags(tagDraft); } else if (e.key === 'Backspace' && !tagDraft && task.tags.length) removeTag(task.tags[task.tags.length - 1]); }}
						onblur={() => addTags(tagDraft)}
					/>
					<datalist id="toodly-tags">{#each store.tagList as [g] (g)}<option value={g}></option>{/each}</datalist>
				</div>

				<span class="flex items-center gap-1.5 text-muted"><ChartGantt size={14} />{tt('Gantt')}</span>
				<label class="flex cursor-pointer items-center gap-2">
					<Switch.Root
						checked={task.in_gantt}
						onCheckedChange={(v) => store.updateTask(task.id, { in_gantt: v })}
						class="relative h-5 w-9 shrink-0 rounded-full bg-hover transition-colors data-[state=checked]:bg-accent"
					>
						<Switch.Thumb class="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
					</Switch.Root>
					<span class="text-muted">{tt('Mostra nel Gantt')}</span>
				</label>

				</div>
				{/if}
			</section>

			<!-- pianificazione -->
			<section>
				{@render head('plan', tt('Pianificazione'))}
				{#if !closed('plan')}
				<div class="mt-2 grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2.5 text-[12.5px]">
				<span class="flex items-center gap-1.5 text-muted"><CalendarPlus size={14} />{tt('Inizio')}</span>
				<input type="date" class="field" value={taskStart(task)} max={task.due_date ?? undefined} onchange={(e) => setStartDate(e.currentTarget.value, e.currentTarget)} />

				<span class="flex items-center gap-1.5 text-muted"><CalendarDays size={14} />{tt('Scadenza')}</span>
				<div class="flex gap-1.5">
					<input type="date" class="field" value={task.due_date ?? ''} onchange={(e) => {
						const v = e.currentTarget.value;
						store.updateTask(task.id, v ? { due_date: v } : { due_date: null, start_time: null, end_time: null, remind_min: null, recurrence: 'none' });
					}} />
					{#if task.due_date}<button class="icon-btn" aria-label={tt('Rimuovi data')} onclick={() => store.updateTask(task.id, { due_date: null, start_time: null, end_time: null, remind_min: null, recurrence: 'none' })}><X size={14} /></button>{/if}
				</div>

				<span class="flex items-center gap-1.5 text-muted"><Diamond size={14} />{tt('Traguardo')}</span>
				<label class="flex cursor-pointer items-center gap-2">
					<Switch.Root
						checked={task.milestone}
						onCheckedChange={(v) => store.updateTask(task.id, { milestone: v })}
						class="relative h-5 w-9 shrink-0 rounded-full bg-hover transition-colors data-[state=checked]:bg-accent"
					>
						<Switch.Thumb class="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
					</Switch.Root>
					<span class="text-muted">{tt('Evento senza durata nel Gantt')}</span>
				</label>

				<span class="flex items-center gap-1.5 text-muted"><Clock size={14} />{tt('Orario')}</span>
				<div class="flex items-center gap-1.5">
					<input type="time" class="field" value={task.start_time ?? ''} onchange={(e) => setStart(e.currentTarget.value)} />
					<span class="text-faint">→</span>
					<input type="time" class="field" value={task.end_time ?? ''} disabled={!task.start_time} onchange={(e) => setEnd(e.currentTarget.value)} />
				</div>

				<span class="flex items-center gap-1.5 text-muted"><Timer size={14} />{tt('Durata stimata')}</span>
				<DurationField value={task.duration_min} fallback={durationOf(task)} onchange={(v) => store.updateTask(task.id, { duration_min: v })} />

				<span class="flex items-center gap-1.5 text-muted"><Bell size={14} />{tt('Promemoria')}</span>
				<div class="min-w-0">
					<Select
						value={task.remind_min == null ? '' : String(task.remind_min)}
						options={remindOptions}
						onchange={async (v) => {
							if (v !== '' && !task.due_date) store.updateTask(task.id, { remind_min: Number(v), due_date: todayISO() });
							else store.updateTask(task.id, { remind_min: v === '' ? null : Number(v) });
							if (v !== '' && !(await ensureNotificationPermission())) showToast(tt('Notifiche non consentite dal sistema'));
						}}
					/>
					{#if task.remind_min != null && !task.start_time}<p class="mt-1 text-[11.5px] text-faint">{tt('Senza orario: alle {time}', { time: uiprefs.allDayTime })}</p>{/if}
				</div>

				<span class="flex items-center gap-1.5 text-muted"><Repeat size={14} />{tt('Ripetizione')}</span>
				<div class="min-w-0 space-y-1.5">
					<Select value={task.recurrence.startsWith('dow:') ? 'dow' : task.recurrence} options={recurOptions} onchange={(v) => {
						const rec = v === 'dow' ? (task.recurrence.startsWith('dow:') ? task.recurrence : 'dow:' + parseISO(task.due_date ?? todayISO()).getDay()) : v;
						const patch: Record<string, string | null> = { recurrence: rec };
						if (v === 'none') patch.recur_until = null;
						if (v !== 'none' && !task.due_date) patch.due_date = todayISO();
						store.updateTask(task.id, patch as { recurrence: Recurrence });
					}} />
					{#if task.recurrence.startsWith('dow:')}
						<div class="flex gap-1" role="group" aria-label={tt('Giorni della settimana')}>
							{#each WEEKDAYS as wd}
								{@const on = recurrenceDays(task.recurrence).includes(wd.d)}
								<button
									class="h-7 flex-1 rounded-md border text-[11.5px] transition-colors {on ? 'border-transparent bg-accent font-semibold text-accent-fg' : 'border-border text-muted hover:bg-hover'}"
									aria-pressed={on}
									title={wd.full}
									onclick={() => toggleWeekday(wd.d)}
								>{wd.short}</button>
							{/each}
						</div>
					{/if}
					{#if task.recurrence !== 'none'}
						<div class="flex items-center gap-2">
							<span class="text-muted">{tt('Fino al')}</span>
							<input type="date" class="field" value={task.recur_until ?? ''} min={task.due_date ?? undefined} onchange={(e) => store.updateTask(task.id, { recur_until: e.currentTarget.value || null })} />
							{#if task.recur_until}<button class="icon-btn" aria-label={tt('Rimuovi data')} onclick={() => store.updateTask(task.id, { recur_until: null })}><X size={14} /></button>{/if}
						</div>
					{/if}
				</div>
				</div>
				{/if}
			</section>

			<!-- economia -->
			{#if uiprefs.showEconomy && fig}
			<section>
				{@render head('econ', tt('Economia'), fig.cost || fig.net ? fm(fig.margin) : '')}
				{#if !closed('econ')}
				<div class="mt-2 grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2.5 text-[12.5px]">
					<span class="flex items-center gap-1.5 text-muted"><Wallet size={14} />{tt('Tariffa oraria')}</span>
					<MoneyField value={task.rate_cents} currency={cur} placeholder={taskList?.rate_cents != null ? formatAmount(taskList.rate_cents, dec) : ''} label={tt('Tariffa oraria')} onchange={(v) => store.updateTask(task.id, { rate_cents: v })} />

					<span class="text-muted">{tt('Costo uomo')}</span>
					<span class="min-w-0 truncate">
						{#if task.duration_min == null}<span class="text-faint">{tt('Imposta la durata stimata')}</span>
						{:else}<span class="font-medium">{fm(fig.labor)}</span> <span class="text-faint">· {tt('{h} h × {r}/h', { h: formatHours(task.duration_min, dec), r: fm(rateOf(task, taskList)) })}</span>{/if}
					</span>

					<span class="text-muted">{tt('Spese (netto IVA)')}</span>
					<MoneyField value={task.expense_cents} currency={cur} label={tt('Spese (netto IVA)')} onchange={(v) => store.updateTask(task.id, { expense_cents: v })} />

					<span class="text-muted">{tt('Ricavo (netto)')}</span>
					<MoneyField value={task.revenue_cents} currency={cur} label={tt('Ricavo (netto)')} onchange={(v) => store.updateTask(task.id, { revenue_cents: v })} />

					<span class="text-muted">{tt('IVA sul ricavo')}</span>
					<Select value={task.vat_rate == null ? '' : String(task.vat_rate)} options={vatOptions} onchange={(v) => store.updateTask(task.id, { vat_rate: v === '' ? null : Number(v) })} />

					{#if fig.net}
						<span class="text-muted">{tt('Ricavo lordo')}</span>
						<span><span class="font-medium">{fm(fig.gross)}</span> <span class="text-faint">· {tt('IVA {x}', { x: fm(fig.vat) })}</span></span>
					{/if}
					<span class="text-muted">{tt('Margine')}</span>
					<span class="font-semibold" style="color:{fig.net === 0 ? 'inherit' : fig.margin < 0 ? 'var(--p3)' : 'var(--ok, #22a06b)'}">{fm(fig.margin)}</span>
				</div>
				{#if withSubs}<p class="mt-2 text-[11.5px] text-muted" title={withSubs.tip}>{tt('Con le sotto-attività')}: <span class="font-medium">{withSubs.text}</span></p>{/if}
				{/if}
			</section>
			{/if}

			<!-- descrizione -->
			<section>
				{@render head('desc', tt('Descrizione'))}
				{#if !closed('desc')}
				<div class="mt-1.5">
				{#key task.id}
					<MarkdownEditor value={task.description} onsave={(v) => store.updateTask(task.id, { description: v })} />
				{/key}
				</div>
				{/if}
			</section>

			<!-- sotto-attività -->
			<section>
				{@render head('subs', tt('Sotto-attività'), subs.length ? `${subs.filter((x) => x.completed).length}/${subs.length}` : '')}
				{#if !closed('subs')}
				<div class="mt-1.5">
				<div class="space-y-0.5">
					{#each subs as s (s.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div class="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-hover" onclick={() => (ui.selectedTaskId = s.id)}>
							<Checkbox checked={s.completed} color="var(--p{s.priority})" size={16} onchange={(v) => store.setCompleted(s.id, v)} />
							<span class="flex-1 truncate {s.completed ? 'text-muted line-through' : ''}">{s.title}</span>
							<button class="icon-btn size-6 opacity-0 group-hover:opacity-100" aria-label={tt('Elimina')} onclick={(e) => { e.stopPropagation(); store.deleteTask(s.id); }}><X size={13} /></button>
						</div>
					{/each}
				</div>
				<div class="mt-1.5"><QuickInput compact placeholder={tt('Aggiungi sotto-attività…')} onsubmit={(t) => store.createTask({ title: t, parent_id: task.id, due_date: null })} /></div>
							</div>
				{/if}
			</section>

			<!-- dipendenze -->
			<section>
				{@render head('deps', tt('Dipendenze'), prereqs.length || dependents.length ? String(prereqs.length + dependents.length) : '')}
				{#if !closed('deps')}
				<div class="mt-1.5">
				<p class="mb-1 text-[11.5px] text-faint">{tt('Il task resta «in attesa» finché i prerequisiti non sono completati.')}</p>
				<div class="space-y-0.5">
					{#each prereqs as p (p.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div class="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-hover" onclick={() => (ui.selectedTaskId = p.id)}>
							{#if p.completed}<CheckCircle2 size={16} class="shrink-0 text-p1" />{:else}<Hourglass size={15} class="shrink-0 text-p2" />{/if}
							<span class="flex-1 truncate {p.completed ? 'text-muted line-through' : ''}">{p.title}</span>
							<span class="text-[11px] text-faint">{p.completed ? tt('completato') : tt('da fare')}</span>
							<button class="icon-btn size-6 opacity-0 group-hover:opacity-100" aria-label={tt('Rimuovi dipendenza')} onclick={(e) => { e.stopPropagation(); store.removeDep(task.id, p.id); }}><X size={13} /></button>
						</div>
					{/each}
				</div>
				<div class="mt-1.5"><Select value="" options={depCandidates} placeholder={tt('＋ Dipende da…')} onchange={addDep} /></div>
				{#if dependents.length}
					<h5 class="mt-3 mb-1 text-[11.5px] font-medium text-muted">{tt('Sblocca')}</h5>
					<div class="space-y-0.5">
						{#each dependents as d (d.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
							<div class="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-hover" onclick={() => (ui.selectedTaskId = d.id)}>
								<Circle size={14} class="shrink-0 text-faint" />
								<span class="flex-1 truncate {d.completed ? 'text-muted line-through' : ''}">{d.title}</span>
							</div>
						{/each}
					</div>
				{/if}
							</div>
				{/if}
			</section>

			<!-- note multiple -->
			<section>
				{@render head('notes', tt('Note'), notes.length ? String(notes.length) : '')}
				{#if !closed('notes')}
				<div class="mt-1.5">
				<div class="space-y-2.5">
					{#each notes as n (n.id)}
						<div class="group relative rounded-xl border border-border bg-sidebar/60 px-3 py-2" in:mIn|local={{ y: 8 }}>
							<div class="md text-[13px]">{@html renderMarkdown(n.text)}</div>
							<div class="mt-1 flex items-center text-[11px] text-faint">
								<time datetime={n.created_at}>{formatStamp(n.created_at)}</time>
								<button class="icon-btn ml-auto size-6 opacity-0 group-hover:opacity-100" aria-label={tt('Elimina nota')} onclick={() => store.deleteNote(n.id)}><Trash2 size={12} /></button>
							</div>
						</div>
					{/each}
				</div>
				<div class="mt-2 rounded-xl border border-border bg-panel focus-within:border-accent">
					<textarea
						bind:value={newNote}
						rows="2"
						placeholder={tt('Aggiungi una nota… (Ctrl+Invio per salvare)')}
						class="block w-full resize-none bg-transparent px-3 py-2 outline-none"
						onkeydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(); } }}
					></textarea>
					<div class="flex justify-end px-2 pb-2"><button class="btn btn-primary h-7" disabled={!newNote.trim()} onclick={addNote}><Plus size={14} />{tt('Aggiungi nota')}</button></div>
				</div>
							</div>
				{/if}
			</section>

			<!-- allegati -->
			<section class="pb-4">
				{@render head('files', tt('Allegati'), files.length ? String(files.length) : '')}
				{#if !closed('files')}
				<div class="mt-1.5">
					<div class="mb-1.5 flex justify-end"><button class="btn h-7" onclick={addFiles}><Plus size={14} />{tt('Aggiungi file')}</button></div>
				<div class="space-y-1">
					{#each files as f (f.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div class="group flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 hover:border-accent/60 hover:bg-hover" onclick={() => openFile(f.path)} title={f.path}>
							<Paperclip size={14} class="shrink-0 text-muted" />
							<span class="min-w-0 flex-1 truncate">{f.name}</span>
							<span class="text-[11px] text-faint">{formatBytes(f.size)}</span>
							<button class="icon-btn size-6 opacity-0 group-hover:opacity-100 {previewId === f.id ? 'opacity-100 text-accent' : ''}" aria-label={tt('Anteprima')} title={tt('Anteprima')} aria-pressed={previewId === f.id} onclick={(e) => { e.stopPropagation(); previewId = previewId === f.id ? null : f.id; }}><Eye size={13} /></button>
							<button class="icon-btn size-6 opacity-0 group-hover:opacity-100" aria-label={tt('Rimuovi allegato')} onclick={(e) => { e.stopPropagation(); store.removeAttachment(f.id); }}><X size={13} /></button>
						</div>
						{#if previewId === f.id}<AttachmentPreview file={f} />{/if}
					{/each}
				</div>
							</div>
				{/if}
			</section>
		</div>
	</aside>
{/if}
