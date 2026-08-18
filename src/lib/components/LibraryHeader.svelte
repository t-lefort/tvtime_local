<script lang="ts">
	import { LIBRARY_SECTIONS, librarySection, type LibraryCounts, type LibrarySection } from '$lib/library';

	/**
	 * En-tête commun aux trois listes de la bibliothèque : un seul titre et des
	 * onglets qui basculent d'un type de média à l'autre sans repasser par un menu.
	 */
	let { current, counts }: { current: LibrarySection; counts: LibraryCounts } = $props();

	const section = $derived(librarySection(current));
</script>

<div class="mb-3 flex items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">Bibliothèque</h1>
	<a
		href={section.addHref}
		class="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90"
	>
		+ Ajouter
	</a>
</div>

<nav class="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Type de média">
	{#each LIBRARY_SECTIONS as item (item.key)}
		<a
			href={item.href}
			aria-current={current === item.key ? 'page' : undefined}
			class="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors
				{current === item.key ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
		>
			<span aria-hidden="true">{item.icon}</span>
			{item.label}
			<span class="opacity-70">· {counts[item.key]}</span>
		</a>
	{/each}
</nav>
