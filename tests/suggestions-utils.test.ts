import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildGenreWeights,
	movieSeedWeight,
	rankSuggestions,
	ratingGenreFactor,
	showSeedWeight,
	type SuggestionCandidate,
	type SuggestionSeed
} from '../src/lib/server/suggestions-utils';

const seed = (over: Partial<SuggestionSeed> & { tmdbId: number }): SuggestionSeed => ({
	title: `Graine ${over.tmdbId}`,
	weight: 1,
	...over
});

const candidate = (over: Partial<SuggestionCandidate> & { tmdbId: number }): SuggestionCandidate => ({
	name: `Titre ${over.tmdbId}`,
	originalName: `Titre ${over.tmdbId}`,
	overview: '',
	posterPath: null,
	backdropPath: null,
	date: null,
	voteAverage: 7,
	genreIds: [],
	...over
});

test('showSeedWeight favorise les favoris et la progression, ignore les séries arrêtées ou non commencées', () => {
	assert.equal(showSeedWeight({ favorite: false, archived: true, watchedCount: 10, airedCount: 10, rating: null }), 0);
	assert.equal(showSeedWeight({ favorite: false, archived: false, watchedCount: 0, airedCount: 10, rating: null }), 0);
	assert.equal(showSeedWeight({ favorite: false, archived: false, watchedCount: 5, airedCount: 10, rating: null }), 1.5);
	assert.equal(showSeedWeight({ favorite: true, archived: false, watchedCount: 10, airedCount: 10, rating: null }), 3);
	// Plus d'épisodes vus que diffusés (rediffusions) : la progression est plafonnée à 1
	assert.equal(showSeedWeight({ favorite: false, archived: false, watchedCount: 20, airedCount: 10, rating: null }), 2);
});

test('movieSeedWeight favorise les favoris et les revisionnages plafonnés, ignore les films non vus', () => {
	assert.equal(movieSeedWeight({ favorite: false, watchCount: 0, rating: null }), 0);
	assert.equal(movieSeedWeight({ favorite: false, watchCount: 1, rating: null }), 1.5);
	assert.equal(movieSeedWeight({ favorite: true, watchCount: 1, rating: null }), 2.5);
	// Les revisionnages au-delà de 2 ne comptent plus
	assert.equal(movieSeedWeight({ favorite: false, watchCount: 10, rating: null }), 2);
	// Un favori jamais marqué vu compte quand même
	assert.equal(movieSeedWeight({ favorite: true, watchCount: 0, rating: null }), 2);
});

test('la note personnelle domine le poids des graines et écarte les titres mal notés', () => {
	const base = { favorite: false, archived: false, watchedCount: 10, airedCount: 10 };
	// 10/10 (+3) pèse plus qu'un favori (+1)
	assert.equal(showSeedWeight({ ...base, rating: 10 }), 5);
	assert.ok(
		showSeedWeight({ ...base, rating: 10 }) > showSeedWeight({ ...base, favorite: true, rating: null })
	);
	// Mal notée (≤ 4) : jamais une graine, même favorite et finie
	assert.equal(showSeedWeight({ ...base, favorite: true, rating: 4 }), 0);
	// Notée mais aucun épisode vu (import) : compte quand même
	assert.equal(showSeedWeight({ ...base, watchedCount: 0, rating: 8 }), 2.8);
	// La note explicite prime sur l'archivage : une série arrêtée mais 10/10 reste une graine
	assert.equal(showSeedWeight({ ...base, archived: true, rating: 10 }), 5);
	assert.equal(showSeedWeight({ ...base, archived: true, rating: 4 }), 0);

	assert.equal(movieSeedWeight({ favorite: false, watchCount: 1, rating: 10 }), 4.5);
	assert.equal(movieSeedWeight({ favorite: true, watchCount: 3, rating: 3 }), 0);
	// Noté mais jamais marqué vu : compte quand même
	assert.equal(movieSeedWeight({ favorite: false, watchCount: 0, rating: 8 }), 2.8);
});

test('ratingGenreFactor amplifie les genres des titres bien notés et amortit les mal notés', () => {
	assert.equal(ratingGenreFactor(null), 1);
	assert.equal(ratingGenreFactor(10), 2);
	assert.equal(ratingGenreFactor(5), 1);
	assert.equal(ratingGenreFactor(1), 0.2);
});

test('buildGenreWeights normalise le temps passé par genre entre 0 et 1', () => {
	const idsByName = new Map([
		['Drame', 18],
		['Comédie', 35]
	]);
	const weights = buildGenreWeights(
		[
			{ genres: ['Drame'], weight: 300 },
			{ genres: ['Drame', 'Comédie'], weight: 100 },
			{ genres: ['Inconnu'], weight: 500 },
			{ genres: ['Comédie'], weight: 0 }
		],
		idsByName
	);
	assert.equal(weights.get(18), 1);
	assert.equal(weights.get(35), 0.25);
	assert.equal(weights.size, 2);
});

test('rankSuggestions exclut la bibliothèque et fait monter les titres recommandés par plusieurs graines', () => {
	const a = seed({ tmdbId: 1, title: 'Breaking Bad', weight: 2 });
	const b = seed({ tmdbId: 2, title: 'The Wire', weight: 1 });
	const ranked = rankSuggestions(
		[
			{ seed: a, candidates: [candidate({ tmdbId: 10 }), candidate({ tmdbId: 11 }), candidate({ tmdbId: 99 })] },
			{ seed: b, candidates: [candidate({ tmdbId: 10 })] }
		],
		new Set([99]),
		new Map()
	);
	assert.deepEqual(
		ranked.map((r) => r.tmdbId),
		[10, 11]
	);
	// Le titre 10 vient des deux graines, la plus affinitaire citée d'abord
	assert.deepEqual(ranked[0].because, ['Breaking Bad', 'The Wire']);
	assert.ok(ranked[0].score > ranked[1].score);
});

test('rankSuggestions départage par la note TMDB puis par l’affinité de genres', () => {
	const s = seed({ tmdbId: 1 });
	const byNote = rankSuggestions(
		[
			{
				seed: s,
				candidates: [
					candidate({ tmdbId: 10, voteAverage: 6 }),
					candidate({ tmdbId: 11, voteAverage: 8.5 })
				]
			}
		],
		new Set(),
		new Map()
	);
	assert.deepEqual(
		byNote.map((r) => r.tmdbId),
		[11, 10]
	);

	const byGenre = rankSuggestions(
		[
			{
				seed: s,
				candidates: [
					candidate({ tmdbId: 10, genreIds: [99] }),
					candidate({ tmdbId: 11, genreIds: [18] })
				]
			}
		],
		new Set(),
		new Map([[18, 1]])
	);
	assert.deepEqual(
		byGenre.map((r) => r.tmdbId),
		[11, 10]
	);
});

test('rankSuggestions plafonne le nombre de résultats', () => {
	const s = seed({ tmdbId: 1 });
	const candidates = Array.from({ length: 30 }, (_, i) => candidate({ tmdbId: 100 + i }));
	assert.equal(rankSuggestions([{ seed: s, candidates }], new Set(), new Map()).length, 24);
	assert.equal(rankSuggestions([{ seed: s, candidates }], new Set(), new Map(), 5).length, 5);
});
