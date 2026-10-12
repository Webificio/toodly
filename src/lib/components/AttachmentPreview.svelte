<script lang="ts">
	import { onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { t } from '../i18n.svelte';
	import type { Attachment } from '../types';

	let { file }: { file: Attachment } = $props();

	const ext = $derived((file.name.split('.').pop() ?? '').toLowerCase());
	const IMG: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };
	const TEXT = ['txt', 'md', 'csv', 'json', 'log', 'xml', 'yml', 'yaml', 'ini', 'html', 'css', 'js', 'ts'];
	const kind = $derived<'image' | 'pdf' | 'text' | 'none'>(IMG[ext] ? 'image' : ext === 'pdf' ? 'pdf' : TEXT.includes(ext) ? 'text' : 'none');

	let url = $state('');
	let text = $state('');
	let error = $state('');
	let loading = $state(true);

	$effect(() => {
		const f = file;
		const k = kind;
		let alive = true;
		let made = '';
		loading = true;
		error = '';
		text = '';
		url = '';
		if (k === 'none') {
			loading = false;
			return;
		}
		invoke<ArrayBuffer>('read_attachment', { path: f.path })
			.then((buf) => {
				if (!alive) return;
				if (k === 'text') text = new TextDecoder().decode(buf.slice(0, 6000)) + (buf.byteLength > 6000 ? '\n…' : '');
				else {
					made = URL.createObjectURL(new Blob([buf], { type: k === 'pdf' ? 'application/pdf' : IMG[ext] }));
					url = made;
				}
			})
			.catch((e) => {
				if (alive) error = typeof e === 'string' ? e : t('Anteprima non disponibile');
			})
			.finally(() => {
				if (alive) loading = false;
			});
		return () => {
			alive = false;
			if (made) URL.revokeObjectURL(made);
		};
	});
	onDestroy(() => {
		if (url) URL.revokeObjectURL(url);
	});
</script>

<div class="mt-1 overflow-hidden rounded-lg border border-border bg-sidebar/50 p-2">
	{#if loading}
		<p class="text-[12px] text-faint">{t('Caricamento…')}</p>
	{:else if error}
		<p class="text-[12px] text-faint">{error}</p>
	{:else if kind === 'none'}
		<p class="text-[12px] text-faint">{t('Anteprima non disponibile per questo tipo di file')}</p>
	{:else if kind === 'image'}
		<img src={url} alt={file.name} class="mx-auto max-h-64 max-w-full rounded object-contain" />
	{:else if kind === 'pdf'}
		<iframe src={url} title={file.name} class="h-80 w-full rounded bg-white"></iframe>
	{:else}
		<pre class="max-h-56 overflow-auto text-[11.5px] leading-snug whitespace-pre-wrap">{text}</pre>
	{/if}
</div>
