import { describe, expect, it } from 'vitest';
import { joinTags, normTag, parseTags, uniqTags } from '../src/lib/tags';

describe('tags', () => {
	it('normTag: minuscolo, senza # + e simboli', () => {
		expect(normTag('#Telefono')).toBe('telefono');
		expect(normTag('+Tesi!')).toBe('tesi');
		expect(normTag('perché')).toBe('perché');
		expect(normTag('a b')).toBe('ab');
		expect(normTag('###')).toBe('');
		expect(normTag('x'.repeat(50))).toHaveLength(30);
	});
	it('parse / join sono inversi e senza duplicati', () => {
		expect(parseTags('a  b a')).toEqual(['a', 'b']);
		expect(parseTags(null)).toEqual([]);
		expect(joinTags(['B', 'a', 'b'])).toBe('b a');
		expect(uniqTags(['#x', 'X', 'y'])).toEqual(['x', 'y']);
	});
});
