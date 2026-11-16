import { json } from '@sveltejs/kit';
import { z } from 'zod';
import {
	testStrapiConnection,
	setActiveConnection,
	resolveStrapiConnection
} from '$lib/server/strapi/connection.js';
import { StrapiDestinationError } from '$lib/server/strapi/destination.js';

const inputSchema = z
	.object({
		strapiUrl: z.string().min(1).max(2048).optional(),
		apiToken: z.string().max(8192).optional(),
		save: z.boolean().default(false)
	})
	.strict();

/** @param {{ request: Request }} event */
export async function POST({ request }) {
	let body;
	try {
		body = inputSchema.parse(await request.json());
	} catch {
		return json(
			{
				success: false,
				errorCode: 'INVALID_REQUEST',
				message:
					'Supply a valid connection request with a URL, optional token, and boolean save flag.'
			},
			{ status: 400 }
		);
	}

	let conn;
	try {
		conn = resolveStrapiConnection(body);
	} catch (err) {
		if (!(err instanceof StrapiDestinationError)) throw err;
		return json({ success: false, errorCode: err.code, message: err.message }, { status: 400 });
	}
	const { strapiUrl, apiToken } = conn;
	const shouldSave = body.save;

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
