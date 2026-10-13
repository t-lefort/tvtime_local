import { shareCount, shareIcon, shareMarks, shareTitle, type ShareList, type ShareOptions } from './share';

/**
 * Image JPEG d'un catalogue, dessinée dans le navigateur : une mosaïque
 * d'affiches rangée par sections, aux couleurs de l'application. Les affiches
 * TMDB autorisent le CORS et les couvertures viennent de la même origine, donc
 * le canvas reste exportable.
 */

const WIDTH = 1080;
const PAD = 48;
const GAP = 16;
/** Sous ~16 Mpx : au-delà, Safari iOS refuse de dessiner le canvas. */
const MAX_PIXELS = 15_000_000;
const MAX_HEIGHT = 16_000;

const COLORS = {
	bg: '#0b1220',
	card: '#17213a',
	line: '#24314f',
	ink: '#e9eef8',
	mut: '#8fa0bd',
	brand: '#fbc500'
};
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface Layout {
	cols: number;
	tileW: number;
	posterH: number;
	tileH: number;
	height: number;
}

const HEADER_H = 150;
const SECTION_H = 76;
const FOOTER_H = 60;

function layoutFor(list: ShareList, cols: number, options: ShareOptions): Layout {
	const tileW = (WIDTH - PAD * 2 - GAP * (cols - 1)) / cols;
	const posterH = tileW * 1.5;
	const small = cols > 6;
	// Titre, puis détail, puis note : chaque ligne de texte compte.
	const textH = (small ? 18 : 24) + (small ? 16 : 20) + (options.ratings ? (small ? 16 : 20) : 0) + 12;
	const tileH = posterH + textH;
	let height = HEADER_H + FOOTER_H;
	for (const section of list.sections) {
		const rows = Math.ceil(section.items.length / cols);
		height += SECTION_H + rows * tileH + (rows - 1) * GAP + 12;
	}
	return { cols, tileW, posterH, tileH, height: Math.ceil(height) };
}

/** Le plus de colonnes nécessaire, et pas plus, pour que l'image reste dessinable. */
function chooseLayout(list: ShareList, options: ShareOptions): Layout {
	const count = shareCount(list);
	const start = count <= 12 ? 3 : count <= 40 ? 4 : 5;
	let layout = layoutFor(list, start, options);
	for (let cols = start + 1; cols <= 14; cols++) {
		if (layout.height * WIDTH <= MAX_PIXELS && layout.height <= MAX_HEIGHT) break;
		layout = layoutFor(list, cols, options);
	}
	return layout;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.referrerPolicy = 'no-referrer';
		const timer = setTimeout(() => resolve(null), 10_000);
		img.onload = () => {
			clearTimeout(timer);
			resolve(img);
		};
		img.onerror = () => {
			clearTimeout(timer);
			resolve(null);
		};
		// TMDB n'envoie l'en-tête CORS qu'aux requêtes qui portent une origine,
		// sans « Vary: Origin » : l'affiche déjà en cache depuis la bibliothèque
		// en est dépourvue et teinterait le canvas. Une adresse à part l'évite.
		img.src = src.startsWith('http') ? `${src}${src.includes('?') ? '&' : '?'}partage` : src;
	});
}

async function loadAll(list: ShareList): Promise<Map<string, HTMLImageElement>> {
	const sources = [
		...new Set(list.sections.flatMap((section) => section.items.map((item) => item.image)).filter(Boolean))
	] as string[];
	const loaded = new Map<string, HTMLImageElement>();
	for (let i = 0; i < sources.length; i += 12) {
		const batch = sources.slice(i, i + 12);
		const images = await Promise.all(batch.map(loadImage));
		images.forEach((img, index) => img && loaded.set(batch[index], img));
	}
	return loaded;
}

/** Coupe le texte avec une ellipse pour qu'il tienne dans `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
	if (ctx.measureText(text).width <= maxWidth) return text;
	let end = text.length;
	while (end > 0 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end--;
	return `${text.slice(0, end).trimEnd()}…`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}

/** Dessine l'image object-fit: cover dans la zone donnée. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
	const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
	const sw = w / scale;
	const sh = h / scale;
	ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

export async function renderShareImage(
	list: ShareList,
	options: ShareOptions & { subtitle: string }
): Promise<Blob> {
	const layout = chooseLayout(list, options);
	const images = await loadAll(list);
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = layout.height;
	const ctx = canvas.getContext('2d')!;
	const small = layout.cols > 6;

	ctx.fillStyle = COLORS.bg;
	ctx.fillRect(0, 0, WIDTH, layout.height);

	ctx.textBaseline = 'top';
	ctx.fillStyle = COLORS.ink;
	ctx.font = `700 44px ${FONT}`;
	ctx.fillText(fit(ctx, `${shareIcon(list.kind)} ${shareTitle(list)}`, WIDTH - PAD * 2), PAD, PAD);
	ctx.fillStyle = COLORS.mut;
	ctx.font = `400 24px ${FONT}`;
	ctx.fillText(fit(ctx, options.subtitle, WIDTH - PAD * 2), PAD, PAD + 56);

	let y = HEADER_H;
	for (const section of list.sections) {
		y += 20;
		ctx.font = `700 28px ${FONT}`;
		ctx.fillStyle = COLORS.ink;
		ctx.fillText(section.label, PAD, y);
		const labelW = ctx.measureText(section.label).width;
		ctx.font = `500 22px ${FONT}`;
		ctx.fillStyle = COLORS.mut;
		ctx.fillText(String(section.items.length), PAD + labelW + 12, y + 5);
		ctx.fillStyle = COLORS.line;
		ctx.fillRect(PAD, y + 38, WIDTH - PAD * 2, 2);
		y += SECTION_H - 20;

		section.items.forEach((item, index) => {
			const col = index % layout.cols;
			const row = Math.floor(index / layout.cols);
			const x = PAD + col * (layout.tileW + GAP);
			const top = y + row * (layout.tileH + GAP);
			const radius = small ? 6 : 10;

			ctx.save();
			roundedRect(ctx, x, top, layout.tileW, layout.posterH, radius);
			ctx.fillStyle = COLORS.card;
			ctx.fill();
			ctx.clip();
			const img = item.image ? images.get(item.image) : undefined;
			if (img) {
				drawCover(ctx, img, x, top, layout.tileW, layout.posterH);
			} else {
				ctx.font = `400 ${Math.round(layout.tileW / 3)}px ${FONT}`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(shareIcon(list.kind), x + layout.tileW / 2, top + layout.posterH / 2);
				ctx.textAlign = 'left';
				ctx.textBaseline = 'top';
			}
			ctx.restore();

			let textY = top + layout.posterH + 8;
			ctx.fillStyle = COLORS.ink;
			ctx.font = `600 ${small ? 14 : 18}px ${FONT}`;
			ctx.fillText(fit(ctx, item.title, layout.tileW), x, textY);
			textY += small ? 18 : 24;
			if (item.detail) {
				ctx.fillStyle = COLORS.mut;
				ctx.font = `400 ${small ? 12 : 15}px ${FONT}`;
				ctx.fillText(fit(ctx, item.detail, layout.tileW), x, textY);
			}
			textY += small ? 16 : 20;
			const marks = shareMarks(item, options);
			if (marks) {
				ctx.fillStyle = COLORS.brand;
				ctx.font = `600 ${small ? 12 : 15}px ${FONT}`;
				ctx.fillText(fit(ctx, marks, layout.tileW), x, textY);
			}
		});
		const rows = Math.ceil(section.items.length / layout.cols);
		y += rows * layout.tileH + (rows - 1) * GAP + 12;
	}

	ctx.fillStyle = COLORS.mut;
	ctx.font = `400 18px ${FONT}`;
	ctx.textAlign = 'center';
	ctx.fillText('Partagé depuis TV Time local', WIDTH / 2, layout.height - FOOTER_H + 16);

	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image impossible à générer'))), 'image/jpeg', 0.9)
	);
}
