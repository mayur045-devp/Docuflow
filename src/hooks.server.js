import { redirect, json } from '@sveltejs/kit';
import { verifySessionToken, SESSION_COOKIE_NAME } from '$lib/server/security/auth.js';

/** @param {{ event: any, resolve: (event: any) => Promise<Response> }} param0 */
export async function handle({ event, resolve }) {
	const { url, cookies } = event;
	const pathname = url.pathname;

	// Public routes
	const isHealthApi = pathname === '/api/health';
	const isLoginRoute = pathname === '/login';

	const token = cookies.get(SESSION_COOKIE_NAME);
	const session = verifySessionToken(token);
	event.locals.session = session;

	if (!session && !isLoginRoute && !isHealthApi) {
		if (pathname.startsWith('/api/')) {
			return json(
				{
					error: {
						code: 'UNAUTHORIZED',
						message: 'Authentication required'
					}
				},
				{ status: 401 }
			);
		}
		const redirectTo = encodeURIComponent(pathname + url.search);
		throw redirect(303, `/login?redirect=${redirectTo}`);
	}

	if (session && isLoginRoute) {
		throw redirect(303, '/');
	}

	const response = await resolve(event);

	// Security headers
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Content-Security-Policy',
		"default-src 'self'; img-src 'self' data: blob: docimg:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self';"
	);

	return response;
}
