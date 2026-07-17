import { createHmac } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { hashPassword } from './auth';
import { db } from './db';
import { users, type User } from './db/schema';

/** Cookie qui mémorise le profil actif (signé si le profil a un mot de passe). */
export const USER_COOKIE = 'user';

export const USER_COOKIE_OPTS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	maxAge: 60 * 60 * 24 * 365
} as const;

export function listUsers(): User[] {
	return db.select().from(users).orderBy(asc(users.name)).all();
}

export function getUserById(id: number): User | undefined {
	return db.select().from(users).where(eq(users.id, id)).get();
}

export function getUserByName(name: string): User | undefined {
	return db.select().from(users).where(eq(users.name, name)).get();
}

export function createUser(name: string, password?: string): User {
	return db
		.insert(users)
		.values({ name, passwordHash: password ? hashPassword(password) : null })
		.returning()
		.get();
}

export function renameUser(id: number, name: string): void {
	db.update(users).set({ name }).where(eq(users.id, id)).run();
}

/** Définit (ou retire avec null) le mot de passe du profil. */
export function setUserPassword(id: number, password: string | null): void {
	db.update(users)
		.set({ passwordHash: password ? hashPassword(password) : null })
		.where(eq(users.id, id))
		.run();
}

/** Définit (ou retire avec null) l'image du profil. */
export function setUserAvatar(id: number, avatar: Buffer | null, avatarType: string | null): void {
	db.update(users).set({ avatar, avatarType }).where(eq(users.id, id)).run();
}

/** Active ou désactive le masquage anti-spoiler des descriptions d'épisodes. */
export function setUserHideEpisodeOverviews(id: number, hide: boolean): void {
	db.update(users).set({ hideEpisodeOverviews: hide }).where(eq(users.id, id)).run();
}

/** Supprime le profil et toutes ses données (suivis, collection, historique) via les cascades. */
export function deleteUser(id: number): void {
	db.delete(users).where(eq(users.id, id)).run();
}

/** Profil actif d'une requête ; hooks.server.ts le garantit hors /profils. */
export function requireUser(locals: App.Locals): { id: number; name: string } {
	if (!locals.user) redirect(303, '/profils');
	return locals.user;
}

/**
 * Signature du cookie d'un profil protégé, dérivée du hash de son mot de passe :
 * impossible à forger sans connaître le mot de passe, et invalidée s'il change.
 */
function cookieSignature(user: User): string {
	return createHmac('sha256', user.passwordHash ?? '')
		.update(`tvtimelocal-profile-${user.id}`)
		.digest('hex');
}

/** Valeur du cookie pour un profil : « id » si libre, « id.signature » si protégé. */
export function profileCookieValue(user: User): string {
	return user.passwordHash ? `${user.id}.${cookieSignature(user)}` : String(user.id);
}

export function userFromCookie(cookie: string | undefined): User | undefined {
	if (!cookie) return undefined;
	const [idPart, signature] = cookie.split('.');
	const id = Number(idPart);
	if (!Number.isInteger(id) || id <= 0) return undefined;
	const user = getUserById(id);
	if (!user) return undefined;
	if (user.passwordHash && signature !== cookieSignature(user)) return undefined;
	return user;
}
