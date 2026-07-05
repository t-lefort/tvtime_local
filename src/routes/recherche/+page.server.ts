import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { shows } from '$lib/server/db/schema';
import { searchTv } from '$lib/server/tmdb';
import { addOrUpdateShow } from '$lib/server/shows';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (!q) return { q, results: [], error: null };

	let found;
	try {
		found = await searchTv(q);
	} catch (e) {
		return { q, results: [], error: e instanceof Error ? e.message : String(e) };
	}
	const inDb = new Map(
		db.select({ tmdbId: shows.tmdbId, id: shows.id }).from(shows).all().map((r) => [r.tmdbId, r.id])
	);
	const results = found.map((r) => ({
		tmdbId: r.id,
		name: r.name,
		originalName: r.original_name,
		overview: r.overview,
		posterPath: r.poster_path,
		firstAirDate: r.first_air_date,
		localId: inDb.get(r.id) ?? null
	}));
	return { q, results, error: null };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const tmdbId = Number((await request.formData()).get('tmdbId'));
		if (!tmdbId) return;
		const show = await addOrUpdateShow(tmdbId);
		redirect(303, `/series/${show.id}`);
	}
};
