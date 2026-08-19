import assert from 'node:assert/strict';
import test from 'node:test';
import {
	belongsToSeries,
	bestDescription,
	cleanDescription,
	compareVolumes,
	foldVolumesIntoSeries,
	formatVolumeLabel,
	formatVolumeNumber,
	normalizeBookTitle,
	sameSeries,
	shouldGroupAsSeries,
	splitSeriesTitle,
	splitVolumeTitle,
	volumeLabelText,
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

test('cleanDescription écarte les gloses Wikidata', () => {
	assert.equal(cleanDescription("série de manga d'Eiichirō Oda"), null);
	assert.equal(cleanDescription('1998 manga volume by Eiichiro Oda'), null);
	assert.equal(cleanDescription("livre d'Eiichiro Oda"), null);
	assert.equal(cleanDescription('roman de Victor Hugo'), null);
	assert.equal(cleanDescription(''), null);
	assert.equal(cleanDescription(null), null);
});

test('cleanDescription garde un vrai résumé et lui met une majuscule', () => {
	assert.equal(
		cleanDescription("sur le chemin de l'île des hommes-poissons, l'équipage fait escale."),
		"Sur le chemin de l'île des hommes-poissons, l'équipage fait escale."
	);
	// Un résumé qui parle de la série reste un résumé : il fait des phrases.
	assert.equal(
		cleanDescription('série culte des années 90. Elle a marqué toute une génération de lecteurs.'),
		'Série culte des années 90. Elle a marqué toute une génération de lecteurs.'
	);
});

test('cleanDescription nettoie le balisage de Google Books', () => {
	assert.equal(
		cleanDescription('<p>Luffy part en mer.<br>Il cherche le One Piece.</p>'),
		'Luffy part en mer. Il cherche le One Piece.'
	);
	assert.equal(cleanDescription('Z&amp;A &quot;pirates&quot;'), 'Z&A "pirates"');
});

test('bestDescription préfère un résumé et rattrape la glose faute de mieux', () => {
	assert.equal(
		bestDescription("série de manga d'Eiichirō Oda", 'Luffy rêve de devenir le roi des pirates.'),
		'Luffy rêve de devenir le roi des pirates.'
	);
	assert.equal(
		bestDescription("série de manga d'Eiichirō Oda", null),
		"Série de manga d'Eiichirō Oda"
	);
	assert.equal(bestDescription(null, undefined, ''), null);
});

test('formatVolumeLabel donne le même repère à tous les tomes', () => {
	const series = 'One Piece';
	assert.deepEqual(formatVolumeLabel({ seriesTitle: series, title: 'One Piece, tome 2', volume: '2' }), {
		label: 'Tome 2',
		title: null
	});
	assert.deepEqual(formatVolumeLabel({ seriesTitle: series, title: 'ONE PIECE 3', volume: '3' }), {
		label: 'Tome 3',
		title: null
	});
	assert.deepEqual(
		formatVolumeLabel({ seriesTitle: series, title: "À l'aube d'une grande aventure", volume: 1 }),
		{ label: 'Tome 1', title: "À l'aube d'une grande aventure" }
	);
	assert.deepEqual(
		formatVolumeLabel({
			seriesTitle: series,
			title: 'One Piece - Édition originale - Tome 51',
			subtitle: 'Les onze supernovae',
			volume: 51
		}),
		{ label: 'Tome 51', title: 'Les onze supernovae' }
	);
	assert.deepEqual(formatVolumeLabel({ seriesTitle: series, title: 'One Piece 9 : Larmes' }), {
		label: 'Tome 9',
		title: 'Larmes'
	});
	assert.deepEqual(formatVolumeLabel({ seriesTitle: series, title: 'One piece. 112' }), {
		label: 'Tome 112',
		title: null
	});
});

test('formatVolumeLabel écarte les titres inutilisables', () => {
	// Un label japonais ne dit rien dans une liste française.
	assert.deepEqual(
		formatVolumeLabel({ seriesTitle: 'One Piece', title: 'ONE PIECE 2 バギー海賊団', volume: 2 }),
		{ label: 'Tome 2', title: null }
	);
	// La mention d'édition n'est pas un titre de tome.
	assert.deepEqual(
		formatVolumeLabel({ seriesTitle: 'One Piece', title: 'One Piece : édition originale. 37', volume: 37 }),
		{ label: 'Tome 37', title: null }
	);
	assert.deepEqual(
		formatVolumeLabel({ seriesTitle: 'One Piece', title: 'One Piece : édition originale. 37, Tom' }),
		{ label: 'Tome 37', title: 'Tom' }
	);
});

test('formatVolumeLabel laisse son titre à un tome sans numéro', () => {
	assert.deepEqual(formatVolumeLabel({ seriesTitle: 'One Piece', title: 'One Piece Artbook' }), {
		label: 'One Piece Artbook',
		title: 'Artbook'
	});
	assert.deepEqual(formatVolumeLabel({ title: '' }), { label: 'Tome sans numéro', title: null });
});

test('formatVolumeNumber garde les tomes intercalaires lisibles', () => {
	assert.equal(formatVolumeNumber(7), '7');
	assert.equal(formatVolumeNumber(2.5), '2,5');
});

test('volumeLabelText assemble le rang et le titre du tome', () => {
	assert.equal(
		volumeLabelText({ seriesTitle: 'One Piece', title: 'Larmes', volume: 9 }),
		'Tome 9 · Larmes'
	);
	assert.equal(volumeLabelText({ seriesTitle: 'One Piece', title: 'One Piece 9', volume: 9 }), 'Tome 9');
});

test('shouldGroupAsSeries suit le catalogue, pas le nombre de tomes achetés', () => {
	// Un seul tome d'une série que le catalogue connaît : c'est une série.
	assert.equal(shouldGroupAsSeries({ volumeCount: 108, ownedCount: 1 }), true);
	// Une série sans catalogue attend d'avoir réuni plusieurs tomes.
	assert.equal(shouldGroupAsSeries({ volumeCount: null, ownedCount: 1 }), false);
	assert.equal(shouldGroupAsSeries({ volumeCount: null, ownedCount: 2 }), true);
	assert.equal(shouldGroupAsSeries({ volumeCount: 1, ownedCount: 1 }), false);
});

test('splitSeriesTitle retrouve la série derrière un titre d’édition', () => {
	assert.deepEqual(splitSeriesTitle('One Piece - Édition originale - Tome 51'), {
		seriesTitle: 'One Piece',
		volume: 51
	});
	assert.deepEqual(splitSeriesTitle('One piece. 112'), { seriesTitle: 'One piece', volume: 112 });
	assert.deepEqual(splitSeriesTitle('Akira, tome 1'), { seriesTitle: 'Akira', volume: 1 });
	assert.deepEqual(splitSeriesTitle('Blake et Mortimer - Le Secret de l’Espadon, tome 1'), {
		seriesTitle: 'Blake et Mortimer',
		volume: 1
	});
});

test('splitSeriesTitle distingue une série dérivée de sa série mère', () => {
	assert.equal(splitSeriesTitle('One Piece Doors - Tome 01').seriesTitle, 'One Piece Doors');
	assert.equal(splitSeriesTitle('One piece party. 6').seriesTitle, 'One piece party');
});

test('splitSeriesTitle ne fabrique pas de série à partir de rien', () => {
	assert.deepEqual(splitSeriesTitle('451'), { seriesTitle: null, volume: null });
	assert.deepEqual(splitSeriesTitle('Le Seigneur des Anneaux'), { seriesTitle: null, volume: null });
	assert.deepEqual(splitSeriesTitle('Tome 3'), { seriesTitle: null, volume: null });
});

test('sameSeries compare deux titres de série sans s’arrêter à la casse', () => {
	assert.equal(sameSeries('One Piece', 'one piece'), true);
	assert.equal(sameSeries('One Piece', 'One Piece Doors'), false);
	assert.equal(sameSeries(null, 'One Piece'), false);
});
