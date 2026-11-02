"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * An asynchronous register function that runs before
     * your application is initialized.
     */
    register({ strapi }) {
        // Provide an authenticated / secure endpoint to return live Strapi schemas to DocuFlow
        strapi.server.routes([
            {
                method: 'GET',
                path: '/api/docuflow-schemas',
                handler: async (ctx) => {
                    const contentTypes = {};
                    for (const [uid, ct] of Object.entries(strapi.contentTypes)) {
                        if (uid.startsWith('api::')) {
                            contentTypes[uid] = {
                                uid,
                                collectionName: ct.collectionName,
                                info: ct.info,
                                options: ct.options,
                                attributes: ct.attributes
                            };
                        }
                    }
                    const components = {};
                    for (const [uid, comp] of Object.entries(strapi.components)) {
                        components[uid] = {
                            uid,
                            category: comp.category,
                            info: comp.info,
                            attributes: comp.attributes
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
    bootstrap( /* { strapi }: { strapi: Core.Strapi } */) { }
};
