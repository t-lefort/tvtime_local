import assert from 'node:assert/strict';
import {
	buildLocalizedMediaVariants,
	mergeMovieSearchResults,
	mergeTvSearchResults,
	type TmdbMovieSummary,
	type TmdbShowSummary
} from './tmdb';

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

const localized = buildLocalizedMediaVariants(
	[
		{
			iso_3166_1: 'FR',
			iso_639_1: 'fr',
			name: 'Français',
			english_name: 'French',
			data: { title: 'Titre français' }
		},
		{
			iso_3166_1: 'US',
			iso_639_1: 'en',
			name: 'English',
			english_name: 'English',
			data: { title: 'English title' }
		},
		{
			iso_3166_1: 'GB',
			iso_639_1: 'en',
			name: 'English',
			english_name: 'English',
			data: { title: 'British title' }
		},
		{
			iso_3166_1: 'ES',
			iso_639_1: 'es',
			name: 'Español',
			english_name: 'Spanish',
			data: { title: 'Título español' }
		}
	],
	[
		{ file_path: '/en-low.jpg', iso_639_1: 'en', vote_average: 4, vote_count: 10 },
		{ file_path: '/en-best.jpg', iso_639_1: 'en', vote_average: 8, vote_count: 2 },
		{ file_path: '/de.jpg', iso_639_1: 'de', vote_average: 7, vote_count: 1 },
		{ file_path: '/neutral.jpg', iso_639_1: null, vote_average: 10, vote_count: 20 }
	],
	'fr',
	{ languageCode: 'en', title: 'Original title' }
);

assert.deepEqual(
	localized.map(({ languageCode, titles, posterPath }) => ({ languageCode, titles, posterPath })),
	[
		{ languageCode: 'de', titles: [], posterPath: '/de.jpg' },
		{
			languageCode: 'en',
			titles: ['Original title', 'English title', 'British title'],
			posterPath: '/en-best.jpg'
		},
		{ languageCode: 'es', titles: ['Título español'], posterPath: null }
	]
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
