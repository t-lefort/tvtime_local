<script lang="ts">
	import Poster from '$lib/components/Poster.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { yearOf } from '$lib/format';

	let { data } = $props();
	const total = $derived(data.shows.length + data.movies.length);
</script>

<svelte:head>
	<title>{data.genre} — TV Time local</title>
</svelte:head>

<div class="-mt-1 mb-4">
	<button
		type="button"
		onclick={() => history.back()}
		class="flex h-9 w-9 items-center justify-center rounded-full bg-card text-lg text-mut hover:bg-card-hover hover:text-ink"
		aria-label="Retour"
	>
		←
	</button>
</div>

<h1 class="text-2xl font-bold">{data.genre}</h1>
<p class="mt-1 text-sm text-mut">
	{total} média{total > 1 ? 's' : ''} de votre bibliothèque
</p>

{#if data.shows.length}
	<h2 class="mt-6 mb-3 text-sm font-semibold tracking-wide text-mut uppercase">
		Séries ({data.shows.length})
	</h2>
	<div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
		{#each data.shows as show (show.tmdbId)}
			<a href="/series/{show.tmdbId}" class="group">
				<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card shadow-md">
					<div class="h-full w-full {show.state === 'stopped' ? 'opacity-40 grayscale' : ''}">
						<Poster path={show.posterPath} alt={show.name} size="w342" />
					</div>
					{#if show.favorite}
						<span class="absolute top-1.5 right-1.5 rounded-full bg-bg/70 px-1.5 py-0.5 text-xs">⭐</span>
					{/if}
					{#if show.watchedCount > 0}
						<div class="absolute inset-x-0 bottom-0">
							<ProgressBar value={show.watchedCount} max={show.airedCount} />
						</div>
					{/if}
				</div>
				<p class="mt-1.5 truncate text-sm font-medium group-hover:text-brand">{show.name}</p>
				<p class="text-xs text-mut">
					{#if show.state === 'notstarted'}
						{show.airedCount} épisodes
					{:else}
						{show.watchedCount}/{show.airedCount}
					{/if}
				</p>
			</a>
		{/each}
	</div>
{/if}

{#if data.movies.length}
	<h2 class="mt-6 mb-3 text-sm font-semibold tracking-wide text-mut uppercase">
		Films ({data.movies.length})
	</h2>
	<div class="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
		{#each data.movies as movie (movie.tmdbId)}
			<a href="/films/{movie.tmdbId}" class="group block">
				<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-line group-hover:ring-brand">
					<Poster path={movie.posterPath} alt={movie.title} size="w342" fallback="🎬" />
					{#if movie.favorite}
						<span class="absolute top-1.5 right-1.5 rounded-full bg-bg/70 px-1.5 py-0.5 text-xs">⭐</span>
					{/if}
					{#if movie.watchCount > 0}
						<span class="absolute top-1 left-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-ink">
							✓
						</span>
					{/if}
				</div>
				<p class="mt-1 line-clamp-2 text-xs font-medium leading-tight group-hover:text-brand">
					{movie.title}
				</p>
				<p class="text-[11px] text-mut">{yearOf(movie.releaseDate)}</p>
			</a>
		{/each}
	</div>
{/if}
