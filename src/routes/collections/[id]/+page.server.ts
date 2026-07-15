import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movies, userMovies } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/users';
import { getCollectionDetails, orderCollectionParts, TmdbError } from '$lib/server/tmdb';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const collectionId = Number(params.id);
	if (!Number.isInteger(collectionId) || collectionId <= 0) error(404, 'Saga introuvable');

	let collection;
	try {
		collection = await getCollectionDetails(collectionId);
	} catch (e) {
		if (e instanceof TmdbError && e.status === 404) error(404, 'Saga introuvable');
		throw e;
	}

	const collected = new Set(
		db
			.select({ tmdbId: movies.tmdbId })
			.from(movies)
			.innerJoin(userMovies, eq(userMovies.movieId, movies.id))
			.where(eq(userMovies.userId, user.id))
			.all()
			.map((r) => r.tmdbId)
	);

	return {
		collection: {
			name: collection.name,
			overview: collection.overview || null,
			posterPath: collection.poster_path,
			backdropPath: collection.backdrop_path
		},
		movies: orderCollectionParts(collection.parts).map((m, i) => ({
			tmdbId: m.id,
			title: m.title || m.original_title,
			posterPath: m.poster_path,
			date: m.release_date || null,
			position: i + 1,
			inLibrary: collected.has(m.id)
		}))
	};
};
