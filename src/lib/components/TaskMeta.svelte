<script lang="ts">
	import { CalendarDays, Repeat, Paperclip, MessageSquare, ListTree, Hourglass, Link2 } from '@lucide/svelte';
	import { t } from '../i18n.svelte';
	import { store } from '../store.svelte';
	import { relativeDay, diffDays, todayISO } from '../dates';
	import { isOverdue } from '../views';
	import type { Task } from '../types';

	let { task, showList = true }: { task: Task; showList?: boolean } = $props();

	const list = $derived(store.listOf(task.list_id));
	const subs = $derived(store.children(task.id));
	const subsDone = $derived(subs.filter((s) => s.completed).length);
	const nNotes = $derived(store.notesOf(task.id).length);
	const nFiles = $derived(store.attachmentsOf(task.id).length);
	const blockers = $derived(task.completed ? [] : store.blockers(task.id));
	const unlocks = $derived(task.completed ? 0 : store.dependents(task.id).filter((d) => !d.completed).length);
	const dueCls = $derived(
		!task.due_date || task.completed
			? 'text-muted'
			: isOverdue(task)
				? 'text-p3'
				: diffDays(task.due_date, todayISO()) === 0
					? 'text-accent'
					: 'text-muted'
	);
</script>

<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted">
	{#if blockers.length}
		<span class="inline-flex max-w-full items-center gap-1 rounded-full bg-p2/15 px-2 py-px font-medium text-p2" title={blockers.map((b) => b.title).join('\n')}>
			<Hourglass size={11} /><span class="truncate">{t('In attesa di {x}', { x: blockers[0].title })}{blockers.length > 1 ? ` +${blockers.length - 1}` : ''}</span>
		</span>
	{/if}
	{#if unlocks}<span class="inline-flex items-center gap-1" title={t('Task che aspettano questo')}><Link2 size={12} />{t('sblocca {n}', { n: unlocks })}</span>{/if}
	{#if task.due_date}
		<span class="inline-flex items-center gap-1 {dueCls}">
			<CalendarDays size={12} />
			{relativeDay(task.due_date)}{#if task.start_time}&nbsp;{task.start_time}{#if task.end_time}–{task.end_time}{/if}{/if}
		</span>
	{/if}
	{#if task.recurrence !== 'none'}<Repeat size={12} />{/if}
	{#if subs.length}
		<span class="inline-flex items-center gap-1"><ListTree size={12} />{subsDone}/{subs.length}</span>
	{/if}
	{#if nNotes}<span class="inline-flex items-center gap-1"><MessageSquare size={12} />{nNotes}</span>{/if}
	{#if nFiles}<span class="inline-flex items-center gap-1"><Paperclip size={12} />{nFiles}</span>{/if}
	{#if showList && list}
		<span class="inline-flex items-center gap-1"><span class="size-2 rounded-full" style="background:{list.color}"></span>{list.name}</span>
	{/if}
</div>
