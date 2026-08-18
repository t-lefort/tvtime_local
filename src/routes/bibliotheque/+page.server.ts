import { getBooksForUser } from '$lib/server/books';
import { getMoviesWithWatch, getShowsWithProgress } from '$lib/server/queries';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	return {
		shows: getShowsWithProgress(user.id).length,
		movies: getMoviesWithWatch(user.id).length,
		books: getBooksForUser(user.id).length
	};
};
