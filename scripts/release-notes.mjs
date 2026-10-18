// Prints the CHANGELOG.md section of a version (used as GitHub release notes).
// Usage: node scripts/release-notes.mjs 1.2.0   (a leading "v" is accepted)
import { readFileSync } from 'node:fs';

const version = (process.argv[2] ?? '').replace(/^v/, '');
if (!version) {
	console.error('Usage: node scripts/release-notes.mjs <version>');
	process.exit(1);
}
const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split(/\r?\n/);
const start = lines.findIndex((l) => l.startsWith('## [' + version + ']'));
if (start < 0) {
	console.error('CHANGELOG.md has no section "## [' + version + ']". Move the Unreleased items under it before tagging.');
	process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && l.startsWith('## ['));
if (end < 0) end = lines.length;
const body = lines
	.slice(start + 1, end)
	.filter((l) => !/^\[[^\]]+\]:\s/.test(l))
	.join('\n')
	.trim();
if (!body) {
	console.error('The section for ' + version + ' is empty.');
	process.exit(1);
}
console.log(body);
