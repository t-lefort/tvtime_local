import { fail, redirect } from '@sveltejs/kit';
import { verifyPassword } from '$lib/server/auth';
import { getUserById, profileCookieValue, USER_COOKIE, USER_COOKIE_OPTS } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

/** Connexion à un profil protégé ; les profils sans mot de passe s'ouvrent depuis /profils. */
export const load: PageServerLoad = ({ params }) => {
	const id = Number(params.id);
	const user = Number.isInteger(id) && id > 0 ? getUserById(id) : undefined;
	if (!user || !user.passwordHash) redirect(303, '/profils');
	return {
		profile: { id: user.id, name: user.name, hasAvatar: Boolean(user.avatar) }
	};
};

export const actions: Actions = {
	default: async ({ params, request, cookies }) => {
		const user = getUserById(Number(params.id));
		if (!user) redirect(303, '/profils');
		if (user.passwordHash) {
			const password = String((await request.formData()).get('password') ?? '');
			if (!password || !verifyPassword(password, user.passwordHash)) {
				return fail(403, { error: 'Mot de passe incorrect.' });
			}
		}
		cookies.set(USER_COOKIE, profileCookieValue(user), USER_COOKIE_OPTS);
		redirect(303, '/');
	}
};
