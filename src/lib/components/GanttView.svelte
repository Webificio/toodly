<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { ChevronRight, Folder, FolderOpen, Target, Eye, EyeOff, Download, Copy } from '@lucide/svelte';
	import Checkbox from './Checkbox.svelte';
	import { t } from '../i18n.svelte';
	import { locale } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { nav, ui, go, showToast } from '../nav.svelte';
	import { uiprefs } from '../uiprefs.svelte';
	import { currentWorkspace } from '../db';
	import { collapsedGroups, loadCollapsed, toggleGroup } from '../groupui.svelte';
	import { inScope, parseScope, sortTasks } from '../views';
	import MoneyChip from './MoneyChip.svelte';
	import { chipOf, ecoShow, groupMoney } from '../economy.svelte';
	import { ganttToMermaid, exportGanttMd } from '../exportgantt';
	import { addDays, diffDays, parseISO, startOfMonth, startOfWeek, taskStart, todayISO, toISO } from '../dates';
	import type { Task } from '../types';

	// ---- costanti di layout ---------------------------------------------------
	const ROW_H = 34;
	/** altezza di un task escluso dal Gantt: riga sottile, senza barra */
	const ROW_H_MIN = 18;
	const HEAD_H = 52;
	const LEFT_W = 300;
	const BAR_H = 20;
	type Zoom = 'day' | 'week' | 'month';
	const PX: Record<Zoom, number> = { day: 32, week: 12, month: 4 };
	const MIN_SPAN: Record<Zoom, number> = { day: 75, week: 240, month: 900 };
	const zooms: { id: Zoom; label: string }[] = [
		{ id: 'day', label: 'Giorni' },
		{ id: 'week', label: 'Settimane' },
		{ id: 'month', label: 'Mesi' }
	];

	const zoom = $derived(nav.gantt);
	const px = $derived(PX[zoom]);
	const today = todayISO();

	// come il calendario: "Oggi" e "Prossimi 7 giorni" limiterebbero troppo la vista
	const scope = $derived(nav.scope === 'today' || nav.scope === 'next7' ? 'all' : nav.scope);

	// cartelle aperte/chiuse: stesso stato della vista Lista per la stessa vista di questo set
	$effect.pre(() => {
		loadCollapsed(currentWorkspace(), nav.scope);
	});

	let showDone = $state(true);
	let showExcluded = $state(true);
	let showCritical = $state(false);
	let onlyLate = $state(false);
	// finestra visibile (virtualizzazione delle righe)
	let scrollTop = $state(0);
	let viewH = $state(900);
	const collapsedTasks = new SvelteSet<string>();

	// ---- intervallo di un task (con l'anteprima del trascinamento) ------------------
	type Drag = { id: string; mode: 'move' | 'start' | 'end'; delta: number };
	let drag = $state<Drag | null>(null);

	type Range = { s: string; e: string };
	function rangeOf(task: Task, live = true): Range | null {
		if (!task.due_date || !task.in_gantt) return null;
		let s = taskStart(task);
		let e = task.due_date;
		if (s > e || task.milestone) s = e;
		if (live && drag && drag.id === task.id && drag.delta) {
			if (drag.mode === 'move') {
				s = addDays(s, drag.delta);
				e = addDays(e, drag.delta);
			} else if (task.milestone) {
				// un traguardo si sposta soltanto
			} else if (drag.mode === 'start') {
				s = addDays(s, drag.delta);
				if (s > e) s = e;
			} else {
				e = addDays(e, drag.delta);
				if (e < s) e = s;
			}
		}
		return { s, e };
	}
	const union = (a: Range | null, b: Range | null): Range | null => (!a ? b : !b ? a : { s: a.s < b.s ? a.s : b.s, e: a.e > b.e ? a.e : b.e });

	// ---- albero gerarchico: cartelle → task → sotto-task -----------------------------
	type GroupRowT = { kind: 'group'; id: string; name: string; depth: number; collapsed: boolean; range: Range | null };
	type TaskRowT = { kind: 'task'; id: string; task: Task; depth: number; hasChildren: boolean; open: boolean; num: number; range: Range | null; compact: boolean };
	type RowT = GroupRowT | TaskRowT;

	/** I task della vista (ambito + filtro «completati»): è anche l'insieme che si esporta in Mermaid. */
	const shown = $derived(
		sortTasks(
			store.tasks.filter((x) => inScope(x, scope, store.filters, store.blockedIds) && (showDone || !x.completed)),
			'manual'
		)
	);

	/** Task in ritardo: scaduti e non completati, oppure che iniziano prima della fine di un prerequisito non completato. */
	const lateIds = $derived.by(() => {
		const out = new Set<string>();
		for (const x of store.tasks) if (!x.completed && x.due_date && x.due_date < today) out.add(x.id);
		for (const d of store.deps) {
			const pre = store.byId.get(d.depends_on_id);
			const post = store.byId.get(d.task_id);
			if (!pre || !post || pre.completed || post.completed) continue;
			const a = rangeOf(pre, false);
			const b = rangeOf(post, false);
			if (a && b && a.e >= b.s) out.add(post.id);
		}
		return out;
	});
	/** I late con i loro antenati: la gerarchia resta leggibile. */
	const lateKeep = $derived.by(() => {
		const keep = new Set<string>();
		for (const id of lateIds) {
			let cur = store.byId.get(id);
			while (cur && !keep.has(cur.id)) {
				keep.add(cur.id);
				cur = cur.parent_id ? store.byId.get(cur.parent_id) : undefined;
			}
		}
		return keep;
	});

	/** Percorso critico: la catena di dipendenze «senza margine» che determina la data di fine. */
	const critical = $derived.by(() => {
		const crit = new Set<string>();
		if (!showCritical) return crit;
		const cand = new Map<string, Range>();
		for (const x of shown) {
			if (x.completed) continue;
			const r = rangeOf(x, false);
			if (r) cand.set(x.id, r);
		}
		const preds = new Map<string, string[]>();
		const linked = new Set<string>();
		for (const d of store.deps) {
			if (!cand.has(d.task_id) || !cand.has(d.depends_on_id)) continue;
			const a = preds.get(d.task_id) ?? [];
			a.push(d.depends_on_id);
			preds.set(d.task_id, a);
			linked.add(d.task_id);
			linked.add(d.depends_on_id);
		}
		let end = '';
		for (const id of linked) {
			const r = cand.get(id)!;
			if (r.e > end) end = r.e;
		}
		const stack = [...linked].filter((id) => cand.get(id)!.e === end);
		while (stack.length) {
			const id = stack.pop()!;
			if (crit.has(id)) continue;
			crit.add(id);
			const cur = cand.get(id)!;
			for (const p of preds.get(id) ?? []) {
				// «senza margine»: il prerequisito finisce al più il giorno prima dell'inizio
				if (diffDays(cur.s, cand.get(p)!.e) <= 1) stack.push(p);
			}
		}
		return crit;
	});

	const tree = $derived.by(() => {
		const matched = shown.filter((x) => (showExcluded || x.in_gantt) && (!onlyLate || lateKeep.has(x.id)));
		const ids = new Set(matched.map((x) => x.id));
		const kids = new Map<string, Task[]>();
		for (const x of matched) {
			if (x.parent_id && ids.has(x.parent_id)) {
				const a = kids.get(x.parent_id) ?? [];
				a.push(x);
				kids.set(x.parent_id, a);
			}
		}
		const groupOf = (x: Task) => (x.group_id && store.groupsById.has(x.group_id) ? x.group_id : null);
		const roots = new Map<string | null, Task[]>();
		for (const x of matched) {
			if (x.parent_id && ids.has(x.parent_id)) continue;
			const g = groupOf(x);
			const a = roots.get(g) ?? [];
			a.push(x);
			roots.set(g, a);
		}

		const subtreeRange = (x: Task): Range | null => {
			let r = rangeOf(x);
			for (const c of kids.get(x.id) ?? []) r = union(r, subtreeRange(c));
			return r;
		};
		const groupRange = (gid: string): Range | null => {
			let r: Range | null = null;
			for (const x of roots.get(gid) ?? []) r = union(r, subtreeRange(x));
			for (const g of store.groupChildren(gid)) r = union(r, groupRange(g.id));
			return r;
		};

		const out: RowT[] = [];
		const walkTask = (x: Task, depth: number, num: number) => {
			const c = kids.get(x.id) ?? [];
			const open = !collapsedTasks.has(x.id);
			out.push({ kind: 'task', id: x.id, task: x, depth, hasChildren: c.length > 0, open, num, range: rangeOf(x), compact: !x.in_gantt });
			if (open) c.forEach((k, i) => walkTask(k, depth + 1, i + 1));
		};
		const walk = (parent: string | null, depth: number) => {
			for (const g of store.groupChildren(parent)) {
				const isCollapsed = collapsedGroups.has(g.id);
				out.push({ kind: 'group', id: g.id, name: g.name, depth, collapsed: isCollapsed, range: groupRange(g.id) });
				if (!isCollapsed) walk(g.id, depth + 1);
			}
			(roots.get(parent) ?? []).forEach((x, i) => walkTask(x, depth, i + 1));
		};
		walk(null, 0);
		return { rows: out, kids };
	});
	const rows = $derived(tree.rows);

	// ---- asse del tempo -------------------------------------------------------------
	const bounds = $derived.by(() => {
		let min = today;
		let max = today;
		for (const x of store.tasks) {
			if (!x.due_date) continue;
			// senza l'anteprima del trascinamento: l'asse non deve spostarsi mentre si trascina
			const r = rangeOf(x, false);
			if (!r) continue;
			if (r.s < min) min = r.s;
			if (r.e > max) max = r.e;
		}
		const lead = zoom === 'day' ? 7 : zoom === 'week' ? 21 : 60;
		const trail = zoom === 'day' ? 21 : zoom === 'week' ? 42 : 120;
		const origin = zoom === 'month' ? startOfMonth(addDays(min, -lead)) : startOfWeek(addDays(min, -lead));
		let end = addDays(max, trail);
		if (diffDays(end, origin) < MIN_SPAN[zoom]) end = addDays(origin, MIN_SPAN[zoom]);
		return { origin, days: diffDays(end, origin) + 1 };
	});
	const origin = $derived(bounds.origin);
	const totalW = $derived(bounds.days * px);
	// altezze variabili: i task esclusi dal Gantt occupano una riga sottile
	const heights = $derived(rows.map((r) => (r.kind === 'task' && r.compact ? ROW_H_MIN : ROW_H)));
	const ys = $derived.by(() => {
		const a: number[] = [];
		let y = 0;
		for (const h of heights) {
			a.push(y);
			y += h;
		}
		return a;
	});
	const bodyH = $derived(heights.reduce((a, b) => a + b, 0));
	/** Righe da disegnare: solo quelle vicine all'area visibile (oltre ~120 righe). */
	const win = $derived.by(() => {
		if (rows.length <= 120) return { a: 0, b: rows.length };
		const top = scrollTop - HEAD_H - 500;
		const bottom = scrollTop - HEAD_H + viewH + 500;
		let a = 0;
		while (a < rows.length - 1 && ys[a] + heights[a] < top) a++;
		let b = a;
		while (b < rows.length && ys[b] < bottom) b++;
		return { a, b };
	});
	const visible = $derived(rows.slice(win.a, win.b));
	const x = (iso: string) => diffDays(iso, origin) * px;

	// intestazioni (riga alta + riga bassa)
	type Cell = { left: number; width: number; label: string; weekend?: boolean; today?: boolean };
	const head = $derived.by(() => {
		const loc = locale();
		const fMonthYear = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' });
		const fMonth = new Intl.DateTimeFormat(loc, { month: 'short' });
		const fWd = new Intl.DateTimeFormat(loc, { weekday: 'narrow' });
		const upper: Cell[] = [];
		const lower: Cell[] = [];
		const last = addDays(origin, bounds.days - 1);

		if (zoom === 'month') {
			let cur = origin;
			let curYear = -1;
			while (cur <= last) {
				const d = parseISO(cur);
				const next = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 1));
				const left = x(cur);
				lower.push({ left, width: x(next) - left, label: fMonth.format(d) });
				if (d.getFullYear() !== curYear) {
					curYear = d.getFullYear();
					upper.push({ left, width: 0, label: String(curYear) });
				}
				cur = next;
			}
		} else {
			let cur = origin;
			let curMonth = -1;
			while (cur <= last) {
				const d = parseISO(cur);
				const key = d.getFullYear() * 12 + d.getMonth();
				if (key !== curMonth) {
					curMonth = key;
					upper.push({ left: x(cur), width: 0, label: fMonthYear.format(d) });
				}
				if (zoom === 'day') {
					const dow = d.getDay();
					lower.push({ left: x(cur), width: px, label: `${fWd.format(d)} ${d.getDate()}`, weekend: dow === 0 || dow === 6, today: cur === today });
					cur = addDays(cur, 1);
				} else {
					lower.push({ left: x(cur), width: 7 * px, label: String(d.getDate()), today: cur <= today && today < addDays(cur, 7) });
					cur = addDays(cur, 7);
				}
			}
		}
		for (let i = 0; i < upper.length; i++) upper[i].width = (i + 1 < upper.length ? upper[i + 1].left : totalW) - upper[i].left;
		return { upper, lower };
	});

	// weekend: strisce di sfondo (solo con lo zoom a giorni)
	const weekends = $derived.by(() => {
		if (zoom !== 'day') return [] as number[];
		const out: number[] = [];
		for (let i = 0; i < bounds.days; i++) {
			const dow = parseISO(addDays(origin, i)).getDay();
			if (dow === 6) out.push(i * px);
		}
		return out;
	});

	const gridBg = $derived.by(() => {
		const step = zoom === 'day' ? px : zoom === 'week' ? 7 * px : 0;
		if (!step) return 'none';
		return `repeating-linear-gradient(to right, transparent 0 ${step - 1}px, color-mix(in srgb, var(--border) 55%, transparent) ${step - 1}px ${step}px)`;
	});

	// ---- colori / avanzamento ---------------------------------------------------
	const colorOf = (task: Task) => `var(--p${task.priority})`;
	/** 0..1: completato = 1; con sotto-task = quota dei completati. */
	function progressOf(task: Task): number {
		if (task.completed) return 1;
		const c = tree.kids.get(task.id) ?? [];
		if (!c.length) return 0;
		return c.filter((k) => k.completed).length / c.length;
	}

	// ---- trascinamento delle barre ----------------------------------------------------
	let moved = false;
	function startDrag(ev: PointerEvent, task: Task, mode: Drag['mode']) {
		if (ev.button !== 0) return;
		ev.preventDefault();
		ev.stopPropagation();
		const x0 = ev.clientX;
		moved = false;
		drag = { id: task.id, mode, delta: 0 };
		const move = (m: PointerEvent) => {
			const delta = Math.round((m.clientX - x0) / px);
			if (Math.abs(m.clientX - x0) > 3) moved = true;
			if (drag && drag.delta !== delta) drag = { ...drag, delta };
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
			const d = drag;
			const r = d ? rangeOf(task) : null;
			drag = null;
			if (d && d.delta && r) store.updateTask(task.id, { start_date: r.s, due_date: r.e });
			else if (!moved) ui.selectedTaskId = task.id;
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
	}

	// tastiera: Invio/Spazio apre il task, Alt+←/→ sposta di un giorno
	function barKey(e: KeyboardEvent, task: Task) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			ui.selectedTaskId = task.id;
		} else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
			e.preventDefault();
			const r = rangeOf(task, false);
			if (!r) return;
			const d = e.key === 'ArrowLeft' ? -1 : 1;
			store.updateTask(task.id, { start_date: addDays(r.s, d), due_date: addDays(r.e, d) });
		}
	}

	// ---- nuova dipendenza: si trascina dal bordo destro di una barra su un'altra barra ---------
	let link = $state<{ x1: number; y1: number; x2: number; y2: number; to: string | null } | null>(null);
	function startLink(ev: PointerEvent, task: Task, r: Range, i: number) {
		if (ev.button !== 0) return;
		ev.preventDefault();
		ev.stopPropagation();
		const x1 = x(r.e) + px;
		const y1 = ys[i] + heights[i] / 2;
		link = { x1, y1, x2: x1, y2: y1, to: null };
		const targetAt = (m: PointerEvent) => {
			const el = document.elementFromPoint(m.clientX, m.clientY)?.closest<HTMLElement>('[data-bar]');
			const id = el?.dataset.taskId ?? null;
			return id && id !== task.id ? id : null;
		};
		const move = (m: PointerEvent) => {
			const rect = body.getBoundingClientRect();
			if (link) link = { ...link, x2: m.clientX - rect.left, y2: m.clientY - rect.top, to: targetAt(m) };
		};
		const end = (m: PointerEvent, commit: boolean) => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', cancel);
			const to = commit ? targetAt(m) : null;
			link = null;
			if (to) {
				// il task di arrivo dipende da quello di partenza
				store.addDep(to, task.id).then((ok) => showToast(ok ? t('Dipendenza creata') : t('Dipendenza circolare: non consentita')));
			}
		};
		const up = (m: PointerEvent) => end(m, true);
		const cancel = (m: PointerEvent) => end(m, false);
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', cancel);
	}

	// doppio clic su una riga senza scadenza: fissa la scadenza in quel giorno
	let body: HTMLDivElement;
	function bodyDblClick(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('[data-bar]')) return;
		const rect = body.getBoundingClientRect();
		const y = e.clientY - rect.top;
		let idx = ys.findIndex((top, i) => y >= top && y < top + heights[i]);
		const row = idx >= 0 ? rows[idx] : undefined;
		if (!row || row.kind !== 'task' || row.compact || row.task.due_date) return;
		store.updateTask(row.task.id, { due_date: addDays(origin, Math.floor((e.clientX - rect.left) / px)) });
	}

	// ---- frecce delle dipendenze -------------------------------------------------------
	const rowIndex = $derived(new Map(rows.map((r, i) => [r.id, i])));
	type Arrow = { d: string; late: boolean; crit: boolean };
	const arrows = $derived.by(() => {
		const out: Arrow[] = [];
		for (const dep of store.deps) {
			const a = rowIndex.get(dep.depends_on_id);
			const b = rowIndex.get(dep.task_id);
			if (a === undefined || b === undefined) continue;
			const ra = rows[a];
			const rb = rows[b];
			if (ra.kind !== 'task' || rb.kind !== 'task' || !ra.range || !rb.range) continue;
			const x1 = x(ra.range.e) + px;
			const y1 = ys[a] + heights[a] / 2;
			const x2 = x(rb.range.s);
			const y2 = ys[b] + heights[b] / 2;
			let d: string;
			if (x2 >= x1 + 14) {
				const xm = x1 + 7;
				d = `M${x1},${y1} H${xm} V${y2} H${x2 - 1}`;
			} else {
				const yb = y2 > y1 ? y2 - ROW_H / 2 : y2 + ROW_H / 2;
				d = `M${x1},${y1} H${x1 + 7} V${yb} H${x2 - 8} V${y2} H${x2 - 1}`;
			}
			out.push({ d, late: ra.range.e >= rb.range.s && !ra.task.completed, crit: critical.has(ra.id) && critical.has(rb.id) });
		}
		return out;
	});

	// ---- scorrimento / zoom -------------------------------------------------------------
	let scroller: HTMLDivElement;
	function scrollToToday(smooth = false) {
		if (!scroller) return;
		const left = x(today) - (scroller.clientWidth - LEFT_W) / 2;
		scroller.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
	}
	function onScroll() {
		if (!scroller) return;
		scrollTop = scroller.scrollTop;
		viewH = scroller.clientHeight;
	}
	onMount(() => {
		viewH = scroller.clientHeight;
		tick().then(() => scrollToToday());
	});
	async function setZoom(z: Zoom) {
		if (z === zoom) return;
		const center = (scroller.scrollLeft + (scroller.clientWidth - LEFT_W) / 2) / px;
		const centerDate = addDays(origin, Math.round(center));
		go({ gz: z === 'week' ? null : z });
		await tick();
		await tick();
		scroller.scrollLeft = Math.max(0, x(centerDate) - (scroller.clientWidth - LEFT_W) / 2);
	}

	function toggleTask(id: string) {
		if (collapsedTasks.has(id)) collapsedTasks.delete(id);
		else collapsedTasks.add(id);
	}
	// ---- esportazione Mermaid -----------------------------------------------------
	const exportTitle = $derived.by(() => {
		const s = parseScope(nav.scope);
		if (s.kind === 'list') return store.listOf(s.id)?.name ?? t('Lista');
		if (s.kind === 'tag') return '#' + s.id;
		if (s.kind === 'filter') return store.filters.find((f) => f.id === s.id)?.name ?? t('Filtro');
		return t('Tutti i task');
	});
	async function exportMermaid() {
		try {
			const dest = await exportGanttMd(shown, exportTitle);
			if (dest === 'empty') showToast(t('Nessun task da esportare nel Gantt'));
			else if (dest) showToast(t('Gantt esportato in Mermaid'));
		} catch (e) {
			console.error(e);
			showToast(t('Esportazione non riuscita'));
		}
	}
	async function copyMermaid() {
		const md = ganttToMermaid(shown, exportTitle);
		if (!md) return showToast(t('Nessun task da esportare nel Gantt'));
		try {
			await navigator.clipboard.writeText(md);
			showToast(t('Mermaid copiato negli appunti'));
		} catch {
			showToast(t('Operazione non riuscita'));
		}
	}

	const fmtDay = (iso: string) => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(parseISO(iso));
	const tip = (task: Task, r: Range | null) => (r ? `${task.title}\n${fmtDay(r.s)} → ${fmtDay(r.e)}` : task.title);
</script>

<div class="flex h-full min-w-0 flex-1 flex-col">
	<!-- barra degli strumenti -->
	<div class="flex h-11 shrink-0 items-center gap-3 border-b border-border px-5">
		<div class="flex rounded-lg bg-hover p-0.5">
			{#each zooms as z (z.id)}
				<button
					class="h-7 rounded-md px-2.5 text-[12.5px] font-medium transition-colors {zoom === z.id ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}"
					onclick={() => setZoom(z.id)}>{t(z.label)}</button>
			{/each}
		</div>
		<button class="btn" onclick={() => scrollToToday(true)}><Target size={14} />{t('Oggi')}</button>
		<label class="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted select-none">
			<input type="checkbox" bind:checked={showDone} class="accent-[var(--accent)]" />{t('Mostra completati')}
		</label>
		<label class="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted select-none" title={t('I task esclusi dal Gantt restano come righe sottili, senza barra')}>
			<input type="checkbox" bind:checked={showExcluded} class="accent-[var(--accent)]" />{t('Mostra esclusi')}
		</label>
		<label class="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted select-none" title={t('Evidenzia la catena di dipendenze che determina la data di fine')}>
			<input type="checkbox" bind:checked={showCritical} class="accent-[var(--accent)]" />{t('Percorso critico')}
		</label>
		<label class="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted select-none" title={t('Solo task scaduti o che iniziano prima della fine di un prerequisito')}>
			<input type="checkbox" bind:checked={onlyLate} class="accent-[var(--accent)]" />{t('Solo in ritardo')}
		</label>
		<span class="ml-auto hidden truncate text-[12px] text-faint xl:block">{t('Trascina le barre per spostarle o ridimensionarle · dal bordo destro di una barra a un’altra per creare una dipendenza')}</span>
		<div class="flex shrink-0 items-center gap-1">
			<button class="btn" title={t('Esporta in Mermaid (.md)')} onclick={exportMermaid}><Download size={14} />Mermaid</button>
			<button class="icon-btn" title={t('Copia Mermaid')} aria-label={t('Copia Mermaid')} onclick={copyMermaid}><Copy size={15} /></button>
		</div>
	</div>

	<div bind:this={scroller} class="relative min-h-0 flex-1 overflow-auto" data-scroll="xy" onscroll={onScroll}>
		{#if rows.length === 0}
			<p class="sticky left-0 mx-auto mt-24 max-w-[380px] text-center text-[13px] text-muted">{t('Nessun task da mostrare nel Gantt. Aggiungi task con una scadenza, oppure attiva «Mostra esclusi» nella barra in alto.')}</p>
		{/if}
		<div style="width:{LEFT_W + totalW}px; min-height:100%">
			<!-- intestazione -->
			<div class="sticky top-0 z-30 flex bg-panel" style="height:{HEAD_H}px">
				<div class="sticky left-0 z-40 flex shrink-0 items-end border-r border-b border-border bg-panel px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-faint uppercase" style="width:{LEFT_W}px">{t('Attività')}</div>
				<div class="relative border-b border-border" style="width:{totalW}px">
					{#each head.upper as c (c.left)}
						<div class="absolute top-0 truncate border-l border-border px-2 pt-1 text-[11.5px] font-semibold capitalize" style="left:{c.left}px; width:{c.width}px; height:{HEAD_H / 2}px">{c.label}</div>
					{/each}
					{#each head.lower as c (c.left)}
						<div
							class="absolute truncate border-t border-l border-border text-center text-[11px] leading-[26px] {c.weekend ? 'bg-hover/60 text-faint' : 'text-muted'} {c.today ? 'font-bold text-accent' : ''}"
							style="left:{c.left}px; width:{c.width}px; top:{HEAD_H / 2}px; height:{HEAD_H / 2}px">{c.label}</div>
					{/each}
				</div>
			</div>

			<div class="flex">
				<!-- albero (sempre visibile a sinistra) -->
				<div class="sticky left-0 z-20 shrink-0 overflow-hidden border-r border-border bg-panel" style="width:{LEFT_W}px; height:{bodyH}px">
					<div style="height:{ys[win.a] ?? 0}px"></div>
					{#each visible as r, k (r.kind + r.id)}
						{@const i = win.a + k}
						{#if r.kind === 'group'}
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
							<div class="flex cursor-pointer items-center gap-1.5 border-b border-border pr-2 hover:bg-hover" style="height:{heights[i]}px; padding-left:{8 + r.depth * 18}px" onclick={() => toggleGroup(r.id)}>
								<span class="grid w-4 shrink-0 place-items-center text-faint"><ChevronRight size={14} class="transition-transform duration-150 {r.collapsed ? '' : 'rotate-90'}" /></span>
								{#if r.collapsed}<Folder size={16} class="shrink-0 text-accent" />{:else}<FolderOpen size={16} class="shrink-0 text-accent" />{/if}
								<span class="min-w-0 truncate text-[13px] font-semibold" title={r.name}>{r.name}</span>
								{#if ecoShow('gantt')}<MoneyChip money={groupMoney(r.id)} class="ml-auto" />{/if}
							</div>
						{:else if r.compact}
							{@const task = r.task}
							<!-- task escluso dal Gantt: riga sottile, nessuna barra -->
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
							<div
								data-task
								role="button"
								tabindex="0"
								onkeydown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ui.selectedTaskId = task.id; } }}
								class="group/row flex cursor-pointer items-center gap-1.5 border-b border-border pr-2 hover:bg-hover {ui.selectedTaskId === task.id ? 'bg-active hover:bg-active' : ''}"
								style="height:{heights[i]}px; padding-left:{8 + r.depth * 18}px"
								onclick={() => (ui.selectedTaskId = task.id)}
							>
								<span class="grid w-4 shrink-0 place-items-center">
									{#if r.hasChildren}
										<button class="grid place-items-center text-faint hover:text-fg" aria-label={t('Espandi')} onclick={(e) => { e.stopPropagation(); toggleTask(task.id); }}>
											<ChevronRight size={12} class="transition-transform duration-150 {r.open ? 'rotate-90' : ''}" />
										</button>
									{/if}
								</span>
								<span class="min-w-0 flex-1 truncate text-[11px] text-faint italic {task.completed ? 'line-through' : ''}" title={task.title + ' — ' + t('escluso dal Gantt')}>{task.title}</span>
								<button class="icon-btn size-4 shrink-0 opacity-0 group-hover/row:opacity-100" title={t('Mostra nel Gantt')} aria-label={t('Mostra nel Gantt')} onclick={(e) => { e.stopPropagation(); store.updateTask(task.id, { in_gantt: true }); }}><Eye size={11} /></button>
							</div>
						{:else}
							{@const task = r.task}
							{@const done = task.completed}
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
							<div
								data-task
								role="button"
								tabindex="0"
								onkeydown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ui.selectedTaskId = task.id; } }}
								class="group/row flex cursor-pointer items-center gap-1.5 border-b border-border pr-2 hover:bg-hover {ui.selectedTaskId === task.id ? 'bg-active hover:bg-active' : ''}"
								style="height:{heights[i]}px; padding-left:{8 + r.depth * 18}px"
								onclick={() => (ui.selectedTaskId = task.id)}
							>
								<span class="grid w-4 shrink-0 place-items-center">
									{#if r.hasChildren}
										<button class="grid place-items-center text-faint hover:text-fg" aria-label={t('Espandi')} onclick={(e) => { e.stopPropagation(); toggleTask(task.id); }}>
											<ChevronRight size={14} class="transition-transform duration-150 {r.open ? 'rotate-90' : ''}" />
										</button>
									{/if}
								</span>
								<Checkbox checked={done} size={16} color={colorOf(task)} blocked={!done && store.blockedIds.has(task.id)} onchange={(v) => store.setCompleted(task.id, v)} />
								{#if uiprefs.showNumbers && r.num > 0}<span class="min-w-[1.25em] shrink-0 text-right text-[12.5px] font-semibold text-accent tabular-nums">{r.num}</span>{/if}
								<span class="min-w-0 flex-1 truncate text-[13px] {done ? 'text-muted line-through' : ''} {task.due_date ? '' : 'italic'}" title={task.due_date ? task.title : task.title + ' — ' + t('senza scadenza')}>{task.title}</span>
								{#if ecoShow('gantt')}<MoneyChip money={chipOf(task)} />{/if}
								<button class="icon-btn size-5 shrink-0 opacity-0 group-hover/row:opacity-100" title={t('Escludi dal Gantt')} aria-label={t('Escludi dal Gantt')} onclick={(e) => { e.stopPropagation(); store.updateTask(task.id, { in_gantt: false }); }}><EyeOff size={12} /></button>
							</div>
						{/if}
					{/each}
				</div>

				<!-- timeline -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div bind:this={body} class="relative shrink-0" style="width:{totalW}px; height:{bodyH}px; background:{gridBg}" ondblclick={bodyDblClick}>
					{#each weekends as wx (wx)}
						<div class="pointer-events-none absolute top-0 bottom-0 bg-hover/50" style="left:{wx}px; width:{px * 2}px"></div>
					{/each}
					<div class="pointer-events-none absolute top-0 bottom-0 z-[5] w-0.5 bg-accent/80" style="left:{x(today) + px / 2 - 1}px"></div>

					<svg aria-hidden="true" class="pointer-events-none absolute top-0 left-0 z-[6]" width={totalW} height={bodyH}>
						<defs>
							<marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--muted)" /></marker>
							<marker id="gantt-arrow-late" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--p3)" /></marker>
						</defs>
						{#each arrows as a}
							<path d={a.d} fill="none" style="stroke:{a.late || a.crit ? 'var(--p3)' : 'var(--muted)'}" stroke-width={a.crit ? 2.2 : 1.4} marker-end="url(#{a.late || a.crit ? 'gantt-arrow-late' : 'gantt-arrow'})" opacity="0.9" />
						{/each}
						{#if link}
							<path d="M{link.x1},{link.y1} L{link.x2},{link.y2}" fill="none" stroke-dasharray="4 3" stroke-width="1.8" style="stroke:{link.to ? 'var(--accent)' : 'var(--muted)'}" />
						{/if}
					</svg>

					{#each visible as r, k (r.kind + r.id)}
						{@const i = win.a + k}
						<div class="pointer-events-none absolute right-0 left-0 border-b border-border" style="top:{ys[i]}px; height:{heights[i]}px"></div>
						{#if r.range}
							{@const left = x(r.range.s)}
							{@const width = Math.max(6, (diffDays(r.range.e, r.range.s) + 1) * px)}
							{#if r.kind === 'group'}
								<!-- barra di riepilogo della cartella: dal primo inizio all'ultima scadenza -->
								<div class="pointer-events-none absolute z-[4] rounded-sm bg-accent/70" style="left:{left}px; width:{width}px; top:{ys[i] + heights[i] / 2 - 4}px; height:8px"></div>
							{:else}
								{@const task = r.task}
								{@const prog = progressOf(task)}
								{@const color = colorOf(task)}
								{@const dragging = drag?.id === task.id}
								{@const isCrit = showCritical && critical.has(task.id)}
								{@const dim = showCritical && !critical.has(task.id)}
								{#if task.milestone}
									<!-- traguardo: rombo sulla scadenza -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										data-bar
										data-task
										data-task-id={task.id}
										role="button"
										tabindex="0"
										aria-label={tip(task, r.range).replace('\n', ', ')}
										onkeydown={(e) => barKey(e, task)}
										title={tip(task, r.range)}
										class="absolute z-[7] cursor-grab {dragging ? 'cursor-grabbing' : ''}"
										style="left:{left + px / 2 - 9}px; top:{ys[i] + (ROW_H - 18) / 2}px; width:18px; height:18px; opacity:{task.completed ? 0.55 : dim ? 0.4 : 1}"
										onpointerdown={(e) => startDrag(e, task, 'move')}
									>
										<div class="absolute inset-[2px] rotate-45 rounded-[3px] border-2 {ui.selectedTaskId === task.id ? 'ring-2 ring-accent' : ''}" style="border-color:{isCrit ? 'var(--p3)' : color}; background:{task.completed ? color : 'var(--panel)'}"></div>
									</div>
									<div class="pointer-events-none absolute z-[7] truncate text-[11.5px] text-muted" style="left:{left + px / 2 + 30}px; top:{ys[i] + (ROW_H - BAR_H) / 2}px; line-height:{BAR_H}px; max-width:260px">{task.title}</div>
								{:else}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									data-bar
									data-task
									data-task-id={task.id}
									role="button"
									tabindex="0"
									aria-label={tip(task, r.range).replace('\n', ', ')}
									onkeydown={(e) => barKey(e, task)}
									title={tip(task, r.range)}
									class="group/bar absolute z-[7] cursor-grab overflow-hidden rounded-md border text-[11.5px] leading-[18px] {ui.selectedTaskId === task.id ? 'ring-2 ring-accent' : ''} {dragging ? 'cursor-grabbing shadow-lg' : ''} {!task.completed && store.blockedIds.has(task.id) ? 'border-dashed' : ''}"
									style="left:{left}px; width:{width}px; top:{ys[i] + (ROW_H - BAR_H) / 2}px; height:{BAR_H}px; border-color:{isCrit ? 'var(--p3)' : color}; border-width:{isCrit ? 2 : 1}px; background:color-mix(in srgb, {color} 22%, var(--panel)); opacity:{task.completed ? 0.55 : dim ? 0.4 : 1}"
									onpointerdown={(e) => startDrag(e, task, 'move')}
								>
									<div class="pointer-events-none absolute inset-y-0 left-0" style="width:{prog * 100}%; background:color-mix(in srgb, {color} 75%, transparent)"></div>
									{#if width >= 70}
										<span class="pointer-events-none relative block truncate px-2 font-medium {prog > 0.5 ? 'text-white' : ''}">{task.title}</span>
									{/if}
									<div class="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize" onpointerdown={(e) => startDrag(e, task, 'start')}></div>
									<div class="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" onpointerdown={(e) => startDrag(e, task, 'end')}></div>
								</div>
								{#if width < 70}
									<div class="pointer-events-none absolute z-[7] truncate text-[11.5px] text-muted" style="left:{left + width + 22}px; top:{ys[i] + (ROW_H - BAR_H) / 2}px; line-height:{BAR_H}px; max-width:260px">{task.title}</div>
								{/if}
								{/if}
								<!-- maniglia per creare una dipendenza: si trascina su un'altra barra -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									data-task
									class="group/h absolute z-[8] grid cursor-crosshair place-items-center"
									style="left:{left + (task.milestone ? px / 2 + 9 : width)}px; top:{ys[i] + (ROW_H - BAR_H) / 2}px; width:16px; height:{BAR_H}px"
									title={t('Trascina su un’altra barra per creare una dipendenza')}
									onpointerdown={(e) => startLink(e, task, r.range!, i)}
								>
									<span class="size-2.5 rounded-full border-2 border-accent bg-panel transition-opacity {ui.selectedTaskId === task.id || link?.to === task.id ? 'opacity-100' : 'opacity-0 group-hover/h:opacity-100'}"></span>
								</div>
							{/if}
						{/if}
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
