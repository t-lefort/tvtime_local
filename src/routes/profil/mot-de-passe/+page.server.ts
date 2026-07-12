import { fail } from '@sveltejs/kit';
import {
	getUserById,
	profileCookieValue,
	requireUser,
	setUserPassword,
	USER_COOKIE,
	USER_COOKIE_OPTS
} from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	return {
		profileName: user.name,
		hasPassword: Boolean(getUserById(user.id)?.passwordHash)
	};
};

export const actions: Actions = {
	/** Définit ou change le mot de passe du profil actif (et re-signe son cookie). */
	set: async ({ request, cookies, locals }) => {
		const user = requireUser(locals);
		const password = String((await request.formData()).get('password') ?? '');
		if (password.length < 4) {
			return fail(400, { error: 'Mot de passe : 4 caractères minimum.' });
		}
		setUserPassword(user.id, password);
		cookies.set(USER_COOKIE, profileCookieValue(getUserById(user.id)!), USER_COOKIE_OPTS);
		return { ok: 'Mot de passe défini.' };
	},

	clear: async ({ cookies, locals }) => {
		const user = requireUser(locals);
		setUserPassword(user.id, null);
		cookies.set(USER_COOKIE, profileCookieValue(getUserById(user.id)!), USER_COOKIE_OPTS);
		return { ok: 'Mot de passe retiré.' };
	}
};
