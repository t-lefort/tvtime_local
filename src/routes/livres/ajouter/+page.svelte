<script lang="ts">
	import { goto } from '$app/navigation';
	import BackButton from '$lib/components/BackButton.svelte';
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	let { data, form } = $props();
	let query = $state('');
	let manual = $state(false);
	$effect(() => {
		query = data.q;
	});
	function detected(isbn: string) {
		query = isbn;
		goto(`/livres/ajouter?q=${isbn}`);
	}
</script>

<svelte:head><title>Ajouter un livre — TV Time local</title></svelte:head>

<div class="mb-4 flex items-center gap-3"><BackButton fallback="/livres" class="flex h-9 w-9 items-center justify-center rounded-full bg-card" /><h1 class="text-2xl font-bold">Ajouter un livre</h1></div>

<BarcodeScanner onDetected={detected} />

<form method="GET" class="mt-4 flex gap-2">
	<input name="q" bind:value={query} placeholder="ISBN, titre ou auteur…" class="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-3 focus:border-brand focus:outline-none" />
	<button class="rounded-full bg-brand px-4 text-sm font-semibold text-brand-ink">Rechercher</button>
</form>

{#if data.error}<p class="mt-4 text-sm text-red-400">{data.error}</p>{/if}
{#if form?.error}<p class="mt-4 text-sm text-red-400">{form.error}</p>{/if}

{#if data.q && data.results.length === 0 && !data.error}
	<div class="mt-5 rounded-xl bg-card p-5 text-center text-mut"><p>Aucun résultat pour « {data.q} ».</p><button class="mt-2 text-brand underline" onclick={() => (manual = true)}>Ajouter les informations manuellement</button></div>
{:else if data.results.length}
	<ul class="mt-5 space-y-2">
		{#each data.results as result (result.sourceId)}
			<li class="flex items-center gap-3 rounded-xl bg-card p-2 pr-3">
				<div class="h-24 w-16 shrink-0 overflow-hidden rounded-md"><BookCover url={result.coverUrl} alt={result.title} /></div>
				<div class="min-w-0 flex-1"><p class="font-semibold">{result.title}</p>{#if result.description}<p class="mt-1 line-clamp-2 text-xs text-mut">{result.description}</p>{/if}</div>
				<form method="POST" action="?/add"><input type="hidden" name="sourceId" value={result.sourceId} /><button class="rounded-full bg-brand px-3.5 py-2 text-sm font-semibold text-brand-ink">Ajouter</button></form>
			</li>
		{/each}
	</ul>
{/if}

<button class="mt-6 text-sm text-mut underline" onclick={() => (manual = !manual)}>Ajout manuel</button>
{#if manual}
	<form method="POST" action="?/manual" class="mt-3 grid gap-3 rounded-2xl bg-card p-4 sm:grid-cols-2">
		<label class="text-xs text-mut">Titre *<input name="title" required class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
		<label class="text-xs text-mut">ISBN<input name="isbn" value={/^\d+$/.test(data.q) ? data.q : ''} class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
		<label class="text-xs text-mut">Auteurs<input name="authors" placeholder="Séparés par des virgules" class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
		<label class="text-xs text-mut">Éditeur<input name="publisher" class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
		<label class="text-xs text-mut">Série<input name="seriesTitle" class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
		<label class="text-xs text-mut">Tome<input name="volume" class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
		<label class="text-xs text-mut">Date de publication<input name="publishDate" type="date" class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
		<button class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink sm:col-span-2">Ajouter à ma bibliothèque</button>
	</form>
{/if}

<p class="mt-8 text-center text-[11px] text-mut/70">Données : Inventaire, BnF, Open Library et Google Books si configuré.</p>
