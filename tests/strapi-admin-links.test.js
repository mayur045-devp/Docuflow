import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/server/env.js', () => ({
	getEnv: () => ({
		STRAPI_URL: 'https://default.example.com',
		STRAPI_ADMIN_URL: 'https://default-admin.example.com/admin/',
		STRAPI_API_TOKEN: 'default-test-token'
	})
}));

import { resetActiveConnection, setActiveConnection } from '../src/lib/server/strapi/connection.js';
import { v4Adapter } from '../src/lib/server/strapi/adapters/v4.js';
import { v5Adapter } from '../src/lib/server/strapi/adapters/v5.js';

afterEach(() => resetActiveConnection());

describe.each([v4Adapter, v5Adapter])('Strapi $version admin links', (adapter) => {
	const entry = { id: 42, documentId: 'document-42' };
	const collectionPath =
		adapter.version === '4'
			? 'collectionType/api::article.article/42'
			: 'collection-types/api::article.article/document-42';
	const singlePath = adapter.version === '4' ? 'singleType' : 'single-types';

	it('uses the configured admin URL for the default environment', () => {
		expect(adapter.adminLink(entry, 'article')).toBe(
			`https://default-admin.example.com/admin/content-manager/${collectionPath}`
		);
	});

	it('links collection and single entries to the switched environment, including its subpath', () => {
		setActiveConnection({
			strapiUrl: 'https://other.example.com/cms/',
			apiToken: 'other-test-token'
		});
		expect(adapter.adminLink(entry, 'article')).toBe(
			`https://other.example.com/cms/admin/content-manager/${collectionPath}`
		);
		expect(adapter.adminLink(entry, 'homepage', 'singleType', 'api::homepage.homepage')).toBe(
			`https://other.example.com/cms/admin/content-manager/${singlePath}/api::homepage.homepage`
		);
	});

	it('restores default admin links after resetting the connection', () => {
		setActiveConnection({ strapiUrl: 'https://other.example.com', apiToken: 'other-test-token' });
		resetActiveConnection();
		expect(adapter.adminLink(entry, 'article')).toBe(
			`https://default-admin.example.com/admin/content-manager/${collectionPath}`
		);
	});
});
