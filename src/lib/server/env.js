import fs from 'node:fs';
import { z } from 'zod';
import { redact } from './security/redact.js';

// Auto-load .env if not loaded (Node 20+ has process.loadEnvFile)
try {
	if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
		process.loadEnvFile();
	}
} catch {
	// ignore if already loaded or in test env
}

const envSchema = z
	.object({
		STRAPI_URL: z.string().url().default('http://localhost:1337'),
		STRAPI_API_TOKEN: z.string().default(''),
		STRAPI_VERSION: z.enum(['auto', '4', '5']).default('auto'),
		STRAPI_ADMIN_EMAIL: z.string().optional().default(''),
		STRAPI_ADMIN_PASSWORD: z.string().optional().default(''),
		STRAPI_PROJECT_PATH: z.string().optional().default(''),
		STRAPI_ADMIN_URL: z.string().optional().default(''),

		AI_PROVIDER: z.enum(['gemini', 'mock']).default('mock'),
		GEMINI_API_KEY: z.string().optional().default(''),
		GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
		AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),

		APP_PASSWORD: z.string().min(1, 'APP_PASSWORD is required for security'),
		SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long'),
		MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
		DATA_DIR: z.string().default('.data'),
		JOB_TTL_DAYS: z.coerce.number().positive().default(30)
	})
	.superRefine((data, ctx) => {
		if (data.AI_PROVIDER === 'gemini' && !data.GEMINI_API_KEY) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'GEMINI_API_KEY is required when AI_PROVIDER is "gemini"',
				path: ['GEMINI_API_KEY']
			});
		}
	});

let parsedEnv = null;

/**
 * Validates and retrieves application configuration.
 * Fails fast with clear actionable error messages if invalid.
 * @returns {z.infer<typeof envSchema>}
 */
export function getEnv() {
	if (parsedEnv) return parsedEnv;

	const result = envSchema.safeParse(process.env);
	if (!result.success) {
		const formattedErrors = result.error.issues
			.map((iss) => `  - ${iss.path.join('.')}: ${iss.message}`)
			.join('\n');
		const message = `[DocuFlow] Invalid environment configuration:\n${formattedErrors}\n\nPlease check your .env file or environment variables.`;
		console.error(redact(message));
		throw new Error(message);
	}

	parsedEnv = result.data;
	return parsedEnv;
}

export const env = new Proxy(
	{},
	{
		get(_target, prop) {
			return getEnv()[prop];
		}
	}
);
