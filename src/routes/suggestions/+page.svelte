<script lang="ts">
	import { enhance } from '$app/forms';
	import Poster from '$lib/components/Poster.svelte';
	import { tmdbImg, yearOf } from '$lib/format';

	/** Logos de plateformes affichés sur une ligne avant de résumer par « +n ». */
	const MAX_ROW_PLATFORMS = 4;

	let { data } = $props();

	let tab: 'series' | 'films' = $state('series');
	let adding = $state<number | null>(null);
	/** Plateforme de streaming sélectionnée (null = toutes), conservée entre les onglets. */
	let platform = $state<string | null>(null);

	const isFilms = $derived.by(() => tab === 'films');
	const all = $derived.by(() => (isFilms ? data.films : data.series));
	const platforms = $derived.by(() => (isFilms ? data.platforms.films : data.platforms.series));
	const items = $derived.by(() =>
		platform === null ? all : all.filter((i) => i.platforms.some((p) => p.name === platform))
	);

	/** Nombre de suggestions d'un onglet sous le filtre courant, pour le badge. */
	function tabCount(key: 'series' | 'films') {
		const list = key === 'films' ? data.films : data.series;
		if (platform === null) return list.length;
		const options = key === 'films' ? data.platforms.films : data.platforms.series;
		return options.find((p) => p.name === platform)?.count ?? 0;
	}

	function ratingLabel(value: number) {
		return value > 0 ? value.toFixed(1).replace('.', ',') : null;
	}
</script>

<svelte:head>
	<title>Pour vous — TV Time local</title>
</svelte:head>

<h1 class="mb-1 text-2xl font-bold">Pour vous</h1>
<p class="mb-4 text-sm text-mut">
	Suggestions d'après vos notes, vos favoris, vos visionnages et les notes TMDB.
</p>

<div class="mb-4 flex border-b border-line" role="tablist">
	{#each [{ key: 'series' as const, label: 'Séries' }, { key: 'films' as const, label: 'Films' }] as t (t.key)}
		{@const count = tabCount(t.key)}
		<button
			role="tab"
			aria-selected={tab === t.key}
			class="flex-1 border-b-2 pb-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-8
				{tab === t.key ? 'border-brand text-brand' : 'border-transparent text-mut'}"
			onclick={() => (tab = t.key)}
		>
			{t.label}
			{#if count}<span class="ml-1 rounded-full bg-card px-2 py-0.5 text-xs">{count}</span>{/if}
		</button>
	{/each}
</div>

{#if platforms.length || platform !== null}
	<div class="mb-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
		<button
			class="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors
				{platform === null ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
			onclick={() => (platform = null)}
		>
			Toutes les plateformes
		</button>
		{#each platforms as p (p.name)}
			<button
				class="flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-xs font-semibold transition-colors
					{platform === p.name ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
				onclick={() => (platform = platform === p.name ? null : p.name)}
			>
				{#if p.logoPath}
					<img src={tmdbImg(p.logoPath, 'w92')} alt="" loading="lazy" class="h-5 w-5 rounded-md" />
				{:else}
					<span class="flex h-5 w-5 items-center justify-center rounded-md bg-card-hover">▶</span>
				{/if}
				{p.name}
				<span class="opacity-70">{p.count}</span>
			</button>
		{/each}
	</div>
{/if}

{#if data.error}
	<div class="rounded-xl border border-red-400/30 bg-card p-5 text-center text-sm text-red-300">
		<p>{data.error}</p>
	</div>
{:else if all.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-1 text-3xl">✨</p>
		<p>
			Pas encore de suggestions : {isFilms
				? 'ajoutez des films et marquez-les comme vus'
				: 'suivez des séries et marquez des épisodes comme vus'} pour en recevoir.
		</p>
	</div>
{:else if items.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-1 text-3xl">📺</p>
		<p class="mb-3">
			Aucune suggestion de {isFilms ? 'film' : 'série'} sur {platform} pour le moment.
		</p>
		<button class="text-sm font-semibold text-brand hover:underline" onclick={() => (platform = null)}>
			Voir toutes les plateformes
		</button>
	</div>
{:else}
	<ul class="space-y-2">
		{#each items as item (item.tmdbId)}
			{@const href = `${isFilms ? '/films' : '/series'}/${item.tmdbId}`}
			<li class="flex items-center gap-3 rounded-xl bg-card p-2 pr-3">
				<a {href} class="w-14 shrink-0 overflow-hidden rounded-md" style="height: 5.25rem">
					<Poster path={item.posterPath} alt={item.name} size="w185" fallback={isFilms ? 'film' : 'TV'} />
				</a>
				<div class="min-w-0 flex-1 py-1">
					<p class="truncate font-semibold">
						<a {href} class="hover:text-brand hover:underline">{item.name}</a>
						{#if yearOf(item.date)}<span class="font-normal text-mut"> ({yearOf(item.date)})</span>{/if}
					</p>
					<p class="truncate text-xs text-mut">
						{#if item.originalName !== item.name}{item.originalName}{/if}
						{#if ratingLabel(item.voteAverage)}
							{item.originalName !== item.name ? ' - ' : ''}TMDB {ratingLabel(item.voteAverage)}/10
						{/if}
					</p>
					{#if item.because.length}
						<p class="mt-0.5 truncate text-xs text-brand">
							Parce que vous avez regardé {item.because.join(' et ')}
						</p>
					{/if}
					{#if item.overview}
						<p class="mt-0.5 line-clamp-2 text-xs text-mut">{item.overview}</p>
					{/if}
					{#if item.platforms.length}
						<div class="mt-1 flex items-center gap-1">
							{#each item.platforms.slice(0, MAX_ROW_PLATFORMS) as p (p.name)}
								{#if p.logoPath}
									<img
										src={tmdbImg(p.logoPath, 'w92')}
										alt={p.name}
										title={p.name}
										loading="lazy"
										class="h-4 w-4 rounded"
									/>
								{/if}
							{/each}
							{#if item.platforms.length > MAX_ROW_PLATFORMS}
								<span class="text-[11px] text-mut">+{item.platforms.length - MAX_ROW_PLATFORMS}</span>
							{/if}
						</div>
					{/if}
				</div>
				<form
					method="POST"
					action={isFilms ? '?/addMovie' : '?/add'}
					use:enhance={() => {
						adding = item.tmdbId;
						return async ({ update }) => {
							await update();
							adding = null;
						};
					}}
				>
					<input type="hidden" name="tmdbId" value={item.tmdbId} />
					<button
						disabled={adding !== null}
						class="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
					>
						{adding === item.tmdbId ? 'Ajout…' : isFilms ? '+ Ajouter' : '+ Suivre'}
					</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<p class="mt-8 text-center text-[11px] text-mut/70">
	Données fournies par <a href="https://www.themoviedb.org" class="underline">TMDB</a>
</p>
