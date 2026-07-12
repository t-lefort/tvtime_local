import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movies, shows, userMovies, userShows } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/users';
import { getPersonFilmography, type PersonCredit } from '$lib/server/tmdb';
import type { PageServerLoad } from './$types';

export interface PersonCreditWithLocal extends PersonCredit {
	localId: number | null;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const personId = Number(params.id);
	if (!Number.isInteger(personId) || personId <= 0) error(404, 'Personne introuvable');

	const { person, movies: movieCredits, shows: showCredits } = await getPersonFilmography(personId);

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

	const withLocal = (credits: PersonCredit[], ids: Map<number, number>): PersonCreditWithLocal[] =>
		credits.map((c) => ({ ...c, localId: ids.get(c.tmdbId) ?? null }));

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
		movies: withLocal(movieCredits, movieIds),
		shows: withLocal(showCredits, showIds)
	};
};
