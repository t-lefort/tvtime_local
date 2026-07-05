<script lang="ts">
	import { page } from '$app/state';

	const items = [
		{ href: '/', label: 'Fil', d: 'M4 6h16M4 12h16M4 18h9' },
		{
			href: '/series',
			label: 'Séries',
			d: 'M3.5 3.5h7v7h-7zM13.5 3.5h7v7h-7zM3.5 13.5h7v7h-7zM13.5 13.5h7v7h-7z'
		},
		{
			href: '/recherche',
			label: 'Recherche',
			d: 'M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z'
		},
		{
			href: '/profil',
			label: 'Profil',
			d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'
		}
	];

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<nav class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur"
	style="padding-bottom: env(safe-area-inset-bottom)">
	<div class="mx-auto flex max-w-2xl">
		{#each items as item (item.href)}
			<a
				href={item.href}
				class="flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium transition-colors
					{isActive(item.href) ? 'text-brand' : 'text-mut hover:text-ink'}"
			>
				<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<path d={item.d} />
				</svg>
				{item.label}
			</a>
		{/each}
	</div>
</nav>
