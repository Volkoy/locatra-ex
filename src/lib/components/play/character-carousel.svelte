<script lang="ts">
	import EmblaCarousel from 'embla-carousel';
	import type { EmblaCarouselType } from 'embla-carousel';
	import CharacterCard from '$lib/components/character-card.svelte';
	import { User, ChevronLeft, ChevronRight } from 'lucide-svelte';

	let {
		characters,
		currentIndex = $bindable(0)
	}: {
		characters: Array<{
			id: number;
			character_id: string;
			name: string | null;
			summary: string | null;
			image_url: string | null;
			category: string | null;
			bg_color?: string | null;
			text_color?: string | null;
		}>;
		currentIndex: number;
	} = $props();

	let emblaNode = $state<HTMLElement | null>(null);
	let embla = $state<EmblaCarouselType | null>(null);

	$effect(() => {
		if (!emblaNode) return;

		const instance = EmblaCarousel(emblaNode, {
			loop: false,
			align: 'center',
			skipSnaps: false,
			containScroll: false,
			startIndex: currentIndex
		});

		instance.on('select', () => {
			currentIndex = instance.selectedScrollSnap();
		});

		embla = instance;
		return () => instance.destroy();
	});
</script>

{#if characters.length === 0}
	<div class="flex flex-col items-center justify-center py-16 text-muted-foreground">
		<User class="mb-3 h-12 w-12 opacity-30" />
		<p>No characters available</p>
	</div>
{:else}
	<div class="relative">
		<!-- Overflow clip: clips x but gives y room for shadow/border -->
		<div class="overflow-hidden py-4">
			<div bind:this={emblaNode} class="-mx-0">
				<div class="flex gap-5 px-[calc(50%-144px)]">
					{#each characters as character, i (character.character_id)}
						<div
							class="shrink-0 transition-opacity duration-300"
							style="opacity: {i === currentIndex ? 1 : 0.4};"
						>
							<CharacterCard {character} />
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Prev button -->
		{#if characters.length > 1}
			<button
				onclick={() => embla?.scrollPrev()}
				disabled={currentIndex === 0}
				class="absolute top-1/2 left-2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition-opacity hover:bg-gray-50 disabled:opacity-30"
				aria-label="Previous character"
			>
				<ChevronLeft class="h-4 w-4" />
			</button>

			<!-- Next button -->
			<button
				onclick={() => embla?.scrollNext()}
				disabled={currentIndex === characters.length - 1}
				class="absolute top-1/2 right-2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition-opacity hover:bg-gray-50 disabled:opacity-30"
				aria-label="Next character"
			>
				<ChevronRight class="h-4 w-4" />
			</button>
		{/if}

		<!-- Dot indicators -->
		{#if characters.length > 1}
			<div class="flex justify-center gap-1.5 pb-2">
				{#each characters as _, i}
					<button
						class="h-2 rounded-full transition-all duration-300 {i === currentIndex
							? 'w-6 bg-dark-green'
							: 'w-2 bg-gray-300'}"
						onclick={() => embla?.scrollTo(i)}
						aria-label="Go to character {i + 1}"
					></button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
