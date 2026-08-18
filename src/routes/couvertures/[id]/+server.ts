import { getCover } from '$lib/server/covers';
import type { RequestHandler } from './$types';

/** Une journée : assez pour ne plus y revenir, assez court pour voir une correction. */
const CACHE_CONTROL = 'public, max-age=86400';

/**
 * Couverture d'un livre de la bibliothèque, servie depuis le cache local.
 * L'absence de couverture est un 404 : le composant retombe alors sur son
 * emoji, et le navigateur retient la réponse au lieu de la redemander.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	const cover = Number.isInteger(id) && id > 0 ? await getCover(id) : null;
	if (!cover) return new Response(null, { status: 404, headers: { 'Cache-Control': CACHE_CONTROL } });
	if (request.headers.get('if-none-match') === cover.etag) {
		return new Response(null, { status: 304, headers: { ETag: cover.etag, 'Cache-Control': CACHE_CONTROL } });
	}
	return new Response(new Uint8Array(cover.body), {
		headers: {
			'Content-Type': cover.contentType,
			'Content-Length': String(cover.body.length),
			ETag: cover.etag,
			'Cache-Control': CACHE_CONTROL
		}
	});
};
