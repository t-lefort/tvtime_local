<script lang="ts">
	import { enhance } from '$app/forms';
	import Poster from '$lib/components/Poster.svelte';
	import { formatDuration, formatMonth } from '$lib/format';

	let { data } = $props();

	const maxMonth = $derived(Math.max(1, ...data.months.map((m) => m.count)));
	const maxGenre = $derived(Math.max(1, ...data.perGenre.map((g) => g.minutes)));

	const stateChips = $derived([
		{ label: 'En cours', value: data.countsByState.watching },
		{ label: 'À jour', value: data.countsByState.uptodate },
		{ label: 'Terminées', value: data.countsByState.finished },
		{ label: 'Arrêtées', value: data.countsByState.stopped },
		{ label: 'Pas commencées', value: data.countsByState.notstarted }
	]);

	const hours = (min: number) => `${Math.round(min / 60)} h`;
</script>

<svelte:head>
	<title>Profil — TV Time local</title>
</svelte:head>

<div class="mb-4 flex items-center justify-between">
	<h1 class="text-2xl font-bold">Profil</h1>
	{#if data.authEnabled}
		<form method="POST" action="?/logout" use:enhance>
			<button class="text-sm text-mut hover:text-ink">Se déconnecter</button>
		</form>
	{/if}
</div>

<section class="rounded-2xl bg-card p-5 text-center">
	<p class="text-xs font-semibold tracking-widest text-mut uppercase">Temps devant l'écran</p>
	<p class="mt-1 text-3xl font-extrabold">{formatDuration(data.totalMinutes)}</p>
	<p class="mt-2 text-sm text-mut">
		{data.distinctEpisodes.toLocaleString('fr-FR')} épisodes ·
		{data.totalShows} séries{#if data.totalWatches > data.distinctEpisodes}
			· {(data.totalWatches - data.distinctEpisodes).toLocaleString('fr-FR')} revisionnages{/if}
	</p>
</section>

<section class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
	{#each stateChips as chip (chip.label)}
		<div class="rounded-xl bg-card px-2 py-3 text-center">
			<p class="text-lg font-bold">{chip.value}</p>
			<p class="text-[11px] text-mut">{chip.label}</p>
		</div>
	{/each}
</section>

<section class="mt-6">
	<h2 class="mb-3 text-sm font-semibold tracking-wide text-mut uppercase">Épisodes vus par mois</h2>
	<div class="rounded-2xl bg-card p-4">
		<div class="flex h-32 items-end gap-[2px]">
			{#each data.months as m (m.month)}
				<div class="group relative flex h-full flex-1 items-end">
					<div
						class="w-full rounded-t bg-brand transition-opacity group-hover:opacity-80"
						style="height: {m.count === 0 ? '0' : Math.max(3, (m.count / maxMonth) * 100) + '%'}"
					></div>
					<span
						class="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 rounded-md bg-bg px-2 py-1 text-[11px] whitespace-nowrap text-ink ring-1 ring-line group-hover:block"
					>
						{formatMonth(m.month)} · {m.count}
					</span>
				</div>
			{/each}
		</div>
		<div class="mt-2 flex gap-[2px] text-[10px] text-mut">
			{#each data.months as m, i (m.month)}
				<span class="flex-1 truncate text-center">{i % 4 === 0 ? formatMonth(m.month) : ''}</span>
			{/each}
		</div>
	</div>
</section>

{#if data.perGenre.length}
	<section class="mt-6">
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-mut uppercase">Par genre</h2>
		<div class="space-y-2.5 rounded-2xl bg-card p-4">
			{#each data.perGenre as g (g.genre)}
				<div class="flex items-center gap-3">
					<span class="w-32 shrink-0 truncate text-sm">{g.genre}</span>
					<div class="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
						<div class="h-full rounded-full bg-brand" style="width: {(g.minutes / maxGenre) * 100}%"></div>
					</div>
					<span class="w-14 shrink-0 text-right text-xs text-mut tabular-nums">{hours(g.minutes)}</span>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if data.watchedShows.length}
	<section class="mt-6">
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-mut uppercase">
			Séries vues · {data.watchedShows.length}
		</h2>
		<ul class="space-y-1.5">
			{#each data.watchedShows as show, i (show.id)}
				<li>
					<a
						href="/series/{show.id}"
						class="flex items-center gap-3 rounded-xl bg-card p-2 pr-4 transition-colors hover:bg-card-hover"
					>
						<span class="w-6 shrink-0 text-center text-xs text-mut tabular-nums">{i + 1}</span>
						<div class="h-14 w-10 shrink-0 overflow-hidden rounded-md">
							<Poster path={show.posterPath} alt="" size="w185" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold">{show.name}</p>
							<p class="text-xs text-mut">{show.watchedCount} épisodes</p>
						</div>
						<span class="shrink-0 text-sm font-medium text-mut tabular-nums">{hours(show.minutesWatched)}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
