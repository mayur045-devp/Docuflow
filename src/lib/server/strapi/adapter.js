import { detectStrapiVersion } from './detect-version.js';
import { v4Adapter } from './adapters/v4.js';
import { v5Adapter } from './adapters/v5.js';

/**
 * Returns the appropriate Strapi adapter for the detected or configured version.
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<typeof v4Adapter | typeof v5Adapter>}
 */
export async function getStrapiAdapter(options = {}) {
	const version = await detectStrapiVersion(options);
	return version === '4' ? v4Adapter : v5Adapter;
}
