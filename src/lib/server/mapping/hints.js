import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads optional configuration hints for a content type.
 *
 * @param {string} contentTypeUid Or singularName e.g. "service-page"
 * @returns {any|null}
 */
export function loadContentHints(contentTypeUid) {
	if (!contentTypeUid) return null;

	const cleanName = contentTypeUid.replace(/^api::/, '').replace(/\.[^.]+$/, '');
	const searchPaths = [
		path.resolve('config/hints', `${cleanName}.json`),
		path.resolve('config/hints', `${contentTypeUid.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`)
	];

	for (const p of searchPaths) {
		if (fs.existsSync(p)) {
			try {
				return JSON.parse(fs.readFileSync(p, 'utf8'));
			} catch {
				// Ignore malformed hint file
			}
		}
	}

	return null;
}
