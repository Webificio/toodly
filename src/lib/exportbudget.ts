import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { store } from './store.svelte';
import { t, locale } from './i18n.svelte';
import { buildCsv, type CsvTask } from './budget';
import { hasMoney, figuresOf, rootGroupId } from './money';
import type { Task } from './types';

/** Salva in CSV i task con importi (quelli passati, di norma la vista corrente). `'empty'` se non c'è nulla, `null` se annullato. */
export async function exportBudgetCsv(tasks: Task[]): Promise<string | 'empty' | null> {
	const byId = new Map(store.tasks.map((x) => [x.id, x]));
	const items: CsvTask[] = tasks
		.filter((x) => hasMoney(figuresOf(x, store.listOf(x.list_id))))
		.map((x) => {
			const g = rootGroupId(x, byId);
			return { task: x, group: g ? store.groupPath(g) : '', list: store.listOf(x.list_id)?.name ?? '', listMoney: store.listOf(x.list_id) };
		});
	if (!items.length) return 'empty';
	const headers = [t('Titolo'), t('Gruppo'), t('Lista'), t('Scadenza'), t('Valuta'), t('Durata (h)'), t('Costo uomo'), t('Spese (netto IVA)'), t('Ricavo (netto)'), t('Aliquota IVA %'), t('IVA'), t('Ricavo lordo'), t('Margine')];
	const dest = await saveDialog({ defaultPath: 'toodly-budget.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
	if (!dest) return null;
	await invoke('save_text_file', { path: dest, content: buildCsv(items, headers, locale()) });
	return dest;
}
