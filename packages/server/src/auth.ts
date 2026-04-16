import { jwtVerify, SignJWT } from 'jose';

import { env } from '@/env';

function getSecret() {
	return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signToken(payload: { sub: string }): Promise<string> {
	return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(getSecret());
}

export async function verifyToken(token: string) {
	const { payload } = await jwtVerify(token, getSecret(), {
		algorithms: ['HS256'],
	});
	return payload;
}
