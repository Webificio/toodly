<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { CalendarDays, Flag, Layers, CheckCheck, Undo2, Trash2, Check } from '@lucide/svelte';
	import { store } from '../store.svelte';
	import { askConfirm, ui } from '../nav.svelte';
	import { t } from '../i18n.svelte';
	import { addDays, todayISO, relativeDay } from '../dates';
	import { PRIORITIES, STATUSES, type Priority, type Status, type Task } from '../types';

	let { task, onmenu }: { task: Task; onmenu?: (open: boolean) => void } = $props();

	let dateOpen = $state(false);
	let prioOpen = $state(false);
	let statusOpen = $state(false);
	$effect(() => onmenu?.(dateOpen || prioOpen || statusOpen));

	const prio = $derived(PRIORITIES.find((p) => p.value === task.priority)!);
	const statusValue = $derived(task.completed ? 'done' : task.status);
	const statusLabel = $derived(STATUSES.find((s) => s.value === statusValue)?.label ?? '');
	const blocked = $derived(!task.completed && store.blockedIds.has(task.id));

	function setDue(due: string | null) {
		store.updateTask(task.id, due ? { due_date: due } : { due_date: null, start_time: null, end_time: null, remind_min: null, recurrence: 'none' });
		dateOpen = false;
	}

	function complete() {
		if (task.completed || blocked) return store.setCompleted(task.id, !task.completed);
		askConfirm({
			title: t('Completa task'),
			message: t('Sei sicuro di voler marcare «{title}» come completato?', { title: task.title }),
			label: t('Completa'),
			run: () => store.setCompleted(task.id, true)
		});
	}
	function remove() {
		const n = store.descendants(task.id).length;
		askConfirm({
			title: t('Elimina task'),
			message: t('Sei sicuro di voler eliminare «{title}»?', { title: task.title }) + (n ? ' ' + t('Verranno eliminati anche {n} sotto-task.', { n }) : ''),
			label: t('Elimina'),
			danger: true,
			run: async () => {
				if (ui.selectedTaskId === task.id) ui.selectedTaskId = null;
				await store.deleteTask(task.id);
			}
		});
	}

	const trigger = 'inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11.5px] text-muted transition-colors hover:bg-active hover:text-fg data-[state=open]:bg-active data-[state=open]:text-fg';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="flex items-center gap-0.5 rounded-lg border border-border bg-panel px-1 py-0.5 shadow-sm" onclick={(e) => e.stopPropagation()} data-nodrag>
	<!-- scadenza -->
	<DropdownMenu.Root bind:open={dateOpen}>
		<DropdownMenu.Trigger class={trigger} title={t('Scadenza')}>
			<CalendarDays size={14} />{#if task.due_date}<span class="max-w-20 truncate">{relativeDay(task.due_date)}</span>{/if}
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content class="menu" sideOffset={4} align="end">
				<DropdownMenu.Item class="menu-item" onSelect={() => setDue(todayISO())}>{t('Oggi')}</DropdownMenu.Item>
				<DropdownMenu.Item class="menu-item" onSelect={() => setDue(addDays(todayISO(), 1))}>{t('Domani')}</DropdownMenu.Item>
				<DropdownMenu.Item class="menu-item" onSelect={() => setDue(addDays(todayISO(), 7))}>{t('Tra una settimana')}</DropdownMenu.Item>
				<div class="px-1.5 py-1"><input type="date" class="field h-8" value={task.due_date ?? ''} onchange={(e) => e.currentTarget.value && setDue(e.currentTarget.value)} /></div>
				{#if task.due_date}
					<DropdownMenu.Separator class="menu-sep" />
					<DropdownMenu.Item class="menu-item" onSelect={() => setDue(null)}>{t('Rimuovi scadenza')}</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>

	<!-- priorità -->
	<DropdownMenu.Root bind:open={prioOpen}>
		<DropdownMenu.Trigger class={trigger} title={t('Priorità')}>
			<Flag size={14} style="color:var(--{prio.cls})" /><span>{prio.label}</span>
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content class="menu" sideOffset={4} align="end">
				{#each PRIORITIES as p}
					<DropdownMenu.Item class="menu-item" data-selected={task.priority === p.value ? '' : undefined} onSelect={() => store.updateTask(task.id, { priority: p.value as Priority })}>
						<Flag size={13} style="color:var(--{p.cls})" />{p.label}{#if task.priority === p.value}<Check size={13} class="ml-auto" />{/if}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>

	<!-- stato -->
	<DropdownMenu.Root bind:open={statusOpen}>
		<DropdownMenu.Trigger class={trigger} title={t('Stato')}>
			<Layers size={14} /><span>{statusLabel}</span>
		</DropdownMenu.Trigger>
		<DropdownMenu.Portal>
			<DropdownMenu.Content class="menu" sideOffset={4} align="end">
				{#each STATUSES as s}
					<DropdownMenu.Item class="menu-item" data-selected={statusValue === s.value ? '' : undefined} onSelect={() => store.setStatus(task.id, s.value as Status)}>
						{s.label}{#if statusValue === s.value}<Check size={13} class="ml-auto" />{/if}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	</DropdownMenu.Root>

	<span class="mx-0.5 h-4 w-px bg-border"></span>
	<button class="icon-btn size-7" title={task.completed ? t('Riapri') : t('Completa')} aria-label={task.completed ? t('Riapri') : t('Completa')} onclick={complete}>
		{#if task.completed}<Undo2 size={14} />{:else}<CheckCheck size={14} />{/if}
	</button>
	<button class="icon-btn size-7 hover:text-p3" title={t('Elimina')} aria-label={t('Elimina')} onclick={remove}><Trash2 size={14} /></button>
</div>
