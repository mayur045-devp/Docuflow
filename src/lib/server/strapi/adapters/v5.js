import { strapiFetch } from '../client.js';
import { getEnv } from '../../env.js';
import { getActiveConnection, normalizeStrapiUrl } from '../connection.js';

export const v5Adapter = {
	version: '5',

	/**
	 * Creates an entry in Strapi 5. Drafts are created using ?status=draft query param.
	 * For single types, Strapi uses PUT /api/{endpoint}.
	 * @param {string} endpoint Plural or singular endpoint name e.g. "service-pages" or "mayur"
	 * @param {any} data
	 * @param {{ draft?: boolean, isSingleType?: boolean }} [options]
	 */
	async create(endpoint, data, { draft = true, isSingleType = false } = {}) {
		const url = `/api/${endpoint}${draft ? '?status=draft' : ''}`;

		const res = await strapiFetch(url, {
			method: isSingleType ? 'PUT' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data })
		});

		return this.normalizeEntry(res);
	},

	/**
	 * Updates an entry in Strapi 5.
	 * For collection types, updates by documentId.
	 * For single types, updates via PUT /api/{endpoint}.
	 * @param {string} endpoint
	 * @param {string|number} documentId
	 * @param {any} data
	 * @param {{ draft?: boolean, isSingleType?: boolean }} [options]
	 */
	async update(endpoint, documentId, data, { draft = true, isSingleType = false } = {}) {
		const target = isSingleType ? `/api/${endpoint}` : `/api/${endpoint}/${documentId}`;
		const url = `${target}${draft ? '?status=draft' : ''}`;

		const res = await strapiFetch(url, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data })
		});

		return this.normalizeEntry(res);
	},

	/**
	 * Fetches a single type entry.
	 * @param {string} endpoint
	 */
	async getSingle(endpoint) {
		try {
			const res = await strapiFetch(`/api/${endpoint}?status=draft`);
			if (res?.data) {
				return this.normalizeEntry(res);
			}
			return null;
		} catch {
			return null;
		}
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
	 * Publishes an entry in Strapi 5.
	 * For collection types, publishes by documentId.
	 * For single types, publishes via actions/publish or status=published.
	 * @param {string} endpoint
	 * @param {string|number} [documentId]
	 * @param {{ isSingleType?: boolean }} [options]
	 */
	async publish(endpoint, documentId, { isSingleType = false } = {}) {
		if (isSingleType) {
			try {
				const res = await strapiFetch(`/api/${endpoint}/actions/publish`, {
					method: 'POST'
				});
				return this.normalizeEntry(res);
			} catch {
				const res = await strapiFetch(`/api/${endpoint}?status=published`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ data: {} })
				});
				return this.normalizeEntry(res);
			}
		}

		// Collection type
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
	 * @param {'collectionType'|'singleType'} [kind='collectionType']
	 * @param {string} [uid='']
	 */
	adminLink(entry, singularName, kind = 'collectionType', uid = '') {
		const { STRAPI_ADMIN_URL } = getEnv();
		const conn = getActiveConnection();
		const base = STRAPI_ADMIN_URL
			? normalizeStrapiUrl(STRAPI_ADMIN_URL)
			: `${normalizeStrapiUrl(conn.strapiUrl)}/admin`;
		const typeUid = uid || `api::${singularName}.${singularName}`;
		if (kind === 'singleType') {
			return `${base}/content-manager/single-types/${typeUid}`;
		}
		const targetId = entry?.documentId || entry?.id;
		return `${base}/content-manager/collection-types/${typeUid}/${targetId}`;
	},

	/**
	 * Formats a relation connect object for Strapi 5.
	 * @param {any} relation
	 */
	formatRelation(relation) {
		if (!relation) return null;
		if (Array.isArray(relation)) {
			if (relation.length === 0) return { set: [] };
			return {
				set: relation.map((item) => {
					const docId = typeof item === 'object' && item !== null ? item.documentId || item.id : item;
					return { documentId: String(docId) };
				})
			};
		}
		if (typeof relation === 'object' && ('set' in relation || 'connect' in relation || 'disconnect' in relation)) {
			return relation;
		}
		const docId = typeof relation === 'object' ? relation.documentId || relation.id : relation;
		return { connect: [{ documentId: String(docId) }] };
	}
};
