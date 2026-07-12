import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function authEnabled(): boolean {
	return Boolean(process.env.AUTH_PASSWORD);
}

/** Jeton de session dérivé du mot de passe : stateless, invalidé si le mot de passe change. */
export function sessionToken(): string {
	return createHmac('sha256', process.env.AUTH_PASSWORD ?? '')
		.update('tvtimelocal-session-v1')
		.digest('hex');
}

export function isValidSession(cookie: string | undefined): boolean {
	return Boolean(cookie) && cookie === sessionToken();
}

/** Hash scrypt salé « sel:hash » pour les mots de passe de profil. */
export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(':');
	if (!salt || !hash) return false;
	return timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 32));
}
