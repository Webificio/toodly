<script lang="ts">
	import { t } from '../i18n.svelte';
	import { Plus } from '@lucide/svelte';
	let {
		placeholder = t('Aggiungi un task…'),
		onsubmit,
		autofocus = false,
		compact = false
	}: { placeholder?: string; onsubmit: (text: string) => void; autofocus?: boolean; compact?: boolean } = $props();
	let value = $state('');
	let el: HTMLInputElement;
	$effect(() => {
		if (autofocus) el?.focus();
	});
	function submit() {
		const v = value.trim();
		if (!v) return;
		onsubmit(v);
		value = '';
	}
</script>

<div class="flex items-center gap-2 rounded-lg border border-transparent bg-hover px-2.5 transition-colors focus-within:border-accent focus-within:bg-panel {compact ? 'h-8' : 'h-10'}">
	<Plus size={15} class="shrink-0 text-faint" />
	<input
		bind:this={el}
		bind:value
		{placeholder}
		class="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
		onkeydown={(e) => {
			if (e.key === 'Enter' && !e.isComposing) submit();
		}}
	/>
</div>
