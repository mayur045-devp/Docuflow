/**
 * Simple in-memory rate limiter for login, uploads, and AI/import requests.
 */
class RateLimiter {
	/**
	 * @param {object} options
	 * @param {number} options.windowMs Window in milliseconds
	 * @param {number} options.max Limit of hits within window
	 */
	constructor({ windowMs, max }) {
		this.windowMs = windowMs;
		this.max = max;
		/** @type {Map<string, { count: number, resetTime: number }>} */
		this.hits = new Map();

		// Cleanup every 5 minutes
		if (typeof setInterval !== 'undefined') {
			const interval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
			if (interval.unref) interval.unref();
		}
	}

	/**
	 * Checks if an identifier has exceeded the limit.
	 * @param {string} key
	 * @returns {{ allowed: boolean, remaining: number, resetTime: number }}
	 */
	check(key) {
		const now = Date.now();
		const record = this.hits.get(key);

		if (!record || now > record.resetTime) {
			this.hits.set(key, { count: 1, resetTime: now + this.windowMs });
			return { allowed: true, remaining: this.max - 1, resetTime: now + this.windowMs };
		}

		if (record.count >= this.max) {
			return { allowed: false, remaining: 0, resetTime: record.resetTime };
		}

		record.count += 1;
		return { allowed: true, remaining: this.max - record.count, resetTime: record.resetTime };
	}

	cleanup() {
		const now = Date.now();
		for (const [key, record] of this.hits.entries()) {
			if (now > record.resetTime) {
				this.hits.delete(key);
			}
		}
	}

	reset(key) {
		this.hits.delete(key);
	}
}

// 5 attempts per 15 mins for login
export const loginLimiter = new RateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
// 30 uploads per minute
export const uploadLimiter = new RateLimiter({ windowMs: 60 * 1000, max: 30 });
// 20 AI/import requests per minute
export const actionLimiter = new RateLimiter({ windowMs: 60 * 1000, max: 30 });
