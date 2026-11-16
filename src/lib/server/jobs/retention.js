import { cleanupExpiredJobs } from './store.js';

export const CLEANUP_INTERVAL_MS = 60 * 1000;
let timer;

function runCleanup() {
	try {
		const deleted = cleanupExpiredJobs();
		if (deleted) console.log(`[DocuFlow] Deleted ${deleted} expired history jobs.`);
	} catch (err) {
		console.error('[DocuFlow] History cleanup failed:', err);
	}
}

export function startJobCleanup() {
	if (timer) return;
	runCleanup();
	timer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
	timer.unref?.();
}

export function stopJobCleanup() {
	clearInterval(timer);
	timer = undefined;
}

if (import.meta.hot) import.meta.hot.dispose(stopJobCleanup);
