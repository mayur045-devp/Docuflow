export interface StrapiAttribute {
	name: string;
	type: string;
	required: boolean;
	unique?: boolean;
	default?: any;
	manualOnly?: boolean;
	repeatable?: boolean;
	componentUid?: string;
	schema?: StrapiContentType | null;
	components?: string[];
	schemas?: Record<string, StrapiContentType>;
	multiple?: boolean;
	allowedTypes?: string[];
	relation?: string;
	target?: string;
	displayField?: string;
	enum?: string[];
}

export interface StrapiContentType {
	uid: string;
	collectionName: string;
	kind: 'collectionType' | 'singleType';
	displayName: string;
	singularName: string;
	pluralName: string;
	description?: string;
	draftAndPublish: boolean;
	attributes: Record<string, StrapiAttribute>;
}

export interface StrapiConnectionStatus {
	reachable: boolean;
	url: string;
	status: 'connected' | 'error';
	version: string;
	contentTypesCount: number;
	componentsCount: number;
	tokenConfigured: boolean;
	error?: string;
}

