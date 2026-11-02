import { json } from '@sveltejs/kit';
import {
	getJob,
	getParsedDocument,
	getExtraction,
	getReview,
	getResult
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
