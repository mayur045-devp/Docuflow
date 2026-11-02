import crypto from 'node:crypto';
import { getEnv } from '../env.js';

export const SESSION_COOKIE_NAME = 'docuflow_session';

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function safeCompare(a, b) {
	if (typeof a !== 'string' || typeof b !== 'string') return false;
	const bufA = Buffer.from(a, 'utf8');
	const bufB = Buffer.from(b, 'utf8');
	if (bufA.length !== bufB.length) {
		// Do a fake timingSafeEqual to avoid timing discrepancy on length
		crypto.timingSafeEqual(bufA, bufA);
		return false;
	}
	return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates the user password against APP_PASSWORD.
 * @param {string} password
 * @returns {boolean}
 */
export function verifyPassword(password) {
	const { APP_PASSWORD } = getEnv();
	return safeCompare(password, APP_PASSWORD);
}

/**
 * Signs a session payload using HMAC-SHA256 with SESSION_SECRET.
 * @param {object} payload
 * @returns {string} base64url encoded token
 */
export function createSessionToken(payload = {}) {
	const { SESSION_SECRET } = getEnv();
	const data = {
		...payload,
		iat: Date.now(),
		exp: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
	};
	const encodedData = Buffer.from(JSON.stringify(data)).toString('base64url');
	const signature = crypto
		.createHmac('sha256', SESSION_SECRET)
		.update(encodedData)
		.digest('base64url');
	return `${encodedData}.${signature}`;
}

/**
 * Verifies a session token.
 * @param {string|null|undefined} token
 * @returns {object|null}
 */
export function verifySessionToken(token) {
	if (!token || typeof token !== 'string') return null;
	const parts = token.split('.');
	if (parts.length !== 2) return null;

	const [encodedData, signature] = parts;
	const { SESSION_SECRET } = getEnv();

	const expectedSignature = crypto
		.createHmac('sha256', SESSION_SECRET)
		.update(encodedData)
		.digest('base64url');

	if (!safeCompare(signature, expectedSignature)) {
		return null;
	}

	try {
		const data = JSON.parse(Buffer.from(encodedData, 'base64url').toString('utf8'));
		if (data.exp && Date.now() > data.exp) {
			return null;
		}
		return data;
	} catch {
		return null;
	}
}
