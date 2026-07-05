import { fail, redirect } from '@sveltejs/kit';
import { authEnabled, sessionToken } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!authEnabled()) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const password = (await request.formData()).get('password');
		if (typeof password !== 'string' || password !== process.env.AUTH_PASSWORD) {
			return fail(400, { incorrect: true });
		}
		cookies.set('session', sessionToken(), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		redirect(303, '/');
	}
};
