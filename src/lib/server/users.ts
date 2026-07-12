import { redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from './db';
import { users, type User } from './db/schema';

/** Cookie qui mémorise le profil actif (l'accès à l'instance est déjà protégé par AUTH_PASSWORD). */
export const USER_COOKIE = 'user';

export function listUsers(): User[] {
	return db.select().from(users).orderBy(asc(users.name)).all();
}

export function getUserById(id: number): User | undefined {
	return db.select().from(users).where(eq(users.id, id)).get();
}

export function getUserByName(name: string): User | undefined {
	return db.select().from(users).where(eq(users.name, name)).get();
}

export function createUser(name: string): User {
	return db.insert(users).values({ name }).returning().get();
}

/** Supprime le profil et toutes ses données (suivis, collection, historique) via les cascades. */
export function deleteUser(id: number): void {
	db.delete(users).where(eq(users.id, id)).run();
}

/** Profil actif d'une requête ; hooks.server.ts le garantit hors /login et /profils. */
export function requireUser(locals: App.Locals): { id: number; name: string } {
	if (!locals.user) redirect(303, '/profils');
	return locals.user;
}

export function userFromCookie(cookie: string | undefined): User | undefined {
	const id = Number(cookie);
	if (!Number.isInteger(id) || id <= 0) return undefined;
	return getUserById(id);
}
