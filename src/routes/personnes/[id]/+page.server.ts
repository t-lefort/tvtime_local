import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movieWatches, movies, shows, userMovies, userShows } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/users';
import {
	getPersonFilmography,
	TmdbError,
	type PersonCredit,
	type PersonFilmography
} from '$lib/server/tmdb';
import type { PageServerLoad } from './$types';

export interface PersonCreditWithLocal extends PersonCredit {
	localId: number | null;
	// Vrai uniquement pour les films effectivement vus (présents dans movie_watches),
	// pour distinguer « vu » de « à voir » comme dans la liste des films.
	watched: boolean;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const personId = Number(params.id);
	if (!Number.isInteger(personId) || personId <= 0) error(404, 'Personne introuvable');

	let filmography: PersonFilmography;
	try {
		filmography = await getPersonFilmography(personId);
	} catch (e) {
		if (e instanceof TmdbError && e.status === 404) error(404, 'Personne introuvable');
		throw e;
	}
	const { person, movies: movieCredits, shows: showCredits } = filmography;

	const movieIds = new Map(
		db
			.select({ tmdbId: movies.tmdbId, id: movies.id })
			.from(movies)
			.innerJoin(userMovies, eq(userMovies.movieId, movies.id))
			.where(eq(userMovies.userId, user.id))
			.all()
			.map((r) => [r.tmdbId, r.id])
	);
	const showIds = new Map(
		db
			.select({ tmdbId: shows.tmdbId, id: shows.id })
			.from(shows)
			.innerJoin(userShows, eq(userShows.showId, shows.id))
			.where(eq(userShows.userId, user.id))
			.all()
			.map((r) => [r.tmdbId, r.id])
	);
	// Films effectivement vus par le profil (présence dans movie_watches).
	const watchedMovieTmdbIds = new Set(
		db
			.select({ tmdbId: movies.tmdbId })
			.from(movies)
			.innerJoin(movieWatches, eq(movieWatches.movieId, movies.id))
			.where(eq(movieWatches.userId, user.id))
			.all()
			.map((r) => r.tmdbId)
	);

	const withLocal = (
		credits: PersonCredit[],
		ids: Map<number, number>,
		watched?: Set<number>
	): PersonCreditWithLocal[] =>
		credits.map((c) => ({
			...c,
			localId: ids.get(c.tmdbId) ?? null,
			watched: watched?.has(c.tmdbId) ?? false
		}));

	return {
		person: {
			name: person.name,
			biography: person.biography || null,
			profilePath: person.profile_path,
			knownFor: person.known_for_department,
			birthday: person.birthday || null,
			deathday: person.deathday || null,
			placeOfBirth: person.place_of_birth || null
		},
		movies: withLocal(movieCredits, movieIds, watchedMovieTmdbIds),
		shows: withLocal(showCredits, showIds)
	};
};
