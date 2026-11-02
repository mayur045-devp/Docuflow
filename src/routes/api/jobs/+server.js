import { json } from '@sveltejs/kit';
import { uploadLimiter } from '$lib/server/security/rate-limit.js';
import { validateDocx } from '$lib/server/security/docx-guard.js';
import { parseDocx } from '$lib/server/document/parser.js';
import { createJob, saveParsedDocument, updateJobState, listJobs } from '$lib/server/jobs/store.js';
import { getContentTypeSchema } from '$lib/server/schema/resolve.js';

export async function GET() {
	const jobs = listJobs();
	return json({ jobs });
}

export async function POST({ request, getClientAddress }) {
	const ip = getClientAddress ? getClientAddress() : '127.0.0.1';
	const rateCheck = uploadLimiter.check(ip);
	if (!rateCheck.allowed) {
		return json(
			{
				error: {
					code: 'RATE_LIMIT_EXCEEDED',
					message: 'Too many upload requests. Please wait a minute.'
				}
			},
			{ status: 429 }
		);
	}

	let formData;
	try {
		formData = await request.formData();
	} catch (_err) {
		return json(
			{ error: { code: 'INVALID_FORM_DATA', message: 'Malformed multipart form data' } },
			{ status: 400 }
		);
	}

	const file = formData.get('file');
	const contentTypeUid = formData.get('contentType');

	if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
		return json(
			{ error: { code: 'MISSING_FILE', message: 'No file was uploaded.' } },
			{ status: 400 }
		);
	}

	if (!contentTypeUid || typeof contentTypeUid !== 'string') {
		return json(
			{ error: { code: 'MISSING_CONTENT_TYPE', message: 'Target content type is required.' } },
			{ status: 400 }
		);
	}

	// Verify target content type exists
	const schema = await getContentTypeSchema(contentTypeUid);
	if (!schema) {
		return json(
			{
				error: {
					code: 'UNKNOWN_CONTENT_TYPE',
					message: `Unknown or unsupported content type "${contentTypeUid}".`
				}
			},
			{ status: 400 }
		);
	}

	const buffer = Buffer.from(await file.arrayBuffer());

	// 1. Guard check
	let guardResult;
	try {
		guardResult = await validateDocx(buffer, file.name);
	} catch (err) {
		return json(
			{
				error: {
					code: 'FILE_VALIDATION_ERROR',
					message: err instanceof Error ? err.message : String(err)
				}
			},
			{ status: 400 }
		);
	}

	// 2. Create job with LOCKED content type
	const job = createJob({
		originalFilename: guardResult.sanitizedFilename,
		sha256: guardResult.sha256,
		buffer,
		contentTypeUid: schema.uid
	});

	// 3. Parse DOCX into DocumentModel
	let docModel;
	try {
		docModel = await parseDocx(buffer);
		saveParsedDocument(job.id, docModel);
		updateJobState(job.id, 'parsed');
	} catch (err) {
		updateJobState(job.id, 'failed', { error: err instanceof Error ? err.message : String(err) });
		return json(
			{
				error: {
					code: 'PARSER_ERROR',
					message: `Failed to parse document: ${err instanceof Error ? err.message : err}`
				}
			},
			{ status: 500 }
		);
	}

	const documentSummary = {
		totalBlocks: docModel.blocks.length,
		headingCount: docModel.blocks.filter((b) => b.type === 'heading').length,
		tableCount: docModel.blocks.filter((b) => b.type === 'table').length,
		imageCount: docModel.images.length,
		inferredHeadings: docModel.blocks.filter((b) => b.inferredHeading).length,
		warnings: docModel.warnings
	};

	return json({
		jobId: job.id,
		fileInfo: {
			name: guardResult.sanitizedFilename,
			size: guardResult.size,
			sha256: guardResult.sha256
		},
		contentType: {
			uid: schema.uid,
			displayName: schema.displayName,
			singularName: schema.singularName
		},
		documentSummary,
		warnings: docModel.warnings
	});
}
