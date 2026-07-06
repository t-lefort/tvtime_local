<script lang="ts">
	import Poster from '$lib/components/Poster.svelte';
	import { formatDateShort, yearOf } from '$lib/format';
	import type { PersonCredit } from '$lib/server/tmdb';

	type CreditWithLocal = PersonCredit & { localId: number | null };

	let { data } = $props();
	const person = $derived(data.person);

	const DEPARTMENT_FR: Record<string, string> = {
		Acting: 'Interprétation',
		Directing: 'Réalisation',
		Writing: 'Scénario',
		Production: 'Production',
		Sound: 'Musique / Son',
		Camera: 'Image',
		Editing: 'Montage'
	};

	function creditHref(kind: 'films' | 'series', credit: CreditWithLocal): string {
		if (credit.localId) return `/${kind}/${credit.localId}`;
		return `/${kind}/tmdb/${credit.tmdbId}`;
	}
</script>

<svelte:head>
	<title>{person.name} — TV Time local</title>
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

<div class="flex gap-4">
	<div class="w-24 shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-line" style="width: 6rem">
		<div class="aspect-[2/3]">
			<Poster path={person.profilePath} alt={person.name} size="w342" fallback="🎭" />
		</div>
	</div>
	<div class="min-w-0 pt-1">
		<h1 class="text-xl leading-tight font-bold">{person.name}</h1>
		{#if person.knownFor}
			<p class="mt-1 text-sm text-brand">{DEPARTMENT_FR[person.knownFor] ?? person.knownFor}</p>
		{/if}
		{#if person.birthday}
			<p class="mt-1 text-xs text-mut">
				Naissance : {formatDateShort(person.birthday)}{#if person.placeOfBirth} · {person.placeOfBirth}{/if}
			</p>
		{/if}
		{#if person.deathday}
			<p class="text-xs text-mut">Décès : {formatDateShort(person.deathday)}</p>
		{/if}
	</div>
</div>

{#if person.biography}
	<p class="mt-4 line-clamp-6 text-sm leading-relaxed text-mut">{person.biography}</p>
{/if}

{#snippet grid(kind: 'films' | 'series', credits: CreditWithLocal[], fallback: string)}
	<ul class="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
		{#each credits as credit (credit.tmdbId)}
			{@const href = creditHref(kind, credit)}
			<li>
				<a href={href} class="group block">
					<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-line group-hover:ring-brand">
						<Poster path={credit.posterPath} alt={credit.title} size="w342" {fallback} />
						{#if credit.localId}
							<span class="absolute top-1 right-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-ink">
								✓
							</span>
						{/if}
					</div>
					<p class="mt-1 line-clamp-2 text-xs font-medium leading-tight group-hover:text-brand">
						{credit.title}
					</p>
					<p class="text-[11px] text-mut">
						{yearOf(credit.date)}{#if credit.role} · {credit.role}{/if}
					</p>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

{#if data.movies.length}
	<h2 class="mt-6 mb-3 text-sm font-semibold tracking-wide text-mut uppercase">
		Films ({data.movies.length})
	</h2>
	{@render grid('films', data.movies, '🎬')}
{/if}

{#if data.shows.length}
	<h2 class="mt-6 mb-3 text-sm font-semibold tracking-wide text-mut uppercase">
		Séries ({data.shows.length})
	</h2>
	{@render grid('series', data.shows, 'TV')}
{/if}

{#if !data.movies.length && !data.shows.length}
	<p class="mt-10 text-center text-sm text-mut">Aucun film ni série trouvé pour cette personne.</p>
{/if}

<p class="mt-8 text-center text-[11px] text-mut/70">
	Données fournies par <a href="https://www.themoviedb.org" class="underline">TMDB</a>
</p>
