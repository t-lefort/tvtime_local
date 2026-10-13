<script lang="ts">
	import { goto } from '$app/navigation';
	import BackButton from '$lib/components/BackButton.svelte';
	import { LIBRARY_SECTIONS, librarySection } from '$lib/library';
	import {
		SHARE_FILTERS,
		shareCount,
		shareFileName,
		shareFilterLabel,
		shareIcon,
		shareMarks,
		shareText,
		shareTitle,
		type ShareKind
	} from '$lib/share';

	let { data } = $props();

	type Format = 'text' | 'image' | 'html' | 'pdf';

	const options = $derived({ ratings: data.ratings });
	const count = $derived(shareCount(data.list));
	const fileName = $derived(shareFileName(data.list, data.today));
	const text = $derived(shareText(data.list, options));
	const subtitle = $derived(
		[
			`${count} ${count > 1 ? 'titres' : 'titre'}`,
			['tous', 'toutes'].includes(data.filter) ? '' : shareFilterLabel(data.kind, data.filter)
		]
			.filter(Boolean)
			.join(' · ')
	);

	let busy = $state<Format | null>(null);
	let notice = $state<string | null>(null);
	let canShareFiles = $state(false);
	let canShareText = $state(false);
	$effect(() => {
		canShareText = typeof navigator.share === 'function';
		try {
			canShareFiles =
				typeof navigator.canShare === 'function' &&
				navigator.canShare({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] });
		} catch {
			canShareFiles = false;
		}
	});

	function params(extra: Record<string, string> = {}) {
		const search = new URLSearchParams({ type: data.kind });
		if (data.filter !== SHARE_FILTERS[data.kind][0].key) search.set('filtre', data.filter);
		if (!data.ratings) search.set('notes', '0');
		for (const [key, value] of Object.entries(extra)) search.set(key, value);
		return search;
	}

	function hrefFor(change: { kind?: ShareKind; filter?: string; ratings?: boolean }) {
		const kind = change.kind ?? data.kind;
		const search = new URLSearchParams({ type: kind });
		const filter = change.kind ? undefined : (change.filter ?? data.filter);
		if (filter && filter !== SHARE_FILTERS[kind][0].key) search.set('filtre', filter);
		if (!(change.ratings ?? data.ratings)) search.set('notes', '0');
		return `/bibliotheque/partage?${search}`;
	}

	function flash(message: string) {
		notice = message;
		setTimeout(() => {
			if (notice === message) notice = null;
		}, 3000);
	}

	function download(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = name;
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}

	/** Envoie le fichier par la feuille de partage du système, sinon le télécharge. */
	async function deliver(blob: Blob, name: string, share: boolean) {
		const file = new File([blob], name, { type: blob.type });
		if (share && canShareFiles && navigator.canShare({ files: [file] })) {
			try {
				await navigator.share({ files: [file], title: shareTitle(data.list) });
			} catch (error) {
				// Fermer la feuille de partage n'est pas une erreur.
				if ((error as Error).name !== 'AbortError') throw error;
			}
			return;
		}
		download(blob, name);
	}

	async function run(format: Format, task: () => Promise<void>) {
		busy = format;
		try {
			await task();
		} catch (error) {
			console.error(error);
			flash('Le partage a échoué, réessayez.');
		} finally {
			busy = null;
		}
	}

	const copyText = () =>
		run('text', async () => {
			await navigator.clipboard.writeText(text);
			flash('Liste copiée dans le presse-papiers.');
		});

	const shareTextOut = () =>
		run('text', async () => {
			try {
				await navigator.share({ title: shareTitle(data.list), text });
			} catch (error) {
				if ((error as Error).name !== 'AbortError') throw error;
			}
		});

	const downloadText = () =>
		run('text', async () => download(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${fileName}.txt`));

	const makeImage = (share: boolean) =>
		run('image', async () => {
			const { renderShareImage } = await import('$lib/share-image');
			const blob = await renderShareImage(data.list, { ...options, subtitle });
			await deliver(blob, `${fileName}.jpg`, share);
		});

	const makeHtml = (share: boolean) =>
		run('html', async () => {
			const response = await fetch(`/bibliotheque/partage/export?${params()}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const blob = new Blob([await response.text()], { type: 'text/html' });
			await deliver(blob, `${fileName}.html`, share);
		});

	function openPdf() {
		window.open(`/bibliotheque/partage/export?${params({ print: '1' })}`, '_blank');
	}

	const button =
		'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50';
	const primary = `${button} bg-brand text-brand-ink hover:opacity-90`;
	const secondary = `${button} bg-card-hover text-ink hover:bg-line`;
</script>

<svelte:head>
	<title>Partager — TV Time local</title>
</svelte:head>

<div class="mb-4 flex items-center gap-3">
	<BackButton fallback={librarySection(data.kind).href} class="text-2xl text-mut hover:text-ink" />
	<h1 class="text-2xl font-bold">Partager</h1>
</div>

<p class="mb-4 text-sm text-mut">
	Une copie de votre liste, à envoyer à qui vous voulez : le destinataire n'a pas besoin d'accès à
	l'application.
</p>

<nav class="mb-3 grid grid-cols-3 gap-1.5 sm:gap-2" aria-label="Type de média">
	{#each LIBRARY_SECTIONS as item (item.key)}
		<a
			href={hrefFor({ kind: item.key })}
			data-sveltekit-replacestate
			aria-current={data.kind === item.key ? 'page' : undefined}
			class="flex min-w-0 items-center justify-center gap-1 rounded-full px-2 py-2 text-[13px] font-semibold transition-colors sm:gap-1.5 sm:px-4 sm:text-sm
				{data.kind === item.key ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
		>
			<span aria-hidden="true" class="shrink-0 max-[360px]:hidden">{item.icon}</span>
			<span class="truncate">{item.label}</span>
			<span class="shrink-0 opacity-70">· {data.libraryCounts[item.key]}</span>
		</a>
	{/each}
</nav>

<div class="scrollbar-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
	{#each SHARE_FILTERS[data.kind] as chip (chip.key)}
		<a
			href={hrefFor({ filter: chip.key })}
			data-sveltekit-replacestate
			data-sveltekit-noscroll
			class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors
				{data.filter === chip.key ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
		>
			{chip.label}
		</a>
	{/each}
</div>

<label class="mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm">
	<input
		type="checkbox"
		checked={data.ratings}
		onchange={(event) =>
			goto(hrefFor({ ratings: event.currentTarget.checked }), { replaceState: true, noScroll: true })}
		class="h-4 w-4 accent-brand"
	/>
	Inclure mes notes et favoris
</label>

{#if count === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-2 text-3xl">{shareIcon(data.kind)}</p>
		<p>Rien à partager dans cette catégorie.</p>
	</div>
{:else}
	<div class="mb-6 grid gap-3 sm:grid-cols-2">
		<div class="rounded-xl bg-card p-4">
			<p class="font-semibold">📝 Texte</p>
			<p class="mb-3 text-sm text-mut">Une liste à coller dans un message.</p>
			<div class="flex flex-wrap gap-2">
				<button class={primary} disabled={busy !== null} onclick={copyText}>Copier</button>
				{#if canShareText}
					<button class={secondary} disabled={busy !== null} onclick={shareTextOut}>Partager…</button>
				{/if}
				<button class={secondary} disabled={busy !== null} onclick={downloadText}>.txt</button>
			</div>
		</div>

		<div class="rounded-xl bg-card p-4">
			<p class="font-semibold">🖼️ Image</p>
			<p class="mb-3 text-sm text-mut">Une mosaïque des affiches, en JPEG.</p>
			<div class="flex flex-wrap gap-2">
				{#if canShareFiles}
					<button class={primary} disabled={busy !== null} onclick={() => makeImage(true)}>
						{busy === 'image' ? 'Création…' : 'Partager…'}
					</button>
				{/if}
				<button class={canShareFiles ? secondary : primary} disabled={busy !== null} onclick={() => makeImage(false)}>
					{busy === 'image' && !canShareFiles ? 'Création…' : 'Télécharger'}
				</button>
			</div>
		</div>

		<div class="rounded-xl bg-card p-4">
			<p class="font-semibold">🌐 Page HTML</p>
			<p class="mb-3 text-sm text-mut">Un fichier autonome qui s'ouvre dans n'importe quel navigateur.</p>
			<div class="flex flex-wrap gap-2">
				{#if canShareFiles}
					<button class={primary} disabled={busy !== null} onclick={() => makeHtml(true)}>
						{busy === 'html' ? 'Création…' : 'Partager…'}
					</button>
				{/if}
				<button class={canShareFiles ? secondary : primary} disabled={busy !== null} onclick={() => makeHtml(false)}>
					{busy === 'html' && !canShareFiles ? 'Création…' : 'Télécharger'}
				</button>
				<a class={secondary} href="/bibliotheque/partage/export?{params()}" target="_blank" rel="noopener">Aperçu</a>
			</div>
		</div>

		<div class="rounded-xl bg-card p-4">
			<p class="font-semibold">📄 PDF</p>
			<p class="mb-3 text-sm text-mut">Ouvre l'impression : choisissez « Enregistrer au format PDF ».</p>
			<div class="flex flex-wrap gap-2">
				<button class={primary} disabled={busy !== null} onclick={openPdf}>Créer le PDF</button>
			</div>
		</div>
	</div>

	{#if notice}
		<p class="fixed inset-x-4 bottom-24 z-50 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg shadow-lg" role="status">
			{notice}
		</p>
	{/if}

	<h2 class="mb-1 text-lg font-semibold">Aperçu</h2>
	<p class="mb-3 text-sm text-mut">{shareTitle(data.list)} · {subtitle}</p>

	{#each data.list.sections as section (section.label)}
		<section class="mb-5">
			<h3 class="mb-2 border-b border-line pb-1 font-semibold">
				{section.label} <span class="text-sm font-normal text-mut">{section.items.length}</span>
			</h3>
			<ul class="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each section.items as item, index (index)}
					{@const marks = shareMarks(item, options)}
					<li class="flex min-w-0 items-center gap-3">
						<div class="h-12 w-8 shrink-0 overflow-hidden rounded bg-card">
							{#if item.image}
								<img src={item.image} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="h-full w-full object-cover" />
							{/if}
						</div>
						<div class="min-w-0">
							<p class="truncate text-sm font-medium">{item.title}</p>
							<p class="truncate text-xs text-mut">
								{item.detail ?? ''}{#if marks}<span class="text-brand">{item.detail ? ' · ' : ''}{marks}</span>{/if}
							</p>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}
