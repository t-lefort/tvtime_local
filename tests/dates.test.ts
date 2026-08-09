import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateInTimeZone, localDateString } from '../src/lib/date';
import { buildEpisodeAirDates } from '../src/lib/server/tvmaze';

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
			{ season: 3, number: 4, airstamp: '2026-07-13T01:00:00Z' },
			{ season: 0, number: 77, airstamp: '2026-07-13T02:00:00Z' },
			{ season: 3, number: 5, airstamp: null }
		],
		'Europe/Paris'
	);
	assert.deepEqual([...dates.entries()], [['3:4', '2026-07-13']]);
});
