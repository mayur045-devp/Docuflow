import { json } from '@sveltejs/kit';
import { getJob, saveReview, updateJobState } from '$lib/server/jobs/store.js';
import { getContentTypeSchema } from '$lib/server/schema/resolve.js';
import { validateContentData } from '$lib/server/schema/to-zod.js';

export async function PUT({ params, request }) {
	const { id } = params;
	const job = getJob(id);

	if (!job) {
		return json({ error: { code: 'NOT_FOUND', message: `Job ${id} not found` } }, { status: 404 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json(
			{ error: { code: 'INVALID_JSON', message: 'Malformed JSON payload' } },
			{ status: 400 }
		);
	}

	const reviewData = body.data || {};
	const approved = Boolean(body.approved);

	const schema = await getContentTypeSchema(job.contentTypeUid, { forceRefresh: true });
	if (!schema) {
		return json(
			{ error: { code: 'SCHEMA_NOT_FOUND', message: 'Content type schema not found.' } },
			{ status: 400 }
		);
	}

	// Server-side revalidation of user edits
	const validation = validateContentData(schema, reviewData);

	saveReview(job.id, reviewData, validation.issues, approved);
	updateJobState(job.id, 'reviewed', { approved });

	return json({
		jobId: job.id,
		state: 'reviewed',
		valid: validation.valid,
		approved,
		issues: validation.issues
	});
}
