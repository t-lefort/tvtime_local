<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	let { data, form } = $props();
	let editing = $state(false);
	let deleting = $state(false);
	const book = $derived(data.book);
	const statusLabels: Record<string, string> = { unread: 'À lire', reading: 'En cours', read: 'Lu' };
</script>

<svelte:head><title>{book.title} — TV Time local</title></svelte:head>

<BackButton fallback="/livres" class="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-card" />

<div class="flex items-start gap-4">
	<div class="w-28 shrink-0 overflow-hidden rounded-lg shadow-lg"><div class="aspect-[2/3]"><BookCover url={book.coverUrl} alt={book.title} /></div></div>
	<div class="min-w-0 flex-1">
		<h1 class="text-xl leading-tight font-bold">{book.title}</h1>
		{#if book.subtitle}<p class="mt-1 text-sm text-mut">{book.subtitle}</p>{/if}
		<p class="mt-2 text-sm">{book.authors.join(', ') || 'Auteur inconnu'}</p>
		{#if book.seriesTitle}<p class="mt-1 text-sm text-mut">{book.seriesTitle}{book.volume ? ` · tome ${book.volume}` : ''}</p>{/if}
		<p class="mt-1 text-xs text-mut">{[book.publisher, book.publishDate, book.pageCount ? `${book.pageCount} pages` : null].filter(Boolean).join(' · ')}</p>
		{#if book.isbn13}<p class="mt-1 font-mono text-xs text-mut">ISBN {book.isbn13}</p>{/if}
	</div>
</div>

<div class="mt-5 flex flex-wrap gap-2">
	{#each ['unread', 'reading', 'read'] as status}
		<form method="POST" action="?/status" use:enhance>
			<input type="hidden" name="status" value={status} />
			<button class="rounded-full px-3.5 py-2 text-sm font-semibold {book.readingStatus === status ? 'bg-brand text-brand-ink' : 'border border-line text-mut'}">{statusLabels[status]}</button>
		</form>
	{/each}
</div>

<div class="mt-3 flex flex-wrap gap-2">
	<form method="POST" action="?/flags" use:enhance>
		<input type="hidden" name="inCollection" value={book.inCollection ? '0' : '1'} />
		<input type="hidden" name="wishlist" value={book.wishlist ? '1' : '0'} />
		<input type="hidden" name="favorite" value={book.favorite ? '1' : '0'} />
		<button class="rounded-full border border-line px-3.5 py-2 text-sm">{book.inCollection ? '✓ Dans ma collection' : '+ Collection'}</button>
	</form>
	<form method="POST" action="?/flags" use:enhance>
		<input type="hidden" name="inCollection" value={book.inCollection ? '1' : '0'} />
		<input type="hidden" name="wishlist" value={book.wishlist ? '0' : '1'} />
		<input type="hidden" name="favorite" value={book.favorite ? '1' : '0'} />
		<button class="rounded-full border border-line px-3.5 py-2 text-sm">{book.wishlist ? '♥ Envie' : '♡ Envie'}</button>
	</form>
	<form method="POST" action="?/flags" use:enhance>
		<input type="hidden" name="inCollection" value={book.inCollection ? '1' : '0'} />
		<input type="hidden" name="wishlist" value={book.wishlist ? '1' : '0'} />
		<input type="hidden" name="favorite" value={book.favorite ? '0' : '1'} />
		<button class="rounded-full border border-line px-3.5 py-2 text-sm">{book.favorite ? '★ Favori' : '☆ Favori'}</button>
	</form>
</div>

{#if book.description}<p class="mt-5 text-sm leading-relaxed text-mut">{book.description}</p>{/if}

<section class="mt-6 rounded-2xl bg-card p-4">
	<h2 class="mb-3 font-semibold">Lecture et prêt</h2>
	<form method="POST" action="?/rate" use:enhance class="space-y-2">
		<div class="flex gap-2"><input name="rating" type="number" min="1" max="10" value={book.rating ?? ''} placeholder="Note /10" class="w-28 rounded-lg border border-line bg-bg px-3 py-2" /><input name="review" value={book.review ?? ''} placeholder="Mon avis" class="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2" /><button class="rounded-full bg-brand px-4 text-sm font-semibold text-brand-ink">Enregistrer</button></div>
	</form>
	<form method="POST" action="?/loan" use:enhance class="mt-3 flex gap-2">
		<input name="loanedTo" value={book.loanedTo ?? ''} placeholder="Prêté à…" class="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2" />
		<button class="rounded-full border border-line px-4 text-sm">{book.loanedTo ? 'Modifier' : 'Noter le prêt'}</button>
	</form>
</section>

<section class="mt-6">
	<button class="text-sm text-mut underline" onclick={() => (editing = !editing)}>Corriger les informations</button>
	{#if editing}
		<form method="POST" action="?/edit" use:enhance class="mt-3 grid gap-3 rounded-2xl bg-card p-4 sm:grid-cols-2">
			<label class="text-xs text-mut">Titre<input name="title" value={book.title} class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
			<label class="text-xs text-mut">Auteurs<input name="authors" value={book.authors.join(', ')} class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
			<label class="text-xs text-mut">Série<input name="seriesTitle" value={book.seriesTitle ?? ''} class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
			<label class="text-xs text-mut">Tome<input name="volume" value={book.volume ?? ''} class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
			<label class="text-xs text-mut">Éditeur<input name="publisher" value={book.publisher ?? ''} class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
			<label class="text-xs text-mut">Date<input name="publishDate" value={book.publishDate ?? ''} class="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink" /></label>
			<button class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink sm:col-span-2">Enregistrer les corrections</button>
		</form>
	{/if}
</section>

{#if form?.error}<p class="mt-3 text-sm text-red-400">{form.error}</p>{/if}
{#if form?.ok}<p class="mt-3 text-sm text-ok">{form.ok}</p>{/if}

<div class="mt-8 flex justify-between border-t border-line pt-4">
	{#if book.isbn13}<form method="POST" action="?/refresh" use:enhance><button class="text-sm text-mut">↻ Actualiser les métadonnées</button></form>{/if}
	{#if deleting}
		<form method="POST" action="?/remove"><button class="rounded-full bg-red-500 px-4 py-2 text-sm text-white">Confirmer la suppression</button></form>
	{:else}<button class="text-sm text-red-400" onclick={() => (deleting = true)}>Supprimer</button>{/if}
</div>
