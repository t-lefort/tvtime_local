/** Utilitaires de formatage partagés client/serveur (locale fr-FR). */

export function tmdbImg(path: string | null | undefined, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string | null {
	return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function sxe(season: number, episode: number): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `S${pad(season)}E${pad(episode)}`;
}

/** "3 mois 12 jours 7 h" (mois de 30 jours, comme TV Time). */
export function formatDuration(minutes: number): string {
	const total = Math.round(minutes);
	const months = Math.floor(total / (30 * 24 * 60));
	const days = Math.floor((total % (30 * 24 * 60)) / (24 * 60));
	const hours = Math.floor((total % (24 * 60)) / 60);
	const parts: string[] = [];
	if (months > 0) parts.push(`${months} mois`);
	if (days > 0) parts.push(`${days} jour${days > 1 ? 's' : ''}`);
	if (hours > 0 || parts.length === 0) parts.push(`${hours} h`);
	return parts.join(' ');
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const dayYearFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });

function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
	const d = new Date(dateStr + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** "Aujourd'hui", "Demain" ou "vendredi 10 juillet [2027]" pour un YYYY-MM-DD. */
export function dayLabel(dateStr: string): string {
	const today = todayStr();
	if (dateStr === today) return "Aujourd'hui";
	if (dateStr === addDays(today, 1)) return 'Demain';
	const d = new Date(dateStr + 'T12:00:00Z');
	const fmt = dateStr.slice(0, 4) === today.slice(0, 4) ? dayFmt : dayYearFmt;
	return fmt.format(d);
}

export function daysUntil(dateStr: string): number {
	const a = new Date(todayStr() + 'T00:00:00Z').getTime();
	const b = new Date(dateStr + 'T00:00:00Z').getTime();
	return Math.round((b - a) / 86_400_000);
}

export function formatDateShort(dateStr: string | null): string {
	if (!dateStr) return '—';
	return shortFmt.format(new Date(dateStr + 'T12:00:00Z'));
}

/** "juil. 25" pour un YYYY-MM. */
export function formatMonth(ym: string): string {
	return monthFmt.format(new Date(ym + '-15T12:00:00Z'));
}

export function yearOf(dateStr: string | null | undefined): string {
	return dateStr ? dateStr.slice(0, 4) : '';
}
