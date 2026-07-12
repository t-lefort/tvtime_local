<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { page } from '$app/state';

	let { children } = $props();
	const hideNav = $derived(page.url.pathname === '/login' || page.url.pathname === '/profils');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<main class="mx-auto w-full max-w-2xl px-4 pt-5 pb-28">
	{@render children()}
</main>

{#if !hideNav}
	<BottomNav />
{/if}
