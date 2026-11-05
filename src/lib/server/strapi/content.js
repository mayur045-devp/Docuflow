import { getStrapiAdapter } from './adapter.js';

/**
 * Creates an entry in Strapi using the appropriate version adapter.
 *
 * @param {string} endpoint
 * @param {any} data
 * @param {{ draft?: boolean, isSingleType?: boolean }} [options]
 */
export async function createContentEntry(endpoint, data, options = {}) {
	const adapter = await getStrapiAdapter();
	return adapter.create(endpoint, data, options);
}

/**
 * Updates an entry in Strapi using the appropriate version adapter.
 *
 * @param {string} endpoint
 * @param {string|number} documentIdOrId
 * @param {any} data
 * @param {{ draft?: boolean, isSingleType?: boolean }} [options]
 */
export async function updateContentEntry(endpoint, documentIdOrId, data, options = {}) {
	const adapter = await getStrapiAdapter();
	return adapter.update(endpoint, documentIdOrId, data, options);
}

/**
 * Fetches a single type entry.
 *
 * @param {string} endpoint
 */
export async function getSingleContentEntry(endpoint) {
	const adapter = await getStrapiAdapter();
	return adapter.getSingle(endpoint);
}

/**
 * Finds an entry by field value.
 *
 * @param {string} endpoint
 * @param {string} field
 * @param {string|number} value
 */
export async function findContentByField(endpoint, field, value) {
	const adapter = await getStrapiAdapter();
	return adapter.findByField(endpoint, field, value);
}

/**
 * Publishes an entry in Strapi.
 *
 * @param {string} endpoint
 * @param {string|number} [documentIdOrId]
 * @param {{ isSingleType?: boolean }} [options]
 */
export async function publishContentEntry(endpoint, documentIdOrId, options = {}) {
	const adapter = await getStrapiAdapter();
	return adapter.publish(endpoint, documentIdOrId, options);
}

