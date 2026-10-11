<script lang="ts">
	import { Check, Lock } from '@lucide/svelte';
	import { t } from '../i18n.svelte';
	import { pop } from '../motion';

	let {
		checked,
		color = 'var(--p0)',
		size = 18,
		blocked = false,
		onchange
	}: { checked: boolean; color?: string; size?: number; blocked?: boolean; onchange: (v: boolean) => void } = $props();
</script>

<button
	type="button"
	role="checkbox"
	aria-checked={checked}
	aria-label={t('Completa')}
	class="grid shrink-0 place-items-center rounded-full border-2 transition-colors duration-150 {blocked && !checked ? 'border-dashed' : ''}"
	style="width:{size}px;height:{size}px;border-color:{color};background:{checked
		? color
		: `color-mix(in srgb, ${color} 10%, transparent)`}"
	onclick={(e) => {
		e.stopPropagation();
		onchange(!checked);
	}}
>
	{#if blocked && !checked}
		<Lock size={size - 9} strokeWidth={3} class="text-p2" />
	{:else if checked}
		<span use:pop class="grid place-items-center text-white"><Check size={size - 8} strokeWidth={3.6} /></span>
	{/if}
</button>
