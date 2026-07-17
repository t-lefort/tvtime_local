<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import CastList from '$lib/components/CastList.svelte';
	import Poster from '$lib/components/Poster.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import Rating from '$lib/components/Rating.svelte';
	import WatchProviders from '$lib/components/WatchProviders.svelte';
	import { formatDateShort, tmdbImg, yearOf } from '$lib/format';

	let { data } = $props();
	const show = $derived(data.show);
	let confirmDelete = $state(false);
	let adding = $state(false);

	const STATUS_FR: Record<string, string> = {
		'Returning Series': 'En production',
		'In Production': 'En production',
		Planned: 'Annoncée',
		Pilot: 'Pilote',
		Ended: 'Terminée',
		Canceled: 'Annulée'
	};

	const remaining = $derived(show.airedCount - show.watchedCount);
</script>

<svelte:head>
	<title>{show.name} — TV Time local</title>
</svelte:head>

<div class="relative -mx-4 -mt-5 h-52 sm:h-64 lg:h-72">
	{#if show.backdropPath}
		<img src={tmdbImg(show.backdropPath, 'w780')} alt="" class="h-full w-full object-cover object-top" />
	{:else}
		<div class="h-full w-full bg-card"></div>
	{/if}
	<div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent"></div>
	<BackButton
		fallback={data.backHref}
		class="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg/70 text-lg backdrop-blur hover:bg-bg"
	/>
</div>

<div class="relative -mt-16 flex items-end gap-4">
	<div class="w-27 shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-line" style="width: 6.75rem">
		<div class="aspect-[2/3]">
			<Poster path={show.posterPath} alt={show.name} size="w342" />
		</div>
	</div>
	<div class="min-w-0 pb-1">
		<h1 class="text-xl leading-tight font-bold">{show.name}</h1>
		<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mut">
			<span>
			{yearOf(show.firstAirDate)}
			{#if show.tmdbStatus}· {STATUS_FR[show.tmdbStatus] ?? show.tmdbStatus}{/if}
			{#if show.archived}· <span class="text-brand">Arrêtée</span>{/if}
			</span>
			<Rating value={show.voteAverage} />
		</p>
		{#if show.genres.length}
			<p class="mt-0.5 truncate text-xs text-mut">
				{#each show.genres as genre, i (genre)}{#if i > 0} · {/if}<a
						href="/genres/{encodeURIComponent(genre)}"
						class="hover:text-brand hover:underline"
						title="Explorer le genre {genre}">{genre}</a
					>{/each}
			</p>
		{/if}
	</div>
</div>

{#if data.inLibrary}
	<div class="mt-4">
		<ProgressBar value={show.watchedCount} max={show.airedCount} />
		<p class="mt-1.5 text-sm text-mut">
			{show.watchedCount}/{show.airedCount} épisodes vus
			{#if remaining > 0}
				· <span class="text-ink">reste {remaining}</span>
			{:else if show.airedCount > 0}
				· à jour ✓
			{/if}
		</p>
	</div>
{:else}
	<div class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mut">
		{#if show.numberOfEpisodes}
			<span>{show.numberOfEpisodes} épisode{show.numberOfEpisodes > 1 ? 's' : ''}</span>
		{/if}
		{#if show.numberOfSeasons}
			<span>{show.numberOfSeasons} saison{show.numberOfSeasons > 1 ? 's' : ''}</span>
		{/if}
		{#if show.episodeRunTime}
			<span>{show.episodeRunTime} min par épisode</span>
		{/if}
		{#if show.networks.length}
			<span>{show.networks.join(' · ')}</span>
		{/if}
	</div>
{/if}

<div class="mt-4 flex flex-wrap items-center gap-2">
	{#if data.inLibrary}
		<form method="POST" action="?/archive" use:enhance>
			{#if show.archived}
				<button class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90">
					▶ Reprendre la série
				</button>
			{:else}
				<button class="rounded-full border border-line px-4 py-2 text-sm font-semibold text-mut hover:border-mut hover:text-ink">
					Arrêter la série
				</button>
			{/if}
		</form>
		<form method="POST" action="?/favorite" use:enhance>
			<button
				class="rounded-full border px-3.5 py-2 text-sm font-semibold {show.favorite
					? 'border-brand text-brand'
					: 'border-line text-mut hover:border-mut hover:text-ink'}"
				title={show.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
			>
				{show.favorite ? '★ Favori' : '☆ Favori'}
			</button>
		</form>
		<form method="POST" action="?/refresh" use:enhance>
			<button
				class="rounded-full border border-line px-3.5 py-2 text-sm text-mut hover:border-mut hover:text-ink"
				title="Rafraîchir depuis TMDB"
			>
				↻
			</button>
		</form>
		<div class="ml-auto">
			{#if confirmDelete}
				<form method="POST" action="?/unfollow" use:enhance class="flex items-center gap-2">
					<button class="rounded-full bg-red-500/90 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-500">
						Confirmer la suppression
					</button>
					<button type="button" class="text-sm text-mut" onclick={() => (confirmDelete = false)}>Annuler</button>
				</form>
			{:else}
				<button
					type="button"
					class="rounded-full border border-line px-3.5 py-2 text-sm text-mut hover:border-red-400 hover:text-red-400"
					title="Supprimer la série et son historique"
					onclick={() => (confirmDelete = true)}
				>
					🗑
				</button>
			{/if}
		</div>
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

{#if show.overview}
	<p class="mt-4 text-sm leading-relaxed text-mut">{show.overview}</p>
{/if}

<CastList cast={show.cast} />

<WatchProviders providers={show.providers} />

{#if data.inLibrary}
	<div class="mt-6 space-y-3">
		{#each data.seasons as season (season.number)}
			<details class="group overflow-hidden rounded-xl bg-card" open={season.number === data.openSeason}>
				<summary class="flex cursor-pointer list-none items-center gap-3 p-3.5 select-none [&::-webkit-details-marker]:hidden">
					<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-mut transition-transform group-open:rotate-90" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M9 6l6 6-6 6" />
					</svg>
					<span class="font-semibold">{season.number === 0 ? 'Spéciaux' : `Saison ${season.number}`}</span>
					<span class="text-xs text-mut">{season.watched}/{season.episodes.length}</span>
					<div class="ml-auto w-20 sm:w-28">
						<ProgressBar value={season.watched} max={season.episodes.length} />
					</div>
				</summary>
				<div class="border-t border-line/70">
					{#if season.watched < season.episodes.filter((e) => e.airDate && e.airDate <= data.today).length}
						<div class="flex justify-end px-3 pt-2">
							<form method="POST" action="?/season" use:enhance>
								<input type="hidden" name="seasonNumber" value={season.number} />
								<button class="text-xs font-medium text-brand hover:underline">Tout marquer comme vu</button>
							</form>
						</div>
					{/if}
					<ul class="divide-y divide-line/50">
						{#each season.episodes as ep (ep.id)}
							{@const aired = Boolean(ep.airDate && ep.airDate <= data.today)}
							<li class="flex items-center gap-3 px-3.5 py-2.5 {aired ? '' : 'opacity-50'}">
								<span class="w-6 shrink-0 text-right text-sm text-mut tabular-nums">{ep.episodeNumber}</span>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm {ep.watchCount ? 'text-mut' : 'font-medium'}">
										{ep.name || `Épisode ${ep.episodeNumber}`}
									</p>
									<p class="text-xs text-mut">
										{formatDateShort(ep.airDate)}{ep.runtime ? ` · ${ep.runtime} min` : ''}{ep.watchCount > 1 ? ` · vu ${ep.watchCount}×` : ''}
									</p>
								</div>
								{#if !ep.watchCount && aired && season.number > 0}
									<form method="POST" action="?/until" use:enhance>
										<input type="hidden" name="seasonNumber" value={ep.seasonNumber} />
										<input type="hidden" name="episodeNumber" value={ep.episodeNumber} />
										<button
											class="flex h-8 w-8 items-center justify-center rounded-full text-mut/60 hover:bg-card-hover hover:text-brand"
											title="Marquer comme vu jusqu'ici"
											aria-label="Marquer comme vu jusqu'à l'épisode {ep.episodeNumber}"
										>
											<svg viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M2 12.5l4.5 4.5L16 7.5" /><path d="M12 16.5l2 1.5L22.5 8.5" />
											</svg>
										</button>
									</form>
								{/if}
								<form method="POST" action="?/toggle" use:enhance>
									<input type="hidden" name="episodeId" value={ep.id} />
									<button
										class="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors {ep.watchCount
											? 'border-brand bg-brand text-brand-ink'
											: 'border-line text-mut hover:border-brand hover:text-brand'}"
										title={ep.watchCount ? 'Marquer comme non vu' : 'Marquer comme vu'}
										aria-label="{ep.watchCount ? 'Marquer comme non vu' : 'Marquer comme vu'} : épisode {ep.episodeNumber}"
									>
										<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
											<path d="M4 12.5l5 5L20 6.5" />
										</svg>
									</button>
								</form>
							</li>
						{/each}
					</ul>
				</div>
			</details>
		{/each}
	</div>
{/if}
