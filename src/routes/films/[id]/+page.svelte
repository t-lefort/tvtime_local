<script lang="ts">
	import { enhance } from '$app/forms';
	import CastList from '$lib/components/CastList.svelte';
	import Poster from '$lib/components/Poster.svelte';
	import WatchProviders from '$lib/components/WatchProviders.svelte';
	import { formatDateShort, tmdbImg, yearOf } from '$lib/format';

	let { data } = $props();
	const movie = $derived(data.movie);
	let confirmDelete = $state(false);
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
		href="/films"
		class="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg/70 text-lg backdrop-blur hover:bg-bg"
		aria-label="Retour aux films"
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

{#if movie.watchCount > 0}
	<p class="mt-4 text-sm text-mut">
		✓ Vu le {formatDateShort(movie.lastWatchedAt?.slice(0, 10) ?? null)}{movie.watchCount > 1
			? ` · ${movie.watchCount} visionnages`
			: ''}
	</p>
{/if}

<div class="mt-4 flex flex-wrap items-center gap-2">
	<form method="POST" action="?/toggle" use:enhance>
		{#if movie.watchCount > 0}
			<button class="rounded-full border border-line px-4 py-2 text-sm font-semibold text-mut hover:border-mut hover:text-ink">
				Marquer comme non vu
			</button>
		{:else}
			<button class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90">
				✓ Marquer comme vu
			</button>
		{/if}
	</form>
	{#if movie.watchCount > 0}
		<form method="POST" action="?/rewatch" use:enhance>
			<button
				class="rounded-full border border-line px-3.5 py-2 text-sm font-semibold text-mut hover:border-mut hover:text-ink"
				title="Ajouter un visionnage"
			>
				+1 visionnage
			</button>
		</form>
	{/if}
	<form method="POST" action="?/favorite" use:enhance>
		<button
			class="rounded-full border px-3.5 py-2 text-sm font-semibold {movie.favorite
				? 'border-brand text-brand'
				: 'border-line text-mut hover:border-mut hover:text-ink'}"
			title={movie.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
		>
			{movie.favorite ? '★ Favori' : '☆ Favori'}
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
			<form method="POST" action="?/remove" use:enhance class="flex items-center gap-2">
				<button class="rounded-full bg-red-500/90 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-500">
					Confirmer la suppression
				</button>
				<button type="button" class="text-sm text-mut" onclick={() => (confirmDelete = false)}>Annuler</button>
			</form>
		{:else}
			<button
				type="button"
				class="rounded-full border border-line px-3.5 py-2 text-sm text-mut hover:border-red-400 hover:text-red-400"
				title="Supprimer le film et son historique"
				onclick={() => (confirmDelete = true)}
			>
				🗑
			</button>
		{/if}
	</div>
</div>

{#if movie.overview}
	<p class="mt-4 text-sm leading-relaxed text-mut">{movie.overview}</p>
{/if}

<CastList cast={movie.cast} />

<WatchProviders providers={movie.providers} />
