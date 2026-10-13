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
	<div class="flex shrink-0 items-center gap-2">
		<a
			href="/bibliotheque/partage?type={current}"
			class="flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-sm font-semibold text-ink hover:bg-card-hover"
			aria-label="Partager"
			title="Partager"
		>
			<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
			</svg>
			<span class="max-sm:hidden">Partager</span>
		</a>
		<a
			href={section.addHref}
			class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90"
		>
			+ Ajouter
		</a>
	</div>
</div>

<!-- Grille de trois colonnes égales plutôt qu'une rangée qui défile : les trois
	 catalogues tiennent toujours dans la largeur, même sur un écran étroit, au
	 lieu que le dernier soit coupé sur le bord. -->
<nav class="mb-4 grid grid-cols-3 gap-1.5 sm:gap-2" aria-label="Type de média">
	{#each LIBRARY_SECTIONS as item (item.key)}
		<a
			href={item.href}
			aria-current={current === item.key ? 'page' : undefined}
			class="flex min-w-0 items-center justify-center gap-1 rounded-full px-2 py-2 text-[13px] font-semibold transition-colors sm:gap-1.5 sm:px-4 sm:text-sm
				{current === item.key ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
		>
			<!-- Sur les écrans les plus étroits, l'emoji est sacrifié avant le libellé. -->
			<span aria-hidden="true" class="shrink-0 max-[360px]:hidden">{item.icon}</span>
			<span class="truncate">{item.label}</span>
			<span class="shrink-0 opacity-70">· {counts[item.key]}</span>
		</a>
	{/each}
</nav>
