import { listJobs } from '$lib/server/jobs/store.js';
import { getEnv } from '$lib/server/env.js';

export async function load() {
	const jobs = listJobs();
	return {
		jobs,
		retentionDays: getEnv().JOB_TTL_DAYS
	};
}
