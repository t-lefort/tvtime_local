import { fail, redirect } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { verifyPassword } from '$lib/server/auth';
import { db } from '$lib/server/db';
import {
	createUser,
	deleteUser,
	getUserById,
	getUserByName,
	listUsers,
	profileCookieValue,
	USER_COOKIE,
	USER_COOKIE_OPTS
} from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

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
			hasPassword: Boolean(u.passwordHash),
			hasAvatar: Boolean(u.avatar),
			shows: counts.get(u.id)?.shows ?? 0,
			movies: counts.get(u.id)?.movies ?? 0
		}))
	};
};

export const actions: Actions = {
	select: async ({ request, cookies }) => {
		const data = await request.formData();
		const id = Number(data.get('userId'));
		const user = getUserById(id);
		if (!user) return fail(400, { error: 'Profil introuvable.', userId: id });
		// Profil protégé : la connexion se fait sur sa page dédiée
		if (user.passwordHash) redirect(303, `/profils/${user.id}/connexion`);
		cookies.set(USER_COOKIE, profileCookieValue(user), USER_COOKIE_OPTS);
		redirect(303, '/');
	},

	create: async ({ request, cookies }) => {
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const password = String(data.get('password') ?? '');
		if (!name) return fail(400, { error: 'Donnez un nom au profil.' });
		if (name.length > 30) return fail(400, { error: 'Nom trop long (30 caractères max).' });
		if (getUserByName(name)) return fail(400, { error: 'Ce nom de profil existe déjà.' });
		const user = createUser(name, password || undefined);
		cookies.set(USER_COOKIE, profileCookieValue(user), USER_COOKIE_OPTS);
		redirect(303, '/');
	},

	delete: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const id = Number(data.get('userId'));
		const user = getUserById(id);
		if (!user) return fail(400, { error: 'Profil introuvable.', userId: id });
		if (user.passwordHash) {
			const password = String(data.get('password') ?? '');
			if (!password || !verifyPassword(password, user.passwordHash)) {
				return fail(403, { error: 'Mot de passe incorrect.', userId: id });
			}
		}
		deleteUser(id);
		if (locals.user?.id === id) cookies.delete(USER_COOKIE, { path: '/' });
	}
};
