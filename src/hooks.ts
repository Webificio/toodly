// Tauri può caricare la finestra come /index.html: la riportiamo alla radice.
export const reroute = ({ url }: { url: URL }): string | void => {
	if (url.pathname === '/index.html') return '/';
};
