<script lang="ts">
	import { tmdbImg } from '$lib/format';
	import type { StoredCastMember } from '$lib/server/tmdb';

	type ProfiledPerson = Pick<StoredCastMember, 'id' | 'name' | 'profilePath'> & {
		character?: string | null;
	};

	let { cast, title = 'Distribution' }: { cast: ProfiledPerson[]; title?: string } = $props();
</script>

{#if cast.length}
	<section class="mt-6">
		<h2 class="mb-2 text-sm font-semibold tracking-wide text-mut uppercase">{title}</h2>
		<ul class="-mx-4 flex gap-3 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			{#each cast as person (person.id)}
				<li class="w-20 shrink-0">
					<a href="/personnes/{person.id}" class="group block" title="Voir la filmographie de {person.name}">
						<div class="aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-line group-hover:ring-brand">
							{#if person.profilePath}
								<img
									src={tmdbImg(person.profilePath, 'w185')}
									alt={person.name}
									loading="lazy"
									class="h-full w-full object-cover"
								/>
							{:else}
								<div class="flex h-full w-full items-center justify-center text-2xl text-mut">🎭</div>
							{/if}
						</div>
						<p class="mt-1 line-clamp-2 text-xs font-medium leading-tight group-hover:text-brand">
							{person.name}
						</p>
						{#if person.character}
							<p class="line-clamp-2 text-[11px] leading-tight text-mut">{person.character}</p>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
