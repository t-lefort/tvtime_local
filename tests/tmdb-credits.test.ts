import assert from 'node:assert/strict';
import test from 'node:test';
import {
	collectionPosition,
	extractCollection,
	extractCompanies,
	extractCrew,
	isNonFictionGenre,
	orderCollectionParts,
	type TmdbCrewMember,
	type TmdbMovieSummary
} from '../src/lib/server/tmdb';

const crew = (id: number, name: string, job: string): TmdbCrewMember => ({
	id,
	name,
	job,
	department: job === 'Director' ? 'Directing' : 'Production'
});

test('extractCrew keeps directors then producers, deduplicated', () => {
	const result = extractCrew({
		crew: [
			crew(1, 'Producer A', 'Producer'),
			crew(2, 'Director B', 'Director'),
			crew(1, 'Producer A', 'Producer'),
			crew(3, 'Composer C', 'Original Music Composer'),
			crew(2, 'Director B', 'Producer')
		]
	});
	assert.deepEqual(result, [
		{ id: 2, name: 'Director B', job: 'Director' },
		{ id: 1, name: 'Producer A', job: 'Producer' },
		{ id: 2, name: 'Director B', job: 'Producer' }
	]);
});

test('extractCrew caps each job and handles missing credits', () => {
	const many = Array.from({ length: 10 }, (_, i) => crew(i + 1, `Producer ${i + 1}`, 'Producer'));
	assert.equal(extractCrew({ crew: many }).length, 6);
	assert.deepEqual(extractCrew(undefined), []);
	assert.deepEqual(extractCrew({ crew: [] }), []);
});

test('isNonFictionGenre recognizes documentaries and unscripted TV genres', () => {
	assert.equal(isNonFictionGenre([18, 99]), true);
	assert.equal(isNonFictionGenre([10763]), true);
	assert.equal(isNonFictionGenre([10764]), true);
	assert.equal(isNonFictionGenre([10767]), true);
	assert.equal(isNonFictionGenre([18, 35]), false);
	assert.equal(isNonFictionGenre(undefined), false);
});

test('extractCompanies keeps the first companies with their logo', () => {
	const companies = Array.from({ length: 7 }, (_, i) => ({
		id: i + 1,
		name: `Studio ${i + 1}`,
		logo_path: i === 0 ? '/logo.png' : null
	}));
	const result = extractCompanies(companies);
	assert.equal(result.length, 5);
	assert.deepEqual(result[0], { id: 1, name: 'Studio 1', logoPath: '/logo.png' });
	assert.deepEqual(extractCompanies(undefined), []);
});

const part = (id: number, title: string, release_date: string | null): TmdbMovieSummary => ({
	id,
	title,
	original_title: title,
	overview: '',
	poster_path: null,
	backdrop_path: null,
	release_date,
	vote_average: 0
});

test('extractCollection keeps id and name, null hors saga', () => {
	assert.deepEqual(
		extractCollection({ id: 1575, name: 'Rocky', poster_path: '/p.jpg', backdrop_path: null }),
		{ id: 1575, name: 'Rocky' }
	);
	assert.equal(extractCollection(null), null);
	assert.equal(extractCollection(undefined), null);
});

test('orderCollectionParts trie par date, les non datés en dernier', () => {
	const ordered = orderCollectionParts([
		part(3, 'Rocky III', '1982-05-28'),
		part(99, 'Rocky (à venir)', null),
		part(1, 'Rocky', '1976-11-21'),
		part(2, 'Rocky II', '1979-06-15')
	]);
	assert.deepEqual(
		ordered.map((p) => p.id),
		[1, 2, 3, 99]
	);
});

test('collectionPosition situe le film dans la saga, 0 si absent', () => {
	const ordered = orderCollectionParts([
		part(1, 'Rocky', '1976-11-21'),
		part(2, 'Rocky II', '1979-06-15'),
		part(3, 'Rocky III', '1982-05-28')
	]);
	assert.equal(collectionPosition(ordered, 2), 2);
	assert.equal(collectionPosition(ordered, 1), 1);
	assert.equal(collectionPosition(ordered, 404), 0);
});
