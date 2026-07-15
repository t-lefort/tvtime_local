<script lang="ts">
	import { enhance } from '$app/forms';
	import CastList from '$lib/components/CastList.svelte';
	import Poster from '$lib/components/Poster.svelte';
	import WatchProviders from '$lib/components/WatchProviders.svelte';
	import { formatDateShort, tmdbImg, yearOf } from '$lib/format';

	let { data } = $props();
	const movie = $derived(data.movie);
	let confirmDelete = $state(false);
	let adding = $state(false);

	/** Équipe groupée par poste, dans l'ordre réalisation puis production. */
	const crewGroups = $derived(
		[
			{ label: 'Réalisation', people: movie.crew.filter((m) => m.job === 'Director') },
			{ label: 'Production', people: movie.crew.filter((m) => m.job === 'Producer') }
		].filter((g) => g.people.length)
	);
</script>

<svelte:head>
	<title>{movie.title} — TV Time local</title>
</svelte:head>

<div class="relative -mx-4 -mt-5 h-52 sm:h-64 lg:h-72">
	{#if movie.backdropPath}
		<img src={tmdbImg(movie.backdropPath, 'w780')} alt="" class="h-full w-full object-cover object-top" />
	{:else}
		<div class="h-full w-full bg-card"></div>
	{/if}
	<div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent"></div>
	<a
		href={data.backHref}
		class="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg/70 text-lg backdrop-blur hover:bg-bg"
		aria-label="Retour"
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
	{#if data.inLibrary}
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
				{adding ? 'Ajout…' : '+ Ajouter'}
			</button>
		</form>
	{/if}
</div>

{#if movie.overview}
	<p class="mt-4 text-sm leading-relaxed text-mut">{movie.overview}</p>
{/if}

{#if crewGroups.length || movie.companies.length}
	<section class="mt-4 space-y-1 text-sm">
		{#each crewGroups as group (group.label)}
			<p>
				<span class="text-mut">{group.label} :</span>
				{#each group.people as person, i (person.id)}{#if i > 0},
					{/if}<a
						href="/personnes/{person.id}"
						class="font-medium hover:text-brand hover:underline"
						title="Voir la filmographie de {person.name}">{person.name}</a
					>{/each}
			</p>
		{/each}
		{#if movie.companies.length}
			<p>
				<span class="text-mut">Sociétés de production :</span>
				{#each movie.companies as company, i (company.id)}{#if i > 0},
					{/if}<a
						href="/societes/{company.id}"
						class="font-medium hover:text-brand hover:underline"
						title="Voir les films de {company.name}">{company.name}</a
					>{/each}
			</p>
		{/if}
	</section>
{/if}

<CastList cast={movie.cast} />

<WatchProviders providers={movie.providers} />
