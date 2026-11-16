import { json } from '@sveltejs/kit';
import {
	getJob,
	getParsedDocument,
	getExtraction,
	getReview,
	getResult,
	deleteJob,
	JobBusyError
} from '$lib/server/jobs/store.js';
import { getContentTypeSchema } from '$lib/server/schema/resolve.js';

export async function GET({ params }) {
	const { id } = params;
	const job = getJob(id);

	if (!job) {
		return json({ error: { code: 'NOT_FOUND', message: `Job ${id} not found` } }, { status: 404 });
	}

	const document = getParsedDocument(id);
	const extraction = getExtraction(id);
	const review = getReview(id);
	const result = getResult(id);
	const schema = await getContentTypeSchema(job.contentTypeUid);

	return json({
		job,
		schema,
		document,
		extraction,
		review,
		result
	});
}

/** @param {{ params: { id: string } }} event */
export async function DELETE({ params }) {
	try {
		if (!deleteJob(params.id)) {
			return json(
				{ error: { code: 'NOT_FOUND', message: 'History entry not found.' } },
				{ status: 404 }
			);
		}
		return new Response(null, { status: 204 });
	} catch (err) {
		if (err instanceof JobBusyError) {
			return json({ error: { code: 'JOB_BUSY', message: err.message } }, { status: 409 });
		}
		if (!/^[a-zA-Z0-9_-]+$/.test(params.id)) {
			return json(
				{ error: { code: 'INVALID_JOB_ID', message: 'Invalid job ID.' } },
				{ status: 400 }
			);
		}
		console.error('[DocuFlow] History deletion failed:', err);
		return json(
			{
				error: {
					code: 'DELETE_FAILED',
					message: 'Could not delete this history entry. Please try again.'
				}
			},
			{ status: 500 }
		);
	}
}
