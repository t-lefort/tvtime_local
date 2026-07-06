<script lang="ts">
	import { enhance } from '$app/forms';
	import CastList from '$lib/components/CastList.svelte';
	import Poster from '$lib/components/Poster.svelte';
	import WatchProviders from '$lib/components/WatchProviders.svelte';
	import { tmdbImg, yearOf } from '$lib/format';

	let { data } = $props();
	const movie = $derived(data.movie);
	let adding = $state(false);
</script>

<svelte:head>
	<title>{movie.title} — TV Time local</title>
</svelte:head>

<div class="relative -mx-4 -mt-5 h-44 sm:h-56">
	{#if movie.backdropPath}
		<img src={tmdbImg(movie.backdropPath, 'w780')} alt="" class="h-full w-full object-cover" />
	{:else}
		<div class="h-full w-full bg-card"></div>
	{/if}
	<div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent"></div>
	<a
		href={data.backHref}
		class="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg/70 text-lg backdrop-blur hover:bg-bg"
		aria-label="Retour à la recherche"
	>
		←
	</a>
</div>

<div class="relative -mt-16 flex items-end gap-4">
	<div class="w-27 shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-line" style="width: 6.75rem">
		<div class="aspect-[2/3]">
			<Poster path={movie.posterPath} alt={movie.title} size="w342" fallback="🎬" />
		</div>
	</div>
	<div class="min-w-0 pb-1">
		<h1 class="text-xl leading-tight font-bold">{movie.title}</h1>
		<p class="mt-1 text-sm text-mut">
			{yearOf(movie.releaseDate)}
			{#if movie.runtime}· {movie.runtime} min{/if}
		</p>
		{#if movie.genres.length}
			<p class="mt-0.5 truncate text-xs text-mut">{movie.genres.join(' · ')}</p>
		{/if}
	</div>
</div>

<div class="mt-4 flex flex-wrap items-center gap-2">
	{#if data.localId}
		<a
			href="/films/{data.localId}"
			class="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand"
		>
			Voir dans mes films
		</a>
	{:else}
		<form
			method="POST"
			action="?/addMovie"
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
				{adding ? 'Ajout…' : '+ Ajouter'}
			</button>
		</form>
	{/if}
</div>

{#if movie.overview}
	<p class="mt-4 text-sm leading-relaxed text-mut">{movie.overview}</p>
{/if}

<CastList cast={movie.cast} />

<WatchProviders providers={movie.providers} />
