import assert from 'node:assert/strict';
import test from 'node:test';
import {
	interleaveResults,
	parseSearchType,
	searchBackHref,
	type SearchResult
} from '../src/lib/search';

const result = (
	kind: 'series' | 'films',
	tmdbId: number,
	popularity: number
): SearchResult => ({
	kind,
	tmdbId,
	name: `${kind} ${tmdbId}`,
	originalName: `${kind} ${tmdbId}`,
	overview: '',
	posterPath: null,
	backdropPath: null,
	date: null,
	voteAverage: 0,
	popularity,
	localId: null
});

test('parseSearchType retombe sur « tout » hors valeurs connues', () => {
	assert.equal(parseSearchType('films'), 'films');
	assert.equal(parseSearchType('series'), 'series');
	assert.equal(parseSearchType('tout'), 'tout');
	assert.equal(parseSearchType('musique'), 'tout');
	assert.equal(parseSearchType(null), 'tout');
});

test('interleaveResults alterne série et film, le plus populaire en tête', () => {
	const shows = [result('series', 1, 50), result('series', 2, 5)];
	const movies = [result('films', 10, 90), result('films', 20, 1)];
	assert.deepEqual(
		interleaveResults(shows, movies).map((r) => `${r.kind}:${r.tmdbId}`),
		['films:10', 'series:1', 'series:2', 'films:20']
	);
});

test('interleaveResults garde une liste vide de chaque côté', () => {
	const shows = [result('series', 1, 1), result('series', 2, 2)];
	assert.deepEqual(
		interleaveResults(shows, []).map((r) => r.tmdbId),
		[1, 2]
	);
	assert.deepEqual(interleaveResults([], []), []);
});

test('interleaveResults plafonne la liste mélangée à 40 résultats', () => {
	const shows = Array.from({ length: 40 }, (_, i) => result('series', i + 1, 0));
	const movies = Array.from({ length: 40 }, (_, i) => result('films', i + 100, 0));
	assert.equal(interleaveResults(shows, movies).length, 40);
});

test('searchBackHref rouvre l’onglet d’origine, sinon celui de la fiche', () => {
	assert.equal(searchBackHref('dune', 'tout', '/films'), '/recherche?type=tout&q=dune');
	assert.equal(searchBackHref('dune', null, '/films'), '/recherche?type=films&q=dune');
	assert.equal(searchBackHref('dune', 'inconnu', '/series'), '/recherche?type=series&q=dune');
	assert.equal(searchBackHref('', 'tout', '/series'), '/series');
});
