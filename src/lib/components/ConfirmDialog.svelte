<script lang="ts">
	import { untrack } from 'svelte';
	import Modal from './Modal.svelte';
	import { ui } from '../nav.svelte';
	import { t } from '../i18n.svelte';

	let open = $state(false);
	let req = $state(ui.confirm);
	let busy = $state(false);

	$effect(() => {
		if (!ui.confirm) return;
		const r = ui.confirm;
		untrack(() => {
			req = r;
			open = true;
		});
	});
	$effect(() => {
		if (!open) ui.confirm = null;
	});

	async function ok() {
		if (!req || busy) return;
		busy = true;
		const run = req.run;
		open = false;
		try {
			await run();
		} finally {
			busy = false;
		}
	}
</script>

<Modal bind:open title={req?.title ?? ''} width={420}>
	<div class="space-y-5">
		<p class="text-[13.5px] leading-relaxed">{req?.message}</p>
		<div class="flex justify-end gap-2">
			<button class="btn" onclick={() => (open = false)}>{t('Annulla')}</button>
			<!-- svelte-ignore a11y_autofocus -->
			<button class="btn {req?.danger ? 'border-p3 bg-p3 text-white hover:opacity-90' : 'btn-primary'}" autofocus onclick={ok}>{req?.label}</button>
		</div>
	</div>
</Modal>
