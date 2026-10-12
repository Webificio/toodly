import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/i18n.svelte', () => ({ t: (s: string) => s, locale: () => 'it', i18n: { lang: 'it' } }));

import { parseQuick } from '../src/lib/quickparse';
import { addDays, todayISO } from '../src/lib/dates';
import type { List } from '../src/lib/types';

const lists = [
	{ id: 'a', name: 'Lavoro' },
	{ id: 'b', name: 'Casa' }
] as List[];

describe('parseQuick', () => {
	it('titolo semplice', () => {
		const p = parseQuick('Comprare il pane', lists);
		expect(p).toMatchObject({ title: 'Comprare il pane', priority: 0, due_date: null, list_id: null, tags: [] });
	});
	it('priorità, scadenza e lista', () => {
		const p = parseQuick('Relazione !alta @domani #lav', lists);
		expect(p.title).toBe('Relazione');
		expect(p.priority).toBe(3);
		expect(p.due_date).toBe(addDays(todayISO(), 1));
		expect(p.list_id).toBe('a');
	});
	it('data esplicita e priorità inglese', () => {
		const p = parseQuick('Dentista !low @2026-11-05', lists);
		expect(p.priority).toBe(1);
		expect(p.due_date).toBe('2026-11-05');
	});
	it('#parola che non è una lista diventa etichetta; +parola sempre', () => {
		const p = parseQuick('Chiamare Marco #telefono +Urgente #cas', lists);
		expect(p.title).toBe('Chiamare Marco');
		expect(p.tags).toEqual(['telefono', 'urgente']);
		expect(p.list_id).toBe('b');
	});
	it('senza etichette (importazione di testo) # resta nel titolo', () => {
		const p = parseQuick('Ticket #123', lists, false);
		expect(p.title).toBe('Ticket #123');
		expect(p.tags).toEqual([]);
	});
});
