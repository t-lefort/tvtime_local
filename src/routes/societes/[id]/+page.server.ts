import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movies, userMovies } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/users';
import { getCompanyDetails, getCompanyMovies, TmdbError } from '$lib/server/tmdb';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const companyId = Number(params.id);
	if (!Number.isInteger(companyId) || companyId <= 0) error(404, 'Société introuvable');

	let company, companyMovies;
	try {
		[company, companyMovies] = await Promise.all([
			getCompanyDetails(companyId),
			getCompanyMovies(companyId)
		]);
	} catch (e) {
		if (e instanceof TmdbError && e.status === 404) error(404, 'Société introuvable');
		throw e;
	}

	const movieIds = new Map(
		db
			.select({ tmdbId: movies.tmdbId, id: movies.id })
			.from(movies)
			.innerJoin(userMovies, eq(userMovies.movieId, movies.id))
			.where(eq(userMovies.userId, user.id))
			.all()
			.map((r) => [r.tmdbId, r.id])
	);

	return {
		company: {
			name: company.name,
			logoPath: company.logo_path,
			description: company.description || null,
			headquarters: company.headquarters || null,
			originCountry: company.origin_country || null
		},
		movies: companyMovies.map((m) => ({
			tmdbId: m.id,
			title: m.title || m.original_title,
			posterPath: m.poster_path,
			date: m.release_date || null,
			localId: movieIds.get(m.id) ?? null
		}))
	};
};
