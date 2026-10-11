import { animate } from 'motion';

const EASE = [0.22, 1, 0.36, 1] as const;

interface FlyParams {
	x?: number;
	y?: number;
	scale?: number;
	duration?: number; // secondi
}

/** Transizione d'ingresso basata su Motion One (usabile con `in:`). */
export function mIn(node: Element, { x = 0, y = 0, scale = 1, duration = 0.28 }: FlyParams = {}) {
	animate(node, { opacity: [0, 1], x: [x, 0], y: [y, 0], scale: [scale, 1] }, { duration, ease: EASE });
	return { duration: duration * 1000 };
}

/** Transizione d'uscita (usabile con `out:`). */
export function mOut(node: Element, { x = 0, y = 0, scale = 1, duration = 0.2 }: FlyParams = {}) {
	animate(node, { opacity: [1, 0], x: [0, x], y: [0, y], scale: [1, scale] }, { duration, ease: EASE });
	return { duration: duration * 1000 };
}

/** Svelte action: piccola animazione "pop" quando l'elemento compare. */
export function pop(node: Element) {
	animate(node, { scale: [0.6, 1.12, 1], opacity: [0, 1] }, { duration: 0.32, ease: EASE });
}

/** Svelte action: fade + salita all'ingresso. */
export function rise(node: Element, delay = 0) {
	animate(node, { opacity: [0, 1], y: [6, 0] }, { duration: 0.28, delay, ease: EASE });
}

/** Linea di sbarramento che si disegna da sinistra a destra. */
export function drawStrike(node: HTMLElement) {
	node.style.transformOrigin = 'left center';
	return animate(node, { scaleX: [0, 1] }, { duration: 0.32, ease: EASE });
}

export function pulse(node: Element) {
	animate(node, { scale: [1, 0.9, 1] }, { duration: 0.22, ease: EASE });
}
