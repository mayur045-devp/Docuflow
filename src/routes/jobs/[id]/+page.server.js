import { error } from '@sveltejs/kit';
import {
	getJob,
	getParsedDocument,
	getExtraction,
	getReview,
	getResult
} from '$lib/server/jobs/store.js';
import { getContentTypeSchema } from '$lib/server/schema/resolve.js';

export async function load({ params }) {
	const { id } = params;
	const job = getJob(id);

	if (!job) {
		throw error(404, `Job ${id} not found`);
	}

	const document = getParsedDocument(id);
	const extraction = getExtraction(id);
	const review = getReview(id);
	const result = getResult(id);
	const schema = await getContentTypeSchema(job.contentTypeUid, { forceRefresh: true });

	return {
		job,
		schema,
		document,
		extraction,
		review,
		result
	};
}
