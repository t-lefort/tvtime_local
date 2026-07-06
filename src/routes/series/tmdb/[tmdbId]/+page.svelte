<script lang="ts">
	import { enhance } from '$app/forms';
	import Poster from '$lib/components/Poster.svelte';
	import WatchProviders from '$lib/components/WatchProviders.svelte';
	import { tmdbImg, yearOf } from '$lib/format';

	let { data } = $props();
	const show = $derived(data.show);
	let adding = $state(false);

	const STATUS_FR: Record<string, string> = {
		'Returning Series': 'En production',
		'In Production': 'En production',
		Planned: 'Annoncée',
		Pilot: 'Pilote',
		Ended: 'Terminée',
		Canceled: 'Annulée'
	};
</script>

<svelte:head>
	<title>{show.name} - TV Time local</title>
</svelte:head>

<div class="relative -mx-4 -mt-5 h-44 sm:h-56">
	{#if show.backdropPath}
		<img src={tmdbImg(show.backdropPath, 'w780')} alt="" class="h-full w-full object-cover" />
	{:else}
		<div class="h-full w-full bg-card"></div>
	{/if}
	<div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent"></div>
	<a
		href={data.backHref}
		class="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg/70 text-lg backdrop-blur hover:bg-bg"
		aria-label="Retour à la recherche"
	>
		&larr;
	</a>
</div>

<div class="relative -mt-16 flex items-end gap-4">
	<div class="w-27 shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-line" style="width: 6.75rem">
		<div class="aspect-[2/3]">
			<Poster path={show.posterPath} alt={show.name} size="w342" fallback="TV" />
		</div>
	</div>
	<div class="min-w-0 pb-1">
		<h1 class="text-xl leading-tight font-bold">{show.name}</h1>
		<p class="mt-1 text-sm text-mut">
			{yearOf(show.firstAirDate)}
			{#if show.status} - {STATUS_FR[show.status] ?? show.status}{/if}
			{#if show.numberOfSeasons} - {show.numberOfSeasons} saison{show.numberOfSeasons > 1 ? 's' : ''}{/if}
		</p>
		{#if show.genres.length}
			<p class="mt-0.5 truncate text-xs text-mut">{show.genres.join(' - ')}</p>
		{/if}
	</div>
</div>

<div class="mt-4 flex flex-wrap items-center gap-2">
	{#if data.localId}
		<a href="/series/{data.localId}" class="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand">
			Voir dans mes séries
		</a>
	{:else}
		<form
			method="POST"
			action="?/add"
			use:enhance={() => {
				adding = true;
				return async ({ update }) => {
					await update();
					adding = false;
				};
			}}
		>
			<button
				disabled={adding}
				class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
			>
				{adding ? 'Ajout…' : '+ Suivre'}
			</button>
		</form>
	{/if}
</div>

<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mut">
	{#if show.numberOfEpisodes}
		<span>{show.numberOfEpisodes} épisode{show.numberOfEpisodes > 1 ? 's' : ''}</span>
	{/if}
	{#if show.episodeRunTime}
		<span>{show.episodeRunTime} min par épisode</span>
	{/if}
	{#if show.networks.length}
		<span>{show.networks.join(' - ')}</span>
	{/if}
</div>

{#if show.overview}
	<p class="mt-4 text-sm leading-relaxed text-mut">{show.overview}</p>
{/if}

<WatchProviders providers={show.providers} />
