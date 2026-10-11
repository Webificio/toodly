import { invoke } from '@tauri-apps/api/core';
import en from './en.json';

export type Lang = 'it' | 'en';
const KEY = 'toodly.lang';

export const i18n = $state<{ lang: Lang }>({ lang: 'it' });

/**
 * Traduzione: la chiave è il testo italiano (lingua predefinita).
 * Con lang = 'en' si cerca la traduzione in en.json, altrimenti si restituisce la chiave.
 * I segnaposto `{nome}` vengono sostituiti con `params`.
 */
export function t(key: string, params?: Record<string, string | number>): string {
	let s = i18n.lang === 'en' ? ((en as Record<string, string>)[key] ?? key) : key;
	if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
	return s;
}

/** Locale BCP-47 per Intl. */
export const locale = () => (i18n.lang === 'en' ? 'en-GB' : 'it-IT');

function read(): Lang {
	try {
		return localStorage.getItem(KEY) === 'en' ? 'en' : 'it';
	} catch {
		return 'it';
	}
}

function apply(l: Lang) {
	document.documentElement.lang = l;
	invoke('set_language', { lang: l }).catch(() => {});
}

export function initLang() {
	i18n.lang = read();
	apply(i18n.lang);
	// le altre finestre condividono localStorage: la lingua resta sincronizzata
	window.addEventListener('storage', (e) => {
		if (e.key === KEY) {
			i18n.lang = read();
			document.documentElement.lang = i18n.lang;
		}
	});
}

export function setLang(l: Lang) {
	i18n.lang = l;
	try {
		localStorage.setItem(KEY, l);
	} catch {}
	apply(l);
}
