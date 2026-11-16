import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ DATA_DIR: '', JOB_TTL_DAYS: 10 }));
const environment = vi.hoisted(() => ({ building: false }));
vi.mock('../src/lib/server/env.js', () => ({ getEnv: () => env }));
vi.mock('$app/env', () => environment);
vi.mock('../src/lib/server/security/auth.js', () => ({
	SESSION_COOKIE_NAME: 'test-session',
	verifySessionToken: (token) => (token === 'valid' ? { user: 'operator' } : null)
}));
vi.mock('../src/lib/server/schema/resolve.js', () => ({ getContentTypeSchema: vi.fn() }));

import {
	createJob,
	deleteJob,
	getJob,
	listJobs,
	cleanupExpiredJobs,
	beginJobActivity,
	JobBusyError
} from '../src/lib/server/jobs/store.js';
import {
	startJobCleanup,
	stopJobCleanup,
	CLEANUP_INTERVAL_MS
} from '../src/lib/server/jobs/retention.js';
import { DELETE } from '../src/routes/api/jobs/[id]/+server.js';
import { handle, init } from '../src/hooks.server.js';

const DAY = 24 * 60 * 60 * 1000;
const tempBase = path.resolve('.data');
let directory;
let releases;

function job(age = 0, state = 'parsed') {
	const meta = createJob({
		originalFilename: 'document.docx',
		sha256: 'test-hash',
		buffer: Buffer.from('test document'),
		contentTypeUid: 'api::article.article'
	});
	const folder = path.join(directory, 'jobs', meta.id);
	meta.createdAt = new Date(Date.now() - age).toISOString();
	meta.state = state;
	fs.writeFileSync(path.join(folder, 'job.json'), JSON.stringify(meta));
	fs.mkdirSync(path.join(folder, 'images'));
	fs.writeFileSync(path.join(folder, 'images', 'img-1.png'), 'image');
	for (const file of ['document.json', 'extraction.json', 'review.json', 'result.json'])
		fs.writeFileSync(path.join(folder, file), '{}');
	return { ...meta, folder };
}

function event(id, operation = '', method = 'POST', authenticated = true) {
	return {
		url: new URL(`https://app.example.com/api/jobs/${id}${operation ? '/' + operation : ''}`),
		request: new Request('https://app.example.com', { method }),
		cookies: { get: () => (authenticated ? 'valid' : null) },
		locals: {},
		params: { id },
		route: { id: `/api/jobs/[id]${operation ? '/' + operation : ''}` }
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
	fs.mkdirSync(tempBase, { recursive: true });
	directory = fs.mkdtempSync(path.join(tempBase, 'history-retention-test-'));
	env.DATA_DIR = directory;
	env.JOB_TTL_DAYS = 10;
	environment.building = false;
	releases = [];
});

afterEach(() => {
	stopJobCleanup();
	for (const release of releases) release();
	vi.restoreAllMocks();
	vi.useRealTimers();
	// Never recursively remove anything except this test's isolated fixture directory.
	if (
		path.dirname(directory) !== tempBase ||
		!path.basename(directory).startsWith('history-retention-test-')
	)
		throw new Error('Unsafe fixture path');
	fs.rmSync(directory, { recursive: true, force: true });
});

describe('Immediate history deletion', () => {
	it('removes metadata, source document, all processing JSON and images immediately', () => {
		const target = job();
		const keep = job();
		expect(deleteJob(target.id)).toBe(true);
		expect(fs.existsSync(target.folder)).toBe(false);
		expect(getJob(target.id)).toBeNull();
		expect(listJobs().map((j) => j.id)).toEqual([keep.id]);
	});

	it.each(['', '..', '../jobs', '..\\jobs', 'safe/../other', '/absolute', 'C:\\outside'])(
		'rejects unsafe ID %s without touching storage',
		(id) => {
			const target = job();
			expect(() => deleteJob(id)).toThrow(/Invalid/);
			expect(fs.existsSync(target.folder)).toBe(true);
		}
	);

	it('rejects a junction/symlink rather than deleting its target', ({ skip }) => {
		job();
		const outside = path.join(directory, 'outside-jobs');
		fs.mkdirSync(outside);
		fs.writeFileSync(path.join(outside, 'keep.txt'), 'keep');
		try {
			fs.symlinkSync(outside, path.join(directory, 'jobs', 'linked-job'), 'junction');
		} catch (err) {
			if (['EPERM', 'EACCES'].includes(err.code)) return skip();
			throw err;
		}
		expect(() => deleteJob('linked-job')).toThrow(/Invalid|outside/);
		expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('keep');
	});

	it('returns 204 only after the API has physically removed the folder', async () => {
		const target = job();
		expect((await DELETE({ params: { id: target.id } })).status).toBe(204);
		expect(fs.existsSync(target.folder)).toBe(false);
		expect((await DELETE({ params: { id: target.id } })).status).toBe(404);
	});

	it('returns 400 for an invalid API ID', async () => {
		expect((await DELETE({ params: { id: '..' } })).status).toBe(400);
	});

	it('returns 409 while work is active and deletes after it finishes', async () => {
		const target = job();
		const release = beginJobActivity(target.id);
		releases.push(release);
		expect(() => deleteJob(target.id)).toThrow(JobBusyError);
		expect((await DELETE({ params: { id: target.id } })).status).toBe(409);
		release();
		release();
		expect((await DELETE({ params: { id: target.id } })).status).toBe(204);
	});

	it('requires authentication through the application hook', async () => {
		const target = job();
		const resolve = vi.fn();
		const response = await handle({ event: event(target.id, '', 'DELETE', false), resolve });
		expect(response.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
		expect(fs.existsSync(target.folder)).toBe(true);
	});
});

describe('Ten-day expiration', () => {
	it('deletes at the exact ten-day boundary while retaining a newer upload', () => {
		const expired = job(10 * DAY);
		const recent = job(10 * DAY - 1);
		expect(cleanupExpiredJobs()).toBe(1);
		expect(fs.existsSync(expired.folder)).toBe(false);
		expect(fs.existsSync(recent.folder)).toBe(true);
	});

	it.each(['uploaded', 'parsed', 'extracted', 'reviewed', 'imported', 'failed', 'importing'])(
		'expires inactive jobs in state %s by creation time',
		(state) => {
			const target = job(11 * DAY, state);
			expect(cleanupExpiredJobs()).toBe(1);
			expect(fs.existsSync(target.folder)).toBe(false);
		}
	);

	it('lists history without returning expired jobs', () => {
		const old = job(11 * DAY);
		const recent = job();
		expect(listJobs().map((j) => j.id)).toEqual([recent.id]);
		expect(fs.existsSync(old.folder)).toBe(false);
	});

	it('defers expired jobs until all active operations release them', () => {
		const target = job(11 * DAY);
		const first = beginJobActivity(target.id),
			second = beginJobActivity(target.id);
		releases.push(first, second);
		expect(listJobs()[0].busy).toBe(true);
		expect(cleanupExpiredJobs()).toBe(0);
		first();
		expect(cleanupExpiredJobs()).toBe(0);
		second();
		expect(cleanupExpiredJobs()).toBe(1);
	});

	it('skips invalid timestamps rather than deleting an unidentifiable-age folder', () => {
		const target = job();
		const meta = getJob(target.id);
		meta.createdAt = 'invalid';
		fs.writeFileSync(path.join(target.folder, 'job.json'), JSON.stringify(meta));
		expect(cleanupExpiredJobs()).toBe(0);
		expect(fs.existsSync(target.folder)).toBe(true);
	});

	it('continues deleting other expired jobs if one deletion fails', () => {
		const first = job(11 * DAY),
			second = job(11 * DAY);
		const remove = fs.rmSync;
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(fs, 'rmSync').mockImplementation((target, options) => {
			if (String(target) === fs.realpathSync(first.folder))
				throw new Error('simulated storage error');
			return remove(target, options);
		});
		expect(cleanupExpiredJobs()).toBe(1);
		expect(fs.existsSync(first.folder)).toBe(true);
		expect(fs.existsSync(second.folder)).toBe(false);
	});
});

describe('Background scheduler and processing protection', () => {
	it('cleans on runtime startup and every minute without visiting history', () => {
		const target = job(10 * DAY - 30_000);
		vi.spyOn(console, 'log').mockImplementation(() => {});
		init();
		expect(fs.existsSync(target.folder)).toBe(true);
		vi.advanceTimersByTime(CLEANUP_INTERVAL_MS);
		expect(fs.existsSync(target.folder)).toBe(false);
	});

	it('does not delete data during a production build', () => {
		const target = job(11 * DAY);
		environment.building = true;
		init();
		expect(fs.existsSync(target.folder)).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('starts only one timer and can stop it', () => {
		startJobCleanup();
		startJobCleanup();
		expect(vi.getTimerCount()).toBe(1);
		stopJobCleanup();
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(['import', 'extract', 'review'])(
		'protects %s requests and releases activity even on failure',
		async (operation) => {
			const target = job(11 * DAY);
			await expect(
				handle({
					event: event(target.id, operation, operation === 'review' ? 'PUT' : 'POST'),
					resolve: async () => {
						expect(() => deleteJob(target.id)).toThrow(JobBusyError);
						expect(cleanupExpiredJobs()).toBe(0);
						throw new Error('test request failure');
					}
				})
			).rejects.toThrow('test request failure');
			expect(deleteJob(target.id)).toBe(true);
		}
	);
});
