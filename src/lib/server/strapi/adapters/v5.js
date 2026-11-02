import { strapiFetch } from '../client.js';
import { getEnv } from '../../env.js';

export const v5Adapter = {
	version: '5',

	/**
	 * Creates an entry in Strapi 5. Drafts are created using ?status=draft query param.
	 * @param {string} endpoint Plural endpoint name e.g. "service-pages"
	 * @param {any} data
	 * @param {{ draft?: boolean }} [options]
	 */
	async create(endpoint, data, { draft = true } = {}) {
		const url = `/api/${endpoint}${draft ? '?status=draft' : ''}`;

		const res = await strapiFetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data })
		});

		return this.normalizeEntry(res);
	},

	/**
	 * Updates an entry in Strapi 5 by documentId.
	 * @param {string} endpoint
	 * @param {string|number} documentId
	 * @param {any} data
	 * @param {{ draft?: boolean }} [options]
	 */
	async update(endpoint, documentId, data, { draft = true } = {}) {
		const url = `/api/${endpoint}/${documentId}${draft ? '?status=draft' : ''}`;

		const res = await strapiFetch(url, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data })
		});

		return this.normalizeEntry(res);
	},

	/**
	 * Finds an entry by a field value using Strapi 5 document service filters.
	 * @param {string} endpoint
	 * @param {string} field
	 * @param {string|number} value
	 */
	async findByField(endpoint, field, value) {
		const query = new URLSearchParams();
		query.set(`filters[${field}][$eq]`, String(value));
		query.set('status', 'draft'); // queries draft status in Strapi 5
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
		const prefix = queryString
			? queryString.startsWith('?')
				? queryString
				: `?${queryString}`
			: '?status=draft';
		const res = await strapiFetch(`/api/${endpoint}${prefix}`);
		return (res?.data || []).map((item) => this.normalizeEntry(item));
	},

	/**
	 * Publishes an entry by documentId in Strapi 5.
	 * @param {string} endpoint
	 * @param {string|number} documentId
	 */
	async publish(endpoint, documentId) {
		// Strapi 5 publish action endpoint or PUT with status=published
		try {
			const res = await strapiFetch(`/api/${endpoint}/${documentId}/actions/publish`, {
				method: 'POST'
			});
			return this.normalizeEntry(res);
		} catch {
			// Fallback PUT
			const res = await strapiFetch(`/api/${endpoint}/${documentId}?status=published`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ data: {} })
			});
			return this.normalizeEntry(res);
		}
	},

	/**
	 * Normalizes a Strapi 5 entry ({ id, documentId, ...attributes }) into standard format.
	 * In Strapi 5, data is flat without `.attributes`.
	 * @param {any} response
	 */
	normalizeEntry(response) {
		const raw = response?.data ? response.data : response;
		if (!raw) return null;

		const { id, documentId, ...attributes } = raw;
		return {
			id,
			documentId: documentId || null,
			attributes: raw.attributes ? { ...raw.attributes } : attributes
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
		const targetId = entry?.documentId || entry?.id;
		return `${base}/content-manager/collection-types/api::${singularName}.${singularName}/${targetId}`;
	},

	/**
	 * Formats a relation connect object for Strapi 5.
	 * @param {any} relation
	 */
	formatRelation(relation) {
		if (!relation) return null;
		const docId = typeof relation === 'object' ? relation.documentId || relation.id : relation;
		return { connect: [{ documentId: String(docId) }] };
	}
};
