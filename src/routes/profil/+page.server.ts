import { redirect } from '@sveltejs/kit';
import { authEnabled } from '$lib/server/auth';
import { getProfileStats } from '$lib/server/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const stats = getProfileStats();

	// 24 derniers mois, mois vides inclus
	const byMonth = new Map(stats.perMonth.map((m) => [m.month, m.count]));
	const months: { month: string; count: number }[] = [];
	const now = new Date();
	for (let i = 23; i >= 0; i--) {
		const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
		const ym = d.toISOString().slice(0, 7);
		months.push({ month: ym, count: byMonth.get(ym) ?? 0 });
	}

	return {
		totalMinutes: stats.totalMinutes,
		distinctEpisodes: stats.distinctEpisodes,
		totalWatches: stats.totalWatches,
		countsByState: stats.countsByState,
		totalShows: stats.totalShows,
		months,
		perGenre: stats.perGenre.slice(0, 10),
		watchedShows: stats.perShow
			.filter((s) => s.minutesWatched > 0)
			.map((s) => ({
				id: s.id,
				name: s.name,
				posterPath: s.posterPath,
				minutesWatched: s.minutesWatched,
				watchedCount: s.watchedCount,
				state: s.state
			})),
		authEnabled: authEnabled()
	};
};

export const actions: Actions = {
	logout: async ({ cookies }) => {
		cookies.delete('session', { path: '/' });
		redirect(303, '/login');
	}
};
