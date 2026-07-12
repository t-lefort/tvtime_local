import { fail, redirect } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createUser, deleteUser, getUserById, getUserByName, listUsers, USER_COOKIE } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

const COOKIE_OPTS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	maxAge: 60 * 60 * 24 * 365
} as const;

export const load: PageServerLoad = ({ locals }) => {
	const counts = new Map(
		db
			.all<{ userId: number; shows: number; movies: number }>(sql`
				SELECT u.id AS userId,
					(SELECT COUNT(*) FROM user_shows us WHERE us.user_id = u.id) AS shows,
					(SELECT COUNT(*) FROM user_movies um WHERE um.user_id = u.id) AS movies
				FROM users u
			`)
			.map((r) => [r.userId, r])
	);
	return {
		currentUserId: locals.user?.id ?? null,
		users: listUsers().map((u) => ({
			id: u.id,
			name: u.name,
			shows: counts.get(u.id)?.shows ?? 0,
			movies: counts.get(u.id)?.movies ?? 0
		}))
	};
};

export const actions: Actions = {
	select: async ({ request, cookies }) => {
		const id = Number((await request.formData()).get('userId'));
		if (!getUserById(id)) return fail(400, { error: 'Profil introuvable.' });
		cookies.set(USER_COOKIE, String(id), COOKIE_OPTS);
		redirect(303, '/');
	},

	create: async ({ request, cookies }) => {
		const name = String((await request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Donnez un nom au profil.' });
		if (name.length > 30) return fail(400, { error: 'Nom trop long (30 caractères max).' });
		if (getUserByName(name)) return fail(400, { error: 'Ce nom de profil existe déjà.' });
		const user = createUser(name);
		cookies.set(USER_COOKIE, String(user.id), COOKIE_OPTS);
		redirect(303, '/');
	},

	delete: async ({ request, cookies, locals }) => {
		const id = Number((await request.formData()).get('userId'));
		if (!getUserById(id)) return fail(400, { error: 'Profil introuvable.' });
		deleteUser(id);
		if (locals.user?.id === id) cookies.delete(USER_COOKIE, { path: '/' });
	}
};
