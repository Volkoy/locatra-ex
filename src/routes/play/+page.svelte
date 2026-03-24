<script lang="ts">
	import { onMount } from 'svelte';
	import { MapLibre, Marker } from 'svelte-maplibre';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Search, Map, List, MapPin } from 'lucide-svelte';
	import GameCard from '$lib/components/play/game-card.svelte';

	let { data } = $props();

	type Game = {
		id: number;
		game_id: string;
		title: string;
		description: string;
		image_url: string | null;
		longitude: number;
		latitude: number;
		distance_meters: number;
	};

	let viewMode = $state<'list' | 'map'>('list');
	let searchQuery = $state('');
	let userLocation = $state<{ lng: number; lat: number } | null>(null);
	let sortedGames = $state<Game[]>(data.games as Game[]);

	function haversine(
		a: { lng: number; lat: number },
		b: { longitude: number; latitude: number }
	): number {
		const R = 6371;
		const dLat = ((b.latitude - a.lat) * Math.PI) / 180;
		const dLng = ((b.longitude - a.lng) * Math.PI) / 180;
		const lat1 = (a.lat * Math.PI) / 180;
		const lat2 = (b.latitude * Math.PI) / 180;
		const x =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
		return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
	}

	onMount(() => {
		if (!navigator.geolocation) return;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				userLocation = { lng: pos.coords.longitude, lat: pos.coords.latitude };
				sortedGames = [...(data.games as Game[])].sort(
					(a, b) => haversine(userLocation!, a) - haversine(userLocation!, b)
				);
			},
			() => {},
			{ enableHighAccuracy: true }
		);
	});

	let filteredGames = $derived(
		sortedGames.filter((g) => g.title?.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	function getDistance(game: Game): number | null {
		if (!userLocation) return null;
		return haversine(userLocation, game);
	}

	let mapCenter = $derived<[number, number]>(
		userLocation ? [userLocation.lng, userLocation.lat] : [0, 20]
	);
	let mapZoom = $derived(userLocation ? 12 : 2);

	let hoveredGameId = $state<string | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	function showCard(id: string) {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		hoveredGameId = id;
	}
	function hideCard() {
		hideTimer = setTimeout(() => {
			hoveredGameId = null;
		}, 150);
	}
</script>

<!--
  Layout:
  - Mobile: header + search/toggle bar + list OR map (toggled)
  - Desktop (md+): left panel (header + search + scrollable list) | right panel (map, always visible)
-->
<div class="flex h-[calc(100svh-var(--app-nav-height,0px))] flex-col overflow-hidden">
	<!-- ── Desktop: two-panel ── -->
	<div class="hidden md:flex md:flex-1 md:overflow-hidden">
		<!-- Left panel -->
		<div class="flex w-80 shrink-0 flex-col border-r lg:w-96">
			<!-- Header -->
			<div class="border-b bg-white px-4 py-4">
				<h1 class="text-2xl font-bold text-dark-green">Games</h1>
				<p class="text-sm text-muted-foreground">Explore games near you</p>
			</div>

			<!-- Search -->
			<div class="border-b bg-white px-4 py-3">
				<div class="relative">
					<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input type="text" placeholder="Search games..." bind:value={searchQuery} class="pl-9" />
				</div>
			</div>

			<!-- Scrollable list -->
			<div class="flex-1 divide-y overflow-y-auto">
				{#if filteredGames.length === 0}
					<div class="py-16 text-center text-muted-foreground">
						<Map class="mx-auto mb-3 h-12 w-12 opacity-30" />
						<p class="text-lg font-medium">No games found</p>
						<p class="text-sm">Try a different search term</p>
					</div>
				{:else}
					{#each filteredGames as game (game.game_id)}
						<GameCard {game} distance={getDistance(game)} />
					{/each}
				{/if}
			</div>
		</div>

		<!-- Right panel: map -->
		<div class="flex-1">
			<MapLibre
				style="https://tiles.openfreemap.org/styles/bright"
				class="h-full w-full"
				center={mapCenter}
				zoom={mapZoom}
			>
				{#each filteredGames as game (game.game_id)}
					{#if game.longitude && game.latitude}
						<Marker lngLat={[game.longitude, game.latitude]}>
							<div
								class="relative"
								onmouseenter={() => showCard(game.game_id)}
								onmouseleave={hideCard}
							>
								<!-- Pin -->
								<a href="/play/{game.game_id}">
									<div
										class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-dark-green shadow-lg transition-colors hover:bg-landmark-green"
									>
										<MapPin class="h-4 w-4 text-white" />
									</div>
								</a>
								<!-- Hover card -->
								{#if hoveredGameId === game.game_id}
									<div
										class="absolute bottom-11 left-1/2 z-50 w-56 -translate-x-1/2 rounded-xl border bg-white shadow-xl"
										onmouseenter={() => showCard(game.game_id)}
										onmouseleave={hideCard}
									>
										{#if game.image_url}
											<img
												src={game.image_url}
												alt={game.title}
												class="h-28 w-full rounded-t-xl object-cover"
											/>
										{/if}
										<div class="p-3">
											<p class="leading-tight font-semibold text-dark-green">{game.title}</p>
											{#if game.description}
												<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
													{game.description}
												</p>
											{/if}
											{#if getDistance(game) !== null}
												<p class="mt-1 text-xs text-muted-foreground">
													{getDistance(game)!.toFixed(1)} km away
												</p>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						</Marker>
					{/if}
				{/each}

				{#if userLocation}
					<Marker lngLat={[userLocation.lng, userLocation.lat]}>
						<div
							class="h-4 w-4 animate-pulse rounded-full border-2 border-white bg-blue-500 shadow"
						></div>
					</Marker>
				{/if}
			</MapLibre>
		</div>
	</div>

	<!-- ── Mobile: toggled list / map ── -->
	<div class="flex flex-1 flex-col overflow-hidden md:hidden">
		<!-- Header -->
		<div class="border-b bg-white px-4 py-4">
			<h1 class="text-2xl font-bold text-dark-green">Games</h1>
			<p class="text-sm text-muted-foreground">Explore games near you</p>
		</div>

		<!-- Search + Toggle -->
		<div class="flex items-center gap-2 border-b bg-white px-4 py-3">
			<div class="relative flex-1">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input type="text" placeholder="Search games..." bind:value={searchQuery} class="pl-9" />
			</div>
			<div class="flex gap-1">
				<Button
					variant={viewMode === 'list' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (viewMode = 'list')}
				>
					<List class="h-4 w-4" />
				</Button>
				<Button
					variant={viewMode === 'map' ? 'default' : 'outline'}
					size="sm"
					onclick={() => (viewMode = 'map')}
				>
					<Map class="h-4 w-4" />
				</Button>
			</div>
		</div>

		<!-- Content -->
		{#if viewMode === 'list'}
			<div class="flex-1 divide-y overflow-y-auto">
				{#if filteredGames.length === 0}
					<div class="py-16 text-center text-muted-foreground">
						<Map class="mx-auto mb-3 h-12 w-12 opacity-30" />
						<p class="text-lg font-medium">No games found</p>
						<p class="text-sm">Try a different search term</p>
					</div>
				{:else}
					{#each filteredGames as game (game.game_id)}
						<GameCard {game} distance={getDistance(game)} />
					{/each}
				{/if}
			</div>
		{:else}
			<div class="flex-1">
				<MapLibre
					style="https://tiles.openfreemap.org/styles/bright"
					class="h-full w-full"
					center={mapCenter}
					zoom={mapZoom}
				>
					{#each filteredGames as game (game.game_id)}
						{#if game.longitude && game.latitude}
							<Marker lngLat={[game.longitude, game.latitude]}>
								<a href="/play/{game.game_id}">
									<div
										class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-slate-700 shadow-lg hover:bg-slate-800"
										title={game.title}
									>
										<span class="text-xs font-bold text-white">G</span>
									</div>
								</a>
							</Marker>
						{/if}
					{/each}

					{#if userLocation}
						<Marker lngLat={[userLocation.lng, userLocation.lat]}>
							<div
								class="h-4 w-4 animate-pulse rounded-full border-2 border-white bg-blue-500 shadow"
							></div>
						</Marker>
					{/if}
				</MapLibre>
			</div>
		{/if}
	</div>
</div>
