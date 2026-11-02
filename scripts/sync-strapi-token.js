import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Ensures that the STRAPI_API_TOKEN in root .env matches a Full Access token
 * in cms/.tmp/data.db hashed with cms/.env's API_TOKEN_SALT.
 */
export function syncStrapiToken() {
	const rootEnvPath = path.resolve(process.cwd(), '.env');
	const cmsEnvPath = path.resolve(process.cwd(), 'cms', '.env');
	const dbPath = path.resolve(process.cwd(), 'cms', '.tmp', 'data.db');

	if (!fs.existsSync(cmsEnvPath) || !fs.existsSync(dbPath)) {
		console.log(
			'[DocuFlow Token Sync] cms/.env or cms/.tmp/data.db not found. Skipping local sync.'
		);
		return null;
	}

	const cmsEnv = fs.readFileSync(cmsEnvPath, 'utf8');
	const saltMatch = cmsEnv.match(/API_TOKEN_SALT=(.+)/);
	if (!saltMatch || !saltMatch[1].trim()) {
		console.warn('[DocuFlow Token Sync] API_TOKEN_SALT not found in cms/.env.');
		return null;
	}
	const salt = saltMatch[1].trim();

	let rootEnv = fs.existsSync(rootEnvPath) ? fs.readFileSync(rootEnvPath, 'utf8') : '';
	const tokenMatch = rootEnv.match(/^STRAPI_API_TOKEN=(.+)$/m);
	let plaintextToken = tokenMatch ? tokenMatch[1].trim() : '';

	if (!plaintextToken) {
		plaintextToken = crypto.randomBytes(32).toString('hex');
		if (tokenMatch) {
			rootEnv = rootEnv.replace(/^STRAPI_API_TOKEN=.*$/m, `STRAPI_API_TOKEN=${plaintextToken}`);
		} else {
			rootEnv += `\nSTRAPI_API_TOKEN=${plaintextToken}\n`;
		}
		fs.writeFileSync(rootEnvPath, rootEnv, 'utf8');
		console.log('[DocuFlow Token Sync] Generated new STRAPI_API_TOKEN and saved to .env');
	}

	const computedHash = crypto.createHmac('sha512', salt).update(plaintextToken).digest('hex');

	const db = new DatabaseSync(dbPath);
	const existingToken = db
		.prepare("SELECT * FROM strapi_api_tokens WHERE name = 'Full Access' OR type = 'full-access'")
		.get();

	if (existingToken) {
		db.prepare(
			"UPDATE strapi_api_tokens SET access_key = ?, type = 'full-access', kind = 'content-api' WHERE id = ?"
		).run(computedHash, existingToken.id);
		console.log(
			`[DocuFlow Token Sync] Successfully synchronized Full Access token (id: ${existingToken.id}) with access_key hash: ${computedHash.slice(0, 16)}...`
		);
	} else {
		const docId = 'token_' + crypto.randomBytes(8).toString('hex');
		const now = Date.now();
		db.prepare(
			`INSERT INTO strapi_api_tokens (
				document_id, name, description, kind, type, access_key, created_at, updated_at, published_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).run(
			docId,
			'Full Access',
			'Full Access API Token for DocuFlow CMS automation',
			'content-api',
			'full-access',
			computedHash,
			now,
			now,
			now
		);
		console.log(
			`[DocuFlow Token Sync] Created new Full Access token record with access_key hash: ${computedHash.slice(0, 16)}...`
		);
	}

	return { token: plaintextToken, hash: computedHash };
}

// Execute directly if run as a script
if (process.argv[1] && process.argv[1].endsWith('sync-strapi-token.js')) {
	try {
		const res = syncStrapiToken();
		if (res) {
			console.log('✅ Strapi API Token is valid and ready to use!');
		}
	} catch (err) {
		console.error('❌ Failed to sync token:', err);
		process.exit(1);
	}
}
