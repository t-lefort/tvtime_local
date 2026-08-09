import { dateInTimeZone } from '$lib/date';

const DEFAULT_TIME_ZONE = 'Europe/Paris';

/** Fuseau utilisé pour décider à quel jour un épisode est disponible. */
export function appTimeZone(): string {
	const configured = process.env.APP_TIMEZONE?.trim() || process.env.TZ?.trim() || DEFAULT_TIME_ZONE;
	try {
		new Intl.DateTimeFormat('en', { timeZone: configured }).format();
		return configured;
	} catch {
		console.warn(`[dates] fuseau invalide « ${configured} », utilisation de ${DEFAULT_TIME_ZONE}`);
		return DEFAULT_TIME_ZONE;
	}
}

export function appToday(now = new Date()): string {
	return dateInTimeZone(now, appTimeZone());
}
