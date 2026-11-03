/**
 * Transliterates and converts any title/string into a clean URL-safe slug.
 *
 * @param {string} text
 * @returns {string}
 */
export function generateSlug(text) {
	if (!text || typeof text !== 'string') return 'entry';

	return (
		text
			.replace(/<[^>]*>/g, '')
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/[\s_]+/g, '-')
			.replace(/-{2,}/g, '-')
			.replace(/^-+|-+$/g, '') || 'entry'
	);
}
