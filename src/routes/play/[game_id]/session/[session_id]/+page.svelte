<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { goto } from '$app/navigation';
	import { MapLibre, Marker } from 'svelte-maplibre';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		MapPin,
		LogOut,
		BookOpen,
		ChevronDown,
		Navigation2,
		Leaf,
		Eye,
		Footprints,
		Landmark,
		BookDashed,
		Flag,
		MessageCircle,
		PenLine,
		LockOpen,
		CheckCheck,
		MousePointerClick,
		LocateFixed
	} from 'lucide-svelte';
	import { Separator } from '$lib/components/ui/separator';
	import AiChat from '$lib/components/play/ai-chat.svelte';
	import AiChatSheet from '$lib/components/play/ai-chat-sheet.svelte';

	type Segment = {
		id: number;
		segment_type: string;
		hero_step: string | null;
		poi_id: number | null;
		card_id: number | null;
		content: string;
	};
	type Poi = {
		id: number;
		name: string;
		description?: string | null;
		image_url?: string | null;
		longitude: number;
		latitude: number;
		radius?: number;
		type?: string;
	};
	type Card = { id: number; title: string | null; prompt: string | null; type: string | null };

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

	let { data } = $props();
	let {
		session,
		pois,
		segments,
		cards,
		visitedPoiIds,
		hasIntroduction,
		gameLocation,
		companion,
		game_id,
		session_id
	} = $derived(data);

	const HERO_STEPS = [
		'call_to_adventure',
		'crossing_the_threshold',
		'meeting_the_mentor',
		'trials_and_growth',
		'death_and_transformation',
		'change_and_return'
	] as const;

	const HERO_STEP_LABELS: Record<string, string> = {
		call_to_adventure: 'Call to Adventure',
		crossing_the_threshold: 'Crossing the Threshold',
		meeting_the_mentor: 'Meeting the Mentor',
		trials_and_growth: 'Trials & Growth',
		death_and_transformation: 'Death & Transformation',
		change_and_return: 'Change & Return'
	};

	// Derived segment state
	let introSegment = $derived(
		(segments as Segment[]).find((s) => s.segment_type === 'introduction')
	);
	let reflectionSegment = $derived(
		(segments as Segment[]).find((s) => s.segment_type === 'reflection')
	);
	let stepSegments = $derived(
		Object.fromEntries(
			HERO_STEPS.map((step) => [
				step,
				(segments as Segment[]).find((s) => s.hero_step === step && s.segment_type !== 'deepening')
			])
		)
	);
	let currentStepIndex = $derived(
		session.current_hero_step
			? HERO_STEPS.indexOf(session.current_hero_step as (typeof HERO_STEPS)[number])
			: -1
	);
	let allStepsDone = $derived(HERO_STEPS.every((step) => stepSegments[step]));

	const HERO_STEP_GOALS: Record<string, string> = {
		introduction: "Define the setting and your character. What's your motivation?",
		call_to_adventure:
			'Use the prompt to fuel your imagination regarding what calls you to explore and visit the island.',
		crossing_the_threshold:
			'Something happens to you and you resolve to start this journey and enter unknown territory...use the prompt to fuel your imagination.',
		meeting_the_mentor:
			'Your path toward your goal is getting harder. You meet a human or more than human entity and receive help that takes you forward. Use the prompt to fuel your imagination.',
		trials_and_growth:
			'You are facing a challenge. Here is where you grow stronger. Use the prompt to inspire what challenge you meet and how you overcome it and how do you grow.',
		death_and_transformation:
			'You thought you had it all sorted... But you have to face one more ordeal! Use the prompt to inspire what challenge you meet and how you overcome it, and survive, transform. How are you transformed?',
		change_and_return:
			'You have reached your goal, transformed and seen the world with new eyes. You are ready for the next phase of your life. Use the prompt to imagine how you changed and what happens next.',
		reflection:
			'Still embodying your character, please reflect on the wisdom that you will carry forward into the world.'
	};

	// ── Map & GPS state ───────────────────────────────────────────────────────

	let userLocation = $state<{ lng: number; lat: number } | null>(null);
	$effect(() => { console.log('[GPS] userLocation', userLocation); });
	let mapCenter = $state<[number, number]>(
		data.gameLocation ? [data.gameLocation.longitude, data.gameLocation.latitude] : [0, 0]
	);
	let geoWatchId: number | null = null;

	// ── Interaction state — persisted across refreshes via localStorage ───────
	const UNLOCK_KEY = `unlock_${data.session_id}`;
	function readUnlockCache() {
		if (typeof window === 'undefined') return null;
		try {
			return JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? 'null');
		} catch {
			return null;
		}
	}
	const _saved = readUnlockCache();
	let selectedPoiId = $state<number | null>(_saved?.selectedPoiId ?? null);

	// Distance/bearing to game starting location (used during intro phase)
	let gameLocationDistance = $derived(
		userLocation && gameLocation ? Math.round(haversineMeters(userLocation, gameLocation)) : null
	);
	let atStartingLocation = $derived(gameLocationDistance !== null && gameLocationDistance <= 50);

	let selectedCard = $state<Card | null>(_saved?.selectedCard ?? null);
	let canDeepen = $state<boolean>(_saved?.canDeepen ?? false);

	// POIs within their unlock radius (unvisited only)
	let inRangeUnvisitedPois = $derived.by(() => {
		if (session.play_mode !== 'gps' || !hasIntroduction || userLocation === null)
			return [] as Poi[];
		const loc = userLocation;
		return (pois as Poi[]).filter(
			(p) =>
				!(visitedPoiIds as number[]).includes(p.id) && haversineMeters(loc, p) <= (p.radius ?? 50)
		);
	});

	// Nearest unvisited POI overall — forces player to approach the closest one first
	let nearestUnvisitedPoi = $derived.by(() => {
		if (session.play_mode !== 'gps' || !hasIntroduction || userLocation === null) return null;
		const unvisited = (pois as Poi[]).filter((p) => !(visitedPoiIds as number[]).includes(p.id));
		if (!unvisited.length) return null;
		const loc = userLocation;
		return unvisited.reduce((a, b) => (haversineMeters(loc, a) <= haversineMeters(loc, b) ? a : b));
	});

	let selectedPoiDistance = $derived.by(() => {
		if (session.play_mode !== 'gps' || selectedPoiId === null || userLocation === null) return null;
		const poi = (pois as Poi[]).find((p) => p.id === selectedPoiId);
		return poi ? haversineMeters(userLocation, poi) : null;
	});

	// Companion reacts to the nearest in-range POI — derived independently of selectedPoiId
	// to avoid a race where the old selectedPoiId (effect-updated) lags behind inRangeUnvisitedPois (derived)
	const nearbyPoiId = $derived.by(() => {
		if (!hasIntroduction) return null;
		if (session.play_mode === 'remote') return selectedPoiId;
		if (!userLocation || inRangeUnvisitedPois.length === 0) return null;
		const loc = userLocation;
		return inRangeUnvisitedPois.reduce((a, b) =>
			haversineMeters(loc, a) <= haversineMeters(loc, b) ? a : b
		).id;
	});

	let canUnlock = $derived.by(() => {
		if (!hasIntroduction || selectedPoiId === null) return false;
		if ((visitedPoiIds as number[]).includes(selectedPoiId)) return false;
		if (session.play_mode === 'remote') return true;
		return inRangeUnvisitedPois.some((p) => p.id === selectedPoiId);
	});

	let selectedPoiRadius = $derived.by(() => {
		const poi = (pois as Poi[]).find((p) => p.id === selectedPoiId);
		return poi?.radius ?? 50;
	});

	let selectedPoiDistanceMeters = $derived(
		session.play_mode === 'gps' && selectedPoiDistance !== null
			? Math.round(selectedPoiDistance)
			: null
	);

	let currentStepTitle = $derived.by(() => {
		if (!hasIntroduction) return 'Introduction';
		if (reflectionSegment) return 'Story Complete';
		if (allStepsDone) return 'Reflection';
		return session.current_hero_step ? (HERO_STEP_LABELS[session.current_hero_step] ?? '') : '';
	});
	let currentGoal = $derived.by(() => {
		if (reflectionSegment) return { text: 'Your story is complete.', icon: CheckCheck };
		if (allStepsDone) return { text: 'Write your reflection.', icon: MessageCircle };
		if (!hasIntroduction) {
			if (session.play_mode === 'gps' && !atStartingLocation)
				return { text: 'Go to the starting location.', icon: Navigation2 };
			if (session.play_mode === 'gps') return { text: 'Start your journey.', icon: Flag };
			return { text: 'Write your introduction.', icon: PenLine };
		}
		if (selectedCard) return { text: 'Write the next part of your story.', icon: PenLine };
		if (session.play_mode === 'gps') {
			if (canUnlock)
				return { text: 'Unlock this location to continue your journey.', icon: LockOpen };
			if (nearestUnvisitedPoi)
				return { text: 'Move to a location to unlock it.', icon: Navigation2 };
			return { text: 'Write the next part of your story.', icon: PenLine };
		}
		if (!selectedPoiId) return { text: 'Select a location to unlock.', icon: MousePointerClick };
		if (canUnlock)
			return { text: 'Unlock this location to continue your journey.', icon: LockOpen };
		return { text: 'Write the next part of your story.', icon: PenLine };
	});

	let currentStepIndicator = $derived.by(() => {
		if (!hasIntroduction) {
			return {
				label: 'I',
				icon: Flag,
				className: 'bg-destructive text-white border-destructive size-5'
			};
		}
		if (allStepsDone) {
			return {
				label: 'R',
				icon: MessageCircle,
				className: 'bg-dark-green text-white border-dark-green size-5'
			};
		}
		return {
			label: String(Math.max(currentStepIndex + 1, 1)),
			icon: null,
			className: 'bg-dark-green text-white border-dark-green size-5'
		};
	});

	function handleExit() {
		if (window.confirm('Exit this game session?')) {
			goto(`/play/${game_id}`);
		}
	}

	// Card flip animation
	type CardAnimState = 'hidden' | 'entering' | 'flipping' | 'revealed';
	let cardAnimState = $state<CardAnimState>('hidden');
	let cardSlideIn = $state(false);

	let segmentType = $state<'step' | 'deepening'>('step');
	let isUnlocking = $state(false);
	let isSavingIntro = $state(false);
	let isSavingStep = $state(false);
	let isSavingReflection = $state(false);
	let introContent = $state('');
	let stepContent = $state('');
	let reflectionContent = $state('');

	// Story sheet
	let sheetOpen = $state(data.session.play_mode === 'remote' && !data.hasIntroduction);

	// AI companion chat state — shared between trigger (top bar) and sheet (root level)
	type ChatMessage = { role: 'user' | 'assistant'; content: string };
	let chatIsOpen = $state(false);
	let chatMessages = $state<ChatMessage[]>([]);
	let chatIsLoading = $state(false);
	let proactivePoisSeen = new SvelteSet<string>(); // Tracks "{poiId}-{heroStep}" pairs already reacted to
	let aiChatRef = $state<{
		send: (text: string) => Promise<void>;
		commentOnSegment: (content: string) => Promise<void>;
	} | null>(null);

	// Scroll refs
	let scrollContainer = $state<HTMLElement | null>(null);
	let sectionRefs = new SvelteMap<string, HTMLElement>();
	let keyboardPadding = $state(32);

	function refAction(node: HTMLElement, key: string) {
		sectionRefs.set(key, node);
		return {
			destroy() {
				sectionRefs.delete(key);
			}
		};
	}

	function scrollToSection(key: string) {
		const el = sectionRefs.get(key);
		if (el && scrollContainer) {
			scrollContainer.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
		}
	}

	// ── GPS helpers ──────────────────────────────────────────────────────────

	const getPoiIcon = (type: string) => {
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
				return MapPin;
		}
	};

	const getPoiMarkerColor = (type: string) => {
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
				return 'bg-blue-600';
		}
	};

	const getPoiMarkerTypeStyle = (type: string) => {
		switch (type) {
			case 'nature':
				return 'text-nature-green bg-nature-green/10';
			case 'history':
				return 'text-history-yellow bg-history-yellow/10';
			case 'sense':
				return 'text-purple-600 bg-purple-600/10';
			case 'action':
				return 'text-sense-red bg-sense-red/10';
			case 'landmark':
				return 'text-landmark-green bg-landmark-green/10';
			default:
				return 'text-blue-600';
		}
	};

	// Returns full !important override strings so Tailwind JIT includes them at build time
	const getPoiOverrideColor = (type?: string): string => {
		switch (type) {
			case 'nature':
				return '!bg-nature-green';
			case 'history':
				return '!bg-history-yellow';
			case 'sense':
				return '!bg-purple-600';
			case 'action':
				return '!bg-sense-red';
			case 'landmark':
				return '!bg-landmark-green';
			default:
				return '';
		}
	};

	function haversineMeters(
		a: { lng: number; lat: number },
		b: { longitude: number; latitude: number }
	): number {
		const R = 6371000;
		const dLat = ((b.latitude - a.lat) * Math.PI) / 180;
		const dLng = ((b.longitude - a.lng) * Math.PI) / 180;
		const lat1 = (a.lat * Math.PI) / 180;
		const lat2 = (b.latitude * Math.PI) / 180;
		const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
		return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
	}

	// Auto-select POI (GPS mode): prefer nearest in-range, fall back to nearest overall for navigation
	$effect(() => {
		if (session.play_mode !== 'gps' || !hasIntroduction || selectedCard !== null) return;
		if (inRangeUnvisitedPois.length > 0 && userLocation) {
			const loc = userLocation;
			selectedPoiId = inRangeUnvisitedPois.reduce((a, b) =>
				haversineMeters(loc, a) <= haversineMeters(loc, b) ? a : b
			).id;
		} else {
			selectedPoiId = nearestUnvisitedPoi?.id ?? null;
		}
	});

	// Persist unlock state across refreshes
	$effect(() => {
		if (selectedPoiId !== null || selectedCard !== null) {
			localStorage.setItem(UNLOCK_KEY, JSON.stringify({ selectedPoiId, selectedCard, canDeepen }));
		} else {
			localStorage.removeItem(UNLOCK_KEY);
		}
	});

	onMount(() => {
		if (session.play_mode === 'gps' && navigator.geolocation) {
			// EMA smoothing factor: 0 = no update, 1 = raw GPS. 0.2 gives smooth movement.
			const ALPHA = 0.2;
			// Discard readings worse than this accuracy (metres)
			const MAX_ACCURACY = 80;

			geoWatchId = navigator.geolocation.watchPosition(
				(pos) => {
					if (pos.coords.accuracy > MAX_ACCURACY) return;
					const next = { lng: pos.coords.longitude, lat: pos.coords.latitude };
					userLocation = userLocation
						? {
								lng: ALPHA * next.lng + (1 - ALPHA) * userLocation.lng,
								lat: ALPHA * next.lat + (1 - ALPHA) * userLocation.lat
							}
						: next;
				},
				() => {
					userLocation = null;
				},
				{ enableHighAccuracy: true, maximumAge: 3000 }
			);
		}

		// Keyboard height compensation
		if (window.visualViewport) {
			const vv = window.visualViewport;
			const onResize = () => {
				keyboardPadding = Math.max(32, window.innerHeight - vv.height + 16);
			};
			vv.addEventListener('resize', onResize);
		}

		requestAnimationFrame(() => {
			if (!hasIntroduction) scrollToSection('intro');
			else if (session.current_hero_step) scrollToSection(session.current_hero_step);
			else if (allStepsDone) scrollToSection('reflection');
		});
	});

	onDestroy(() => {
		if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
	});

	// ── Derived locations ────────────────────────────────────────────────────

	let selectedPoi = $derived((pois as Poi[]).find((p) => p.id === selectedPoiId) ?? null);
	const nearestPoiOverrideColor = $derived(getPoiOverrideColor(selectedPoi?.type));

	async function beginWritingFromUnlock(card: Card, canDeepenVal: boolean) {
		selectedCard = card;
		canDeepen = canDeepenVal;
		stepContent = '';
		segmentType = 'step';
		cardAnimState = 'entering';
		cardSlideIn = false;
		await tick();
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				cardSlideIn = true;
				setTimeout(() => { cardAnimState = 'flipping'; }, 500);
				setTimeout(() => { cardAnimState = 'revealed'; }, 1100);
			});
		});
	}

	function openSheetForWriting() {
		cardSlideIn = false;
		setTimeout(() => { cardAnimState = 'hidden'; }, 300);
		sheetOpen = true;
		tick().then(() => {
			if (session.current_hero_step) scrollToSection(session.current_hero_step);
		});
	}

	// ── Map interaction ──────────────────────────────────────────────────────

	function handlePoiClick(poiId: number) {
		if ((visitedPoiIds as number[]).includes(poiId) || !hasIntroduction) return;
		if (session.play_mode === 'gps') return;
		selectedPoiId = poiId;
	}

	// Shared unlock enhance factory
	function makeUnlockEnhance() {
		return ({ formData }: { formData: FormData }) => {
			isUnlocking = true;
			if (userLocation) {
				formData.set('user_lng', String(userLocation.lng));
				formData.set('user_lat', String(userLocation.lat));
			}
			return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
				isUnlocking = false;
				if (result.type === 'success') {
					const d = result.data as { card?: Card; canDeepen?: boolean } | null;
					if (d?.card) {
						await beginWritingFromUnlock(d.card, d.canDeepen ?? false);
					} else {
						await update();
					}
				} else {
					await update();
				}
			};
		};
	}

	const sheetBottomStyle = $derived(sheetOpen ? 'calc(72dvh + 8px)' : '64px');
</script>

<div class="relative h-dvh w-full overflow-hidden">
	<!-- Map -->
	<MapLibre
		style="https://tiles.openfreemap.org/styles/liberty"
		class="h-full w-full touch-none"
		attributionControl={false}
		bind:center={mapCenter}
		zoom={gameLocation ? 14 : 10}
	>
		{#if gameLocation}
			<Marker lngLat={[gameLocation.longitude, gameLocation.latitude]}>
				<div class="relative flex items-center justify-center">
					{#if !hasIntroduction}
						<span
							class="absolute inline-flex size-10 animate-ping rounded-full bg-start-red opacity-30"
						></span>
					{/if}
					<div
						class="relative flex size-10 items-center justify-center rounded-full p-2 text-white shadow-lg ring-2 ring-white {hasIntroduction
							? 'bg-gray-300'
							: 'bg-start-red'}"
					>
						<Flag class="size-6" strokeWidth={2} />
					</div>
				</div>
			</Marker>
		{/if}

		{#each pois as poi (poi.id)}
			{@const isVisited = (visitedPoiIds as number[]).includes(poi.id)}
			{@const isSelected = poi.id === selectedPoiId}
			{@const PoiIcon = getPoiIcon(poi.type)}
			{@const poiColor = getPoiMarkerColor(poi.type)}
			<Marker lngLat={[poi.longitude, poi.latitude]}>
				<div class="flex flex-col items-center gap-1">
					<button
						onclick={() => handlePoiClick(poi.id)}
						class="flex size-10 items-center justify-center rounded-full p-2 text-white shadow-lg ring-2 ring-white transition-all
							{isVisited ? 'bg-gray-300' : isSelected ? 'scale-110 ' + poiColor : poiColor}"
						title={poi.name}
					>
						<PoiIcon class="size-6" strokeWidth={2} />
					</button>
					{#if inRangeUnvisitedPois.some((p) => p.id === poi.id) || isSelected}
						<span
							class="rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow-md {poiColor}"
						>
							{poi.name}
						</span>
					{/if}
				</div>
			</Marker>
		{/each}

		{#if session.play_mode === 'gps' && userLocation}
			<Marker lngLat={[userLocation.lng, userLocation.lat]}>
				<div class="relative flex items-center justify-center">
					<span
						class="absolute inline-flex size-14 animate-ping rounded-full bg-blue-400 opacity-20"
					></span>

					<div class="relative size-3 rounded-full bg-blue-500 shadow-lg ring-2 ring-white"></div>
				</div>
			</Marker>
		{/if}
	</MapLibre>

	<!-- ── Top controls ──────────────────────────────────────────────── -->
	<div class="absolute top-0 right-0 left-0 z-10 mx-auto justify-between p-3">
		<div class="relative flex items-start">
			<!-- Chat trigger + geolocate — far left -->
			<div class="z-20 flex shrink-0 flex-col items-center gap-8">
				{#if companion}
					<AiChat
						bind:this={aiChatRef}
						sessionId={session_id}
						{nearbyPoiId}
						focusedPoiId={selectedPoiId}
						currentHeroStep={session.current_hero_step ?? null}
						currentCard={selectedCard}
						companionName={companion.name}
						companionAvatarUrl={companion.avatar_url}
						bind:isOpen={chatIsOpen}
						bind:messages={chatMessages}
						bind:isLoading={chatIsLoading}
						{proactivePoisSeen}
					/>
				{/if}
				{#if session.play_mode === 'gps'}
					<Button
						size="icon-lg"
						variant="outline"
						onclick={() => {
							if (userLocation) mapCenter = [userLocation.lng, userLocation.lat];
						}}
						class=""
						aria-label="Center on my location"
					>
						<LocateFixed class="size-5" />
					</Button>
				{/if}
			</div>

			<!-- Exit button — far right -->
			<Button
				size="icon-lg"
				variant="destructive"
				onclick={handleExit}
				class="ml-auto shrink-0"
				aria-label="Exit game"
			>
				<LogOut class="size-5" />
			</Button>
		</div>
	</div>

	<!-- ── Step indicator — below top bar, centered ─────────────────── -->
	<div class="absolute top-0 left-1/2 z-10 m-3 -translate-x-1/2">
		<div
			class="flex items-center gap-2 rounded-full border-2 border-dark-green bg-primary-foreground p-3 pr-6 shadow-lg"
		>
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-dark-green font-bold {currentStepIndicator.className}"
			>
				{#if currentStepIndicator.icon}
					<currentStepIndicator.icon class="h-5 w-5" />
				{:else}
					{currentStepIndicator.label}
				{/if}
			</div>
			<div class="flex flex-col items-start justify-items-start gap-1">
				<p class="text-lg leading-tight font-black text-dark-green">{currentStepTitle}</p>
				<div class="flex items-center gap-1 text-sm text-black">
					<currentGoal.icon class="h-4 w-4 shrink-0" />
					<span class="max-w-48 truncate font-medium">{currentGoal.text}</span>
				</div>
			</div>
		</div>
	</div>

	<!-- ── Card flip overlay ──────────────────────────────────────────── -->
	{#if cardAnimState !== 'hidden'}
		<div
			class="absolute inset-0 z-30 flex items-center justify-center bg-black/50 transition-opacity duration-300
				{cardSlideIn ? 'opacity-100' : 'opacity-0'}"
		>
			<div class="card-flip-container relative z-10">
				<div
					class="card-flipper [transition-property:transform,opacity,translate] duration-500
						{cardAnimState === 'flipping' || cardAnimState === 'revealed' ? 'is-flipped' : ''}
						{cardSlideIn ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}"
				>
					{#if selectedCard}
						{@const CardIcon = getCardIcon(selectedCard.type)}
						{@const headerBg = getCardHeaderBg(selectedCard.type)}
						<!-- Back face -->
						<div class="card-face flex flex-col items-center justify-center {headerBg}">
							<div class="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/20">
								<CardIcon class="h-10 w-10 text-white" />
							</div>
							<div class="mt-5 h-1 w-12 rounded-full bg-white/25"></div>
							<div class="mt-2 h-1 w-7 rounded-full bg-white/25"></div>
						</div>
						<!-- Front face -->
						<div class="card-face card-front flex flex-col overflow-hidden rounded-xl border-8 border-white shadow-2xl outline-2 outline-gray-200">
							<div class="flex flex-col items-center gap-2 p-4 {headerBg}">
								<div class="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
									<CardIcon class="h-8 w-8 text-white" />
								</div>
								<h3 class="line-clamp-3 text-center text-sm font-bold leading-tight text-white">
									{selectedCard.title}
								</h3>
							</div>
							<div class="flex flex-1 flex-col justify-between bg-white p-4 pt-6">
								{#if selectedCard.prompt}
									<p class="line-clamp-[7] text-center text-sm leading-relaxed text-black">
										{selectedCard.prompt}
									</p>
								{/if}
								<Button class="mt-4 w-full" onclick={openSheetForWriting}>Write story</Button>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- ── GPS intro bar (go to starting location / start journey) ───── -->
	{#if session.play_mode === 'gps' && !hasIntroduction && selectedCard === null}
		<div
			class="absolute right-0 left-0 z-20 flex flex-col items-center gap-3 px-4 py-3 transition-[bottom] duration-300"
			style="bottom: {sheetBottomStyle}"
		>
			{#if atStartingLocation}
				<!-- At starting location — show Start journey button -->
				<Button
					size="lg"
					class="w-full max-w-xs rounded-full font-bold"
					onclick={() => {
						sheetOpen = true;
						tick().then(() => scrollToSection('intro'));
					}}
				>
					Start your journey
				</Button>
			{:else}
				<!-- Not yet at starting location — show distance -->
				{#if gameLocationDistance !== null}
					<div
						class="flex items-center justify-center rounded-xl border-2 border-dark-green bg-white px-4 py-3"
					>
						<p class="text-sm font-bold text-dark-green">
							{gameLocationDistance}m to starting location
						</p>
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- ── Floating proximity card (GPS + remote) ────────────────────── -->
	{#if hasIntroduction && !allStepsDone && selectedCard === null && selectedPoi}
		<div
			class="absolute right-0 left-0 z-20 mx-auto w-full max-w-md px-4 transition-[bottom] duration-300"
			style="bottom: {sheetBottomStyle}"
		>
			<div class="overflow-hidden rounded-2xl border border-dark-green bg-white shadow-xl">
				<div class="aspect-video w-full">
					{#if selectedPoi.image_url}
						<img src={selectedPoi.image_url} alt={selectedPoi.name} class="h-full w-full object-cover" />
					{:else}
						<div class="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
							<MapPin class="size-5" />
						</div>
					{/if}
				</div>
				<div class="space-y-2 p-3">
					<div class="flex items-center gap-2">
						{#if selectedPoi.type}
							<span class="rounded-full px-2 py-0.5 text-xs font-medium uppercase {getPoiMarkerTypeStyle(selectedPoi.type)}">{selectedPoi.type}</span>
						{/if}
						<p class="line-clamp-1 text-sm font-bold text-dark-green">{selectedPoi.name}</p>
					</div>
					{#if session.play_mode === 'gps' && selectedPoiDistanceMeters !== null && selectedPoiRadius !== null}
						<p class="text-xs text-dark-green/70">{selectedPoiDistanceMeters}m away · {selectedPoiRadius}m unlock radius</p>
					{/if}
					{#if canUnlock}
						<form method="POST" action="?/unlockPoi" use:enhance={makeUnlockEnhance()}>
							<input type="hidden" name="poi_id" value={selectedPoiId} />
							<Button
								type="submit"
								size="sm"
								class="w-full font-bold !text-white {nearestPoiOverrideColor}"
								disabled={isUnlocking}
							>
								{isUnlocking ? 'Unlocking…' : `Unlock ${selectedPoi.name}`}
							</Button>
						</form>
					{:else}
						<p class="text-xs text-dark-green/70">Move closer to unlock this location.</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}


	<!-- ── AI Companion sheet (rendered at root to escape top bar stacking context) ── -->
	{#if companion}
		<AiChatSheet
			bind:isOpen={chatIsOpen}
			bind:messages={chatMessages}
			isLoading={chatIsLoading}
			companionName={companion.name}
			companionAvatarUrl={companion.avatar_url}
			playerAvatarUrl={session.characters?.image_url ?? null}
			onSend={(text) => aiChatRef?.send(text)}
		/>
	{/if}

	<!-- ── Story sheet ────────────────────────────────────────────────── -->
	<div
		class="absolute right-0 bottom-0 left-0 z-20 mx-auto max-w-3xl transition-[height] duration-300 ease-out"
		style="height: {sheetOpen ? '80dvh' : '52px'}"
	>
		<div class="flex h-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl">
			<!-- Handle + header toggle -->
			<button
				class="w-full shrink-0 text-left"
				onclick={() => (sheetOpen = !sheetOpen)}
				aria-label={sheetOpen ? 'Collapse story sheet' : 'Expand story sheet'}
			>
				<div class="flex justify-center pt-3 pb-1">
					<div class="h-1 w-10 rounded-full bg-gray-200"></div>
				</div>
				<div class="relative flex items-center justify-center px-5 pb-3">
					<span class="text-sm font-bold text-dark-green">Story Sheet</span>
					<ChevronDown
						class="absolute right-5 h-4 w-4 text-muted-foreground transition-transform duration-300
							{sheetOpen ? 'rotate-180' : ''}"
					/>
				</div>
			</button>

			<!-- Scrollable content -->
			<div
				class="flex-1 overflow-y-auto p-4"
				style="padding-bottom: {keyboardPadding}px"
				bind:this={scrollContainer}
			>
				<!-- ── Introduction ── -->
				<section use:refAction={'intro'} class="px-5 py-10">
					<div class="flex flex-col gap-4">
						<!-- Circle -->
						<div class="flex items-center gap-2">
							<div
								class="flex h-9 w-9 items-center justify-center rounded-full border-2
									border-destructive bg-destructive"
							>
								<Flag class="h-4 w-4 text-white" />
							</div>
							<p class="font-bold text-dark-green">Introduction</p>
						</div>
						<!-- Content -->
						<div class="min-w-0 flex-1 space-y-3">
							<!-- Character card -->
							<div
								class="flex items-center gap-3 rounded-xl border border-gray-300 p-3"
								style="background-color: {session.characters?.bg_color ??
									'#f9fafb'}; color: {session.characters?.text_color ?? 'inherit'};"
							>
								{#if session.characters?.image_url}
									<img
										src={session.characters.image_url}
										alt={session.characters.name ?? ''}
										class="h-14 w-14 shrink-0 rounded-full object-cover"
									/>
								{/if}
								<div class="min-w-0">
									<p class="leading-tight font-semibold">{session.character_name}</p>
									{#if session.characters?.name}
										<p class="text-sm opacity-70">{session.characters.name}</p>
									{/if}
									{#if session.characters?.summary}
										<p class="mt-1 line-clamp-3 text-sm leading-relaxed opacity-70">
											{session.characters.summary}
										</p>
									{/if}
								</div>
							</div>
							<p class="text-sm leading-relaxed text-muted-foreground">
								{HERO_STEP_GOALS.introduction}
							</p>
							{#if introSegment}
								<Textarea value={introSegment.content} disabled class="min-h-[160px]" />
							{:else}
								<form
									method="POST"
									action="?/saveIntroduction"
									use:enhance={() => {
										isSavingIntro = true;
										return async ({ result, update }) => {
											isSavingIntro = false;
											if (result.type === 'success') {
												sheetOpen = false;
												await update({ reset: false });
												await tick();
												scrollToSection(HERO_STEPS[0]);
											} else {
												await update();
											}
										};
									}}
								>
									<Textarea
										name="content"
										bind:value={introContent}
										placeholder="The morning was crisp as I stepped into the unknown…"
										class="min-h-[160px]"
									/>
									<Button
										type="submit"
										size="lg"
										class="mt-4 w-full font-bold"
										disabled={isSavingIntro || !introContent.trim()}
									>
										{isSavingIntro ? 'Saving…' : 'Begin the journey'}
									</Button>
								</form>
							{/if}
						</div>
					</div>
				</section>
				<Separator class="mx-auto w-4/5 bg-dark-green" />

				<!-- ── Hero steps ── -->
				{#each HERO_STEPS as step, i (step)}
					{@const label = HERO_STEP_LABELS[step]}
					{@const doneSegment = stepSegments[step]}
					{@const isCurrent = !doneSegment && hasIntroduction && i === currentStepIndex}
					{@const isWriting = isCurrent && selectedCard !== null}
					{@const isLocked = !doneSegment && !isCurrent}

					<section use:refAction={step} class="px-5 py-10 {isLocked ? 'opacity-40' : ''}">
						<div class="flex flex-col gap-4">
							<!-- Circle -->
							<div class="flex items-center gap-2">
								<div
									class="flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all
										{doneSegment
										? 'border-dark-green bg-dark-green text-white'
										: isCurrent
											? 'border-dark-green bg-white text-dark-green'
											: 'border-gray-300 bg-white text-gray-400'}"
								>
									{i + 1}
								</div>
								<p class="font-bold {isLocked ? 'text-gray-400' : 'text-foreground'}">{label}</p>
							</div>
							<!-- Content -->
							<div class="min-w-0 flex-1 space-y-3">
								<!-- Location + Card prompt -->
								{#if doneSegment?.card_id || (isWriting && selectedCard)}
									{@const card = doneSegment?.card_id ? ((cards as Card[]).find((c) => c.id === doneSegment!.card_id) ?? null) : selectedCard}
									{@const poi = doneSegment?.poi_id ? ((pois as Poi[]).find((p) => p.id === doneSegment!.poi_id) ?? null) : selectedPoi}
									<div class="flex flex-col gap-2">
										{#if poi}
											{@const PoiIcon = getPoiIcon(poi.type ?? '')}
											{@const poiTypeStyle = getPoiMarkerTypeStyle(poi.type ?? '')}
											<div class="flex items-center gap-2 rounded-xl border border-gray-200 p-2">
												{#if poi.image_url}
													<img src={poi.image_url} alt={poi.name} class="h-12 w-20 shrink-0 rounded-lg object-cover" />
												{:else}
													<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
														<PoiIcon class="h-5 w-5 text-muted-foreground" />
													</div>
												{/if}
												<div class="min-w-0">
													{#if poi.type}
														<span class="rounded-full px-2 py-0.5 text-xs font-medium uppercase {poiTypeStyle}">{poi.type}</span>
													{/if}
													<p class="truncate text-sm font-semibold text-dark-green">{poi.name}</p>
												</div>
											</div>
										{/if}
										{#if card}
											{@const CardIcon = getCardIcon(card.type)}
											{@const headerBg = getCardHeaderBg(card.type)}
											<div class="flex items-start gap-3 rounded-xl border border-gray-300 p-3">
												<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {headerBg}">
													<CardIcon class="h-4 w-4 text-white" />
												</div>
												<div class="min-w-0">
													<p class="text-sm font-semibold text-foreground">{card.title}</p>
													{#if card.prompt}
														<p class="mt-1 text-sm leading-relaxed text-muted-foreground">{card.prompt}</p>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								{/if}

								<!-- Step description -->
								<p class="text-sm leading-relaxed text-muted-foreground">{HERO_STEP_GOALS[step]}</p>

								{#if doneSegment}
									<Textarea value={doneSegment.content} disabled class="min-h-[160px]" />
								{:else if isWriting}
									{#if canDeepen}
										<div class="flex gap-2">
											<Button
												variant={segmentType === 'step' ? 'default' : 'outline'}
												size="lg"
												class="flex-1"
												onclick={() => (segmentType = 'step')}>Next step</Button
											>
											<Button
												variant={segmentType === 'deepening' ? 'default' : 'outline'}
												size="lg"
												class="flex-1"
												onclick={() => (segmentType = 'deepening')}>Deepen</Button
											>
										</div>
									{/if}
									<form
										method="POST"
										action="?/saveSegment"
										use:enhance={() => {
											isSavingStep = true;
											const savedContent = stepContent;
											return async ({ result, update }) => {
												isSavingStep = false;
												if (result.type === 'success') {
													const d = result.data as {
														completed?: boolean;
														nextStep?: string | null;
													};
													selectedCard = null;
													selectedPoiId = null;
													stepContent = '';
													segmentType = 'step';
													sheetOpen = !!d?.completed;
													await update({ reset: false });
													await tick();
													if (d?.completed) scrollToSection('reflection');
													else if (d?.nextStep) scrollToSection(d.nextStep);
													aiChatRef?.commentOnSegment(savedContent);
												} else {
													await update();
												}
											};
										}}
									>
										<input type="hidden" name="poi_id" value={selectedPoiId} />
										<input type="hidden" name="segment_type" value={segmentType} />
										{#if selectedCard}<input
												type="hidden"
												name="card_id"
												value={selectedCard.id}
											/>{/if}
										<Textarea
											name="content"
											bind:value={stepContent}
											placeholder="Continue your story…"
											class="min-h-[180px]"
										/>
										<Button
											type="submit"
											size="lg"
											class="mt-2 w-full font-bold"
											disabled={isSavingStep || !stepContent.trim()}
										>
											{isSavingStep ? 'Saving…' : 'Save & continue'}
										</Button>
									</form>
								{:else}
									<Textarea
										disabled
										placeholder="Unlock a location to write this chapter…"
										class="min-h-[120px]"
									/>
								{/if}
							</div>
						</div>
					</section>
					<Separator class="mx-auto w-4/5 bg-dark-green" />
				{/each}

				<!-- ── Reflection ── -->
				<section
					use:refAction={'reflection'}
					class="px-5 py-10 {!allStepsDone ? 'opacity-40' : ''}"
				>
					<div class="flex flex-col gap-4">
						<!-- Circle -->
						<div class="flex shrink-0 flex-col items-center">
							<div
								class="transition-allborder-dark-green flex h-9 w-9 items-center justify-center rounded-full border-2 bg-dark-green"
							>
								<MessageCircle class="h-4 w-4 text-white" />
							</div>
							<p class="font-bold {!allStepsDone ? 'text-gray-400' : 'text-foreground'}">
								Reflection
							</p>
						</div>
						<!-- Content -->
						<div class="min-w-0 flex-1 space-y-3">
							<p class="text-sm leading-relaxed text-muted-foreground">
								{HERO_STEP_GOALS.reflection}
							</p>
							{#if reflectionSegment}
								<Textarea value={reflectionSegment.content} disabled class="min-h-[180px]" />
								<Button href="/play/{game_id}/session/{session_id}/story" class="w-full" size="sm">
									View complete story
								</Button>
							{:else if allStepsDone}
								<form
									method="POST"
									action="?/saveReflection"
									use:enhance={() => {
										isSavingReflection = true;
										return async ({ result, update }) => {
											isSavingReflection = false;
											if (result.type === 'success') {
												goto(`/play/${game_id}/session/${session_id}/story`);
											} else {
												await update({ reset: false });
											}
										};
									}}
								>
									<Textarea
										name="content"
										bind:value={reflectionContent}
										placeholder="Looking back on this journey…"
										class="min-h-[180px]"
									/>
									<Button
										type="submit"
										size="lg"
										class="mt-2 w-full font-bold"
										disabled={isSavingReflection || !reflectionContent.trim()}
									>
										{isSavingReflection ? 'Saving…' : 'Complete your story'}
									</Button>
								</form>
							{:else}
								<Textarea
									disabled
									placeholder="Complete all steps to write your reflection…"
									class="min-h-[120px]"
								/>
							{/if}
						</div>
					</div>
				</section>
			</div>
		</div>
	</div>
</div>

<style>
	.card-flip-container {
		perspective: 1200px;
		width: min(288px, 80vw);
	}
	.card-flipper {
		position: relative;
		transform-style: preserve-3d;
		transition: transform 0.6s ease-in-out;
		aspect-ratio: 2 / 3;
	}
	.card-flipper.is-flipped {
		transform: rotateY(180deg);
	}
	.card-face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		border-radius: 1rem;
		overflow: hidden;
	}
	.card-front {
		transform: rotateY(180deg);
	}
</style>
