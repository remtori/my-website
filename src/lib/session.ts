import { parse } from 'cookie';

export const SESSION_COOKIE = 'admin_session';

const MAX_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let out = 0;
	for (let i = 0; i < a.length; i++) {
		out |= a[i] ^ b[i];
	}
	return out === 0;
}

function bytesToBase64url(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(b64url: string): Uint8Array {
	const padded = b64url
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(Math.ceil(b64url.length / 4) * 4, '=');
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

async function hmacSha256Base64url(secret: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
	return bytesToBase64url(new Uint8Array(sig));
}

export function timingSafeStringEqual(a: string, b: string): boolean {
	const enc = new TextEncoder();
	return timingSafeEqualBytes(enc.encode(a), enc.encode(b));
}

export async function createSessionValue(secret: string): Promise<string> {
	const now = Date.now();
	const payload = JSON.stringify({ v: 1, iat: now, exp: now + MAX_SESSION_MS });
	const payloadB64 = bytesToBase64url(new TextEncoder().encode(payload));
	const sig = await hmacSha256Base64url(secret, payloadB64);
	return `${payloadB64}.${sig}`;
}

export async function verifySessionValue(token: string | undefined, secret: string): Promise<boolean> {
	if (!token?.includes('.')) {
		return false;
	}
	const lastDot = token.lastIndexOf('.');
	const payloadB64 = token.slice(0, lastDot);
	const sig = token.slice(lastDot + 1);
	const expectedSig = await hmacSha256Base64url(secret, payloadB64);
	try {
		if (!timingSafeEqualBytes(base64urlToBytes(sig), base64urlToBytes(expectedSig))) {
			return false;
		}
	} catch {
		return false;
	}
	try {
		const payloadJson = new TextDecoder().decode(base64urlToBytes(payloadB64));
		const payload = JSON.parse(payloadJson) as { exp?: number; v?: number };
		if (payload.v !== 1 || typeof payload.exp !== 'number') {
			return false;
		}
		if (payload.exp < Date.now()) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}

export function getSessionCookieFromRequest(request: Request): string | undefined {
	const raw = request.headers.get('cookie');
	if (!raw) {
		return undefined;
	}
	const cookies = parse(raw);
	return cookies[SESSION_COOKIE];
}

export function sessionCookieHeader(value: string, secure: boolean): string {
	const maxAge = Math.floor(MAX_SESSION_MS / 1000);
	const sec = secure ? '; Secure' : '';
	return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${sec}`;
}
