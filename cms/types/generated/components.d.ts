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

export interface ButtonLinks extends Struct.ComponentSchema {
	collectionName: 'components_button_links';
	info: {
		displayName: 'Links';
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

export interface ComponentBanner extends Struct.ComponentSchema {
	collectionName: 'components_component_banners';
	info: {
		displayName: 'banner';
	};
	attributes: {
		button: Schema.Attribute.Component<'button.button', false>;
		description: Schema.Attribute.Text;
		Image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
		title: Schema.Attribute.String;
	};
}

export interface ComponentCards extends Struct.ComponentSchema {
	collectionName: 'components_component_cards';
	info: {
		displayName: 'cards';
	};
	attributes: {
		description: Schema.Attribute.Text;
		Links: Schema.Attribute.Component<'button.links', false>;
		media: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
		title: Schema.Attribute.String;
	};
}

export interface ComponentClientLogos extends Struct.ComponentSchema {
	collectionName: 'components_component_client_logos';
	info: {
		displayName: 'clientLogos';
	};
	attributes: {
		image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
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
		image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
		title: Schema.Attribute.String;
	};
}

export interface ComponentMetaSocial extends Struct.ComponentSchema {
	collectionName: 'components_component_meta_socials';
	info: {
		displayName: 'metaSocial';
	};
	attributes: {
		description: Schema.Attribute.Text;
		image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios', true>;
		socialNetwork: Schema.Attribute.Enumeration<['ex']>;
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
		PollSubtitle: Schema.Attribute.String;
		PollTitle: Schema.Attribute.String;
		position: Schema.Attribute.Integer;
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

export interface CtaCta extends Struct.ComponentSchema {
	collectionName: 'components_cta_ctas';
	info: {
		displayName: 'cta';
	};
	attributes: {
		button: Schema.Attribute.Component<'button.button', false>;
		description: Schema.Attribute.String;
		image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
		title: Schema.Attribute.String;
	};
}

export interface HeroHeroSection extends Struct.ComponentSchema {
	collectionName: 'components_hero_hero_sections';
	info: {
		displayName: 'HeroSection';
	};
	attributes: {
		coverImage: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
		subtitle: Schema.Attribute.String;
		title: Schema.Attribute.String;
	};
}

export interface HeroShareData extends Struct.ComponentSchema {
	collectionName: 'components_hero_share_data';
	info: {
		displayName: 'shareData';
	};
	attributes: {
		shareContent: Schema.Attribute.Blocks;
		title: Schema.Attribute.String;
	};
}

declare module '@strapi/strapi' {
	export namespace Public {
		export interface ComponentSchemas {
			'button.button': ButtonButton;
			'button.links': ButtonLinks;
			'component.author-data': ComponentAuthorData;
			'component.banner': ComponentBanner;
			'component.cards': ComponentCards;
			'component.client-logos': ComponentClientLogos;
			'component.content-new': ComponentContentNew;
			'component.meta-social': ComponentMetaSocial;
			'component.options': ComponentOptions;
			'component.poll-data': ComponentPollData;
			'component.seo': ComponentSeo;
			'cta.cta': CtaCta;
			'hero.hero-section': HeroHeroSection;
			'hero.share-data': HeroShareData;
		}
	}
}
