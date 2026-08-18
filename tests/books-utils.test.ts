import assert from 'node:assert/strict';
import test from 'node:test';
import {
	belongsToSeries,
	compareVolumes,
	foldVolumesIntoSeries,
	normalizeBookTitle,
	splitVolumeTitle,
	volumeNumber
} from '../src/lib/books';

test('normalizeBookTitle ignore casse, accents et ponctuation', () => {
	assert.equal(normalizeBookTitle('One Piece, tome 2'), 'one piece tome 2');
	assert.equal(normalizeBookTitle('Lanfeust de Troy — Trölls'), 'lanfeust de troy trolls');
});

test('splitVolumeTitle retrouve la série et le numéro de tome', () => {
	assert.deepEqual(splitVolumeTitle('One Piece, tome 2'), { title: 'one piece', volume: 2 });
	assert.deepEqual(splitVolumeTitle('One Piece 9 : Larmes'), { title: 'one piece', volume: 9 });
	assert.deepEqual(splitVolumeTitle('One Piece Tome 26'), { title: 'one piece', volume: 26 });
	assert.deepEqual(splitVolumeTitle('One Piece T. 51'), { title: 'one piece', volume: 51 });
	assert.deepEqual(splitVolumeTitle('One Piece'), { title: 'one piece', volume: null });
});

test('splitVolumeTitle ne prend pas un titre entier pour un numéro', () => {
	assert.deepEqual(splitVolumeTitle('451'), { title: '451', volume: null });
});

test('belongsToSeries reconnaît un tome parmi les résultats de recherche', () => {
	assert.equal(belongsToSeries('One Piece 21 : Utupia', 'One Piece'), true);
	assert.equal(belongsToSeries('One piece', 'One Piece'), true);
	assert.equal(belongsToSeries('One Piece: Sea of Survival', 'One Piece'), false);
	assert.equal(belongsToSeries('Akira, tome 1', 'One Piece'), false);
	assert.equal(belongsToSeries('One Piece 3', ''), false);
});

test('volumeNumber lit le tome tel que les catalogues l’écrivent', () => {
	assert.equal(volumeNumber('3'), 3);
	assert.equal(volumeNumber('T. 12'), 12);
	assert.equal(volumeNumber('2,5'), 2.5);
	assert.equal(volumeNumber(null), null);
	assert.equal(volumeNumber('hors-série'), null);
});

test('compareVolumes ordonne par numéro et rejette les tomes sans numéro à la fin', () => {
	const volumes = [
		{ volume: null, title: 'Artbook' },
		{ volume: 10, title: 'Dix' },
		{ volume: 2, title: 'Deux' },
		{ volume: null, title: 'Anthologie' }
	];
	assert.deepEqual(
		[...volumes].sort(compareVolumes).map((v) => v.title),
		['Deux', 'Dix', 'Anthologie', 'Artbook']
	);
});

test('foldVolumesIntoSeries remplace les tomes épars par leur série', () => {
	const series = [{ label: 'One Piece' }, { label: 'Liste des épisodes de One Piece' }];
	const works = [
		{ label: 'One Piece 9 : Larmes' },
		{ label: 'One Piece, tome 2' },
		{ label: 'One Piece: Sea of Survival' },
		{ label: 'Akira, tome 1' }
	];
	const folded = foldVolumesIntoSeries(series, works);
	assert.deepEqual(
		folded.series.map((s) => s.label),
		['One Piece']
	);
	assert.deepEqual(
		folded.works.map((w) => w.label),
		['One Piece: Sea of Survival', 'Akira, tome 1']
	);
});

test('foldVolumesIntoSeries laisse la liste intacte sans série correspondante', () => {
	const works = [{ label: 'Akira, tome 1' }];
	assert.deepEqual(foldVolumesIntoSeries([{ label: 'Gunnm' }], works), { series: [], works });
});
