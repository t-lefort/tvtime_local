import assert from 'node:assert/strict';
import test from 'node:test';
import { extractCompanies, extractCrew, type TmdbCrewMember } from '../src/lib/server/tmdb';

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
