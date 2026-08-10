import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateInTimeZone, localDateString } from '../src/lib/date';
import { buildEpisodeAirDates, localizedEpisodeAirDate } from '../src/lib/server/tvmaze';

test('dateInTimeZone convertit une diffusion américaine au lendemain en France', () => {
	assert.equal(dateInTimeZone('2026-07-13T01:00:00Z', 'Europe/Paris'), '2026-07-13');
	assert.equal(dateInTimeZone('2026-07-13T01:00:00Z', 'America/New_York'), '2026-07-12');
});

test('localDateString conserve la date civile sans passer par UTC', () => {
	assert.equal(localDateString(new Date(2026, 7, 5, 0, 30)), '2026-08-05');
});

test('buildEpisodeAirDates indexe les épisodes normaux et ignore les spéciaux', () => {
	const dates = buildEpisodeAirDates(
		[
			{ season: 3, number: 4, airdate: '2026-07-12', airstamp: '2026-07-13T01:00:00Z' },
			{ season: 0, number: 77, airdate: '2026-07-12', airstamp: '2026-07-13T02:00:00Z' },
			{ season: 3, number: 5, airdate: '2026-07-12', airstamp: null }
		],
		'Europe/Paris'
	);
	assert.deepEqual([...dates.entries()], [['4:2026-07-12', '2026-07-13']]);
});

test('la date et le numéro identifient un épisode malgré un découpage de saisons différent', () => {
	const dates = buildEpisodeAirDates(
		[
			{ season: 3, number: 1, airdate: '2023-10-05', airstamp: '2023-10-05T12:00:00Z' },
			{ season: 4, number: 1, airdate: '2026-10-23', airstamp: '2026-10-23T07:00:00Z' }
		],
		'Europe/Paris'
	);

	assert.equal(localizedEpisodeAirDate(dates, 1, '2026-10-23'), '2026-10-23');
	assert.notEqual(localizedEpisodeAirDate(dates, 1, '2026-10-23'), '2023-10-05');
});

test('une diffusion américaine en soirée devient disponible le lendemain en France', () => {
	const dates = buildEpisodeAirDates(
		[
			{ season: 2, number: 3, airdate: '2026-07-12', airstamp: '2026-07-13T01:00:00Z' }
		],
		'Europe/Paris'
	);

	assert.equal(localizedEpisodeAirDate(dates, 3, '2026-07-12'), '2026-07-13');
});
