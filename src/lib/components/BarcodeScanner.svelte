<script lang="ts">
	import { onDestroy } from 'svelte';
	let { onDetected }: { onDetected: (isbn: string) => void } = $props();
	let video = $state<HTMLVideoElement>();
	let running = $state(false);
	let error = $state('');
	let controls: { stop: () => void } | null = null;
	let lastCode = '';

	async function start() {
		error = '';
		lastCode = '';
		if (!video) return;
		if (!window.isSecureContext && location.hostname !== 'localhost') {
			error = 'La caméra nécessite HTTPS. Vous pouvez saisir l’ISBN manuellement.';
			return;
		}
		try {
			const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
				import('@zxing/browser'),
				import('@zxing/library')
			]);
			const hints = new Map();
			hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
			const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
			running = true;
			controls = await reader.decodeFromConstraints(
				{ video: { facingMode: { ideal: 'environment' } }, audio: false },
				video,
				(result) => {
					const value = result?.getText() ?? '';
					if (!value || value === lastCode || !/^97[89]\d{10}$/.test(value)) return;
					lastCode = value;
					onDetected(value);
					stop();
				}
			);
		} catch (cause) {
			running = false;
			error = cause instanceof Error && cause.name === 'NotAllowedError'
				? 'Accès à la caméra refusé.'
				: 'Impossible de démarrer la caméra.';
		}
	}

	function stop() {
		controls?.stop();
		controls = null;
		running = false;
	}

	onDestroy(stop);
</script>

<div>
	<div class:hidden={!running} class="relative overflow-hidden rounded-xl bg-black">
		<video bind:this={video} muted playsinline class="aspect-[4/3] w-full object-cover"></video>
		{#if running}
			<div class="pointer-events-none absolute inset-x-[12%] top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-brand"></div>
		{/if}
	</div>
	{#if running}
		<button type="button" class="mt-2 text-sm text-mut underline" onclick={stop}>Arrêter la caméra</button>
	{:else}
		<button type="button" class="rounded-full border border-line px-4 py-2 text-sm font-semibold" onclick={start}>📷 Scanner un code-barres</button>
	{/if}
	{#if error}<p class="mt-2 text-sm text-red-400">{error}</p>{/if}
</div>
