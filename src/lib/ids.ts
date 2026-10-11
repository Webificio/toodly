export function uid(): string {
	try {
		return crypto.randomUUID();
	} catch {
		return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
	}
}
export const nowISO = () => new Date().toISOString();
