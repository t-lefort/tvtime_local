<script lang="ts">
	import Poster from '$lib/components/Poster.svelte';
	import { tmdbImg, yearOf } from '$lib/format';

	let { data } = $props();
	const collection = $derived(data.collection);
	const collectedCount = $derived(data.movies.filter((m) => m.inLibrary).length);
</script>

<svelte:head>
	<title>{collection.name} — TV Time local</title>
</svelte:head>

<div class="relative -mx-4 -mt-5 h-44 sm:h-56">
	{#if collection.backdropPath}
		<img src={tmdbImg(collection.backdropPath, 'w780')} alt="" class="h-full w-full object-cover" />
	{:else}
		<div class="h-full w-full bg-card"></div>
	{/if}
	<div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent"></div>
	<button
		type="button"
		onclick={() => history.back()}
		class="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg/70 text-lg backdrop-blur hover:bg-bg"
		aria-label="Retour"
	>
		←
	</button>
</div>

<div class="relative -mt-16 flex items-end gap-4">
	<div class="shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-line" style="width: 6.75rem">
		<div class="aspect-[2/3]">
			<Poster path={collection.posterPath} alt={collection.name} size="w342" fallback="🎬" />
		</div>
	</div>
	<div class="min-w-0 pb-1">
		<h1 class="text-xl leading-tight font-bold">{collection.name}</h1>
		<p class="mt-1 text-sm text-mut">
			{data.movies.length} film{data.movies.length > 1 ? 's' : ''}
			{#if collectedCount}· {collectedCount} dans votre collection{/if}
		</p>
	</div>
</div>

{#if collection.overview}
	<p class="mt-4 text-sm leading-relaxed text-mut">{collection.overview}</p>
{/if}

{#if data.movies.length}
	<ul class="mt-6 grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
		{#each data.movies as movie (movie.tmdbId)}
			<li>
				<a href="/films/{movie.tmdbId}" class="group block">
					<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-line group-hover:ring-brand">
						<Poster path={movie.posterPath} alt={movie.title} size="w342" fallback="🎬" />
						<span class="absolute top-1 left-1 rounded-full bg-bg/80 px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur">
							{movie.position}
						</span>
						{#if movie.inLibrary}
							<span class="absolute top-1 right-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-ink">
								✓
							</span>
						{/if}
					</div>
					<p class="mt-1 line-clamp-2 text-xs leading-tight font-medium group-hover:text-brand">
						{movie.title}
					</p>
					<p class="text-[11px] text-mut">{yearOf(movie.date)}</p>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="mt-10 text-center text-sm text-mut">Aucun film dans cette saga.</p>
{/if}

<p class="mt-8 text-center text-[11px] text-mut/70">
	Données fournies par <a href="https://www.themoviedb.org" class="underline">TMDB</a>
</p>
