import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import { actionLimiter } from '$lib/server/security/rate-limit.js';
import {
	getJob,
	getParsedDocument,
	saveExtraction,
	updateJobState
} from '$lib/server/jobs/store.js';
import { getContentTypeSchema } from '$lib/server/schema/resolve.js';
import { runExtraction } from '$lib/server/ai/extract.js';

export async function POST({ params, request, getClientAddress }) {
	const ip = getClientAddress ? getClientAddress() : '127.0.0.1';
	const rateCheck = actionLimiter.check(ip);
	if (!rateCheck.allowed) {
		return json(
			{
				error: {
					code: 'RATE_LIMIT_EXCEEDED',
					message: 'Too many extraction requests. Please wait a moment.'
				}
			},
			{ status: 429 }
		);
	}

	const { id } = params;
	const job = getJob(id);

	if (!job) {
		return json({ error: { code: 'NOT_FOUND', message: `Job ${id} not found` } }, { status: 404 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	// Allow switching target collection before extraction
	const targetContentTypeUid = body.contentType || job.contentTypeUid;
	if (body.contentType && body.contentType !== job.contentTypeUid) {
		job.contentTypeUid = body.contentType;
		updateJobState(job.id, 'parsed', { contentTypeUid: body.contentType });
	}

	const docModel = getParsedDocument(id);
	if (!docModel) {
		return json(
			{ error: { code: 'INVALID_STATE', message: 'Document has not been parsed yet.' } },
			{ status: 400 }
		);
	}

	const schema = await getContentTypeSchema(targetContentTypeUid, { forceRefresh: true });
	if (!schema) {
		return json(
			{
				error: {
					code: 'SCHEMA_NOT_FOUND',
					message: `Schema for ${targetContentTypeUid} not found.`
				}
			},
			{ status: 400 }
		);
	}

	// Compute schema fingerprint to track schema drift
	const schemaFingerprint = crypto
		.createHash('sha256')
		.update(JSON.stringify(schema.attributes || {}))
		.digest('hex');

	try {
		const extraction = await runExtraction({
			documentModel: docModel,
			contentTypeDef: schema
		});

		const extractionToSave = {
			...extraction,
			schemaFingerprint,
			extractedAt: new Date().toISOString()
		};

		saveExtraction(job.id, extractionToSave);
		updateJobState(job.id, 'extracted');

		return json({
			jobId: job.id,
			state: 'extracted',
			data: extraction.data,
			fieldNotes: extraction.fieldNotes,
			warnings: extraction.warnings,
			unmapped: extraction.unmapped,
			issues: extraction.issues,
			latencyMs: extraction.latencyMs,
			providerUsed: extraction.providerUsed,
			schemaFingerprint
		});
	} catch (err) {
		console.error(`Extraction failed for job ${id}:`, err);
		return json(
			{
				error: {
					code: 'EXTRACTION_FAILED',
					message: err instanceof Error ? err.message : String(err)
				}
			},
			{ status: 500 }
		);
	}
}
