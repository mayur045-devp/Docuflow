import { Readable } from 'node:stream';
import { getRequest } from '@sveltejs/kit/node';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/server/security/rate-limit.js', () => ({
	uploadLimiter: { check: () => ({ allowed: true }) }
}));
vi.mock('../src/lib/server/schema/resolve.js', () => ({
	getContentTypeSchema: async () => ({ uid: 'api::article.article' })
}));
vi.mock('../src/lib/server/security/docx-guard.js', () => ({
	validateDocx: async (buffer, name) => ({
		sanitizedFilename: name,
		size: buffer.length,
		sha256: 'test-hash'
	})
}));
vi.mock('../src/lib/server/document/parser.js', () => ({
	parseDocx: async () => ({ blocks: [], images: [], warnings: [] })
}));
vi.mock('../src/lib/server/jobs/store.js', () => ({
	createJob: () => ({ id: 'upload-test' }),
	saveParsedDocument: vi.fn(),
	updateJobState: vi.fn(),
	listJobs: () => [],
	beginJobActivity: () => () => {}
}));

import { POST } from '../src/routes/api/jobs/+server.js';

function eventFor(request) {
	return /** @type {Parameters<typeof POST>[0]} */ (
		/** @type {unknown} */ ({ request, getClientAddress: () => '127.0.0.1' })
	);
}

// Exercise the same Node-to-Web stream conversion used by the production adapter.
async function upload(bodySizeLimit, chunked = false) {
	const form = new FormData();
	form.append('file', new Blob([Buffer.alloc(600 * 1024)]), 'document.docx');
	form.append('contentType', 'api::article.article');
	const encoded = new Request('http://localhost/api/jobs', { method: 'POST', body: form });
	const body = Buffer.from(await encoded.arrayBuffer());
	const incoming = Object.assign(Readable.from([body]), {
		headers: {
			'content-type': encoded.headers.get('content-type'),
			...(chunked ? { 'transfer-encoding': 'chunked' } : { 'content-length': String(body.length) })
		},
		httpVersionMajor: 1,
		method: 'POST',
		url: '/api/jobs'
	});
	const request = getRequest({
		request: /** @type {import('http').IncomingMessage} */ (incoming),
		base: 'http://localhost',
		bodySizeLimit
	});
	return POST(eventFor(request));
}

describe('Production multipart uploads', () => {
	it.each([false, true])('preserves HTTP 413 from the adapter (chunked: %s)', async (chunked) => {
		const response = await upload(512 * 1024, chunked);
		expect(response.status).toBe(413);
		expect((await response.json()).error.code).toBe('PAYLOAD_TOO_LARGE');
	});

	it('accepts a document above the old 512 KB production limit', async () => {
		const response = await upload(11 * 1024 * 1024);
		expect(response.status).toBe(200);
		expect((await response.json()).fileInfo.size).toBe(600 * 1024);
	});

	it('still reports malformed multipart bodies as HTTP 400', async () => {
		const request = new Request('http://localhost/api/jobs', {
			method: 'POST',
			headers: { 'content-type': 'multipart/form-data' },
			body: 'missing boundary'
		});
		const response = await POST(eventFor(request));
		expect(response.status).toBe(400);
		expect((await response.json()).error.code).toBe('INVALID_FORM_DATA');
	});
});
