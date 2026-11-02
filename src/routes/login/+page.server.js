import { fail, redirect } from '@sveltejs/kit';
import {
	verifyPassword,
	createSessionToken,
	SESSION_COOKIE_NAME
} from '$lib/server/security/auth.js';
import { loginLimiter } from '$lib/server/security/rate-limit.js';

export const actions = {
	login: async ({ request, cookies, url, getClientAddress }) => {
		const ip = getClientAddress ? getClientAddress() : '127.0.0.1';
		const rate = loginLimiter.check(ip);
		if (!rate.allowed) {
			return fail(429, { message: 'Too many failed login attempts. Please try again later.' });
		}

		const data = await request.formData();
		const password = data.get('password');

		if (!password || typeof password !== 'string') {
			return fail(400, { message: 'Password is required' });
		}

		if (!verifyPassword(password)) {
			return fail(400, { message: 'Invalid application password' });
		}

		// Create signed session token
		const token = createSessionToken({ user: 'operator' });
		cookies.set(SESSION_COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		const redirectTo = url.searchParams.get('redirect') || '/';
		throw redirect(303, redirectTo);
	},

	logout: async ({ cookies }) => {
		cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
		throw redirect(303, '/login');
	}
};
