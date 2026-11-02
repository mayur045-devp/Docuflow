/**
 * Redacts sensitive tokens, keys, and passwords from logs and strings.
 * @param {any} val
 * @param {string[]} [extraSecrets]
 * @returns {any}
 */
export function redact(val, extraSecrets = []) {
	if (val === null || val === undefined) return val;
	if (typeof val === 'string') {
		let redacted = val;
		const knownSecrets = [
			process.env.STRAPI_API_TOKEN,
			process.env.GEMINI_API_KEY,
			process.env.APP_PASSWORD,
			process.env.SESSION_SECRET,
			process.env.STRAPI_ADMIN_PASSWORD,
			...extraSecrets
		].filter((s) => typeof s === 'string' && s.length >= 4);

		for (const secret of knownSecrets) {
			if (secret) {
				redacted = redacted.replaceAll(secret, '[REDACTED]');
			}
		}

		// Also scrub Authorization headers and Bearer tokens
		redacted = redacted.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
		redacted = redacted.replace(
			/(password|token|apiKey|secret)["']?\s*[:=]\s*["']?([^"',\s]+)/gi,
			'$1="[REDACTED]"'
		);

		return redacted;
	}

	if (Array.isArray(val)) {
		return val.map((item) => redact(item, extraSecrets));
	}

	if (typeof val === 'object') {
		const result = {};
		for (const [k, v] of Object.entries(val)) {
			if (/password|token|apiKey|secret|authorization/i.test(k)) {
				result[k] = '[REDACTED]';
			} else {
				result[k] = redact(v, extraSecrets);
			}
		}
		return result;
	}

	return val;
}
