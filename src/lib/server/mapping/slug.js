export { generateSlug } from '../../shared/slug.js';

/**
 * Ensures a slug is unique by querying Strapi and incrementing counter suffix if needed.
 *
 * @param {object} params
 * @param {string} params.endpoint
 * @param {string} params.baseSlug
 * @param {any} params.adapter Strapi adapter
 * @param {string|number|null} [params.currentEntryId=null] ID of existing entry if updating
 * @returns {Promise<string>} Unique slug
 */
export async function ensureUniqueSlug({ endpoint, baseSlug, adapter, currentEntryId = null }) {
	let candidate = baseSlug || 'entry';
	let counter = 1;

	while (counter <= 50) {
		const existing = await adapter.findByField(endpoint, 'slug', candidate);
		if (
			!existing ||
			(currentEntryId && (existing.id === currentEntryId || existing.documentId === currentEntryId))
		) {
			return candidate;
		}

		counter += 1;
		candidate = `${baseSlug}-${counter}`;
	}

	return `${baseSlug}-${Date.now()}`;
}
