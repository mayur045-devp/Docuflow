import { strapiFetch } from '../client.js';
import { getEnv } from '../../env.js';

export const v4Adapter = {
	version: '4',

	/**
	 * Creates an entry in Strapi 4. Draft entries have `publishedAt: null`.
	 * @param {string} endpoint Plural endpoint name e.g. "service-pages"
	 * @param {any} data
	 * @param {{ draft?: boolean }} [options]
	 */
	async create(endpoint, data, { draft = true } = {}) {
		const payload = {
			...data,
			...(draft ? { publishedAt: null } : { publishedAt: new Date().toISOString() })
		};

		const res = await strapiFetch(`/api/${endpoint}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: payload })
		});

		return this.normalizeEntry(res);
	},

	/**
	 * Updates an existing entry by numeric ID in Strapi 4.
	 * @param {string} endpoint
	 * @param {number|string} id Numeric id
	 * @param {any} data
	 * @param {{ draft?: boolean }} [options]
	 */
	async update(endpoint, id, data, { draft = true } = {}) {
		const payload = {
			...data,
			...(draft ? { publishedAt: null } : {})
		};

		const res = await strapiFetch(`/api/${endpoint}/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: payload })
		});

		return this.normalizeEntry(res);
	},

	/**
	 * Finds an entry by a field value using Strapi 4 filter syntax.
	 * @param {string} endpoint
	 * @param {string} field
	 * @param {string|number} value
	 */
	async findByField(endpoint, field, value) {
		const query = new URLSearchParams();
		query.set(`filters[${field}][$eq]`, String(value));
		query.set('publicationState', 'preview'); // includes drafts in v4
		query.set('pagination[pageSize]', '1');

		const res = await strapiFetch(`/api/${endpoint}?${query.toString()}`);
		const items = res?.data;
		if (Array.isArray(items) && items.length > 0) {
			return this.normalizeEntry(items[0]);
		}
		return null;
	},

	/**
	 * Lists entries.
	 * @param {string} endpoint
	 * @param {string} [queryString='']
	 */
	async list(endpoint, queryString = '') {
		const res = await strapiFetch(`/api/${endpoint}${queryString ? '?' + queryString : ''}`);
		return (res?.data || []).map((item) => this.normalizeEntry(item));
	},

	/**
	 * Explicitly publishes an entry in Strapi 4 by setting publishedAt timestamp.
	 * @param {string} endpoint
	 * @param {number|string} id
	 */
	async publish(endpoint, id) {
		const res = await strapiFetch(`/api/${endpoint}/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: { publishedAt: new Date().toISOString() }
			})
		});
		return this.normalizeEntry(res);
	},

	/**
	 * Normalizes a Strapi 4 entry ({ id, attributes }) into standard { id, documentId, attributes }.
	 * @param {any} response
	 */
	normalizeEntry(response) {
		const raw = response?.data ? response.data : response;
		if (!raw) return null;

		return {
			id: raw.id,
			documentId: null,
			attributes: raw.attributes ? { ...raw.attributes } : { ...raw }
		};
	},

	/**
	 * Generates a direct URL to the entry in Strapi Admin UI.
	 * @param {any} entry
	 * @param {string} singularName
	 */
	adminLink(entry, singularName) {
		const { STRAPI_URL, STRAPI_ADMIN_URL } = getEnv();
		const base = STRAPI_ADMIN_URL || `${STRAPI_URL}/admin`;
		const id = entry?.id;
		return `${base}/content-manager/collectionType/api::${singularName}.${singularName}/${id}`;
	},

	/**
	 * Formats a relation connect object for Strapi 4.
	 * @param {any} relation
	 */
	formatRelation(relation) {
		if (!relation) return null;
		const id = typeof relation === 'object' ? relation.id : relation;
		return { connect: [id] };
	}
};
