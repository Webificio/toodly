import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/i18n.svelte', () => ({ t: (s: string) => s, locale: () => 'it', i18n: { lang: 'it' } }));

import { filterMatches, inScope, parseScope, ruleMatches } from '../src/lib/views';
import { addDays, todayISO } from '../src/lib/dates';
import type { Filter } from '../src/lib/types';
import { mkTask } from './helpers';

const today = todayISO();

describe('scope', () => {
	it('parseScope', () => {
		expect(parseScope('list:x')).toEqual({ kind: 'list', id: 'x' });
		expect(parseScope('tag:tesi')).toEqual({ kind: 'tag', id: 'tesi' });
		expect(parseScope('filter:f')).toEqual({ kind: 'filter', id: 'f' });
		expect(parseScope('today')).toEqual({ kind: 'smart', id: 'today' });
	});
	it('viste intelligenti', () => {
		const overdue = mkTask({ due_date: addDays(today, -2) });
		const tomorrow = mkTask({ due_date: addDays(today, 1) });
		const far = mkTask({ due_date: addDays(today, 30) });
		expect(inScope(overdue, 'today', [])).toBe(true);
		expect(inScope(tomorrow, 'today', [])).toBe(false);
		expect(inScope(tomorrow, 'next7', [])).toBe(true);
		expect(inScope(far, 'next7', [])).toBe(false);
		expect(inScope(mkTask({ priority: 3 }), 'important', [])).toBe(true);
		expect(inScope(far, 'all', [])).toBe(true);
	});
	it('lista ed etichetta', () => {
		expect(inScope(mkTask({ list_id: 'l9' }), 'list:l9', [])).toBe(true);
		expect(inScope(mkTask({ list_id: 'l1' }), 'list:l9', [])).toBe(false);
		expect(inScope(mkTask({ tags: ['tesi', 'x'] }), 'tag:tesi', [])).toBe(true);
		expect(inScope(mkTask({ tags: ['x'] }), 'tag:tesi', [])).toBe(false);
	});
});

describe('filtri', () => {
	const f = (match_mode: 'and' | 'or', rules: Filter['rules']): Filter => ({ id: 'f', name: 'f', match_mode, rules, sort: 0, created_at: '' });
	it('regole di base', () => {
		expect(ruleMatches(mkTask({ priority: 2 }), { field: 'priority', op: '>=', value: '2' })).toBe(true);
		expect(ruleMatches(mkTask({ priority: 1 }), { field: 'priority', op: '>=', value: '2' })).toBe(false);
		expect(ruleMatches(mkTask({ title: 'Relazione Finale' }), { field: 'title', op: 'contains', value: 'finale' })).toBe(true);
		expect(ruleMatches(mkTask({ tags: ['tesi'] }), { field: 'tag', op: '==', value: 'tesi' })).toBe(true);
		expect(ruleMatches(mkTask({ tags: ['tesi'] }), { field: 'tag', op: '!=', value: 'tesi' })).toBe(false);
		expect(ruleMatches(mkTask({ due_date: null }), { field: 'due', op: '==', value: 'none' })).toBe(true);
	});
	it('AND / OR', () => {
		const t = mkTask({ priority: 3, tags: ['x'] });
		const rules = [
			{ field: 'priority' as const, op: '==', value: '3' },
			{ field: 'tag' as const, op: '==', value: 'y' }
		];
		expect(filterMatches(t, f('and', rules))).toBe(false);
		expect(filterMatches(t, f('or', rules))).toBe(true);
		expect(filterMatches(t, f('and', []))).toBe(true);
	});
});
