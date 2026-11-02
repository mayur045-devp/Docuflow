import { describe, it, expect } from 'vitest';
import { canTransition, assertTransition } from '../src/lib/server/jobs/state-machine.js';
import { createJob, getJob, updateJobState, listJobs } from '../src/lib/server/jobs/store.js';

describe('Job State Machine and Store', () => {
	it('enforces legal state transitions and rejects illegal ones', () => {
		expect(canTransition('uploaded', 'parsed')).toBe(true);
		expect(canTransition('parsed', 'extracted')).toBe(true);
		expect(canTransition('extracted', 'reviewed')).toBe(true);
		expect(canTransition('reviewed', 'importing')).toBe(true);
		expect(canTransition('importing', 'imported')).toBe(true);

		// Illegal skip from uploaded directly to importing
		expect(canTransition('uploaded', 'importing')).toBe(false);
		expect(() => assertTransition('uploaded', 'importing')).toThrow(
			/illegal job state transition/i
		);

		// Imported is a terminal state
		expect(canTransition('imported', 'reviewed')).toBe(false);
	});

	it('creates jobs and locks the content type', () => {
		const job = createJob({
			originalFilename: 'test.docx',
			sha256: 'abc1234567890abcdef',
			buffer: Buffer.from('test bytes'),
			contentTypeUid: 'api::service-page.service-page'
		});

		expect(job.id).toBeDefined();
		expect(job.state).toBe('uploaded');
		expect(job.contentTypeUid).toBe('api::service-page.service-page');

		const loaded = getJob(job.id);
		expect(loaded).toBeDefined();
		expect(loaded.originalFilename).toBe('test.docx');

		// Transition to parsed
		const updated = updateJobState(job.id, 'parsed');
		expect(updated.state).toBe('parsed');
	});

	it('lists jobs and detects duplicate document hashes', () => {
		const hash = 'duplicate-hash-12345';
		createJob({
			originalFilename: 'file1.docx',
			sha256: hash,
			buffer: Buffer.from('bytes 1'),
			contentTypeUid: 'api::service-page.service-page'
		});

		createJob({
			originalFilename: 'file2.docx',
			sha256: hash,
			buffer: Buffer.from('bytes 2'),
			contentTypeUid: 'api::service-page.service-page'
		});

		const jobs = listJobs();
		const matching = jobs.filter((j) => j.sha256 === hash);
		expect(matching.length).toBeGreaterThanOrEqual(2);
		expect(matching.some((j) => j.duplicateDoc === true)).toBe(true);
	});
});
