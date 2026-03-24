<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { goto } from '$app/navigation';
	import { MapLibre, Marker, GeolocateControl } from 'svelte-maplibre';
	import type { Map } from 'maplibre-gl';
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
		EllipsisVertical,
		Flag,
		MessageCircle,
		PenLine,
		LockOpen,
		CheckCheck,
		MousePointerClick
	} from 'lucide-svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
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
	type Poi = { id: number; name: string; longitude: number; latitude: number; radius?: number };
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
	let currentStepTitle = $derived.by(() => {
		if (!hasIntroduction) return 'Introduction';
		if (reflectionSegment) return 'Story Complete';
		if (allStepsDone) return 'Reflection';
		return session.current_hero_step ? (HERO_STEP_LABELS[session.current_hero_step] ?? '') : '';
	});

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

	// ── Map & GPS state (declared early — referenced by derived below) ────────

	// Map bearing (controlled via svelte-maplibre's bindable prop)
	let mapBearing = $state(0);

	// GPS state
	let userLocation = $state<{ lng: number; lat: number } | null>(null);
	const nearbyPoiIds = new SvelteSet<number>();
	let heading = $state<number | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let geolocateControl = $state<any>(undefined);
	let mapLoaded = $state(false);
	let map = $state<Map | undefined>(undefined);
	// Stored once — map owns its position after initial mount; prevents re-centering on data updates
	let mapCenter = $state<[number, number]>(
		data.gameLocation ? [data.gameLocation.longitude, data.gameLocation.latitude] : [0, 0]
	);

	// ── Progress & goal (depend on nearbyPoiIds) ──────────────────────────────

	// 0 = intro, 1–6 = steps, 7 = reflection
	let currentProgressIndex = $derived.by(() => {
		if (!hasIntroduction) return 0;
		if (allStepsDone) return 7;
		return currentStepIndex >= 0 ? currentStepIndex + 1 : 1;
	});

	// Interaction state — persisted across refreshes via localStorage
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
	const nearbyPoiId = $derived(
		session.play_mode === 'remote' ? selectedPoiId : ([...nearbyPoiIds][0] ?? null)
	);

	// Distance/bearing to game starting location (used during intro phase)
	let gameLocationDistance = $derived(
		userLocation && gameLocation ? Math.round(haversineMeters(userLocation, gameLocation)) : null
	);
	let gameLocationBearing = $derived(
		userLocation && gameLocation ? getBearing(userLocation, gameLocation) : null
	);
	let relativeGameBearing = $derived(
		gameLocationBearing !== null && heading !== null
			? (gameLocationBearing - heading + 360) % 360
			: gameLocationBearing
	);
	let atStartingLocation = $derived(gameLocationDistance !== null && gameLocationDistance <= 50);

	let selectedCard = $state<Card | null>(_saved?.selectedCard ?? null);
	let canDeepen = $state<boolean>(_saved?.canDeepen ?? false);

	let canUnlock = $derived(
		hasIntroduction &&
			selectedPoiId !== null &&
			!(visitedPoiIds as number[]).includes(selectedPoiId) &&
			(session.play_mode === 'remote' || nearbyPoiIds.has(selectedPoiId))
	);

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
		if (canUnlock) return { text: 'Unlock the location to continue.', icon: LockOpen };
		if (session.play_mode === 'gps' && nearbyPoiIds.size === 0)
			return { text: 'Go to the next location.', icon: Navigation2 };
		if (session.play_mode === 'remote' && !selectedPoiId)
			return { text: 'Select a location to unlock.', icon: MousePointerClick };
		return { text: 'Write the next part of your story.', icon: PenLine };
	});

	let progressTrack: HTMLElement | null = null;
	let progressNodeEls = $state<(HTMLElement | null)[]>(new Array(8).fill(null));

	$effect(() => {
		const idx = currentProgressIndex;
		requestAnimationFrame(() => {
			const el = progressNodeEls[idx];
			if (!el || !progressTrack) return;
			// Use getBoundingClientRect so position is relative to the visible track,
			// not the offsetParent (which may differ from the scroll container)
			const elRect = el.getBoundingClientRect();
			const trackRect = progressTrack.getBoundingClientRect();
			const elCenter = elRect.left - trackRect.left + progressTrack.scrollLeft + elRect.width / 2;
			progressTrack.scrollTo({
				left: elCenter - progressTrack.offsetWidth / 2,
				behavior: 'smooth'
			});
		});
	});

	// Listen to GeolocateControl position updates → update userLocation + nearbyPoiIds
	$effect(() => {
		if (!geolocateControl) return;
		geolocateControl.on('geolocate', updateNearby);
		return () => geolocateControl?.off('geolocate', updateNearby);
	});

	// Auto-trigger tracking once the map is loaded and control is ready (GPS mode only).
	// Plain variable (not $state) so re-runs of this effect don't call trigger() a second time,
	// which would toggle tracking OFF.
	let geolocateTriggered = false;
	$effect(() => {
		if (!geolocateControl || !mapLoaded || session.play_mode !== 'gps' || geolocateTriggered)
			return;
		geolocateTriggered = true;
		geolocateControl.trigger();
	});

	let segmentType = $state<'step' | 'deepening'>('step');
	let isUnlocking = $state(false);
	let isSavingIntro = $state(false);
	let isSavingStep = $state(false);
	let isSavingReflection = $state(false);
	let introContent = $state('');
	let stepContent = $state('');
	let reflectionContent = $state('');

	// Card flip animation
	type CardAnimState = 'hidden' | 'entering' | 'flipping' | 'revealed';
	let cardAnimState = $state<CardAnimState>('hidden');
	let cardSlideIn = $state(false);

	// Story sheet
	let sheetOpen = $state(data.session.play_mode === 'remote' && !data.hasIntroduction);

	// AI companion chat state — shared between trigger (top bar) and sheet (root level)
	type ChatMessage = { role: 'user' | 'assistant'; content: string };
	let chatIsOpen = $state(false);
	let chatMessages = $state<ChatMessage[]>([]);
	let chatIsLoading = $state(false);
	let aiChatRef = $state<{ send: (text: string) => Promise<void>; commentOnSegment: (content: string) => Promise<void> } | null>(null);

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

	function getBearing(
		from: { lng: number; lat: number },
		to: { longitude: number; latitude: number }
	): number {
		const lat1 = (from.lat * Math.PI) / 180;
		const lat2 = (to.latitude * Math.PI) / 180;
		const dLon = ((to.longitude - from.lng) * Math.PI) / 180;
		const y = Math.sin(dLon) * Math.cos(lat2);
		const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
		return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
	}

	function updateNearby(pos: GeolocationPosition) {
		const lng = pos.coords.longitude;
		const lat = pos.coords.latitude;
		userLocation = { lng, lat };
		if (map && lng != null && lat != null) {
			map.easeTo({ center: [lng, lat], duration: 500 });
		}
		nearbyPoiIds.clear();
		for (const poi of pois as Poi[]) {
			if (!(visitedPoiIds as number[]).includes(poi.id)) {
				const dist = haversineMeters(userLocation, poi);
				if (dist <= (poi.radius ?? 50)) nearbyPoiIds.add(poi.id);
			}
		}
	}

	let hasAbsoluteOrientation = false;
	let lastOrientationUpdate = 0;
	const ORIENTATION_THROTTLE_MS = 100; // ~10fps for bearing updates

	function handleOrientation(e: DeviceOrientationEvent) {
		// Prefer absolute events once we get real data from them; ignore relative fallback after that
		if (!e.absolute && hasAbsoluteOrientation) return;

		let h: number | null = null;
		const webkit = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
		if (webkit.webkitCompassHeading !== undefined) {
			h = webkit.webkitCompassHeading;
		} else if (e.alpha !== null) {
			h = (360 - e.alpha) % 360;
		}
		if (e.absolute && h !== null) hasAbsoluteOrientation = true;

		if (h !== null) {
			heading = h; // heading used for compass needle UI — always update
			// Throttle map bearing updates to avoid flooding Svelte reactivity during touch
			const now = Date.now();
			if (now - lastOrientationUpdate >= ORIENTATION_THROTTLE_MS) {
				lastOrientationUpdate = now;
				mapBearing = h;
			}
		}
	}

	// Auto-select nearby POI (GPS mode)
	$effect(() => {
		if (session.play_mode !== 'gps' || cardAnimState !== 'hidden') return;
		const firstNearby = (pois as Poi[]).find(
			(p) => nearbyPoiIds.has(p.id) && !(visitedPoiIds as number[]).includes(p.id)
		);
		if (firstNearby && selectedPoiId !== firstNearby.id) {
			selectedPoiId = firstNearby.id;
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
		if (session.play_mode === 'gps') {
			// Compass / heading — drives mapBearing and bottom compass needle.
			// Register both absolute (Android/real device) and relative (Chrome DevTools simulation).
			type IOSDeviceOrientationEvent = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
			if (typeof (DeviceOrientationEvent as IOSDeviceOrientationEvent).requestPermission === 'function') {
				// iOS 13+
				(DeviceOrientationEvent as IOSDeviceOrientationEvent)
					.requestPermission!()
					.then((state: string) => {
						if (state === 'granted') {
							window.addEventListener(
								'deviceorientation',
								handleOrientation as EventListener,
								true
							);
						}
					})
					.catch(() => {});
			} else {
				window.addEventListener(
					'deviceorientationabsolute',
					handleOrientation as EventListener,
					true
				);
				window.addEventListener('deviceorientation', handleOrientation as EventListener, true);
			}
		}

		// Keyboard height compensation — lifts scroll container above the software keyboard
		if (window.visualViewport) {
			const vv = window.visualViewport;
			const onViewportResize = () => {
				keyboardPadding = Math.max(32, window.innerHeight - vv.height + 16);
			};
			vv.addEventListener('resize', onViewportResize);
		}

		requestAnimationFrame(() => {
			if (!hasIntroduction) scrollToSection('intro');
			else if (session.current_hero_step) scrollToSection(session.current_hero_step);
			else if (allStepsDone) scrollToSection('reflection');
		});
	});

	onDestroy(() => {
		if (typeof window === 'undefined') return;
		window.removeEventListener(
			'deviceorientationabsolute',
			handleOrientation as EventListener,
			true
		);
		window.removeEventListener('deviceorientation', handleOrientation as EventListener, true);
		window.visualViewport?.removeEventListener('resize', () => {});
	});

	// ── Derived locations ────────────────────────────────────────────────────

	let selectedPoi = $derived((pois as Poi[]).find((p) => p.id === selectedPoiId) ?? null);

	let nearestUnvisited = $derived.by((): Poi | null => {
		const unvisited = (pois as Poi[]).filter((p) => !(visitedPoiIds as number[]).includes(p.id));
		if (!unvisited.length) return null;
		if (userLocation && session.play_mode === 'gps') {
			return unvisited.reduce((best, p) =>
				haversineMeters(userLocation!, p) < haversineMeters(userLocation!, best) ? p : best
			);
		}
		return unvisited[0];
	});

	let nearestDistance = $derived(
		nearestUnvisited && userLocation && session.play_mode === 'gps'
			? Math.round(haversineMeters(userLocation, nearestUnvisited))
			: null
	);

	let poiBearing = $derived(
		userLocation && nearestUnvisited ? getBearing(userLocation, nearestUnvisited) : null
	);

	// Bearing relative to device heading → compass needle points to POI
	let relativeBearing = $derived(
		poiBearing !== null && heading !== null ? (poiBearing - heading + 360) % 360 : poiBearing
	);

	// ── Card animation ───────────────────────────────────────────────────────

	async function triggerCardAnimation(card: Card, canDeepenVal: boolean) {
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
				setTimeout(() => {
					cardAnimState = 'flipping';
				}, 500);
				setTimeout(() => {
					cardAnimState = 'revealed';
				}, 1100);
			});
		});
	}

	function openSheetForWriting() {
		cardSlideIn = false;
		setTimeout(() => {
			cardAnimState = 'hidden';
		}, 300);
		sheetOpen = true;
		tick().then(() => {
			if (session.current_hero_step) scrollToSection(session.current_hero_step);
		});
	}


	// ── Map interaction ──────────────────────────────────────────────────────

	function handlePoiClick(poiId: number) {
		if ((visitedPoiIds as number[]).includes(poiId) || !hasIntroduction) return;
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
						await triggerCardAnimation(d.card, d.canDeepen ?? false);
					} else {
						await update();
					}
				} else {
					await update();
				}
			};
		};
	}

	const sheetBottomStyle = $derived(sheetOpen ? 'calc(72vh + 8px)' : '64px');
</script>

<div class="relative h-screen w-full overflow-hidden">
	<!-- Map -->
	<MapLibre
		style="https://tiles.openfreemap.org/styles/liberty"
		class="h-full w-full touch-none"
		attributionControl={false}
		bind:center={mapCenter}
		zoom={gameLocation ? 14 : 10}
		bind:map
		bind:bearing={mapBearing}
		bind:loaded={mapLoaded}
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
				<button
					onclick={() => handlePoiClick(poi.id)}
					class="flex size-10 items-center justify-center rounded-full p-2 text-white shadow-lg ring-2 ring-white transition-all
						{isVisited ? 'bg-gray-300' : isSelected ? 'scale-110 ' + poiColor : poiColor}"
					title={poi.name}
				>
					<PoiIcon class="size-6" strokeWidth={2} />
				</button>
			</Marker>
		{/each}

		{#if session.play_mode === 'gps'}
			<GeolocateControl
				trackUserLocation={true}
				showAccuracyCircle={false}
				positionOptions={{ enableHighAccuracy: true, maximumAge: 0 }}
				bind:control={geolocateControl}
				position="bottom-right"
			/>
		{/if}
	</MapLibre>

	<!-- ── Custom locate button (GPS mode) ───────────────────────────── -->
	{#if session.play_mode === 'gps'}
		<button
			onclick={() => geolocateControl?.trigger()}
			class="absolute right-4 top-1/2 z-[25] flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg transition-colors hover:bg-white/90 active:bg-white/80"
			aria-label="Center on my location"
		>
			<Navigation2 class="size-5 text-dark-green" />
		</button>
	{/if}

	<!-- ── Gradient vignettes ──────────────────────────────────────────── -->
	<div
		class="pointer-events-none absolute inset-x-0 top-0 z-[5] h-40 bg-gradient-to-b from-dark-green/60 to-transparent"
	></div>
	<div
		class="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-56 bg-gradient-to-t from-dark-green/60 to-transparent"
	></div>

	<!-- ── Top bar ────────────────────────────────────────────────────── -->
	<div
		class="absolute top-0 right-0 left-0 z-10 mx-auto max-w-3xl rounded-b-3xl bg-dark-green p-2 text-white"
	>
		<div class="relative flex items-center justify-center">
			<!-- Companion chat button (top-left) -->
			<div class="absolute top-0 left-0 mt-2">
				{#if companion}
					<AiChat
						bind:this={aiChatRef}
						sessionId={session_id}
						{nearbyPoiId}
						currentHeroStep={session.current_hero_step ?? null}
						currentCard={selectedCard}
						companionName={companion.name}
						companionAvatarUrl={companion.avatar_url}
						bind:isOpen={chatIsOpen}
						bind:messages={chatMessages}
						bind:isLoading={chatIsLoading}
					/>
				{/if}
			</div>

			<!-- Options menu -->
			<div class="absolute top-0 right-0 mt-2">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="flex size-8 items-center justify-center rounded-full text-white hover:bg-white/20"
								aria-label="Options"
							>
								<EllipsisVertical class="size-5" />
							</button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Item variant="destructive" onclick={() => goto(`/play/${game_id}`)}>
							<LogOut class="size-4" />
							Exit game
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>

			<!-- Scrollable progress track (centred, fades at edges) -->
			<div
				class="mt-2 flex h-16 w-16 shrink-0 snap-x snap-mandatory items-center overflow-x-auto rounded-full bg-white"
				style="scrollbar-width:none;"
				bind:this={progressTrack}
			>
				<div class="flex items-center" style="padding-inline: calc(50% - 20px);">
					<!-- Intro node -->
					<div
						bind:this={progressNodeEls[0]}
						class="flex h-10 w-10 shrink-0 snap-center items-center justify-center rounded-full border-2 border-destructive
							bg-destructive transition-all"
					>
						<Flag class="h-4 w-4 text-white" />
					</div>

					{#each HERO_STEPS as step, i (step)}
						<!-- Connecting line -->
						<div
							class="h-1 w-8 shrink-0 transition-colors
								{i === 0
								? hasIntroduction
									? 'bg-dark-green'
									: 'bg-gray-300'
								: stepSegments[HERO_STEPS[i - 1]]
									? 'bg-dark-green'
									: 'bg-gray-300'}"
						></div>
						<!-- Step circle -->
						<div
							bind:this={progressNodeEls[i + 1]}
							class="flex h-10 w-10 shrink-0 snap-center items-center justify-center rounded-full border-2 text-sm font-bold transition-all
								{stepSegments[step]
								? 'border-dark-green bg-dark-green text-white'
								: i === currentStepIndex
									? 'border-dark-green bg-dark-green text-white'
									: 'border-gray-300 bg-white text-gray-400'}"
						>
							{i + 1}
						</div>
					{/each}

					<!-- Line before reflection -->
					<div
						class="h-1 w-8 shrink-0 transition-colors {allStepsDone
							? 'bg-dark-green'
							: 'bg-gray-300'}"
					></div>

					<!-- Reflection node -->
					<div
						bind:this={progressNodeEls[7]}
						class="flex h-10 w-10 shrink-0 snap-center items-center justify-center rounded-full border-2 transition-all
							{reflectionSegment
							? 'border-dark-green bg-dark-green'
							: allStepsDone
								? 'border-dark-green bg-dark-green'
								: 'border-gray-300 bg-white'}"
					>
						<MessageCircle
							class="h-4 w-4
								{reflectionSegment ? 'text-white' : allStepsDone ? 'text-white' : 'text-gray-400'}"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Step title + goal -->
		<div class="my-2 flex flex-col items-center gap-2 text-center">
			<p class="text-lg font-bold text-white">{currentStepTitle}</p>
			<div
				class="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-medium text-dark-green"
			>
				<currentGoal.icon class="h-3.5 w-3.5 shrink-0" />
				<span>{currentGoal.text}</span>
			</div>
		</div>
	</div>

	<!-- ── Card flip overlay ──────────────────────────────────────────── -->
	{#if cardAnimState !== 'hidden'}
		<!-- Backdrop -->
		<div
			class="absolute inset-0 z-30 flex items-center justify-center bg-black/50 transition-opacity duration-300
				{cardSlideIn ? 'opacity-100' : 'opacity-0'}"
		>
			<div class="absolute inset-0"></div>
			<!-- Card -->
			<div class="card-flip-container relative z-10">
				<div
					class="card-flipper transition-[transform] duration-500
						{cardAnimState === 'flipping' || cardAnimState === 'revealed' ? 'is-flipped' : ''}
						[transition-property:transform,opacity,translate] duration-500
						{cardSlideIn ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}"
				>
					{#if selectedCard}
						{@const CardIcon = getCardIcon(selectedCard.type)}
						{@const headerBg = getCardHeaderBg(selectedCard.type)}

						<!-- Back face: type color + icon -->
						<div class="card-face flex flex-col items-center justify-center {headerBg}">
							<div
								class="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/20"
							>
								<CardIcon class="h-10 w-10 text-white" />
							</div>
							<div class="mt-5 h-1 w-12 rounded-full bg-white/25"></div>
							<div class="mt-2 h-1 w-7 rounded-full bg-white/25"></div>
						</div>

						<!-- Front face: matches authoring tool layout -->
						<div
							class="card-face card-front flex flex-col overflow-hidden rounded-xl border-8 border-white shadow-2xl outline-2 outline-gray-200"
						>
							<!-- Colored header with icon + title -->
							<div class="flex flex-col items-center gap-2 p-4 {headerBg}">
								<div class="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
									<CardIcon class="h-8 w-8 text-white" />
								</div>
								<h3 class="line-clamp-3 text-center text-sm leading-tight font-bold text-white">
									{selectedCard.title}
								</h3>
							</div>
							<!-- White body with prompt + button -->
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
				<!-- Not yet at starting location — show compass + distance -->
				<div
					class="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dark-green bg-white p-2"
				>
					{#if relativeGameBearing !== null}
						<div class="flex size-12 items-center justify-center">
							<Navigation2
								strokeWidth={2}
								class="size-8 text-dark-green transition-transform duration-200"
								style="transform: rotate({relativeGameBearing}deg)"
							/>
						</div>
					{/if}
					{#if gameLocationDistance !== null}
						<p class="text-sm font-bold text-dark-green">
							{gameLocationDistance}m away
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── GPS bottom bar (compass + distance + unlock) ──────────────── -->
	{#if session.play_mode === 'gps' && hasIntroduction && !allStepsDone && selectedCard === null}
		<div
			class="absolute right-0 left-0 z-20 flex flex-col items-center gap-2 transition-[bottom] duration-300"
			style="bottom: {sheetBottomStyle}"
		>
			<!-- Navigation icon + distance -->
			{#if relativeBearing !== null || nearestDistance !== null}
				<div
					class="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dark-green bg-white p-2"
				>
					{#if relativeBearing !== null}
						<div class="flex size-12 items-center justify-center">
							<Navigation2
								strokeWidth={2}
								class="size-8 text-dark-green transition-transform duration-200"
								style="transform: rotate({relativeBearing}deg)"
							/>
						</div>
					{/if}
					{#if nearestDistance !== null}
						<p class="text-sm font-bold text-dark-green">{nearestDistance}m away</p>
					{/if}
				</div>
			{/if}

			<!-- Unlock button (only when in range) -->
			{#if canUnlock}
				<form
					method="POST"
					action="?/unlockPoi"
					class="flex w-full justify-center"
					use:enhance={makeUnlockEnhance()}
				>
					<input type="hidden" name="poi_id" value={selectedPoiId} />
					<Button
						size="lg"
						type="submit"
						class="w-full max-w-xs rounded-full font-bold"
						disabled={isUnlocking}
					>
						{isUnlocking ? 'Unlocking…' : `Unlock ${selectedPoi?.name ?? 'location'}`}
					</Button>
				</form>
			{/if}
		</div>
	{/if}

	<!-- ── Remote mode: unlock bar ────────────────────────────────────── -->
	{#if session.play_mode === 'remote' && canUnlock && selectedCard === null}
		<div
			class="absolute right-0 left-0 z-20 max-w-lg px-4 py-2 transition-[bottom] duration-300
				{canUnlock ? 'mx-auto' : 'mx-4'}"
			style="bottom: {sheetBottomStyle}"
		>
			<form
				method="POST"
				action="?/unlockPoi"
				class="flex w-full justify-center"
				use:enhance={makeUnlockEnhance()}
			>
				<input type="hidden" name="poi_id" value={selectedPoiId} />
				<Button
					size="lg"
					type="submit"
					class="w-full max-w-xs rounded-full font-bold"
					disabled={isUnlocking}
				>
					{isUnlocking ? 'Unlocking…' : `Unlock ${selectedPoi?.name ?? 'location'}`}
				</Button>
			</form>
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
			onSend={(text) => aiChatRef?.send(text)}
		/>
	{/if}

	<!-- ── Story sheet ────────────────────────────────────────────────── -->
	<div
		class="absolute right-0 bottom-0 left-0 z-20 mx-auto max-w-3xl transition-[height] duration-300 ease-out"
		style="height: {sheetOpen ? '80vh' : '52px'}"
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
								<!-- Card prompt (done: look up from cards; writing: use selectedCard) -->
								{#if doneSegment?.card_id}
									{@const doneCard = (cards as Card[]).find((c) => c.id === doneSegment!.card_id)}
									{#if doneCard}
										{@const CardIcon = getCardIcon(doneCard.type)}
										{@const headerBg = getCardHeaderBg(doneCard.type)}
										<div class="flex items-start gap-3 rounded-xl border border-gray-300 p-3">
											<div
												class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {headerBg}"
											>
												<CardIcon class="h-4 w-4 text-white" />
											</div>
											<div class="min-w-0">
												<p class="text-sm font-semibold text-foreground">{doneCard.title}</p>
												{#if doneCard.prompt}
													<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
														{doneCard.prompt}
													</p>
												{/if}
											</div>
										</div>
									{/if}
								{:else if isWriting && selectedCard}
									{@const CardIcon = getCardIcon(selectedCard.type)}
									{@const headerBg = getCardHeaderBg(selectedCard.type)}
									<div class="flex items-start gap-3 rounded-xl border border-gray-300 p-3">
										<div
											class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {headerBg}"
										>
											<CardIcon class="h-4 w-4 text-white" />
										</div>
										<div class="min-w-0">
											<p class="text-sm font-semibold text-foreground">{selectedCard.title}</p>
											{#if selectedCard.prompt}
												<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
													{selectedCard.prompt}
												</p>
											{/if}
										</div>
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
													nearbyPoiIds.clear();
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

	/* Hide built-in GeolocateControl button — replaced by custom positioned button */
	:global(.maplibregl-ctrl-geolocate) {
		display: none !important;
	}
</style>
