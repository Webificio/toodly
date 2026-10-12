import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/i18n.svelte', () => ({ t: (s: string) => s, locale: () => 'it', i18n: { lang: 'it' } }));

import { buildIcs, icsEscape, icsFold, icsRrule } from '../src/lib/ics';
import { mkTask } from './helpers';

const now = new Date(Date.UTC(2026, 9, 12, 8, 30, 0));

describe('ics', () => {
	it('escape e piegatura delle righe', () => {
		expect(icsEscape('a,b;c\\d\ne')).toBe(String.raw`a\,b\;c\\d\ne`);
		const long = 'SUMMARY:' + 'è'.repeat(80);
		const folded = icsFold(long);
		for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part.replace(/^ /, '')).length).toBeLessThanOrEqual(75);
		expect(folded.replace(/\r\n /g, '')).toBe(long);
	});
	it('niente task con scadenza: vuoto', () => {
		expect(buildIcs([mkTask()], { now })).toBe('');
	});
	it('evento a giornata intera', () => {
		const ics = buildIcs([mkTask({ id: 'a1', title: 'Pagare, bolletta', due_date: '2026-10-31', priority: 3, tags: ['casa'] })], { now });
		expect(ics).toContain('BEGIN:VCALENDAR');
		expect(ics).toContain('UID:a1@toodly');
		expect(ics).toContain('DTSTAMP:20261012T083000Z');
		expect(ics).toContain('DTSTART;VALUE=DATE:20261031');
		expect(ics).toContain('DTEND;VALUE=DATE:20261101');
		expect(ics).toContain('SUMMARY:Pagare\\, bolletta');
		expect(ics).toContain('CATEGORIES:casa');
		expect(ics).toContain('PRIORITY:1');
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
	});
	it('evento con orario, promemoria e ripetizione', () => {
		const ics = buildIcs(
			[mkTask({ due_date: '2026-10-12', start_time: '09:30', end_time: '10:15', remind_min: 10, recurrence: 'dow:1,4', recur_until: '2026-12-31' })],
			{ now }
		);
		expect(ics).toContain('DTSTART:20261012T093000');
		expect(ics).toContain('DTEND:20261012T101500');
		expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TH;UNTIL=20261231T235959');
		expect(ics).toContain('TRIGGER:-PT10M');
	});
	it('promemoria senza orario: dall’ora predefinita', () => {
		const ics = buildIcs([mkTask({ due_date: '2026-10-12', remind_min: 30 })], { now, allDayTime: '09:00' });
		expect(ics).toContain('TRIGGER:PT510M');
	});
	it('completati esclusi, salvo richiesta', () => {
		const done = mkTask({ due_date: '2026-10-12', completed: true });
		expect(buildIcs([done], { now })).toBe('');
		expect(buildIcs([done], { now, includeCompleted: true })).toContain('SUMMARY:✓ Task');
	});
	it('regole di ripetizione', () => {
		const r = (recurrence: string, recur_until: string | null = null, start_time: string | null = null) => icsRrule({ recurrence, recur_until, start_time });
		expect(r('none')).toBeNull();
		expect(r('daily')).toBe('FREQ=DAILY');
		expect(r('weekdays')).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
		expect(r('monthend')).toBe('FREQ=MONTHLY;BYMONTHDAY=-1');
		expect(r('monthly', '2027-01-01')).toBe('FREQ=MONTHLY;UNTIL=20270101');
	});
});
