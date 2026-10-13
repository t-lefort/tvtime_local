import assert from 'node:assert/strict';
import test from 'node:test';
import {
	formatVolumeRanges,
	parseShareFilter,
	parseShareKind,
	shareFileName,
	shareText,
	type ShareList
} from '../src/lib/share';

test('formatVolumeRanges résume les tomes en plages', () => {
	assert.equal(formatVolumeRanges([3, 1, 2, 5, 7, 8]), 'tomes 1 à 3, 5, 7 à 8');
	assert.equal(formatVolumeRanges([4]), 'tome 4');
	assert.equal(formatVolumeRanges([1, 2, 2.5, 3]), 'tomes 1 à 2, 2,5, 3');
	assert.equal(formatVolumeRanges([1, 2, null]), 'tomes 1 à 2 + 1 hors numérotation');
	assert.equal(formatVolumeRanges([null, null]), '2 tomes');
});

test('parseShareKind et parseShareFilter retombent sur les défauts', () => {
	assert.equal(parseShareKind('films'), 'films');
	assert.equal(parseShareKind('nimporte'), 'series');
	assert.equal(parseShareFilter('livres', 'lus'), 'lus');
	assert.equal(parseShareFilter('films', 'terminees'), 'tous');
	assert.equal(parseShareFilter('series', null), 'toutes');
});

test('shareFileName produit un nom sans accents', () => {
	assert.equal(shareFileName({ kind: 'series', owner: 'Thomas Lé' }, '2026-10-13'), 'series-thomas-le-2026-10-13');
});

test('shareText liste les sections, avec ou sans notes', () => {
	const list: ShareList = {
		kind: 'films',
		owner: 'Thomas',
		sections: [
			{
				label: 'Vus',
				items: [
					{ title: 'Inception', detail: '2010', image: null, rating: 9, favorite: true },
					{ title: 'Dune', detail: null, image: null, rating: null, favorite: false }
				]
			},
			{ label: 'À voir', items: [{ title: 'Heat', detail: '1995', image: null, rating: null, favorite: false }] }
		]
	};
	assert.equal(
		shareText(list, { ratings: true }),
		['🎬 Les films de Thomas (3)', '', 'Vus (2)', '• Inception (2010) ★ 9/10 ♥', '• Dune', '', 'À voir (1)', '• Heat (1995)'].join('\n')
	);
	assert.match(shareText(list, { ratings: false }), /• Inception \(2010\)\n/);
});
