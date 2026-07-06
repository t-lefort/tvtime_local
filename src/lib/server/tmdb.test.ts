import assert from 'node:assert/strict';
import { mergeMovieSearchResults, mergeTvSearchResults, type TmdbMovieSummary, type TmdbShowSummary } from './tmdb';

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


const show = (id: number, name: string): TmdbShowSummary => ({
	id,
	name,
	original_name: name,
	overview: '',
	poster_path: null,
	backdrop_path: null,
	first_air_date: null,
	vote_average: 0
});

const showTitleMatch = show(1, 'Show title result');
const duplicateShowCredit = show(1, 'Duplicate show credit');
const actorShowCredit = show(2, 'Actor show credit');
const creatorShowCredit = show(3, 'Creator show credit');

assert.deepEqual(mergeTvSearchResults([showTitleMatch], [duplicateShowCredit, actorShowCredit, creatorShowCredit]), [
	showTitleMatch,
	actorShowCredit,
	creatorShowCredit
]);

assert.equal(
	mergeTvSearchResults(
		Array.from({ length: 45 }, (_, index) => show(index + 1, `Show ${index + 1}`)),
		[]
	).length,
	40
);
