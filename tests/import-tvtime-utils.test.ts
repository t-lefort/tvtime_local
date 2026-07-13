import assert from 'node:assert/strict';
import test from 'node:test';
import { zipSync } from 'fflate';
import {
	collectMovieImportData,
	csvFilesFromUpload,
	norm
} from '../src/lib/server/tvtime-import-utils';

test('csvFilesFromUpload retrouve les CSV attendus dans un zip GDPR ou des fichiers isolés', () => {
	const enc = new TextEncoder();
	const zip = zipSync({
		// l'export GDPR range les CSV dans des sous-dossiers
		'gdpr/followed_tv_show.csv': enc.encode('tv_show_id\n42'),
		'gdpr/tracking/tracking-prod-records-v2.csv': enc.encode('key\nwatch-episode-1'),
		'gdpr/autre_fichier.csv': enc.encode('ignoré'),
		'__MACOSX/followed_tv_show.csv': enc.encode('métadonnées macOS à ignorer')
	});

	assert.deepEqual(csvFilesFromUpload([{ name: 'tvtime.zip', data: zip }]), {
		'followed_tv_show.csv': 'tv_show_id\n42',
		'tracking-prod-records-v2.csv': 'key\nwatch-episode-1'
	});

	// CSV sélectionnés individuellement, casse du nom indifférente
	assert.deepEqual(
		csvFilesFromUpload([
			{ name: 'Followed_TV_Show.csv', data: enc.encode('tv_show_id\n7') },
			{ name: 'notes.txt', data: enc.encode('ignoré') }
		]),
		{ 'followed_tv_show.csv': 'tv_show_id\n7' }
	);
});

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
