import { redact } from '../security/redact.js';

/**
 * Normalizes Strapi REST API errors into clean, field-mapped issues.
 *
 * @param {any} strapiError
 * @param {number} status
 * @returns {{ code: string, message: string, issues: { path: string, message: string }[] }}
 */
export function normalizeStrapiError(strapiError, status = 500) {
	const raw = strapiError?.error || strapiError || {};
	let message = raw.message || 'An error occurred while communicating with Strapi.';
	const code = raw.name || `STRAPI_ERROR_${status}`;

	if (status === 401 || code === 'UnauthorizedError') {
		message =
			'Missing or invalid credentials: The STRAPI_API_TOKEN in your .env was rejected or is missing. Please verify that your API token is valid and has Full Access permissions in Strapi Settings > API Tokens (or run "npm run strapi:token" if using the local CMS).';
	}

	/** @type {{ path: string, message: string }[]} */
	const issues = [];

	if (Array.isArray(raw.details?.errors)) {
		for (const err of raw.details.errors) {
			const pathStr = Array.isArray(err.path) ? err.path.join('.') : String(err.path || '');
			issues.push({
				path: pathStr,
				message: redact(err.message || message)
			});
		}
	} else if (raw.details?.key) {
		issues.push({
			path: String(raw.details.key),
			message: redact(message)
		});
	}

	return {
		code,
		message: redact(message),
		issues
	};
}
