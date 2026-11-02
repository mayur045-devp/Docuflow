import { json } from '@sveltejs/kit';
import { searchRelations } from '$lib/server/strapi/relations.js';

export async function GET({ url }) {
	const target = url.searchParams.get('target') || '';
	const q = url.searchParams.get('q') || '';
	const displayField = url.searchParams.get('displayField') || 'name';

	if (!target) {
		return json({ candidates: [] });
	}

	const candidates = await searchRelations({
		targetTarget: target,
		query: q,
		displayField
	});

	return json({ candidates });
}
