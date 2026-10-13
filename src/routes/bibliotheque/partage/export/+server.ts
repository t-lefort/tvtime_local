import { parseShareFilter, parseShareKind, shareFileName, shareFilterLabel } from '$lib/share';
import { appToday } from '$lib/server/dates';
import { renderShareHtml } from '$lib/server/share-html';
import { getShareList } from '$lib/server/share';
import { requireUser } from '$lib/server/users';
import type { RequestHandler } from './$types';

/**
 * Page HTML autonome d'un catalogue. `?print=1` ouvre aussitôt la boîte
 * d'impression (« Enregistrer au format PDF ») ; `?dl=1` la télécharge.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const user = requireUser(locals);
	const kind = parseShareKind(url.searchParams.get('type'));
	const filter = parseShareFilter(kind, url.searchParams.get('filtre'));
	const list = getShareList(user, kind, filter);
	const date = appToday();
	const html = await renderShareHtml(list, {
		ratings: url.searchParams.get('notes') !== '0',
		filterLabel: shareFilterLabel(kind, filter),
		date,
		print: url.searchParams.get('print') === '1'
	});
	const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8' };
	if (url.searchParams.get('dl') === '1') {
		headers['Content-Disposition'] = `attachment; filename="${shareFileName(list, date)}.html"`;
	}
	return new Response(html, { headers });
};
