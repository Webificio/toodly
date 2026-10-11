<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { mIn, mOut } from '../motion';
	import { t } from '../i18n.svelte';

	let {
		open = $bindable(false),
		title,
		width = 460,
		children
	}: { open: boolean; title: string; width?: number; children: Snippet } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay forceMount>
			{#snippet child({ props, open })}
				{#if open}
					<div {...props} class="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" in:mIn={{ duration: 0.18 }} out:mOut={{ duration: 0.15 }}></div>
				{/if}
			{/snippet}
		</Dialog.Overlay>
		<div class="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
			<Dialog.Content forceMount>
				{#snippet child({ props, open })}
					{#if open}
						<div
							{...props}
							class="pointer-events-auto flex max-h-[88vh] w-full flex-col rounded-2xl border border-border bg-elev shadow-pop"
							style="max-width:{width}px"
							in:mIn={{ y: 14, scale: 0.97, duration: 0.26 }}
							out:mOut={{ y: 8, scale: 0.98, duration: 0.16 }}
						>
							<div class="flex items-center justify-between px-5 pt-4 pb-2">
								<Dialog.Title class="text-[15px] font-semibold">{title}</Dialog.Title>
								<Dialog.Close class="icon-btn" aria-label={t('Chiudi')}><X size={16} /></Dialog.Close>
							</div>
							<div class="overflow-auto px-5 pt-2 pb-5">{@render children()}</div>
						</div>
					{/if}
				{/snippet}
			</Dialog.Content>
		</div>
	</Dialog.Portal>
</Dialog.Root>
