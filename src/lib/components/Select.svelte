<script lang="ts">
	import { t } from '../i18n.svelte';
	import { Select } from 'bits-ui';
	import { Check, ChevronDown } from '@lucide/svelte';

	interface Opt {
		value: string;
		label: string;
		color?: string;
	}
	let {
		value,
		options,
		onchange,
		placeholder,
		class: cls = ''
	}: { value: string; options: Opt[]; onchange: (v: string) => void; placeholder?: string; class?: string } = $props();

	const current = $derived(options.find((o) => o.value === value));
</script>

<Select.Root type="single" {value} onValueChange={(v) => onchange(v)} items={options}>
	<Select.Trigger class="field flex items-center justify-between gap-2 text-left {cls}">
		<span class="flex min-w-0 items-center gap-2 truncate">
			{#if current?.color}<span class="size-2.5 shrink-0 rounded-full" style="background:{current.color}"></span>{/if}
			<span class="truncate">{current?.label ?? placeholder ?? t('Seleziona')}</span>
		</span>
		<ChevronDown size={14} class="shrink-0 text-faint" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content class="menu max-h-72 overflow-auto" sideOffset={4}>
			<Select.Viewport>
				{#each options as o (o.value)}
					<Select.Item value={o.value} label={o.label} class="menu-item">
						{#snippet children({ selected })}
							{#if o.color}<span class="size-2.5 rounded-full" style="background:{o.color}"></span>{/if}
							<span class="flex-1">{o.label}</span>
							{#if selected}<Check size={14} />{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
