<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as HoverCard from '$lib/components/ui/hover-card/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button';
	import { MapLibre, Marker, NavigationControl, GeolocateControl } from 'svelte-maplibre';
	import type { Map, MapMouseEvent, LngLat, GeoJSONSource } from 'maplibre-gl';
	import {
		Footprints,
		X,
		MapPin,
		Trash2,
		SquarePen,
		Flag,
		Search,
		List,
		Leaf,
		BookOpen,
		Eye,
		Landmark,
		ArrowLeft,
		ArrowRight
	} from 'lucide-svelte';
	import ImageUpload from './image-upload.svelte';
	import { Slider } from '$lib/components/ui/slider';
	import { superForm } from 'sveltekit-superforms';
	import { poiSchema } from '$lib/zod/schema';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Spinner } from './ui/spinner';

	let { data, params, supabase, session } = $props();

	const types = [
		{ value: 'nature', label: 'Nature' },
		{ value: 'history', label: 'History' },
		{ value: 'sense', label: 'Sense' },
		{ value: 'action', label: 'Action' },
		{ value: 'landmark', label: 'Landmark' }
	];

	type POI = {
		id: number;
		name: string;
		description: string;
		contextual_data: string;
		image_url?: string;
		type: string;
		tags: string[];
		latitude: number;
		longitude: number;
		radius: number;
	};

	let pois = $derived(data.pois || []);
	let isFormOpen = $state(false);
	let editingPOI = $state<POI | null>(null);
	let map = $state<Map>();
	let center = $derived(data.center);
	let tagInput = $state('');
	let tempMarkerPosition = $state<{ lng: number; lat: number } | null>(null);
	let hasInitialized = $state(false);
	let isDraggingMarker = $state(false);
	let justFinishedDragging = $state(false);
	let poiPositions = $state<Record<number, { lng: number; lat: number }>>({});
	let previousEditingPOIPosition = $state<{ lng: number; lat: number } | null>(null);
	let queryLocation = $state('');
	let searchResults = $state<Array<{ lat: string; lon: string; display_name: string }>>([]);
	let showSearchResults = $state(false);
	let isLoadingSearch = $state(false);
	let lastRequestTime = 0;
	const MIN_REQUEST_INTERVAL = 1000;
	let searchContainerRef: HTMLDivElement | null = null;
	let isListOpen = $state(false);

	// Initialize POI positions
	$effect(() => {
		pois.forEach((poi: POI) => {
			if (!poiPositions[poi.id]) {
				poiPositions[poi.id] = { lng: poi.longitude, lat: poi.latitude };
			}
		});
	});

	// Sync POI position to form data when editing and marker is dragged
	$effect(() => {
		if (editingPOI?.id && poiPositions[editingPOI.id]) {
			$formData.latitude = poiPositions[editingPOI.id].lat;
			$formData.longitude = poiPositions[editingPOI.id].lng;
		}
	});

	// Sync temp marker position to form data when creating and marker is dragged
	$effect(() => {
		if (tempMarkerPosition && !editingPOI) {
			$formData.latitude = tempMarkerPosition.lat;
			$formData.longitude = tempMarkerPosition.lng;
		}
	});

	// Clear temporary marker and reset drag state when form closes
	$effect(() => {
		if (!isFormOpen) {
			tempMarkerPosition = null;
			// Reset drag state in case it got stuck
			isDraggingMarker = false;
			justFinishedDragging = false;
			previousEditingPOIPosition = null;
			editingPOI = null;
		}
	});

	onMount(() => {
		if (map && center && !hasInitialized) {
			map.setCenter(center as LngLat);
			hasInitialized = true;
		}

		// Add global mouseup listener to reset drag state if it gets stuck
		const handleGlobalMouseUp = () => {
			if (isDraggingMarker) {
				isDraggingMarker = false;
				justFinishedDragging = true;
				setTimeout(() => {
					justFinishedDragging = false;
				}, 200);
			}
		};

		// Add click outside handler to close search results
		const handleClickOutside = (e: MouseEvent) => {
			if (
				showSearchResults &&
				searchContainerRef &&
				!searchContainerRef.contains(e.target as Node)
			) {
				showSearchResults = false;
			}
		};

		window.addEventListener('mouseup', handleGlobalMouseUp);
		document.addEventListener('click', handleClickOutside);

		return () => {
			window.removeEventListener('mouseup', handleGlobalMouseUp);
			document.removeEventListener('click', handleClickOutside);
		};
	});

	const form = superForm(data.form, {
		validators: zod4Client(poiSchema),
		dataType: 'json',
		resetForm: true,
		onUpdated: ({ form }) => {
			if (form.valid) {
				const action = editingPOI ? 'updated' : 'created';
				toast.success(`POI ${action} successfully!`);
				isFormOpen = false;
				editingPOI = null;
				tempMarkerPosition = null;
				invalidateAll();
			}
		}
	});

	const { form: formData, enhance, delayed } = form;

	const typeTriggerContent = $derived(
		types.find((t) => t.value === $formData.type)?.label || 'Select type'
	);

	async function rateLimitedFetch(url: string): Promise<Response> {
		const now = Date.now();
		const timeSinceLastRequest = now - lastRequestTime;

		if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
			// Wait for the remaining time
			await new Promise((resolve) =>
				setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
			);
		}

		lastRequestTime = Date.now();

		return fetch(url, {
			headers: {
				'User-Agent': 'LocatraEx/1.0 (cyred3@gmail.com)',
				Referer: window.location.origin
			}
		});
	}

	async function searchLocation(query: string) {
		if (!query || query.trim() === '') return;
		isLoadingSearch = true;
		searchResults = [];
		showSearchResults = true;
		try {
			const response = await rateLimitedFetch(
				`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
			);
			const results = (await response.json()) as Array<{
				lat: string;
				lon: string;
				display_name: string;
			}>;
			searchResults = results;
		} catch (error) {
			console.error('Location search failed:', error);
			toast.error('Failed to search location');
		} finally {
			isLoadingSearch = false;
		}
	}

	function selectLocation(result: { lat: string; lon: string; display_name: string }) {
		const lat = parseFloat(result.lat);
		const lng = parseFloat(result.lon);

		// Fly to the selected location
		if (map) {
			map.flyTo({
				center: [lng, lat],
				zoom: 16,
				duration: 1000
			});
		}

		// Clear search UI
		searchResults = [];
		showSearchResults = false;
		queryLocation = '';
	}

	const handleMapClick = (e: MapMouseEvent) => {
		// Don't handle map clicks when dragging markers or right after finishing a drag
		if (isDraggingMarker || justFinishedDragging) return;

		const { lng, lat } = e.lngLat;
		console.log('Map clicked at:', lng, lat);
		tempMarkerPosition = { lng, lat };

		// Fly to the clicked location with animation
		if (map) {
			const currentZoom = map.getZoom();
			const targetZoom = currentZoom < 16 ? 16 : currentZoom;

			map.flyTo({
				center: [lng, lat],
				zoom: targetZoom,
				duration: 1000
			});
		}

		editingPOI = null;
		$formData.id = undefined;
		$formData.name = '';
		$formData.description = '';
		$formData.image_url = '';
		$formData.contextual_data = '';
		$formData.type = '';
		$formData.tags = [];
		$formData.latitude = lat;
		$formData.longitude = lng;
		isFormOpen = true;
	};

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

	const getPoiColor = (type: string) => {
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

	const getPoiPaleBg = (type: string) => {
		switch (type) {
			case 'nature':
				return 'bg-nature-green/10';
			case 'history':
				return 'bg-history-yellow/10';
			case 'sense':
				return 'bg-purple-600/10';
			case 'action':
				return 'bg-sense-red/10';
			case 'landmark':
				return 'bg-landmark-green/10';
			default:
				return 'bg-gray-100';
		}
	};

	const getPoiTextColor = (type: string) => {
		switch (type) {
			case 'nature':
				return 'text-nature-green';
			case 'history':
				return 'text-history-yellow';
			case 'sense':
				return 'text-purple-600';
			case 'action':
				return 'text-sense-red';
			case 'landmark':
				return 'text-landmark-green';
			default:
				return 'text-gray-700';
		}
	};

	function createCircleGeoJSON(lng: number, lat: number, radiusMeters: number) {
		const n = 64;
		const coords: [number, number][] = [];
		const km = radiusMeters / 1000;
		const distX = km / (111.32 * Math.cos((lat * Math.PI) / 180));
		const distY = km / 110.574;
		for (let i = 0; i <= n; i++) {
			const theta = (i / n) * 2 * Math.PI;
			coords.push([lng + distX * Math.cos(theta), lat + distY * Math.sin(theta)]);
		}
		return {
			type: 'FeatureCollection' as const,
			features: [
				{
					type: 'Feature' as const,
					geometry: { type: 'Polygon' as const, coordinates: [coords] },
					properties: {}
				}
			]
		};
	}

	$effect(() => {
		const FILL = 'poi-radius-fill';
		const OUTLINE = 'poi-radius-outline';
		const SOURCE = 'poi-radius';

		const cleanup = () => {
			if (!map) return;
			if (map.getLayer(FILL)) map.removeLayer(FILL);
			if (map.getLayer(OUTLINE)) map.removeLayer(OUTLINE);
			if (map.getSource(SOURCE)) map.removeSource(SOURCE);
		};

		if (!map || !isFormOpen) return cleanup;

		const pos = editingPOI?.id ? poiPositions[editingPOI.id] : tempMarkerPosition;
		if (!pos) return cleanup;

		const geojson = createCircleGeoJSON(pos.lng, pos.lat, $formData.radius);

		if (map.getSource(SOURCE)) {
			(map.getSource(SOURCE) as GeoJSONSource).setData(geojson);
		} else {
			map.addSource(SOURCE, { type: 'geojson', data: geojson });
			map.addLayer({
				id: FILL,
				type: 'fill',
				source: SOURCE,
				paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.15 }
			});
			map.addLayer({
				id: OUTLINE,
				type: 'line',
				source: SOURCE,
				paint: { 'line-color': '#6366f1', 'line-width': 2, 'line-dasharray': [3, 2] }
			});
		}

		return cleanup;
	});

	const openEditForm = (poi: POI) => {
		tempMarkerPosition = null;
		editingPOI = poi;

		// Ensure POI position is in sync
		if (!poiPositions[poi.id]) {
			poiPositions[poi.id] = { lng: poi.longitude, lat: poi.latitude };
		}

		// Store the current position to restore if the user cancels
		previousEditingPOIPosition = { ...poiPositions[poi.id] };

		// Fly to POI location - use the current position from poiPositions
		if (map) {
			map.flyTo({
				center: [poiPositions[poi.id].lng, poiPositions[poi.id].lat],
				zoom: 16,
				duration: 1000
			});
		}

		$formData.id = poi.id;
		$formData.name = poi.name;
		$formData.description = poi.description || '';
		$formData.image_url = poi.image_url || '';
		$formData.contextual_data = poi.contextual_data || '';
		$formData.type = poi.type;
		$formData.tags = poi.tags || [];
		$formData.latitude = poiPositions[poi.id].lat;
		$formData.longitude = poiPositions[poi.id].lng;
		$formData.radius = poi.radius ?? 50;
		isFormOpen = true;
	};

	function addTag() {
		const sanitizedTag = tagInput.trim().replace(/\s+/g, '');

		if (sanitizedTag && !$formData.tags.includes(sanitizedTag)) {
			$formData.tags = [...$formData.tags, sanitizedTag];
			tagInput = '';
		}
	}

	function removeTag(index: number) {
		$formData.tags = $formData.tags.filter((_: string, i: number) => i !== index);
	}

	async function updatePOIPosition(id: number, lng: number, lat: number) {
		const formData = new FormData();
		formData.append('id', id.toString());
		formData.append('latitude', lat.toString());
		formData.append('longitude', lng.toString());

		const response = await fetch('?/updateLocation', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			toast.success('POI location updated!');
			await invalidateAll();
		} else {
			toast.error('Failed to update POI location');
		}
	}

	async function deletePOI(id: number) {
		if (!confirm('Are you sure you want to delete this POI?')) return;

		const formData = new FormData();
		formData.append('poiId', id.toString());

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			toast.success('POI deleted successfully!');
			await invalidateAll();
		} else {
			toast.error('Failed to delete POI');
		}
	}
</script>

<div class="flex h-full w-full flex-col gap-4">
	<!-- Header Section -->
	<div class="space-y-2">
		<h2 class="text-2xl font-bold text-gray-900">Points of Interest</h2>
		<p class="text-sm text-gray-600">
			Click anywhere on the map to create a new POI, or click an existing marker to edit it. Drag
			markers to adjust their locations.
		</p>
	</div>

	<!-- Location Search -->
	<div class="relative" bind:this={searchContainerRef}>
		<div class="flex gap-2">
			<Input
				type="text"
				placeholder="Search for a location..."
				bind:value={queryLocation}
				autocomplete="off"
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						searchLocation(queryLocation);
					}
				}}
			/>
			<Button
				type="button"
				variant="outline"
				onclick={() => searchLocation(queryLocation)}
				disabled={isLoadingSearch || !queryLocation.trim()}
			>
				{#if isLoadingSearch}
					<Spinner />
				{:else}
					<Search class="size-4" />
				{/if}
				Search
			</Button>
		</div>

		<!-- Search Results Dropdown -->
		{#if showSearchResults && searchResults.length > 0}
			<div
				class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
			>
				{#each searchResults as result (result.display_name)}
					<button
						type="button"
						onclick={() => selectLocation(result)}
						class="w-full cursor-pointer px-4 py-3 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
					>
						<p class="text-sm font-medium text-gray-900">{result.display_name}</p>
					</button>
				{/each}
			</div>
		{:else if showSearchResults && !isLoadingSearch && queryLocation && searchResults.length === 0}
			<div
				class="absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-3 shadow-lg"
			>
				<p class="text-sm text-gray-500">No results found for "{queryLocation}"</p>
			</div>
		{/if}
	</div>

	<!-- Map Section -->
	<div class="flex flex-1 gap-2 overflow-hidden">
		<div class="relative z-10 flex-1 rounded-lg border border-gray-300">
			<MapLibre
				style="https://tiles.openfreemap.org/styles/liberty"
				class="h-full w-full"
				bind:map
				zoom={14}
				onclick={handleMapClick}
				attributionControl={false}
			>
				{#each pois as poi (poi.id)}
					{#if poiPositions[poi.id]}
						{@const PoiIcon = getPoiIcon(poi.type)}
						{@const poiColor = getPoiColor(poi.type)}
						<Marker
							draggable
							bind:lngLat={poiPositions[poi.id]}
							ondragstart={() => {
								isDraggingMarker = true;
								justFinishedDragging = false;
							}}
							ondragend={() => {
								// Immediately reset drag state
								isDraggingMarker = false;
								justFinishedDragging = true;

								// Clear the flag after a short delay to prevent accidental map clicks
								setTimeout(() => {
									justFinishedDragging = false;
								}, 200);

								// Update form data if this POI is being edited
								if (editingPOI?.id === poi.id) {
									$formData.latitude = poiPositions[poi.id].lat;
									$formData.longitude = poiPositions[poi.id].lng;
								} else {
									// Auto-save position update for non-editing POIs
									updatePOIPosition(poi.id, poiPositions[poi.id].lng, poiPositions[poi.id].lat);
								}
							}}
						>
							<HoverCard.Root openDelay={200}>
								<HoverCard.Trigger>
									<div
										role="button"
										tabindex="0"
										onclick={(e) => {
											e.stopPropagation();
											if (!isDraggingMarker && !justFinishedDragging) openEditForm(poi);
										}}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												if (!isDraggingMarker && !justFinishedDragging) openEditForm(poi);
											}
										}}
										class="flex cursor-pointer flex-col items-center"
									>
										<div
											class="flex size-10 items-center justify-center rounded-full p-2 text-white shadow-lg ring-2 ring-white {poiColor}"
										>
											<PoiIcon class="size-6" stroke-width={2} />
										</div>
										<div
											class="mt-1 max-w-[120px] overflow-hidden rounded-md px-2 py-1 text-xs font-semibold text-ellipsis whitespace-nowrap text-white shadow-md backdrop-blur-sm {poiColor}"
										>
											{poi.name}
										</div>
									</div>
								</HoverCard.Trigger>
								{#if !isFormOpen}
									<HoverCard.Content class="w-80 overflow-hidden p-0">
										<div class="flex flex-col">
											<!-- POI Image -->
											<div
												class="relative h-32 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200"
											>
												{#if poi.image_url}
													<img
														src={poi.image_url}
														alt={poi.name}
														class="h-full w-full object-cover"
													/>
												{:else}
													<div class="flex h-full w-full items-center justify-center">
														<MapPin class="h-12 w-12 text-gray-300" />
													</div>
												{/if}
											</div>

											<!-- POI Content -->
											<div class="space-y-2 p-4">
												<!-- Type Badge -->
												<span
													class="self-start rounded-full px-2 py-0.5 text-xs font-medium uppercase {getPoiPaleBg(
														poi.type
													)} {getPoiTextColor(poi.type)}"
												>
													{poi.type}
												</span>
												<!-- POI Name -->
												<h4 class="line-clamp-2 text-base leading-tight font-bold text-gray-900">
													{poi.name}
												</h4>

												<!-- POI Description -->
												{#if poi.description}
													<p class="line-clamp-3 text-sm leading-relaxed text-gray-600">
														{poi.description}
													</p>
												{/if}

												<!-- Tags -->
												{#if poi.tags && poi.tags.length > 0}
													<div class="flex flex-wrap gap-1 pt-1">
														{#each poi.tags.slice(0, 5) as tag (tag)}
															<span
																class="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700"
															>
																#{tag}
															</span>
														{/each}
														{#if poi.tags.length > 5}
															<span class="text-xs text-gray-500">+{poi.tags.length - 5}</span>
														{/if}
													</div>
												{/if}

												<!-- Actions -->
												<div class="flex gap-2 pt-2">
													<Button
														size="sm"
														class="flex-1"
														onclick={(e) => {
															e.stopPropagation();
															openEditForm(poi);
														}}
													>
														<SquarePen class="size-3.5" /> Edit
													</Button>
													<Button
														size="sm"
														variant="destructive"
														onclick={(e) => {
															e.stopPropagation();
															deletePOI(poi.id);
														}}
													>
														<Trash2 class="size-3.5" />
													</Button>
												</div>
											</div>
										</div>
									</HoverCard.Content>
								{/if}
							</HoverCard.Root>
						</Marker>
					{/if}
				{/each}
				<!-- Temporary marker for new POI -->
				{#if tempMarkerPosition}
					<Marker
						draggable
						bind:lngLat={tempMarkerPosition}
						ondragstart={() => {
							isDraggingMarker = true;
							justFinishedDragging = false;
						}}
						ondragend={() => {
							// Immediately reset drag state
							isDraggingMarker = false;
							justFinishedDragging = true;

							// Clear the flag after a short delay
							setTimeout(() => {
								justFinishedDragging = false;
							}, 200);

							$formData.latitude = tempMarkerPosition!.lat;
							$formData.longitude = tempMarkerPosition!.lng;
						}}
					>
						<div class="flex flex-col items-center">
							<div
								class="flex size-10 items-center justify-center rounded-full bg-orange-500 p-2 text-white shadow-lg ring-2 ring-white"
							>
								<MapPin class="size-6" stroke-width={2} />
							</div>
							<div
								class="mt-1 rounded-md bg-orange-500/95 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white shadow-md backdrop-blur-sm"
							>
								New POI
							</div>
						</div>
					</Marker>
				{/if}
				<!-- Starting Location Marker -->
				{#if center}
					<Marker lngLat={center}>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger>
									<div class="flex flex-col items-center">
										<div
											class="flex size-10 items-center justify-center rounded-full bg-start-red p-2 text-white shadow-lg ring-2 ring-white"
										>
											<Flag class="size-6" stroke-width={2} />
										</div>
										<div
											class="mt-1 rounded-md bg-start-red/95 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white shadow-md backdrop-blur-sm"
										>
											Starting Location
										</div>
									</div>
								</Tooltip.Trigger>
								<Tooltip.Content
									>Go to General Information to edit the starting location</Tooltip.Content
								>
							</Tooltip.Root>
						</Tooltip.Provider>
					</Marker>
				{/if}
				<!-- Map Controls -->
				<NavigationControl position="top-left" />
				<GeolocateControl position="top-left" />
			</MapLibre>
		</div>
	</div>

	<!-- Bottom Bar -->
	<div class="flex items-center justify-between pt-2">
		<Button type="button" size="lg" onclick={() => (isListOpen = true)}>
			<List class="mr-2 size-5" />
			View POIs ({pois.length})
		</Button>
		<div class="flex gap-2">
			<Button size="lg" variant="outline" href="/dashboard/games/{params.id}/edit/characters">
				<ArrowLeft /> Back
			</Button>
			<Button size="lg" href="/dashboard/games/{params.id}/edit/cards">
				Next <ArrowRight />
			</Button>
		</div>
	</div>
</div>

<!-- Dialog Form -->
<Sheet.Root bind:open={isFormOpen}>
	<Sheet.Content
		class="fixed top-0 right-0 z-[100] h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
		onInteractOutside={(e) => e.preventDefault()}
	>
		<Sheet.Header>
			{#if $formData.type}
				<span
					class="self-start rounded-full px-2 py-0.5 text-xs font-medium uppercase {getPoiPaleBg(
						$formData.type
					)} {getPoiTextColor($formData.type)}"
				>
					{$formData.type}
				</span>
			{/if}
			<Sheet.Title class="text-2xl font-semibold">
				{editingPOI?.id ? 'Edit POI' : 'Create POI'}
			</Sheet.Title>
		</Sheet.Header>
		<form
			method="POST"
			action="?/{editingPOI ? 'update' : 'create'}"
			use:enhance
			class="space-y-6 p-4"
		>
			<div class="rounded-lg bg-gray-50">
				<p class="bg-gray-50 p-3 text-sm text-gray-600">
					<span class="font-semibold">Location:</span>
					{$formData.longitude.toFixed(6)}, {$formData.latitude.toFixed(6)}
					<span class="mt-1 block text-xs text-gray-500">Drag the marker to adjust position</span>
				</p>
			</div>

			<Input type="hidden" name="id" bind:value={$formData.id} />
			<Input type="hidden" name="latitude" bind:value={$formData.latitude} />
			<Input type="hidden" name="longitude" bind:value={$formData.longitude} />

			<Form.Field {form} name="radius">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Unlock Radius</Form.Label>
						<Form.Description>How close the player must be to unlock this POI.</Form.Description>
						<div class="flex items-center gap-3">
							<Slider
								type="single"
								min={10}
								max={100}
								step={1}
								bind:value={$formData.radius}
								class=""
							/>
							<span
								class="w-16 shrink-0 text-right text-sm font-semibold text-gray-700 tabular-nums"
								>{$formData.radius} m</span
							>
						</div>
						<input type="hidden" {...props} bind:value={$formData.radius} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label for="name">POI Name</Form.Label>
						<Form.Description>Enter the name of the point of interest.</Form.Description>
						<Input
							{...props}
							bind:value={$formData.name}
							placeholder="Enter POI name"
							autocomplete="off"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="type">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label for="type">Type</Form.Label>
						<Select.Root type="single" bind:value={$formData.type}>
							<Select.Trigger {...props} class="w-full">{typeTriggerContent}</Select.Trigger>
							<Select.Content>
								<Select.Item value="nature">Nature</Select.Item>
								<Select.Item value="history">History</Select.Item>
								<Select.Item value="sense">Sense</Select.Item>
								<Select.Item value="action">Action</Select.Item>
								<Select.Item value="landmark">Landmark</Select.Item>
							</Select.Content>
						</Select.Root>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="description">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label for="description">Description</Form.Label>
						<Form.Description>A brief description of the location.</Form.Description>
						<Textarea
							{...props}
							bind:value={$formData.description}
							placeholder="Enter a brief description of the POI"
							rows={4}
						></Textarea>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="contextual_data">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label for="contextual_data">Contextual Data for AI</Form.Label>
						<Form.Description
							>This information helps the AI understand the location's significance and generate
							relevant content.</Form.Description
						>
						<Textarea
							{...props}
							bind:value={$formData.contextual_data}
							placeholder="Additional contextual information about the POI for AI purposes"
							rows={10}
						></Textarea>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="image_url">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="font-semibold">POI Image</Form.Label>
						<Form.Description
							>Upload an image for this point of interest (16:9 ratio).</Form.Description
						>
						<ImageUpload
							currentImageUrl={$formData.image_url}
							storagePath="{session.user.id}/{params.id}/pois/{editingPOI?.id ?? 'new'}"
							{supabase}
							onUploaded={(url) => {
								$formData.image_url = url;
							}}
							onRemoved={() => {
								$formData.image_url = '';
							}}
						/>
						<input type="hidden" {...props} bind:value={$formData.image_url} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="tags">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label for="tags">Tags</Form.Label>
						<Form.Description>Add keywords to categorize this POI.</Form.Description>
						<div class="flex gap-2">
							<Input
								type="text"
								bind:value={tagInput}
								oninput={(e) => {
									// Remove spaces as user types
									const target = e.target as HTMLInputElement;
									target.value = target.value.replace(/\s+/g, '');
									tagInput = target.value;
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										addTag();
									}
									// Prevent spacebar
									if (e.key === ' ') {
										e.preventDefault();
									}
								}}
								placeholder="Add a tag..."
							/>
							<Button onclick={addTag}>Add</Button>
						</div>
						{#if $formData.tags.length > 0}
							<div class="mt-2 flex flex-wrap gap-2">
								{#each $formData.tags as tag, index (tag)}
									<Button
										variant="ghost"
										class="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-50"
										onclick={() => removeTag(index)}
									>
										<span>
											#{tag}
										</span>
										<X class="size-4" strokeWidth={2} />
									</Button>
								{/each}
							</div>
						{/if}
						<input type="hidden" {...props} value={JSON.stringify($formData.tags)} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Sheet.Footer class="flex flex-row justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onclick={() => {
						// Restore previous position if editing an existing POI
						if (editingPOI?.id && previousEditingPOIPosition) {
							poiPositions[editingPOI.id] = previousEditingPOIPosition;
						}
						isFormOpen = false;
						tempMarkerPosition = null;
					}}>Cancel</Button
				>
				<Button type="submit" disabled={$delayed}>
					{#if $delayed}
						<span class="flex items-center gap-2">
							<Spinner />
							Saving...
						</span>
					{:else}
						{editingPOI ? 'Update POI' : 'Create POI'}
					{/if}
				</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>

<!-- POI List Drawer -->
<Drawer.Root bind:open={isListOpen} direction="bottom">
	<Drawer.Content class="max-h-[85vh]">
		<Drawer.Header>
			<Drawer.Title class="text-2xl font-semibold">Created POIs ({pois.length})</Drawer.Title>
		</Drawer.Header>
		<div class="max-h-[calc(85vh-80px)] overflow-y-auto px-4 pb-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#if pois.length === 0}
					<div class="col-span-full py-12 text-center">
						<MapPin class="mx-auto mb-4 size-12 text-gray-400" />
						<p class="text-lg font-medium text-gray-600">No POIs created yet</p>
						<p class="text-sm text-gray-500">Click on the map to create your first POI</p>
					</div>
				{:else}
					{#each pois as poi (poi.id)}
						<button
							type="button"
							onclick={() => {
								// Fly to POI on map
								if (map && poiPositions[poi.id]) {
									map.flyTo({
										center: [poiPositions[poi.id].lng, poiPositions[poi.id].lat],
										zoom: 16,
										duration: 1000
									});
									isListOpen = false;
								}
							}}
							class="group relative overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md"
						>
							<!-- POI Image -->
							<div
								class="relative h-40 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200"
							>
								{#if poi.image_url}
									<img
										src={poi.image_url}
										alt={poi.name}
										class="h-full w-full object-cover transition group-hover:scale-105"
									/>
								{:else}
									<div class="flex h-full w-full items-center justify-center">
										<MapPin class="size-12 text-gray-300" />
									</div>
								{/if}
							</div>

							<!-- POI Content -->
							<div class="space-y-2 p-4">
								<!-- Type Badge -->
								<span
									class="self-start rounded-full px-2 py-0.5 text-xs font-medium uppercase {getPoiPaleBg(
										poi.type
									)} {getPoiTextColor(poi.type)}"
								>
									{poi.type}
								</span>
								<h3 class="line-clamp-1 text-lg font-bold text-gray-900">{poi.name}</h3>
								{#if poi.description}
									<p class="line-clamp-2 text-sm text-gray-600">{poi.description}</p>
								{/if}
							</div>

							<!-- Action Buttons -->
							<div class="flex gap-2 border-t border-gray-100 p-3">
								<Button
									type="button"
									size="sm"
									class="flex-1"
									onclick={(e) => {
										e.stopPropagation();
										openEditForm(poi);
										isListOpen = false;
									}}
								>
									<SquarePen class="mr-1 size-4" />
									Edit
								</Button>
								<Button
									type="button"
									size="sm"
									variant="destructive"
									onclick={(e) => {
										e.stopPropagation();
										if (poi.id) deletePOI(poi.id);
									}}
								>
									<Trash2 class="size-4" />
								</Button>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</Drawer.Content>
</Drawer.Root>

<style>
	/* Hide the sheet overlay to allow map interaction */
	:global([data-slot='sheet-overlay']) {
		display: none !important;
	}

	/* Only make HoverCard portals transparent, not all portals */
	:global([data-bits-hover-card-content]) {
		pointer-events: auto !important;
	}

	/* Make the portal wrapper for HoverCard transparent */
	:global([data-portal]:has([data-bits-hover-card-content])) {
		pointer-events: none !important;
	}

	/* Ensure sheet content and all interactive elements receive pointer events */
	:global([data-slot='sheet-content']),
	:global([data-slot='sheet-content'] *) {
		pointer-events: auto !important;
	}

	/* Ensure select dropdowns receive pointer events */
	:global([data-bits-menu-content]),
	:global([data-bits-select-content]),
	:global([data-bits-select-content] *),
	:global([role='listbox']),
	:global([role='listbox'] *) {
		pointer-events: auto !important;
		z-index: 9999 !important;
	}

	/* Ensure map and all its children receive pointer events */
	:global(.maplibregl-map),
	:global(.maplibregl-canvas-container),
	:global(.maplibregl-canvas) {
		pointer-events: auto !important;
	}

	/* Ensure map markers and their children are interactive and have proper layering */
	:global(.maplibregl-marker),
	:global(.maplibregl-marker *) {
		pointer-events: auto !important;
	}

	:global(.maplibregl-marker) {
		z-index: 50 !important;
	}
</style>
