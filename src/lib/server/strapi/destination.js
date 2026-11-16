import dns from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { Agent } from 'undici';
import { getEnv } from '../env.js';

export class StrapiDestinationError extends Error {
	constructor(message, code = 'UNSAFE_STRAPI_DESTINATION') {
		super(message);
		this.name = 'StrapiDestinationError';
		this.code = code;
	}
}

const blockedIPv4 = new BlockList();
for (const [address, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['168.63.129.16', 32],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.88.99.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4]
])
	blockedIPv4.addSubnet(String(address), Number(prefix), 'ipv4');

const globalIPv6 = new BlockList();
globalIPv6.addSubnet('2000::', 3, 'ipv6');
const blockedIPv6 = new BlockList();
blockedIPv6.addSubnet('2001::', 23, 'ipv6');
blockedIPv6.addSubnet('2001:db8::', 32, 'ipv6');
blockedIPv6.addSubnet('2002::', 16, 'ipv6');
blockedIPv6.addSubnet('3fff::', 20, 'ipv6');

const privateNetworks = new BlockList();
privateNetworks.addSubnet('10.0.0.0', 8, 'ipv4');
privateNetworks.addSubnet('172.16.0.0', 12, 'ipv4');
privateNetworks.addSubnet('192.168.0.0', 16, 'ipv4');
privateNetworks.addSubnet('fc00::', 7, 'ipv6');

const blockedPrivateTargets = new BlockList();
blockedPrivateTargets.addAddress('fd00:ec2::254', 'ipv6');

// Logged-in operators can connect to public and internal CMS instances.
// Loopback, link-local/metadata and other reserved targets stay blocked.
export function isAllowedStrapiAddress(_hostname, address) {
	if (isPublicAddress(address)) return true;
	const family = isIP(address);
	if (!family) return false;
	const kind = family === 4 ? 'ipv4' : 'ipv6';
	if (family === 6 && blockedPrivateTargets.check(address, 'ipv6')) return false;
	return privateNetworks.check(address, kind);
}

export function isPublicAddress(address) {
	if (isIP(address) === 4) return !blockedIPv4.check(address, 'ipv4');
	if (isIP(address) === 6) {
		return globalIPv6.check(address, 'ipv6') && !blockedIPv6.check(address, 'ipv6');
	}
	return false;
}

// Validate the addresses used by the actual socket lookup, avoiding a separate
// DNS preflight followed by an unchecked second lookup (DNS rebinding).
/** @type {import('node:net').LookupFunction} */
export const publicLookup = (hostname, options, callback) => {
	dns.lookup(
		hostname,
		{ all: true, family: options.family || 0, verbatim: true },
		(err, addresses) => {
			if (err) return callback(err, '');
			if (
				!addresses.length ||
				addresses.some(({ address }) => !isAllowedStrapiAddress(hostname, address))
			) {
				return callback(
					new StrapiDestinationError(
						'The CMS resolves to a blocked loopback, metadata, link-local, or reserved network address.'
					),
					''
				);
			}
			if (options.all) return callback(null, addresses);
			callback(null, addresses[0].address, addresses[0].family);
		}
	);
};

const dispatcher = new Agent({ connect: { lookup: publicLookup, timeout: 8000 } });

function canonicalBaseUrl(rawUrl) {
	let parsed;
	try {
		if (typeof rawUrl !== 'string' || rawUrl.includes('\\')) throw new Error();
		parsed = new URL(rawUrl);
	} catch {
		throw new StrapiDestinationError('Enter a valid HTTPS Strapi base URL.', 'INVALID_URL');
	}
	if (
		parsed.protocol !== 'https:' ||
		parsed.username ||
		parsed.password ||
		parsed.search ||
		parsed.hash
	) {
		throw new StrapiDestinationError(
			'Strapi URLs must use HTTPS and contain no credentials, query, or fragment.'
		);
	}
	const hostname = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
	if (
		hostname === 'localhost' ||
		hostname.endsWith('.localhost') ||
		(isIP(hostname) && !isAllowedStrapiAddress(hostname, hostname))
	)
		throw new StrapiDestinationError(
			'Loopback, metadata, link-local, and reserved Strapi addresses are not allowed.'
		);
	return `${parsed.origin}${parsed.pathname.replace(/\/+/g, '/').replace(/\/+$/, '')}`;
}

export function validateStrapiBaseUrl(rawUrl) {
	return canonicalBaseUrl(rawUrl);
}

/** @param {string} url @param {RequestInit} [options] @param {string} [baseUrl] */
export async function strapiNetworkFetch(url, options = {}, baseUrl = getEnv().STRAPI_URL) {
	const approvedBase = validateStrapiBaseUrl(baseUrl);
	const target = new URL(url);
	const base = new URL(approvedBase);
	if (
		target.username ||
		target.password ||
		target.origin !== base.origin ||
		(target.pathname !== base.pathname &&
			!target.pathname.startsWith(`${base.pathname.replace(/\/$/, '')}/`))
	)
		throw new StrapiDestinationError('Strapi requests must stay inside the approved base URL.');
	const timeout = AbortSignal.timeout(15000);
	const requestOptions = {
		...options,
		dispatcher,
		redirect: /** @type {RequestRedirect} */ ('error'),
		signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
	};
	try {
		return await fetch(target, requestOptions);
	} catch (err) {
		if (err?.cause instanceof StrapiDestinationError) throw err.cause;
		if (err?.cause?.message === 'unexpected redirect') {
			throw new StrapiDestinationError(
				'The CMS redirected this request. Configure its final HTTPS base URL.',
				'STRAPI_REDIRECT_BLOCKED'
			);
		}
		throw err;
	}
}
