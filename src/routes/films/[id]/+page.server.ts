import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movies, movieWatches } from '$lib/server/db/schema';
import { getMoviesWithWatch } from '$lib/server/queries';
import { addOrUpdateMovie } from '$lib/server/movies';
import type { StoredProviders } from '$lib/server/tmdb';
import type { Actions, PageServerLoad } from './$types';

function requireMovie(id: number) {
	const movie = db.select().from(movies).where(eq(movies.id, id)).get();
	if (!movie) error(404, 'Film introuvable');
	return movie;
}

export const load: PageServerLoad = ({ params }) => {
	const movie = getMoviesWithWatch(Number(params.id))[0];
	if (!movie) error(404, 'Film introuvable');

	return {
		movie: {
			...movie,
			genres: JSON.parse(movie.genres) as string[],
			providers: movie.watchProviders
				? (JSON.parse(movie.watchProviders) as StoredProviders)
				: null
		}
	};
};

export const actions: Actions = {
	/** Marque vu (aujourd'hui) ou efface tout l'historique si déjà vu. */
	toggle: async ({ params }) => {
		const movie = requireMovie(Number(params.id));
		const existing = db.select().from(movieWatches).where(eq(movieWatches.movieId, movie.id)).all();
		if (existing.length > 0) {
			db.delete(movieWatches).where(eq(movieWatches.movieId, movie.id)).run();
		} else {
			db.insert(movieWatches).values({ movieId: movie.id }).run();
		}
	},

	/** Ajoute un visionnage supplémentaire (revisionnage). */
	rewatch: async ({ params }) => {
		const movie = requireMovie(Number(params.id));
		db.insert(movieWatches).values({ movieId: movie.id }).run();
	},

	favorite: async ({ params }) => {
		const movie = requireMovie(Number(params.id));
		db.update(movies).set({ favorite: !movie.favorite }).where(eq(movies.id, movie.id)).run();
	},

	refresh: async ({ params }) => {
		const movie = requireMovie(Number(params.id));
		await addOrUpdateMovie(movie.tmdbId);
	},

	remove: async ({ params }) => {
		const movie = requireMovie(Number(params.id));
		db.delete(movies).where(eq(movies.id, movie.id)).run();
		redirect(303, '/films');
	}
};
