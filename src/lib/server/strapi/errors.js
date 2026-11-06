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
			'Missing or invalid credentials: The STRAPI_API_TOKEN in your .env was rejected or is missing. Please verify that your API token is valid and has appropriate permissions in Strapi Settings > API Tokens.';
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

	let finalMessage = redact(message);
	if (issues.length > 0) {
		const fieldDetails = issues
			.map((i) => (i.path ? `Field "${i.path}": ${i.message}` : i.message))
			.filter(Boolean)
			.join(' | ');
		if (fieldDetails && !finalMessage.includes(fieldDetails)) {
			finalMessage = `${finalMessage} — ${fieldDetails}`;
		}
	}

	return {
		code,
		message: finalMessage,
		issues,
		raw: strapiError
	};
}
