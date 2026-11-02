import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import { resolveAvailableSchemas } from '$lib/server/schema/resolve.js';
import { registerUploadedSchema } from '$lib/server/schema/loader-upload.js';
import { detectStrapiVersion } from '$lib/server/strapi/detect-version.js';

export async function GET({ url }) {
	const forceRefresh = url.searchParams.get('refresh') === 'true';
	const targetUid = url.searchParams.get('uid');
	const resolved = await resolveAvailableSchemas({ forceRefresh });
	const detectedVersion = await detectStrapiVersion({ forceRefresh });

	let selectedSchema = null;
	let fingerprint = null;
	if (targetUid) {
		selectedSchema = resolved.contentTypes[targetUid] || null;
		if (selectedSchema) {
			fingerprint = crypto
				.createHash('sha256')
				.update(JSON.stringify(selectedSchema.attributes || {}))
				.digest('hex');
		}
	}

	return json({
		source: resolved.source,
		strapiVersion: detectedVersion,
		contentTypes: resolved.contentTypes,
		selectedSchema,
		fingerprint
	});
}

export async function POST({ request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json(
			{ error: { code: 'INVALID_JSON', message: 'Invalid JSON payload' } },
			{ status: 400 }
		);
	}

	const { schema, components } = body;
	if (!schema || !schema.attributes) {
		return json(
			{ error: { code: 'INVALID_SCHEMA', message: 'Schema must contain attributes definition.' } },
			{ status: 400 }
		);
	}

	const normalized = registerUploadedSchema(schema, components || {});
	return json({
		success: true,
		contentType: normalized
	});
}
