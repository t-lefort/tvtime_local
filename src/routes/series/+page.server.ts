import { getShowsWithProgress, type ShowState } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

const FILTERS: Record<string, ShowState | null> = {
	toutes: null,
	encours: 'watching',
	ajour: 'uptodate',
	terminees: 'finished',
	arretees: 'stopped',
	pascommencees: 'notstarted'
};

export const load: PageServerLoad = ({ url }) => {
	const filter = url.searchParams.get('filtre') ?? 'toutes';
	const all = getShowsWithProgress();

	const counts: Record<string, number> = { toutes: all.length };
	for (const [key, state] of Object.entries(FILTERS)) {
		if (state) counts[key] = all.filter((s) => s.state === state).length;
	}

	const state = FILTERS[filter] ?? null;
	const shows = (state ? all.filter((s) => s.state === state) : all).map((s) => ({
		id: s.id,
		name: s.name,
		posterPath: s.posterPath,
		state: s.state,
		favorite: s.favorite,
		airedCount: s.airedCount,
		watchedCount: s.watchedCount,
		lastWatchedAt: s.lastWatchedAt
	}));

	// Les plus récemment regardées d'abord, puis alphabétique
	shows.sort((a, b) => {
		if (a.lastWatchedAt && b.lastWatchedAt) return b.lastWatchedAt.localeCompare(a.lastWatchedAt);
		if (a.lastWatchedAt) return -1;
		if (b.lastWatchedAt) return 1;
		return a.name.localeCompare(b.name, 'fr');
	});

	return { shows, filter, counts };
};
