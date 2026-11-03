import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { normalizeContentType } from './normalize.js';

/**
 * Recursively finds files matching a pattern.
 * @param {string} dir
 * @param {RegExp} pattern
 * @returns {string[]}
 */
function findFiles(dir, pattern) {
	const results = [];
	if (!fs.existsSync(dir)) return results;

	function walk(currentDir) {
		const entries = fs.readdirSync(currentDir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
			} else if (pattern.test(entry.name)) {
				results.push(fullPath);
			}
		}
	}

	walk(dir);
	return results;
}

/**
 * Loads content types and components from a local filesystem project folder.
 * Supports standard Strapi project paths (src/api/.../content-types/.../schema.json)
 * as well as custom fixture paths.
 *
 * @param {string} rootPath
 * @returns {{ contentTypes: Record<string, any>, components: Record<string, any> }}
 */
export function loadSchemasFromFiles(rootPath) {
	if (!rootPath || !fs.existsSync(rootPath)) {
		return { contentTypes: {}, components: {} };
	}

	/** @type {Record<string, any>} */
	const rawComponents = {};
	/** @type {Record<string, any>} */
	const rawContentTypes = {};

	// 1. Find all components (in src/components or components/)
	const compDirs = [path.join(rootPath, 'src', 'components'), path.join(rootPath, 'components')];
	for (const compDir of compDirs) {
		if (fs.existsSync(compDir)) {
			const files = findFiles(compDir, /\.json$/);
			for (const file of files) {
				try {
					const content = JSON.parse(fs.readFileSync(file, 'utf8'));
					// e.g. components/default/service-item.json -> "default.service-item"
					const rel = path.relative(compDir, file);
					const parts = rel.split(path.sep);
					const cat = parts[0] || 'default';
					const name = path.basename(file, '.json');
					const compUid = `${cat}.${name}`;
					rawComponents[compUid] = content;
				} catch {
					// Ignore invalid JSON
				}
			}
		}
	}

	// 2. Find content types
	const ctDirs = [
		path.join(rootPath, 'src', 'api'),
		path.join(rootPath, 'content-types'),
		path.join(rootPath, 'api')
	];

	for (const ctDir of ctDirs) {
		if (fs.existsSync(ctDir)) {
			const files = findFiles(ctDir, /schema\.json$/);
			for (const file of files) {
				try {
					const content = JSON.parse(fs.readFileSync(file, 'utf8'));
					const singular = content.info?.singularName || path.basename(path.dirname(file));
					const uid = `api::${singular}.${singular}`;
					content.uid = uid;
					rawContentTypes[uid] = content;
				} catch {
					// Ignore invalid JSON
				}
			}
		}
	}

	// 2.5. Discover plugin content types (e.g. plugin::users-permissions.user)
	const userExtPath = path.join(
		rootPath,
		'src',
		'extensions',
		'users-permissions',
		'content-types',
		'user',
		'schema.json'
	);
	if (fs.existsSync(userExtPath)) {
		try {
			const content = JSON.parse(fs.readFileSync(userExtPath, 'utf8'));
			content.uid = 'plugin::users-permissions.user';
			content.kind = content.kind || 'collectionType';
			rawContentTypes['plugin::users-permissions.user'] = content;
		} catch {
			// Ignore invalid JSON
		}
	} else {
		const userPluginPath = path.join(
			rootPath,
			'node_modules',
			'@strapi',
			'plugin-users-permissions',
			'dist',
			'server',
			'content-types',
			'user',
			'index.js'
		);
		if (fs.existsSync(userPluginPath)) {
			try {
				const req = createRequire(import.meta.url);
				const userMod = req(path.resolve(userPluginPath));
				const userRaw = userMod.__require ? userMod.__require() : userMod;
				if (userRaw && userRaw.attributes) {
					userRaw.uid = 'plugin::users-permissions.user';
					userRaw.kind = userRaw.kind || 'collectionType';
					rawContentTypes['plugin::users-permissions.user'] = userRaw;
				}
			} catch {
				// Ignore load error
			}
		}
	}

	// 3. Normalize all content types with expanded components
	/** @type {Record<string, any>} */
	const normalizedContentTypes = {};
	for (const [uid, raw] of Object.entries(rawContentTypes)) {
		normalizedContentTypes[uid] = normalizeContentType(raw, rawComponents);
	}

	return {
		contentTypes: normalizedContentTypes,
		components: rawComponents
	};
}
