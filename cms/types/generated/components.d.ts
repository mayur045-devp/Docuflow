import type { Schema, Struct } from '@strapi/strapi';

export interface ButtonButton extends Struct.ComponentSchema {
	collectionName: 'components_button_buttons';
	info: {
		displayName: 'button';
	};
	attributes: {
		link: Schema.Attribute.String;
		name: Schema.Attribute.String;
	};
}

export interface ComponentAuthorData extends Struct.ComponentSchema {
	collectionName: 'components_component_author_data';
	info: {
		displayName: 'AuthorData';
	};
	attributes: {
		Authordesignation: Schema.Attribute.String;
		AuthorImage: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
		AuthorName: Schema.Attribute.String;
		title: Schema.Attribute.String;
	};
}

export interface ComponentContentNew extends Struct.ComponentSchema {
	collectionName: 'components_component_content_news';
	info: {
		displayName: 'contentNew';
	};
	attributes: {
		content: Schema.Attribute.Text;
		title: Schema.Attribute.String;
	};
}

export interface ComponentOptions extends Struct.ComponentSchema {
	collectionName: 'components_component_options';
	info: {
		displayName: 'options';
	};
	attributes: {
		isCorrect: Schema.Attribute.Boolean;
		label: Schema.Attribute.String;
		votes: Schema.Attribute.Integer;
	};
}

export interface ComponentPollData extends Struct.ComponentSchema {
	collectionName: 'components_component_poll_data';
	info: {
		displayName: 'PollData';
	};
	attributes: {
		isActive: Schema.Attribute.Boolean;
		Options: Schema.Attribute.Component<'component.options', false>;
		position: Schema.Attribute.Integer;
		subtitle: Schema.Attribute.String;
		title: Schema.Attribute.String;
	};
}

export interface ComponentSeo extends Struct.ComponentSchema {
	collectionName: 'components_component_seos';
	info: {
		displayName: 'seo';
	};
	attributes: {
		canonicalURL: Schema.Attribute.String;
		keywords: Schema.Attribute.String;
		metaDescription: Schema.Attribute.String;
		metaRobots: Schema.Attribute.String;
		metaTitle: Schema.Attribute.String;
		metaViewPort: Schema.Attribute.String;
		shareImage: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
		structureData: Schema.Attribute.JSON;
	};
}

declare module '@strapi/strapi' {
	export namespace Public {
		export interface ComponentSchemas {
			'button.button': ButtonButton;
			'component.author-data': ComponentAuthorData;
			'component.content-new': ComponentContentNew;
			'component.options': ComponentOptions;
			'component.poll-data': ComponentPollData;
			'component.seo': ComponentSeo;
		}
	}
}
