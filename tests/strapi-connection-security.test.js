import dns from 'node:dns';
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
	STRAPI_URL: 'https://cms.example.com',
	STRAPI_API_TOKEN: 'saved-test-token',
	STRAPI_VERSION: '5',
	STRAPI_PRIVATE_IPS: ''
}));
vi.mock('../src/lib/server/env.js', () => ({ getEnv: () => env }));

import {
	getActiveConnection,
	resetActiveConnection,
	setActiveConnection,
	testStrapiConnection
} from '../src/lib/server/strapi/connection.js';
import {
	isPublicAddress,
	isAllowedStrapiAddress,
	publicLookup,
	strapiNetworkFetch
} from '../src/lib/server/strapi/destination.js';
import { POST } from '../src/routes/api/strapi/test/+server.js';

function request(body) {
	return {
		request: new Request('https://app.example.com/api/strapi/test', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
}

describe('Smoke test secrets', () => {
	it('generates a fresh session secret instead of assigning a reusable literal', () => {
		const source = fs.readFileSync('scripts/smoke.js', 'utf8');
		expect(source).toMatch(
			/process\.env\.SESSION_SECRET\s*=\s*crypto\.randomBytes\(64\)\.toString\(['"]hex['"]\)/
		);
		expect(source).not.toMatch(/process\.env\.SESSION_SECRET\s*=\s*['"]/);
	});
});

describe('Strapi token isolation and URL validation', () => {
	beforeEach(() => {
		resetActiveConnection();
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			async () =>
				new Response(JSON.stringify({ data: [] }), {
					headers: { 'Content-Type': 'application/json' }
				})
		);
	});
	afterEach(() => vi.restoreAllMocks());

	it.each([
		'https://other.example.com',
		'https://cms.example.com.attacker.example.com',
		'https://cms.example.com/another-base',
		'https://cms.example.com:8443'
	])('does not send the saved token to changed URL %s', async (strapiUrl) => {
		const response = await POST(request({ strapiUrl, save: true }));
		expect(response.status).toBe(400);
		expect((await response.json()).errorCode).toBe('STRAPI_TOKEN_REQUIRED');
		expect(fetch).not.toHaveBeenCalled();
		expect(getActiveConnection().strapiUrl).toBe(env.STRAPI_URL);
		expect(() => setActiveConnection({ strapiUrl })).toThrow(/token/);
	});

	it('switches through 100 public HTTPS CMSs with separate tokens and no URL allowlist', async () => {
		for (let index = 0; index < 100; index += 1) {
			vi.mocked(fetch).mockClear();
			const strapiUrl = `https://cms-${index}.example.com`;
			const apiToken = `cms-${index}-test-token`;
			const response = await POST(request({ strapiUrl, apiToken, save: true }));
			expect(response.status).toBe(200);
			expect(getActiveConnection()).toMatchObject({ strapiUrl, apiToken });
			expect(fetch).toHaveBeenCalledTimes(2);
			for (const [url, options] of vi.mocked(fetch).mock.calls) {
				expect(String(url).startsWith(`${strapiUrl}/`)).toBe(true);
				expect(new Headers(options.headers).get('Authorization')).toBe(`Bearer ${apiToken}`);
				expect(options.redirect).toBe('error');
			}
		}
	});

	it('reuses credentials only for the active base URL, including trailing slash normalization', async () => {
		const response = await POST(request({ strapiUrl: `${env.STRAPI_URL}/`, save: true }));
		expect(response.status).toBe(200);
		for (const [, options] of vi.mocked(fetch).mock.calls) {
			expect(new Headers(options.headers).get('Authorization')).toBe(
				`Bearer ${env.STRAPI_API_TOKEN}`
			);
			expect(options.signal).toBeInstanceOf(AbortSignal);
		}
	});

	it('accepts the empty JSON object used by the home page connection button', async () => {
		expect((await POST(request({}))).status).toBe(200);
	});

	it.each([
		'http://cms.example.com',
		'https://127.1',
		'https://2130706433',
		'https://[::1]',
		'https://[::ffff:127.0.0.1]',
		'https://169.254.169.254',
		'https://localhost',
		'https://cms.local',
		'https://user:password@cms.example.com',
		'https://cms.example.com?redirect=https://other.example.com',
		'https://cms.example.com#fragment',
		'file:///etc/passwd'
	])('blocks unsafe URL %s before making requests', async (strapiUrl) => {
		expect(
			(await testStrapiConnection({ strapiUrl, apiToken: 'supplied-test-token' })).success
		).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it.each([null, [], { save: 'false' }, { apiToken: 123 }, { strapiUrl: '' }])(
		'rejects malformed input',
		async (body) => {
			expect((await POST(request(body))).status).toBe(400);
			expect(fetch).not.toHaveBeenCalled();
		}
	);

	it('rejects invalid JSON without falling back to saved credentials', async () => {
		const response = await POST({
			request: new Request('https://app.example.com/api/strapi/test', {
				method: 'POST',
				body: '{broken'
			})
		});
		expect(response.status).toBe(400);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('prevents requests escaping the selected CMS origin or base path', async () => {
		await expect(
			strapiNetworkFetch('https://other.example.com/api', {}, env.STRAPI_URL)
		).rejects.toThrow(/inside/);
		await expect(
			strapiNetworkFetch('https://cms.example.com/admin', {}, `${env.STRAPI_URL}/strapi`)
		).rejects.toThrow(/inside/);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('does not follow redirects or save a failed connection', async () => {
		vi.mocked(fetch).mockImplementation(async (_url, options) => {
			expect(options.redirect).toBe('error');
			throw new TypeError('fetch failed: unexpected redirect');
		});
		const response = await POST(
			request({ strapiUrl: 'https://other.example.com', apiToken: 'other-test-token', save: true })
		);
		expect(response.status).toBe(502);
		expect(getActiveConnection().strapiUrl).toBe(env.STRAPI_URL);
	});
});

describe('Socket DNS and internal CMS exceptions', () => {
	afterEach(() => {
		env.STRAPI_PRIVATE_IPS = '';
		vi.restoreAllMocks();
	});

	it.each([
		'0.0.0.0',
		'10.0.0.1',
		'100.64.0.1',
		'127.0.0.1',
		'169.254.169.254',
		'172.16.0.1',
		'192.168.1.1',
		'198.18.0.1',
		'224.0.0.1',
		'::',
		'::1',
		'::ffff:8.8.8.8',
		'fc00::1',
		'fe80::1',
		'ff02::1',
		'2001:db8::1',
		'2002:7f00:1::'
	])('rejects non-public address %s by default', (address) =>
		expect(isPublicAddress(address)).toBe(false)
	);
	it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('accepts public address %s', (address) =>
		expect(isPublicAddress(address)).toBe(true)
	);

	it('keeps internal IP exceptions scoped to their hostname and exact IP', () => {
		env.STRAPI_PRIVATE_IPS = '10.20.30.40,other.example.com=10.20.30.50';
		expect(isAllowedStrapiAddress('cms.example.com', '10.20.30.40')).toBe(true);
		expect(isAllowedStrapiAddress('other.example.com', '10.20.30.50')).toBe(true);
		expect(isAllowedStrapiAddress('other.example.com', '10.20.30.40')).toBe(false);
		expect(isAllowedStrapiAddress('cms.example.com', '10.20.30.50')).toBe(false);
		expect(isAllowedStrapiAddress('attacker.example.com', '10.20.30.50')).toBe(false);
		expect(isAllowedStrapiAddress('other.example.com', '10.20.30.51')).toBe(false);
	});

	it.each(['127.0.0.1', '169.254.169.254', '::1', 'fe80::1', '0.0.0.0'])(
		'never allows dangerous IP %s even in configuration',
		(address) => {
			env.STRAPI_PRIVATE_IPS = address;
			expect(isAllowedStrapiAddress('cms.example.com', address)).toBe(false);
		}
	);

	it('rejects mixed public/private DNS responses', async () => {
		vi.spyOn(dns, 'lookup').mockImplementation((_hostname, _options, callback) =>
			callback(null, [
				{ address: '8.8.8.8', family: 4 },
				{ address: '127.0.0.1', family: 4 }
			])
		);
		const error = await new Promise((resolve) =>
			publicLookup('cms.example.com', { all: true }, resolve)
		);
		expect(error).toMatchObject({ code: 'UNSAFE_STRAPI_DESTINATION' });
	});

	it('rejects private DNS at the actual socket lookup before opening a connection', async () => {
		const lookup = vi
			.spyOn(dns, 'lookup')
			.mockImplementation((_hostname, _options, callback) =>
				callback(null, [{ address: '127.0.0.1', family: 4 }])
			);
		await expect(strapiNetworkFetch('https://cms.example.com/api/test')).rejects.toMatchObject({
			code: 'UNSAFE_STRAPI_DESTINATION'
		});
		expect(lookup).toHaveBeenCalled();
	});
});
