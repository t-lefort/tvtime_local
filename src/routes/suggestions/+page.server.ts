import { redirect } from '@sveltejs/kit';
import { addOrUpdateShow, followShow } from '$lib/server/shows';
import { addOrUpdateMovie, collectMovie } from '$lib/server/movies';
import { getSuggestions, type Suggestion } from '$lib/server/suggestions';
import { requireUser } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	// Page désactivée dans les paramètres du profil
	if (locals.user?.hideSuggestions) redirect(303, '/');
	try {
		const { series, films } = await getSuggestions(user.id);
		return { series, films, error: null };
	} catch (e) {
		return {
			series: [] as Suggestion[],
			films: [] as Suggestion[],
			error: e instanceof Error ? e.message : String(e)
		};
	}
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const user = requireUser(locals);
		const tmdbId = Number((await request.formData()).get('tmdbId'));
		if (!tmdbId) return;
		const show = await addOrUpdateShow(tmdbId);
		followShow(user.id, show.id);
		redirect(303, `/series/${show.tmdbId}`);
	},

	addMovie: async ({ request, locals }) => {
		const user = requireUser(locals);
		const tmdbId = Number((await request.formData()).get('tmdbId'));
		if (!tmdbId) return;
		const movie = await addOrUpdateMovie(tmdbId);
		collectMovie(user.id, movie.id);
		redirect(303, `/films/${movie.tmdbId}`);
	}
};
