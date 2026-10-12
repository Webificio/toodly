import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/i18n.svelte', () => ({ t: (s: string) => s, locale: () => 'it', i18n: { lang: 'it' } }));

import { addDays, addMonths, diffDays, nextOccurrence, recurrenceDays, startOfWeek, taskStart } from '../src/lib/dates';

describe('dates', () => {
	it('addDays / diffDays attraversano mesi e anni', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
		expect(diffDays('2026-10-15', '2026-10-12')).toBe(3);
	});
	it('addMonths non sfora a fine mese', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
	});
	it('startOfWeek è il lunedì', () => {
		expect(startOfWeek('2026-10-15')).toBe('2026-10-12');
		expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
	});
	it('taskStart usa start_date, altrimenti il giorno di creazione', () => {
		expect(taskStart({ start_date: '2026-02-03', created_at: '2026-01-01T10:00:00.000Z' })).toBe('2026-02-03');
		expect(taskStart({ start_date: null, created_at: '2026-01-01T10:00:00.000Z' })).toBe('2026-01-01');
	});
});

describe('nextOccurrence', () => {
	it('regole semplici', () => {
		expect(nextOccurrence('2026-10-12', 'daily')).toBe('2026-10-13');
		expect(nextOccurrence('2026-10-12', 'weekly')).toBe('2026-10-19');
		expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28');
		expect(nextOccurrence('2026-10-12', 'yearly')).toBe('2027-10-12');
		expect(nextOccurrence('2026-10-12', 'none')).toBe('2026-10-12');
	});
	it('giorni feriali saltano il fine settimana', () => {
		expect(nextOccurrence('2026-10-16', 'weekdays')).toBe('2026-10-19'); // venerdì → lunedì
		expect(nextOccurrence('2026-10-12', 'weekdays')).toBe('2026-10-13');
	});
	it('ultimo giorno del mese', () => {
		expect(nextOccurrence('2026-10-31', 'monthend')).toBe('2026-11-30');
		expect(nextOccurrence('2026-01-15', 'monthend')).toBe('2026-02-28');
		expect(nextOccurrence('2027-12-10', 'monthend')).toBe('2028-01-31');
		expect(nextOccurrence('2027-01-31', 'monthend')).toBe('2027-02-28');
	});
	it('giorni della settimana scelti', () => {
		expect(recurrenceDays('dow:4,1,1')).toEqual([1, 4]);
		expect(nextOccurrence('2026-10-12', 'dow:1,4')).toBe('2026-10-15'); // lun → gio
		expect(nextOccurrence('2026-10-15', 'dow:1,4')).toBe('2026-10-19'); // gio → lun
		expect(nextOccurrence('2026-10-15', 'dow:4')).toBe('2026-10-22');
	});
	it('regola non valida: nessuno spostamento', () => {
		expect(nextOccurrence('2026-10-12', 'dow:')).toBe('2026-10-12');
		expect(nextOccurrence('2026-10-12', 'boh')).toBe('2026-10-12');
	});
});
