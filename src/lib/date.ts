/** Retourne la date civile YYYY-MM-DD correspondant à un instant dans un fuseau IANA. */
export function dateInTimeZone(date: Date | string, timeZone: string): string {
	const instant = typeof date === 'string' ? new Date(date) : date;
	if (Number.isNaN(instant.getTime())) throw new RangeError(`Date invalide : ${date}`);

	const parts = new Intl.DateTimeFormat('en', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(instant);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value;
	return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Date civile locale du navigateur ou du processus, sans conversion UTC. */
export function localDateString(date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}
