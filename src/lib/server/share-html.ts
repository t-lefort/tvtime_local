import { shareCount, shareIcon, shareMarks, shareTitle, type ShareList, type ShareOptions } from '$lib/share';
import { getCover } from './covers';

const escape = (value: string) =>
	value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * Les couvertures de livres viennent du cache de l'instance, que le
 * destinataire ne peut pas joindre : elles voyagent dans le fichier. Les
 * affiches TMDB, publiques, restent de simples liens.
 */
async function embedLocalImages(list: ShareList): Promise<Map<string, string>> {
	const local = [
		...new Set(
			list.sections.flatMap((section) =>
				section.items.map((item) => item.image).filter((image) => image?.startsWith('/couvertures/'))
			)
		)
	] as string[];
	const embedded = new Map<string, string>();
	// Par petits paquets : une grande bibliothèque ne doit pas lancer des
	// centaines de téléchargements de couvertures pas encore en cache.
	for (let i = 0; i < local.length; i += 8) {
		await Promise.all(
			local.slice(i, i + 8).map(async (image) => {
				const id = Number(image.slice('/couvertures/'.length));
				const cover = Number.isInteger(id) ? await getCover(id).catch(() => null) : null;
				if (cover) embedded.set(image, `data:${cover.contentType};base64,${cover.body.toString('base64')}`);
			})
		);
	}
	return embedded;
}

/**
 * Une page HTML autonome : un seul fichier, sans script ni feuille externe,
 * lisible hors ligne et imprimable (c'est elle qui sert de PDF).
 */
export async function renderShareHtml(
	list: ShareList,
	options: ShareOptions & { filterLabel: string; date: string; print?: boolean }
): Promise<string> {
	const images = await embedLocalImages(list);
	const title = shareTitle(list);
	const count = shareCount(list);
	const subtitle = [
		`${count} ${count > 1 ? 'titres' : 'titre'}`,
		options.filterLabel && !['Tous', 'Toutes'].includes(options.filterLabel) ? options.filterLabel : '',
		`le ${new Date(`${options.date}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
	]
		.filter(Boolean)
		.join(' · ');
	const fallback = shareIcon(list.kind);

	const sections = list.sections
		.map((section) => {
			const cards = section.items
				.map((item) => {
					const src = item.image ? (images.get(item.image) ?? (item.image.startsWith('/') ? null : item.image)) : null;
					const marks = shareMarks(item, options);
					return `<li class="card">
	<div class="poster">${src ? `<img src="${escape(src)}" alt="" ${options.print ? '' : 'loading="lazy"'} referrerpolicy="no-referrer">` : `<span>${fallback}</span>`}</div>
	<div class="name">${escape(item.title)}</div>
	${item.detail ? `<div class="detail">${escape(item.detail)}</div>` : ''}
	${marks ? `<div class="marks">${escape(marks)}</div>` : ''}
</li>`;
				})
				.join('\n');
			return `<section>
<h2>${escape(section.label)} <small>${section.items.length}</small></h2>
<ul class="grid">
${cards}
</ul>
</section>`;
		})
		.join('\n');

	return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
:root { --bg: #f7f7f9; --card: #ffffff; --ink: #141a26; --mut: #5d6b82; --line: #e2e6ee; --brand: #b38b00; color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
	:root { --bg: #0b1220; --card: #17213a; --ink: #e9eef8; --mut: #8fa0bd; --line: #24314f; --brand: #fbc500; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 32px 16px 48px; }
h1 { margin: 0; font-size: 28px; }
.sub { margin: 4px 0 0; color: var(--mut); }
section { margin-top: 32px; }
h2 { margin: 0 0 12px; font-size: 19px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
h2 small { color: var(--mut); font-weight: 500; font-size: 15px; }
.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 18px 14px; }
.card { min-width: 0; break-inside: avoid; }
.poster { aspect-ratio: 2 / 3; border-radius: 8px; overflow: hidden; background: var(--card); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-size: 32px; }
.poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
.name { margin-top: 6px; font-weight: 600; font-size: 14px; line-height: 1.25; overflow-wrap: anywhere; }
.detail { color: var(--mut); font-size: 12.5px; }
.marks { color: var(--brand); font-size: 13px; font-weight: 600; }
footer { margin-top: 40px; color: var(--mut); font-size: 12px; text-align: center; }
@media print {
	:root { --bg: #fff; --card: #f2f3f6; --ink: #000; --mut: #555; --line: #ccc; --brand: #8a6a00; }
	@page { margin: 12mm; }
	main { padding: 0; max-width: none; }
	.grid { grid-template-columns: repeat(6, 1fr); gap: 10px 8px; }
	.name { font-size: 11px; }
	.detail, .marks { font-size: 10px; }
	h2 { break-after: avoid; }
	* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
<main>
<h1>${fallback} ${escape(title)}</h1>
<p class="sub">${escape(subtitle)}</p>
${sections || '<p class="sub">Rien à partager pour le moment.</p>'}
<footer>Partagé depuis TV Time local</footer>
</main>
${options.print ? `<script>addEventListener('load', () => setTimeout(() => print(), 150));</script>` : ''}
</body>
</html>
`;
}
