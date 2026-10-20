<script lang="ts">
	import { untrack } from 'svelte';
	import { Trash2 } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import { store } from '../store.svelte';
	import { t as tt, locale } from '../i18n.svelte';
	import Select from './Select.svelte';
	import MoneyField from './MoneyField.svelte';
	import { CURRENCIES, DEFAULT_VAT, VAT_RATES, currencySymbol } from '../money';
	import { uiprefs } from '../uiprefs.svelte';
	import { ui, go, nav } from '../nav.svelte';
	import { LIST_COLORS } from '../types';

	let open = $state(false);
	let name = $state('');
	let color = $state(LIST_COLORS[0]);
	let editingId = $state<string | null>(null);
	let confirm = $state(false);
	let currency = $state('EUR');
	let rate = $state<number | null>(null);
	let vat = $state(DEFAULT_VAT);

	$effect(() => {
		const target = ui.listEditor;
		if (!target) return;
		untrack(() => {
			confirm = false;
			if (target === 'new') {
				editingId = null;
				name = '';
				color = LIST_COLORS[store.lists.length % LIST_COLORS.length];
				currency = store.lists[0]?.currency ?? 'EUR';
				rate = null;
				vat = store.lists[0]?.vat_rate ?? DEFAULT_VAT;
			} else {
				const l = store.lists.find((x) => x.id === target);
				if (!l) {
					ui.listEditor = null;
					return;
				}
				editingId = l.id;
				name = l.name;
				color = l.color;
				currency = l.currency;
				rate = l.rate_cents;
				vat = l.vat_rate;
			}
			open = true;
		});
	});
	$effect(() => {
		if (!open) ui.listEditor = null;
	});

	const moveTarget = $derived(store.listsSorted.find((l) => l.id !== editingId)?.name ?? '');

	async function save() {
		const n = name.trim();
		if (!n) return;
		const money = { currency, rate_cents: rate, vat_rate: vat };
		if (editingId) await store.updateList(editingId, { name: n, color, ...money });
		else {
			const l = await store.createList(n, color);
			await store.updateList(l.id, money);
			go({ scope: 'list:' + l.id });
		}
		open = false;
	}
	async function remove() {
		if (!editingId) return;
		if (!confirm) return (confirm = true);
		const id = editingId;
		open = false;
		if (nav.scope === 'list:' + id) go({ scope: 'all' });
		await store.deleteList(id);
	}
</script>

<Modal bind:open title={editingId ? tt('Modifica lista') : tt('Nuova lista')} width={420}>
	<div class="space-y-4">
		<input class="field" placeholder={tt('Nome della lista')} bind:value={name} onkeydown={(e) => e.key === 'Enter' && save()} />
		<div class="flex flex-wrap gap-2">
			{#each LIST_COLORS as c}
				<button
					aria-label={c}
					class="size-7 rounded-full ring-offset-2 ring-offset-elev transition-transform hover:scale-110 {color === c ? 'ring-2 ring-accent' : ''}"
					style="background:{c}"
					onclick={() => (color = c)}
				></button>
			{/each}
		</div>
		{#if uiprefs.showEconomy}
			<div class="space-y-2 rounded-lg border border-border p-3 text-[12.5px]">
				<div class="text-[12px] font-semibold tracking-wide text-muted uppercase">{tt('Economia')}</div>
				<div class="grid grid-cols-[130px_1fr] items-center gap-x-3 gap-y-2">
					<span class="text-muted">{tt('Valuta')}</span>
					<Select value={currency} options={CURRENCIES.map((c) => ({ value: c, label: `${c} (${currencySymbol(c, locale())})` }))} onchange={(v) => (currency = v)} />
					<span class="text-muted">{tt('Tariffa oraria')}</span>
					<MoneyField value={rate} {currency} label={tt('Tariffa oraria')} onchange={(v) => (rate = v)} />
					<span class="text-muted">{tt('IVA sui ricavi')}</span>
					<Select value={String(vat)} options={VAT_RATES.map((r) => ({ value: String(r), label: r + '%' }))} onchange={(v) => (vat = Number(v))} />
				</div>
				<p class="text-[11.5px] text-faint">{tt('Valgono per tutti i task della lista, salvo diversa indicazione sul singolo task.')}</p>
			</div>
		{/if}
		<div class="flex items-center gap-2 pt-1">
			{#if editingId && store.lists.length > 1}
				<button class="btn text-p3" onclick={remove}><Trash2 size={14} />{confirm ? tt('Conferma (i task vanno in «{name}»)', { name: moveTarget }) : tt('Elimina')}</button>
			{/if}
			<button class="btn ml-auto" onclick={() => (open = false)}>{tt('Annulla')}</button>
			<button class="btn btn-primary" disabled={!name.trim()} onclick={save}>{tt('Salva')}</button>
		</div>
	</div>
</Modal>
