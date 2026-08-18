<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import UserRating from '$lib/components/UserRating.svelte';
	import { formatDateShort } from '$lib/format';

	let { data, form } = $props();
	let editing = $state(false);
	let confirmDelete = $state(false);

	const book = $derived(data.book);

	const STATUSES = [
		{ key: 'unread', label: 'À lire' },
		{ key: 'reading', label: 'En cours' },
		{ key: 'read', label: 'Lu' }
	] as const;

	/** Les sources donnent tantôt une date complète, tantôt une simple année. */
	function publishLabel(value: string | null): string | null {
		if (!value) return null;
		return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDateShort(value) : value;
	}

	/** Les trois marqueurs de collection partagent la même action : on renvoie l'état complet. */
	function flags(overrides: Partial<{ inCollection: boolean; wishlist: boolean; favorite: boolean }>) {
		return {
			inCollection: book.inCollection,
			wishlist: book.wishlist,
			favorite: book.favorite,
			...overrides
		};
	}
</script>

<svelte:head><title>{book.title} — TV Time local</title></svelte:head>

<BackButton fallback="/livres" class="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-card text-lg" />

<div class="flex items-end gap-4">
	<div class="w-27 shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-line" style="width: 6.75rem">
		<div class="aspect-[2/3]"><BookCover url={book.coverUrl} alt={book.title} /></div>
	</div>
	<div class="min-w-0 flex-1 pb-1">
		<h1 class="text-xl leading-tight font-bold">{book.title}</h1>
		{#if book.subtitle}<p class="mt-1 text-sm text-mut">{book.subtitle}</p>{/if}
		<p class="mt-1 text-sm">{book.authors.join(', ') || 'Auteur inconnu'}</p>
		{#if book.seriesTitle}
			<p class="mt-0.5 text-sm text-mut">{book.seriesTitle}{book.volume ? ` · tome ${book.volume}` : ''}</p>
		{/if}
		<p class="mt-0.5 truncate text-xs text-mut">
			{[book.publisher, publishLabel(book.publishDate), book.pageCount ? `${book.pageCount} pages` : null]
				.filter(Boolean)
				.join(' · ')}
		</p>
	</div>
</div>

<p class="mt-4 text-sm text-mut">
	{#if book.readingStatus === 'read'}✓ Lu{:else if book.readingStatus === 'reading'}📖 Lecture en cours{:else}À lire{/if}
	· Ajouté le {formatDateShort(book.addedAt.slice(0, 10))}
</p>

<div class="mt-4 flex flex-wrap items-center gap-2">
	{#each STATUSES as status (status.key)}
		<form method="POST" action="?/status" use:enhance>
			<input type="hidden" name="status" value={status.key} />
			<button
				class="rounded-full px-3.5 py-2 text-sm font-semibold transition-colors {book.readingStatus === status.key
					? 'bg-brand text-brand-ink'
					: 'border border-line text-mut hover:border-mut hover:text-ink'}"
			>
				{status.label}
			</button>
		</form>
	{/each}

	<form method="POST" action="?/flags" use:enhance>
		{#each Object.entries(flags({ favorite: !book.favorite })) as [name, value] (name)}
			<input type="hidden" {name} value={value ? '1' : '0'} />
		{/each}
		<button
			class="rounded-full border px-3.5 py-2 text-sm font-semibold {book.favorite
				? 'border-brand text-brand'
				: 'border-line text-mut hover:border-mut hover:text-ink'}"
			title={book.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
		>
			{book.favorite ? '★ Favori' : '☆ Favori'}
		</button>
	</form>

	<form method="POST" action="?/flags" use:enhance>
		{#each Object.entries(flags({ inCollection: !book.inCollection })) as [name, value] (name)}
			<input type="hidden" {name} value={value ? '1' : '0'} />
		{/each}
		<button
			class="rounded-full border px-3.5 py-2 text-sm font-semibold {book.inCollection
				? 'border-brand text-brand'
				: 'border-line text-mut hover:border-mut hover:text-ink'}"
			title={book.inCollection ? 'Retirer de ma collection' : 'Ajouter à ma collection'}
		>
			{book.inCollection ? '✓ Ma collection' : '+ Ma collection'}
		</button>
	</form>

	<form method="POST" action="?/flags" use:enhance>
		{#each Object.entries(flags({ wishlist: !book.wishlist })) as [name, value] (name)}
			<input type="hidden" {name} value={value ? '1' : '0'} />
		{/each}
		<button
			class="rounded-full border px-3.5 py-2 text-sm font-semibold {book.wishlist
				? 'border-brand text-brand'
				: 'border-line text-mut hover:border-mut hover:text-ink'}"
			title={book.wishlist ? 'Retirer de mes envies' : 'Ajouter à mes envies'}
		>
			{book.wishlist ? '♥ Envie' : '♡ Envie'}
		</button>
	</form>

	{#if book.isbn13}
		<form method="POST" action="?/refresh" use:enhance>
			<button
				class="rounded-full border border-line px-3.5 py-2 text-sm text-mut hover:border-mut hover:text-ink"
				title="Rafraîchir les métadonnées bibliographiques"
			>
				↻
			</button>
		</form>
	{/if}

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
				title="Retirer le livre de ma bibliothèque"
				onclick={() => (confirmDelete = true)}
			>
				🗑
			</button>
		{/if}
	</div>
</div>

<div class="mt-3">
	<UserRating value={book.rating} />
</div>

{#if book.description}
	<p class="mt-4 text-sm leading-relaxed text-mut">{book.description}</p>
{/if}

<section class="mt-6 rounded-2xl bg-card p-4">
	<h2 class="mb-2 text-sm font-semibold">Mon avis</h2>
	<form method="POST" action="?/review" use:enhance class="flex flex-col gap-2">
		<textarea
			name="review"
			rows="3"
			placeholder="Ce que j'en ai pensé…"
			class="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-mut focus:border-brand focus:outline-none"
			>{book.review ?? ''}</textarea
		>
		<button class="self-end rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90">
			Enregistrer
		</button>
	</form>
</section>

{#if form?.error}<p class="mt-3 text-sm text-red-400">{form.error}</p>{/if}
{#if form?.ok}<p class="mt-3 text-sm text-ok">{form.ok}</p>{/if}

<section class="mt-6 border-t border-line pt-4">
	<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-mut">
		{#if book.isbn13}<span class="font-mono">ISBN {book.isbn13}</span>{/if}
		<button class="text-sm text-mut underline hover:text-ink" onclick={() => (editing = !editing)}>
			Corriger les informations
		</button>
	</div>
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
