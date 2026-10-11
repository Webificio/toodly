/**
 * Mini-libreria di drag & drop basata su Pointer Events.
 * (Il drag nativo HTML5 è inaffidabile nelle webview di Tauri, e qui serve
 *  un controllo fine: indicatori di inserimento, drop su griglie orarie, ecc.)
 */

export interface DropEvent<P = any> {
	payload: P;
	x: number;
	y: number;
	rect: DOMRect;
	el: HTMLElement;
}

export interface DropZone<P = any> {
	accept?: (payload: P) => boolean;
	over?: (e: DropEvent<P>) => void;
	leave?: () => void;
	drop?: (e: DropEvent<P>) => void;
}

export interface DragState {
	active: boolean;
	payload: any;
	label: string;
	x: number;
	y: number;
}

export const drag = $state<DragState>({ active: false, payload: null, label: '', x: 0, y: 0 });

const zones = new Map<HTMLElement, DropZone>();
let hovered: HTMLElement | null = null;

export function dropzone(node: HTMLElement, opts: DropZone) {
	zones.set(node, opts);
	return {
		update(o: DropZone) {
			zones.set(node, o);
		},
		destroy() {
			zones.delete(node);
			if (hovered === node) hovered = null;
		}
	};
}

function zoneAt(x: number, y: number): HTMLElement | null {
	for (const el of document.elementsFromPoint(x, y)) {
		const z = zones.get(el as HTMLElement);
		if (z && (!z.accept || z.accept(drag.payload))) return el as HTMLElement;
	}
	return null;
}

function autoScroll(x: number, y: number) {
	for (const el of document.elementsFromPoint(x, y)) {
		const h = el as HTMLElement;
		if (h.dataset && 'scroll' in h.dataset) {
			const r = h.getBoundingClientRect();
			const edge = 44;
			if (y < r.top + edge) h.scrollTop -= Math.ceil((r.top + edge - y) / 3);
			else if (y > r.bottom - edge) h.scrollTop += Math.ceil((y - (r.bottom - edge)) / 3);
			if (h.dataset.scroll === 'xy') {
				if (x < r.left + edge) h.scrollLeft -= Math.ceil((r.left + edge - x) / 3);
				else if (x > r.right - edge) h.scrollLeft += Math.ceil((x - (r.right - edge)) / 3);
			}
			return;
		}
	}
}

export interface DraggableOptions {
	payload: () => any;
	label?: () => string;
	/** Selettore CSS dell'handle; se assente tutto l'elemento è trascinabile. */
	handle?: string;
	disabled?: boolean;
}

export function draggable(node: HTMLElement, initial: DraggableOptions) {
	let opts = initial;
	let start: { x: number; y: number } | null = null;
	let started = false;

	function down(e: PointerEvent) {
		if (opts.disabled || e.button !== 0) return;
		const target = e.target as HTMLElement;
		if (opts.handle) {
			if (!target.closest(opts.handle)) return;
		} else if (target.closest('button, input, textarea, select, a, [data-nodrag]')) return;
		start = { x: e.clientX, y: e.clientY };
		started = false;
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', cancel);
		window.addEventListener('keydown', key, true);
	}

	function begin(e: PointerEvent) {
		started = true;
		drag.active = true;
		drag.payload = opts.payload();
		drag.label = opts.label?.() ?? '';
		document.body.classList.add('is-dragging');
		node.classList.add('drag-source');
		window.getSelection()?.removeAllRanges();
		update(e);
	}

	function update(e: PointerEvent) {
		drag.x = e.clientX;
		drag.y = e.clientY;
		autoScroll(e.clientX, e.clientY);
		const z = zoneAt(e.clientX, e.clientY);
		if (z !== hovered) {
			if (hovered) zones.get(hovered)?.leave?.();
			hovered = z;
		}
		if (z) zones.get(z)?.over?.({ payload: drag.payload, x: e.clientX, y: e.clientY, rect: z.getBoundingClientRect(), el: z });
	}

	function move(e: PointerEvent) {
		if (!start) return;
		if (!started) {
			if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) return;
			begin(e);
		} else update(e);
	}

	function finish(doDrop: boolean, e?: PointerEvent) {
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', up);
		window.removeEventListener('pointercancel', cancel);
		window.removeEventListener('keydown', key, true);
		const wasStarted = started;
		const z = hovered;
		hovered = null;
		if (wasStarted) {
			if (z) {
				const zone = zones.get(z);
				if (doDrop && e && zone?.drop) {
					zone.drop({ payload: drag.payload, x: e.clientX, y: e.clientY, rect: z.getBoundingClientRect(), el: z });
				}
				zone?.leave?.();
			}
			// evita che il click di fine trascinamento apra il task
			const swallow = (ev: Event) => {
				ev.stopPropagation();
				ev.preventDefault();
			};
			window.addEventListener('click', swallow, { capture: true, once: true });
			setTimeout(() => window.removeEventListener('click', swallow, true), 0);
		}
		drag.active = false;
		drag.payload = null;
		document.body.classList.remove('is-dragging');
		node.classList.remove('drag-source');
		start = null;
		started = false;
	}

	const up = (e: PointerEvent) => finish(true, e);
	const cancel = () => finish(false);
	function key(e: KeyboardEvent) {
		if (e.key === 'Escape' && started) {
			e.stopPropagation();
			finish(false);
		}
	}

	node.addEventListener('pointerdown', down);
	return {
		update(o: DraggableOptions) {
			opts = o;
		},
		destroy() {
			node.removeEventListener('pointerdown', down);
			if (start) finish(false);
		}
	};
}
