import { parseShareFilter, parseShareKind } from '$lib/share';
import { appToday } from '$lib/server/dates';
import { getLibraryCounts } from '$lib/server/library';
import { getShareList } from '$lib/server/share';
import { requireUser } from '$lib/server/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
	const user = requireUser(locals);
	const kind = parseShareKind(url.searchParams.get('type'));
	const filter = parseShareFilter(kind, url.searchParams.get('filtre'));
	return {
		kind,
		filter,
		// Les notes sont partagées sauf demande contraire.
		ratings: url.searchParams.get('notes') !== '0',
		list: getShareList(user, kind, filter),
		today: appToday(),
		libraryCounts: getLibraryCounts(user.id)
	};
};
