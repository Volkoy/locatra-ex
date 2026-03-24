<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowLeft,
		Flag,
		MessageCircle,
		Leaf,
		BookOpen,
		Eye,
		Footprints,
		Landmark,
		BookDashed
	} from 'lucide-svelte';

	let { data } = $props();
	let { story, segments, usedCards, gameName, gameId, characterName, character } = $derived(data);

	const HERO_STEP_LABELS: Record<string, string> = {
		call_to_adventure: 'Call to Adventure',
		crossing_the_threshold: 'Crossing the Threshold',
		meeting_the_mentor: 'Meeting the Mentor',
		trials_and_growth: 'Trials & Growth',
		death_and_transformation: 'Death & Transformation',
		change_and_return: 'Change & Return'
	};

	const HERO_STEP_ORDER = [
		'call_to_adventure',
		'crossing_the_threshold',
		'meeting_the_mentor',
		'trials_and_growth',
		'death_and_transformation',
		'change_and_return'
	];

	const SEGMENT_LABELS: Record<string, string> = {
		introduction: 'Introduction',
		step: 'Journey',
		deepening: 'Journey (Deepening)',
		reflection: 'Reflection'
	};

	type Segment = {
		id: number;
		segment_type: string;
		hero_step: string | null;
		card_id: number | null;
		content: string;
	};

	function stepNumber(segment: Segment): number | null {
		if (!segment.hero_step) return null;
		const idx = HERO_STEP_ORDER.indexOf(segment.hero_step);
		return idx >= 0 ? idx + 1 : null;
	}

	const getCardHeaderBg = (type: string | null) => {
		switch (type) {
			case 'nature':
				return 'bg-nature-green';
			case 'history':
				return 'bg-history-yellow';
			case 'sense':
				return 'bg-purple-600';
			case 'action':
				return 'bg-sense-red';
			case 'landmark':
				return 'bg-landmark-green';
			default:
				return 'bg-gray-600';
		}
	};

	const getCardIcon = (type: string | null) => {
		switch (type) {
			case 'nature':
				return Leaf;
			case 'history':
				return BookOpen;
			case 'sense':
				return Eye;
			case 'action':
				return Footprints;
			case 'landmark':
				return Landmark;
			default:
				return BookDashed;
		}
	};

	// Drag-to-scroll
	let carousel: HTMLElement | null = $state(null);
	let isDragging = false;
	let startX = 0;
	let scrollLeft = 0;

	function onMouseDown(e: MouseEvent) {
		if (!carousel) return;
		isDragging = true;
		startX = e.pageX - carousel.offsetLeft;
		scrollLeft = carousel.scrollLeft;
		carousel.style.cursor = 'grabbing';
	}

	function onMouseMove(e: MouseEvent) {
		if (!isDragging || !carousel) return;
		e.preventDefault();
		const x = e.pageX - carousel.offsetLeft;
		const walk = (x - startX) * 1.5;
		carousel.scrollLeft = scrollLeft - walk;
	}

	function onMouseUp() {
		isDragging = false;
		if (carousel) carousel.style.cursor = 'grab';
	}
</script>

<svelte:head>
	<title>{story.title} — PathWritter</title>
	<meta name="description" content="A story from {gameName} by {characterName}" />
</svelte:head>

<div class="flex min-h-screen bg-primary-foreground">
	<!-- Character + Story + Cards -->
	<div class="mx-4 my-4 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-dark-green bg-white shadow-lg md:mx-auto">
		<!-- Back button -->
		<div class="flex items-center gap-2 p-2">
			{#if gameId}
				<Button variant="ghost" size="sm" href="/play/{gameId}/stories" class="gap-1">
					<ArrowLeft class="size-4" />
					Back
				</Button>
			{/if}
		</div>
		<!-- Title -->
		<div class="border-b border-dark-green px-5 pb-4">
			<h1 class="text-2xl font-bold">{story.title}</h1>
			<p class="mt-1 text-sm text-muted-foreground">{gameName}</p>
		</div>
		<!-- Character header -->
		<div class="flex items-center gap-3 border-b border-dark-green px-5 py-4">
				{#if character?.image_url}
					<img
						src={character.image_url}
						alt={characterName}
						class="size-12 shrink-0 rounded-full object-cover ring-2 ring-border"
					/>
				{:else}
					<div
						class="flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ring-2 ring-border"
						style="background-color: {character?.bg_color ??
							'#0f342a'}; color: {character?.text_color ?? '#ffffff'}"
					>
						{characterName.charAt(0)}
					</div>
				{/if}
				<div>
					<p class="font-semibold">{characterName}</p>
					{#if character?.name}
						<p class="text-sm text-muted-foreground">as {character.name}</p>
					{/if}
				</div>
			</div>

			<!-- Story timeline -->
			<div class="px-5 py-6">
				<div>
					{#each segments as segment, i (segment.id)}
						{@const num = stepNumber(segment)}
						{@const isLast = i === segments.length - 1}
						{@const isIntro = segment.segment_type === 'introduction'}
						{@const isReflection = segment.segment_type === 'reflection'}
						<div class="flex gap-4">
							<!-- Left: circle + connecting line -->
							<div class="flex w-10 shrink-0 flex-col items-center">
								<div
									class="flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm {isIntro
										? 'bg-destructive'
										: 'bg-dark-green'}"
								>
									{#if isIntro}
										<Flag class="size-4" />
									{:else if isReflection}
										<MessageCircle class="size-4" />
									{:else if num !== null}
										<span class="text-sm font-bold">{num}</span>
									{:else}
										<span class="text-xs font-bold">·</span>
									{/if}
								</div>
								{#if !isLast}
									<div class="w-0.5 flex-1 bg-dark-green" style="min-height: 2rem;"></div>
								{/if}
							</div>

							<!-- Right: content (no step label) -->
							<div class="min-w-0 flex-1 pb-8">
								<p class="leading-relaxed whitespace-pre-wrap text-foreground">{segment.content}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
			<!-- close px-5 py-6 -->

			<!-- Cards carousel -->
			{#if usedCards.length > 0}
				<div class="mt-8 border-t border-dark-green px-5 pt-8">
					<h2 class="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
						Story prompts
					</h2>
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<div
						role="list"
						bind:this={carousel}
						class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 select-none"
						style="scrollbar-width: none; cursor: grab; scroll-behavior: smooth;"
						onmousedown={onMouseDown}
						onmousemove={onMouseMove}
						onmouseup={onMouseUp}
						onmouseleave={onMouseUp}
					>
						<div class="w-5 shrink-0" aria-hidden="true"></div>
						{#each usedCards as { card, hero_step, segment_type } (card.id)}
							{@const CardIcon = getCardIcon(card.type)}
							{@const headerBg = getCardHeaderBg(card.type)}
							{@const label = hero_step
								? (HERO_STEP_LABELS[hero_step] ?? hero_step)
								: (SEGMENT_LABELS[segment_type] ?? segment_type)}
							{@const isIntro = segment_type === 'introduction'}
							{@const isReflection = segment_type === 'reflection'}
							{@const num = hero_step ? HERO_STEP_ORDER.indexOf(hero_step) + 1 : null}
							<div role="listitem" class="w-52 shrink-0 snap-start">
								<!-- Step indicator above card -->
								<div class="mb-2 flex items-center gap-2">
									<div
										class="flex size-8 shrink-0 items-center justify-center rounded-full bg-dark-green text-xs font-bold text-white"
									>
										{#if isIntro}
											<Flag class="size-3.5" />
										{:else if isReflection}
											<MessageCircle class="size-3.5" />
										{:else if num !== null}
											{num}
										{/if}
									</div>
									<span class="text-xs font-semibold text-muted-foreground">{label}</span>
								</div>
								<!-- Card -->
								<div
									class="flex aspect-[2/3] flex-col overflow-hidden rounded-xl border-4 border-white shadow-lg outline outline-gray-200"
								>
									<!-- Coloured header: icon + title -->
									<div class="flex flex-col items-center gap-2 p-4 {headerBg}">
										<div class="flex size-10 items-center justify-center rounded-full bg-white/20">
											<CardIcon class="size-5 text-white" />
										</div>
										{#if card.title}
											<p
												class="line-clamp-3 text-center text-xs leading-tight font-bold text-white"
											>
												{card.title}
											</p>
										{/if}
									</div>
									<!-- White body: prompt -->
									<div class="flex-1 bg-white p-3">
										{#if card.prompt}
											<p class="line-clamp-6 text-center text-xs leading-relaxed text-black">
												{card.prompt}
											</p>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Footer -->
			<footer
				class="border-t border-dark-green px-5 py-6 text-center text-sm text-muted-foreground"
			>
				<p>Story created on {new Date(story.created_at).toLocaleDateString()}</p>
				<p class="mt-1">Written with PathWriter</p>
			</footer>
	</div>
</div>
