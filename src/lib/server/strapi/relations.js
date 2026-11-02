import { getStrapiAdapter } from './adapter.js';

/**
 * Searches a target collection for relation candidates.
 *
 * @param {object} params
 * @param {string} params.targetTarget e.g. "api::category.category" or endpoint "categories"
 * @param {string} [params.query=''] Search term
 * @param {string} [params.displayField='name'] Display field for label
 * @param {number} [params.limit=20] Max results
 * @returns {Promise<{ id: number, documentId?: string, label: string }[]>}
 */
export async function searchRelations({
	targetTarget,
	query = '',
	displayField = 'name',
	limit = 20
}) {
	const adapter = await getStrapiAdapter();

	// Extract plural or collection name from target UID
	// e.g. "api::category.category" -> "categories"
	let endpoint = targetTarget;
	if (targetTarget.includes('::')) {
		const modelPart = targetTarget.split('::')[1]?.split('.')[0];
		endpoint = `${modelPart}s`;
	}

	const urlParams = new URLSearchParams();
	urlParams.set('pagination[pageSize]', String(limit));

	if (query.trim()) {
		urlParams.set(`filters[${displayField}][$containsi]`, query.trim());
	}

	try {
		const rawItems = await adapter.list(endpoint, urlParams.toString());
		return rawItems.map((item) => {
			const label = item.attributes?.[displayField] || item.attributes?.title || `ID: ${item.id}`;
			return {
				id: item.id,
				documentId: item.documentId || undefined,
				label: String(label)
			};
		});
	} catch {
		return [];
	}
}
