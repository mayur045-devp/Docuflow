import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import { resolveAvailableSchemas, getContentTypeSchema } from '$lib/server/schema/resolve.js';
import { registerUploadedSchema } from '$lib/server/schema/loader-upload.js';
import { getActiveConnection } from '$lib/server/strapi/connection.js';

export async function GET({ url }) {
	const forceRefresh = url.searchParams.get('refresh') === 'true';
	const targetUid = url.searchParams.get('uid');
	const active = getActiveConnection();

	try {
		const resolved = await resolveAvailableSchemas({ forceRefresh });

		let selectedSchema = null;
		let fingerprint = null;
		if (targetUid) {
			selectedSchema = await getContentTypeSchema(targetUid, { forceRefresh });
			if (selectedSchema) {
				fingerprint = crypto
					.createHash('sha256')
					.update(JSON.stringify(selectedSchema.attributes || {}))
					.digest('hex');
			}
		}

		return json({
			source: resolved.source,
			strapiUrl: resolved.normalizedUrl || active.strapiUrl,
			strapiVersion: resolved.strapiVersion || '5',
			contentTypesCount:
				resolved.contentTypesCount || Object.keys(resolved.contentTypes || {}).length,
			componentsCount: resolved.componentsCount || 0,
			contentTypes: resolved.contentTypes,
			selectedSchema,
			fingerprint
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return json(
			{
				error: {
					code: 'SCHEMA_DISCOVERY_FAILED',
					message,
					strapiUrl: active.strapiUrl
				}
			},
			{ status: 502 }
		);
	}
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
