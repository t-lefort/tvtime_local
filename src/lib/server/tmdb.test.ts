import assert from 'node:assert/strict';
import { mergeMovieSearchResults, type TmdbMovieSummary } from './tmdb';

const movie = (id: number, title: string): TmdbMovieSummary => ({
	id,
	title,
	original_title: title,
	overview: '',
	poster_path: null,
	backdrop_path: null,
	release_date: null,
	vote_average: 0
});

const titleMatch = movie(1, 'Title result');
const duplicateCredit = movie(1, 'Duplicate credit');
const actorCredit = movie(2, 'Actor credit');
const directorCredit = movie(3, 'Director credit');

assert.deepEqual(mergeMovieSearchResults([titleMatch], [duplicateCredit, actorCredit, directorCredit]), [
	titleMatch,
	actorCredit,
	directorCredit
]);

assert.equal(
	mergeMovieSearchResults(
		Array.from({ length: 45 }, (_, index) => movie(index + 1, `Movie ${index + 1}`)),
		[]
	).length,
	40
);

