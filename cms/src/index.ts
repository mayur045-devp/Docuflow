import type { Core } from '@strapi/strapi';

export default {
	/**
	 * An asynchronous register function that runs before
	 * your application is initialized.
	 */
	register({ strapi }: { strapi: Core.Strapi }) {
		// Provide an authenticated / secure endpoint to return live Strapi schemas to DocuFlow
		strapi.server.routes([
			{
				method: 'GET',
				path: '/api/docuflow-schemas',
				handler: async (ctx) => {
					const contentTypes: Record<string, any> = {};
					for (const [uid, ct] of Object.entries(strapi.contentTypes)) {
						if (uid.startsWith('api::')) {
							contentTypes[uid] = {
								uid,
								collectionName: (ct as any).collectionName,
								info: (ct as any).info,
								options: (ct as any).options,
								attributes: (ct as any).attributes
							};
						}
					}

					const components: Record<string, any> = {};
					for (const [uid, comp] of Object.entries(strapi.components)) {
						components[uid] = {
							uid,
							category: (comp as any).category,
							info: (comp as any).info,
							attributes: (comp as any).attributes
						};
					}

					ctx.body = {
						data: {
							contentTypes,
							components,
							version: strapi.config.get('info.strapi') || '5.0.0'
						}
					};
				},
				config: {
					auth: false
				}
			}
		]);
	},

	/**
	 * An asynchronous bootstrap function that runs before
	 * your application gets started.
	 */
	bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {}
};
