import { getJobImage } from '$lib/server/jobs/store.js';

export async function GET({ params }) {
	const { id, imageId } = params;
	const img = getJobImage(id, imageId);

	if (!img) {
		return new Response('Image not found', { status: 404 });
	}

	return new Response(new Uint8Array(img.buffer), {
		status: 200,
		headers: {
			'Content-Type': img.mime,
			'Cache-Control': 'private, max-age=86400',
			'X-Content-Type-Options': 'nosniff'
		}
	});
}
