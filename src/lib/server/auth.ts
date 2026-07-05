import { createHmac } from 'node:crypto';

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
