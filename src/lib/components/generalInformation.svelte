<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import { Search, Flag, Save, ArrowRight, ArrowLeft } from 'lucide-svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import ImageUpload from './image-upload.svelte';
	import { MapLibre, MapEvents, Marker } from 'svelte-maplibre';
	import type { MapMouseEvent } from 'maplibre-gl';
	import { goto } from '$app/navigation';
	import { superForm } from 'sveltekit-superforms';
	import { generalInfoSchema } from '$lib/zod/schema';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { onMount } from 'svelte';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { toast } from 'svelte-sonner';

	let { data, params, supabase, session } = $props();

	const form = superForm(data.form, {
		resetForm: false,
		validators: zod4Client(generalInfoSchema),
		dataType: 'json',
		onResult: ({ result }) => {
			if (result.type === 'success') {
				goto(`/dashboard/games/${params.id}/edit/characters`);
			} else if (result.type === 'failure' && result.data?.message) {
				toast.error(result.data.message);
			}
		}
	});

	const { form: formData, enhance, delayed, tainted } = form;

	let center = $state<[number, number]>(
		$formData.location?.lng && $formData.location?.lat
			? [$formData.location.lng, $formData.location.lat]
			: [0, 0]
	);
	let showMarker = $state(false);
	let boundPos = $state<{ lng: number; lat: number }>({
		lng: $formData.location?.lng ?? 0,
		lat: $formData.location?.lat ?? 0
	});
	let queryLocation = $state('');
	let lastRequestTime = 0;
	const MIN_REQUEST_INTERVAL = 1000;
	let isLoadingAddress = $state(false);
	let searchResults = $state<Array<{ lat: string; lon: string; display_name: string }>>([]);
	let showSearchResults = $state(false);
	let locationAddress = $state('');
	let searchContainerRef: HTMLDivElement | null = null;

	let hasInitialLocation = $derived.by(() => {
		const lat = $formData.location?.lat;
		const lng = $formData.location?.lng;
		return lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0;
	});

	const availableCategories = [
		'History',
		'Culture',
		'Art',
		'Architecture',
		'Nature',
		'Adventure',
		'Mystery',
		'Education',
		'Family Friendly',
		'Urban Exploration'
	];

	onMount(() => {
		if (hasInitialLocation) {
			console.log('Using initial location from form data');
			showMarker = true;
			boundPos = {
				lng: $formData.location.lng ?? 0,
				lat: $formData.location.lat ?? 0
			};
			center = [$formData.location.lng ?? 0, $formData.location.lat ?? 0];
			reverseGeocode(boundPos.lat, boundPos.lng);
		} else {
			console.log('No saved location, centering on user location without showing marker');
			// Just center the map on user's location, don't save to form or show marker
			getUserLocation();
		}

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

		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	async function getUserLocation() {
		if (!navigator.geolocation) {
			console.warn('Geolocation is not supported by this browser');
			// Fallback to default location (Lisbon) - just center, don't save
			center = [-9.1393, 38.7223];
			boundPos = { lng: -9.1393, lat: 38.7223 };
			return;
		}

		console.log('Requesting geolocation permission...');

		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const lat = position.coords.latitude;
				const lng = position.coords.longitude;

				// Only center the map, don't update form data or show marker
				center = [lng, lat];
				boundPos = { lng, lat };
			},
			(error) => {
				console.error('Error getting user location:', error);
				console.error('Error code:', error.code, 'Error message:', error.message);
				// Fallback to default location (Lisbon) - just center, don't save
				center = [-9.1393, 38.7223];
				boundPos = { lng: -9.1393, lat: 38.7223 };
			},
			{
				enableHighAccuracy: true,
				timeout: 5000,
				maximumAge: 0
			}
		);
	}

	function toggleCategory(category: string) {
		if ($formData.categories.includes(category)) {
			$formData.categories = $formData.categories.filter((c: string) => c !== category);
		} else {
			$formData.categories = [...$formData.categories, category];
		}
	}

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

	async function reverseGeocode(lat: number, lng: number) {
		console.log('Reverse geocoding for:', lat, lng);
		isLoadingAddress = true;
		try {
			const response = await rateLimitedFetch(
				`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
			);
			const data = (await response.json()) as { display_name: string };
			// Store address in a local variable for display only
			locationAddress = data.display_name;
			// Only update coordinates in form data
			$formData.location = {
				lat,
				lng
			};
		} catch (error) {
			console.error('Reverse geocoding failed:', error);
		} finally {
			isLoadingAddress = false;
		}
	}

	async function searchLocation(query: string) {
		console.log('Searching location for query:', query);
		if (!query) return;
		isLoadingAddress = true;
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
		} finally {
			isLoadingAddress = false;
		}
	}

	function selectLocation(result: { lat: string; lon: string; display_name: string }) {
		const lat = parseFloat(result.lat);
		const lon = parseFloat(result.lon);
		showMarker = true;
		boundPos = { lng: lon, lat: lat };
		$formData.location = {
			lat,
			lng: lon
		};
		locationAddress = result.display_name;
		center = [lon, lat];
		searchResults = [];
		showSearchResults = false;
		queryLocation = '';
	}

	function setMarker(e: MapMouseEvent) {
		showMarker = true;
		const lngLat = e.lngLat;
		boundPos = { lng: lngLat.lng, lat: lngLat.lat };
		reverseGeocode(boundPos.lat, boundPos.lng);
	}
</script>

<div class="mx-auto mb-2 w-full flex-1">
	<div class="space-y-6 rounded-lg border border-gray-300 bg-white p-6">
		<div class="mb-6">
			<h2 class="text-2xl font-semibold">General Information</h2>
			<p class="text-gray-600">Fill out this form with some basic information about the game.</p>
		</div>
		<form method="POST" use:enhance class="space-y-6">
			<!-- Title -->
			<Form.Field {form} name="title">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="text-xl font-semibold">Title</Form.Label>
						<Form.Description class="text-gray-500">Give your game a title.</Form.Description>
						<Input
							{...props}
							type="text"
							placeholder="Title"
							bind:value={$formData.title}
							autocomplete="off"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Description -->
			<Form.Field {form} name="description">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="text-xl font-semibold">Description</Form.Label>
						<Form.Description class="text-gray-500">
							Describe your game and what players can expect.
						</Form.Description>
						<Textarea
							{...props}
							class="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							placeholder="Description"
							rows={4}
							bind:value={$formData.description}
						></Textarea>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Location -->
			<Form.Field {form} name="location">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="text-xl font-semibold">Location</Form.Label>
						<Form.Description class="text-gray-500">
							Search or click on the map to set location of the game
						</Form.Description>
						<div class="relative" bind:this={searchContainerRef}>
							<div class="flex">
								<Input
									{...props}
									type="text"
									placeholder="Search location"
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
									class="ml-2"
									onclick={() => searchLocation(queryLocation)}
									disabled={isLoadingAddress}
								>
									<Search />Search
								</Button>
							</div>

							<!-- Search Results Dropdown -->
							{#if showSearchResults && searchResults.length > 0}
								<div
									class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
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
							{:else if showSearchResults && !isLoadingAddress && queryLocation && searchResults.length === 0}
								<div
									class="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white px-4 py-3 shadow-lg"
								>
									<p class="text-sm text-gray-500">No results found for "{queryLocation}"</p>
								</div>
							{/if}
						</div>
						<div class="space-y-2">
							<!-- Map Container -->
							<div class="relative w-full overflow-hidden rounded-lg border">
								<MapLibre
									style="https://tiles.openfreemap.org/styles/liberty"
									class="relative h-[50vh] w-full"
									standardControls
									attributionControl={false}
									{center}
									zoom={12}
								>
									<MapEvents onclick={setMarker} />
									{#if showMarker}
										<Marker
											draggable
											bind:lngLat={boundPos}
											ondragend={() => reverseGeocode(boundPos.lat, boundPos.lng)}
										>
											<Tooltip.Provider>
												<Tooltip.Root>
													<Tooltip.Trigger
														class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-start-red shadow-lg"
													>
														<Flag strokeWidth={3} class="h-4 w-4 text-white" />
													</Tooltip.Trigger>
													<Tooltip.Content>Starting point</Tooltip.Content>
												</Tooltip.Root>
											</Tooltip.Provider>
										</Marker>
									{/if}
								</MapLibre>
							</div>

							<div class="rounded-lg bg-gray-100 p-3 text-sm">
								<p class="font-semibold text-gray-700">Selected Location</p>

								{#if isLoadingAddress}
									<div class="flex items-center gap-2 text-gray-600">
										<Spinner />
										<span>Loading address...</span>
									</div>
								{:else if hasInitialLocation}
									<p class="text-xl text-gray-600">
										{locationAddress || 'No address available'}
									</p>
									<p class="mt-1 text-sm text-gray-500">
										Coordinates: {$formData.location?.lat?.toFixed(6)}, {$formData.location?.lng?.toFixed(
											6
										)}
									</p>
								{:else}
									<p class="text-gray-600">No location selected.</p>
								{/if}
							</div>
						</div>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Cover Image -->
			<Form.Field {form} name="cover_image_url">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="text-xl font-semibold">Cover Image</Form.Label>
						<Form.Description class="text-gray-500">
							Upload a cover image for your game (PNG, JPG, WEBP · max 50 MB — cropped to 16:9).
						</Form.Description>
						<ImageUpload
							currentImageUrl={$formData.cover_image_url}
							storagePath="{session.user.id}/{params.id}/cover"
							{supabase}
							onUploaded={(url) => {
								$formData.cover_image_url = url;
								$tainted = { ...$tainted, cover_image_url: true };
							}}
							onRemoved={() => {
								$formData.cover_image_url = '';
								$tainted = { ...$tainted, cover_image_url: true }; // Mark as tainted when removed
							}}
						/>
						<input type="hidden" {...props} bind:value={$formData.cover_image_url} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Categories -->
			<Form.Field {form} name="categories">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="text-xl font-semibold">Categories</Form.Label>
						<Form.Description class="text-gray-500"
							>Select one or more categories that best describe your game.</Form.Description
						>
						<div class="flex flex-wrap gap-2">
							{#each availableCategories as category (category)}
								<Button
									{...props}
									type="button"
									variant={$formData.categories.includes(category) ? 'default' : 'outline'}
									onclick={() => toggleCategory(category)}
								>
									{category}
								</Button>
							{/each}
						</div>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Form Actions -->
			<!-- Form Actions -->
			<div class="mt-8 flex w-full justify-end gap-4">
				<Button size="lg" variant="outline" href="/dashboard"><ArrowLeft /> Back</Button>
				<div>
					{#if Object.keys($tainted || {}).length}
						<Form.Button type="submit" size="lg" disabled={$delayed}>
							{#if $delayed}
								<Spinner />
								Saving...
							{:else}
								<Save /> Save Changes
							{/if}
						</Form.Button>
					{:else}
						<Button size="lg" href={`/dashboard/games/${params.id}/edit/characters`}>
							Next <ArrowRight />
						</Button>
					{/if}
				</div>
			</div>
		</form>
	</div>
</div>
