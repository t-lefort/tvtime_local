import assert from 'node:assert/strict';
import test from 'node:test';
import { collectMovieImportData, norm } from '../scripts/import-tvtime-utils';

test('collectMovieImportData extracts watched, rewatched and watchlist movies', () => {
	const data = collectMovieImportData([
		{
			movie_name: 'Dune',
			type: 'watchlist',
			release_date: '2021-09-15 00:00:00',
			updated_at: '2024-01-01 10:00:00'
		},
		{
			movie_name: 'Dune',
			type: 'watch',
			release_date: '2021-09-15 00:00:00',
			updated_at: '2024-01-02 20:00:00'
		},
		{
			movie_name: 'Dune',
			type: 'rewatch',
			release_date: '2021-09-15 00:00:00',
			updated_at: '2024-02-03 21:30:00'
		},
		{
			movie_name: 'Old entry',
			key: 'watch-movie-42',
			release_date: '0000-00-00 00:00:00',
			created_at: '2020-05-06 12:00:00'
		},
		{
			series_name: 'Not a movie',
			key: 'watch-episode-1',
			created_at: '2024-03-01 09:00:00'
		}
	]);

	const duneKey = `${norm('Dune')}|2021`;
	const oldEntryKey = `${norm('Old entry')}|`;

	assert.equal(data.moviesToImport.size, 2);
	assert.deepEqual(data.moviesToImport.get(duneKey), {
		key: duneKey,
		name: 'Dune',
		releaseYear: '2021',
		addedAt: '2024-01-01 10:00:00',
		source: 'vu'
	});
	assert.deepEqual(data.moviesToImport.get(oldEntryKey), {
		key: oldEntryKey,
		name: 'Old entry',
		releaseYear: undefined,
		addedAt: '2020-05-06 12:00:00',
		source: 'vu'
	});
	assert.deepEqual(
		data.watchEvents.map((e) => ({ key: e.key, watchedAt: e.watchedAt, type: e.type })),
		[
			{ key: duneKey, watchedAt: '2024-01-02 20:00:00', type: 'watch' },
			{ key: duneKey, watchedAt: '2024-02-03 21:30:00', type: 'rewatch' },
			{ key: oldEntryKey, watchedAt: '2020-05-06 12:00:00', type: 'watch' }
		]
	);
});
