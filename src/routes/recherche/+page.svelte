<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Poster from '$lib/components/Poster.svelte';
	import { tmdbImg, yearOf } from '$lib/format';

	let { data } = $props();
	let adding = $state<number | null>(null);
	let query = $state('');
	let searching = $state(false);
	let queuedQuery = $state('');
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	const isFilms = $derived(data.type === 'films');
	const preview = $derived(data.results[0] ?? null);
	const otherResults = $derived(data.results.slice(1));
	const companies = $derived(data.companies ?? []);
	const people = $derived(data.people ?? []);
	const hasSuggestions = $derived(isFilms && (companies.length > 0 || people.length > 0));

	const DEPARTMENT_FR: Record<string, string> = {
		Acting: 'Acteur / Actrice',
		Directing: 'Réalisation',
		Writing: 'Scénario',
		Production: 'Production',
		Sound: 'Musique / Son',
		Camera: 'Image',
		Editing: 'Montage'
	};

	$effect(() => {
		const q = data.q;
		untrack(() => {
			searching = false;
			// Si cette navigation est le résultat d'une recherche que l'on a nous-mêmes
			// déclenchée (frappe débouncée), on laisse le champ intact : sinon le trim
			// côté serveur écraserait ce que l'utilisateur vient de taper (espace en fin,
			// caractères ajoutés pendant la navigation…).
			if (q === queuedQuery) return;
			query = q;
			queuedQuery = q;
		});
	});

	function searchUrl(type = data.type, q = query) {
		const params = new URLSearchParams({ type });
		const trimmed = q.trim();
		if (trimmed) params.set('q', trimmed);
		return `/recherche?${params}`;
	}

	function resultHref(result: { tmdbId: number }): string {
		const base = isFilms ? '/films' : '/series';
		const params = data.q ? `?${new URLSearchParams({ q: data.q })}` : '';
		return `${base}/${result.tmdbId}${params}`;
	}

	function ratingLabel(value: number) {
		return value > 0 ? value.toFixed(1).replace('.', ',') : null;
	}

	function scheduleSearch(value: string) {
		query = value;
		const nextQuery = value.trim();
		queuedQuery = nextQuery;

		if (searchTimeout) clearTimeout(searchTimeout);
		if (nextQuery === data.q) {
			searching = false;
			return;
		}

		searching = Boolean(nextQuery);
		searchTimeout = setTimeout(async () => {
			await goto(searchUrl(data.type, nextQuery), {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		}, nextQuery ? 450 : 150);
	}

	function markSubmitPending() {
		if (searchTimeout) clearTimeout(searchTimeout);
		queuedQuery = query.trim();
		searching = Boolean(queuedQuery) && queuedQuery !== data.q;
	}

	function clearPendingSearch() {
		if (searchTimeout) clearTimeout(searchTimeout);
		searching = false;
	}
</script>

<svelte:head>
	<title>Recherche — TV Time local</title>
</svelte:head>

<div class="mx-auto max-w-2xl">
<h1 class="mb-4 text-2xl font-bold">Recherche</h1>

<div class="mb-4 flex gap-2">
	{#each [{ key: 'series', label: 'Séries' }, { key: 'films', label: 'Films' }] as t (t.key)}
		<a
			href={searchUrl(t.key, query)}
			data-sveltekit-replacestate
			onclick={clearPendingSearch}
			class="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors
				{data.type === t.key ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
		>
			{t.label}
		</a>
	{/each}
</div>

<form method="GET" class="mb-3" onsubmit={markSubmitPending}>
	<input type="hidden" name="type" value={data.type} />
	<input
		type="search"
		name="q"
		bind:value={query}
		oninput={(event) => scheduleSearch(event.currentTarget.value)}
		placeholder={isFilms ? "Nom d'un film…" : "Nom d'une série…"}
		autocomplete="off"
		class="w-full rounded-xl border border-line bg-card px-4 py-3 text-ink placeholder:text-mut focus:border-brand focus:outline-none"
	/>
</form>

<div class="mb-5 min-h-5 text-xs text-mut" aria-live="polite">
	{#if searching}
		Recherche de « {queuedQuery} »…
	{:else if data.q && data.results.length}
		{data.results.length} résultat{data.results.length > 1 ? 's' : ''} pour « {data.q} »
	{/if}
</div>

{#if hasSuggestions}
	<section class="mb-5 space-y-4">
		{#if companies.length}
			<div>
				<h2 class="mb-2 text-xs font-semibold tracking-wide text-mut uppercase">Sociétés de production</h2>
				<div class="flex flex-wrap gap-2">
					{#each companies as company (company.id)}
						<a
							href="/societes/{company.id}"
							class="flex items-center gap-2 rounded-full bg-card py-1.5 pr-3.5 pl-1.5 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:bg-card-hover hover:text-brand hover:ring-brand"
						>
							<span class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
								{#if company.logoPath}
									<img src={tmdbImg(company.logoPath, 'w185')} alt="" class="max-h-full max-w-full object-contain" />
								{:else}
									<span class="text-xs">🏢</span>
								{/if}
							</span>
							{company.name}
						</a>
					{/each}
				</div>
			</div>
		{/if}
		{#if people.length}
			<div>
				<h2 class="mb-2 text-xs font-semibold tracking-wide text-mut uppercase">Producteurs & personnes</h2>
				<div class="flex flex-wrap gap-2">
					{#each people as person (person.id)}
						<a
							href="/personnes/{person.id}"
							class="flex items-center gap-2 rounded-full bg-card py-1.5 pr-3.5 pl-1.5 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:bg-card-hover hover:text-brand hover:ring-brand"
						>
							<span class="h-7 w-7 shrink-0 overflow-hidden rounded-full">
								<Poster path={person.profilePath} alt="" size="w185" fallback="🎭" />
							</span>
							<span class="leading-tight">
								{person.name}
								{#if person.knownFor}<span class="text-xs font-normal text-mut"> · {DEPARTMENT_FR[person.knownFor] ?? person.knownFor}</span>{/if}
							</span>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</section>
{/if}

{#if data.error}
	<div class="rounded-xl border border-red-400/30 bg-card p-5 text-center text-sm text-red-300">
		<p>{data.error}</p>
	</div>
{:else if searching && data.results.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p>Recherche en cours…</p>
	</div>
{:else if data.q && data.results.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p>Aucun résultat pour « {data.q} ».</p>
	</div>
{:else if preview}
	{@const previewHref = resultHref(preview)}
	<section class="mb-5 overflow-hidden rounded-xl bg-card shadow-md ring-1 ring-line/70">
		<a href={previewHref} class="group block">
			<div class="relative h-30 bg-card-hover sm:h-36">
				{#if preview.backdropPath}
					<img src={tmdbImg(preview.backdropPath, 'w780')} alt="" class="h-full w-full object-cover" />
				{/if}
				<div class="absolute inset-0 bg-gradient-to-t from-card via-card/55 to-card/5"></div>
				<p class="absolute top-3 left-3 rounded-full bg-bg/70 px-2.5 py-1 text-[11px] font-semibold text-brand backdrop-blur">
					Meilleure correspondance
				</p>
			</div>
		</a>
		<div class="relative -mt-12 flex gap-3 p-3.5 pt-0 sm:gap-4">
			<a href={previewHref} class="w-22 shrink-0 self-start overflow-hidden rounded-lg shadow-lg ring-1 ring-line" style="width: 5.5rem">
				<div class="aspect-[2/3]">
					<Poster path={preview.posterPath} alt={preview.name} size="w342" fallback={isFilms ? 'film' : 'TV'} />
				</div>
			</a>
			<div class="min-w-0 flex-1 pt-10">
				<div class="flex flex-wrap items-start gap-x-2 gap-y-1">
					<h2 class="min-w-0 flex-1 text-lg leading-tight font-bold">
						<a href={previewHref} class="hover:text-brand hover:underline">{preview.name}</a>
					</h2>
					{#if preview.localId}
						<span class="rounded-full border border-brand px-2 py-0.5 text-[11px] font-semibold text-brand">Déjà ajouté</span>
					{/if}
				</div>
				<p class="mt-1 text-sm text-mut">
					{isFilms ? 'Film' : 'Série'}
					{#if yearOf(preview.date)} - {yearOf(preview.date)}{/if}
					{#if ratingLabel(preview.voteAverage)} - TMDB {ratingLabel(preview.voteAverage)}/10{/if}
				</p>
				{#if preview.originalName !== preview.name}
					<p class="mt-0.5 truncate text-xs text-mut">{preview.originalName}</p>
				{/if}
				{#if preview.overview}
					<p class="mt-2 line-clamp-4 text-sm leading-relaxed text-mut">{preview.overview}</p>
				{:else}
					<p class="mt-2 text-sm text-mut">Aucun résumé disponible pour ce résultat.</p>
				{/if}
				<div class="mt-3 flex flex-wrap items-center gap-2">
					{#if preview.localId}
						<a href={previewHref} class="rounded-full border border-brand px-3.5 py-1.5 text-sm font-semibold text-brand">
							Voir dans la bibliotheque
						</a>
					{:else}
						<form
							method="POST"
							action={isFilms ? '?/addMovie' : '?/add'}
							use:enhance={() => {
								adding = preview.tmdbId;
								return async ({ update }) => {
									await update();
									adding = null;
								};
							}}
						>
							<input type="hidden" name="tmdbId" value={preview.tmdbId} />
							<button
								disabled={adding !== null}
								class="rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
							>
								{adding === preview.tmdbId ? 'Ajout…' : isFilms ? '+ Ajouter' : '+ Suivre'}
							</button>
						</form>
						<a href={previewHref} class="rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold text-mut hover:border-mut hover:text-ink">
							Détails
						</a>
					{/if}
				</div>
			</div>
		</div>
	</section>

	{#if otherResults.length}
		<h2 class="mb-2 text-xs font-semibold tracking-wide text-mut uppercase">Autres résultats</h2>
		<ul class="space-y-2">
			{#each otherResults as result (result.tmdbId)}
				{@const href = resultHref(result)}
				<li class="flex items-center gap-3 rounded-xl bg-card p-2 pr-3">
					<a href={href} class="h-21 w-14 shrink-0 overflow-hidden rounded-md" style="height: 5.25rem">
						<Poster path={result.posterPath} alt={result.name} size="w185" fallback={isFilms ? 'film' : 'TV'} />
					</a>
					<div class="min-w-0 flex-1 py-1">
						<p class="truncate font-semibold">
							<a href={href} class="hover:text-brand hover:underline">{result.name}</a>
							{#if yearOf(result.date)}<span class="font-normal text-mut"> ({yearOf(result.date)})</span>{/if}
						</p>
						<p class="truncate text-xs text-mut">
							{#if result.originalName !== result.name}{result.originalName}{/if}
							{#if ratingLabel(result.voteAverage)}
								{result.originalName !== result.name ? ' - ' : ''}TMDB {ratingLabel(result.voteAverage)}/10
							{/if}
						</p>
						{#if result.overview}
							<p class="mt-0.5 line-clamp-2 text-xs text-mut">{result.overview}</p>
						{/if}
					</div>
					{#if result.localId}
						<a href={href} class="shrink-0 rounded-full border border-brand px-3.5 py-1.5 text-sm font-semibold text-brand">
							Voir
						</a>
					{:else}
						<form
							method="POST"
							action={isFilms ? '?/addMovie' : '?/add'}
							use:enhance={() => {
								adding = result.tmdbId;
								return async ({ update }) => {
									await update();
									adding = null;
								};
							}}
						>
							<input type="hidden" name="tmdbId" value={result.tmdbId} />
							<button
								disabled={adding !== null}
								class="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
							>
								{adding === result.tmdbId ? 'Ajout…' : isFilms ? '+ Ajouter' : '+ Suivre'}
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{:else}
	<p class="mt-10 text-center text-sm text-mut">
		Cherchez {isFilms ? 'un film' : 'une série'} pour l'ajouter à votre bibliothèque.
	</p>
{/if}

<p class="mt-8 text-center text-[11px] text-mut/70">
	Données fournies par <a href="https://www.themoviedb.org" class="underline">TMDB</a>
</p>
</div>
