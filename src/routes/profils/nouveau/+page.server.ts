import { fail, redirect } from '@sveltejs/kit';
import { createUser, getUserByName, profileCookieValue, USER_COOKIE, USER_COOKIE_OPTS } from '$lib/server/users';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const password = String(data.get('password') ?? '');
		if (!name) return fail(400, { error: 'Donnez un nom au profil.' });
		if (name.length > 30) return fail(400, { error: 'Nom trop long (30 caractères max).' });
		if (getUserByName(name)) return fail(400, { error: 'Ce nom de profil existe déjà.' });
		const user = createUser(name, password || undefined);
		cookies.set(USER_COOKIE, profileCookieValue(user), USER_COOKIE_OPTS);
		redirect(303, '/');
	}
};
