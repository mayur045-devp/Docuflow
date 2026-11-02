import { listJobs } from '$lib/server/jobs/store.js';

export async function load() {
	const jobs = listJobs();
	return {
		jobs
	};
}
