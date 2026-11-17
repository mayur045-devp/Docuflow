import fs from 'node:fs';

// The adapter reads BODY_SIZE_LIMIT during import, before application hooks run.
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 100);
if (!Number.isFinite(maxUploadMb) || maxUploadMb <= 0) {
	throw new Error('MAX_UPLOAD_MB must be a positive number.');
}

// Allow multipart headers and fields in addition to the document itself.
process.env.BODY_SIZE_LIMIT ??= String(Math.ceil((maxUploadMb + 1) * 1024 * 1024));

await import('../build/index.js');
