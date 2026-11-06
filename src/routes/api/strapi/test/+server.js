import { json } from '@sveltejs/kit';
import {
	testStrapiConnection,
	setActiveConnection,
	getActiveConnection
} from '$lib/server/strapi/connection.js';

export async function POST({ request }) {
	let body = {};
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	const active = getActiveConnection();
	const strapiUrl = body.strapiUrl || active.strapiUrl;
	const apiToken = body.apiToken !== undefined ? body.apiToken : active.apiToken;
	const shouldSave = Boolean(body.save);

	const result = await testStrapiConnection({
		strapiUrl,
		apiToken
	});

	if (result.success && shouldSave) {
		setActiveConnection({
			strapiUrl: result.normalizedUrl,
			apiToken
		});
	}

	const httpStatus = result.success
		? 200
		: typeof result.status === 'number' && result.status >= 400 && result.status < 600
			? result.status
			: 502;

	return json(result, { status: httpStatus });
}
