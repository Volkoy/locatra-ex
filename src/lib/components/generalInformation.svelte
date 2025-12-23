<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import Label from './ui/label/label.svelte';
	import * as Form from '$lib/components/ui/form/index.js';
	import { Upload, X, Search, MapPin, Save, ArrowRight, ArrowLeft } from 'lucide-svelte';
	import ValidationChecklist from './validation-checklist.svelte';
	import { MapLibre, MapEvents, Marker } from 'svelte-maplibre';
	import type { LngLatBoundsLike, LngLat, MapMouseEvent } from 'maplibre-gl';
	import { superForm } from 'sveltekit-superforms';
	import { generalInfoSchema } from '$lib/zod/schema';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { onMount } from 'svelte';
	import SuperDebug from 'sveltekit-superforms';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { toast } from 'svelte-sonner';

	let { data, params, supabase, session } = $props();

	const form = superForm(data.form, {
		resetForm: false,
		validators: zod4Client(generalInfoSchema),
		dataType: 'json',
		onResult: ({ result }) => {
			if (result.type === 'success' && result.data?.message) {
				toast.success(result.data.message);
			} else if (result.type === 'failure' && result.data?.message) {
				toast.error(result.data.message);
			}
		}
	});

	const { form: formData, errors, enhance, delayed, tainted } = form;

	let imagePreview = $state($formData.cover_image_url || '');
	let imageFile = $state<File | null>(null);
	let isUploadingImage = $state(false);
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
	let isDragging = $state(false);
	let queryLocation = $state('');
	let lastRequestTime = 0;
	const MIN_REQUEST_INTERVAL = 1000;
	let isLoadingAddress = $state(false);
	let imageTimestamp = $state(Date.now());
	let isLoadingUserLocation = $state(false);
	let searchResults = $state<Array<{ lat: string; lon: string; display_name: string }>>([]);
	let showSearchResults = $state(false);
	let locationAddress = $state('');

	let hasInitialLocation = $derived.by(() => {
		const lat = $formData.location?.lat;
		const lng = $formData.location?.lng;
		return lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0;
	});

	const validationChecks = $derived.by(
		(): Array<{
			label: string;
			status: 'complete' | 'incomplete' | 'warning';
			description: string;
		}> => [
			{
				label: 'Game title',
				status: ($formData.title && $formData.title.trim() !== '' ? 'complete' : 'incomplete') as
					| 'complete'
					| 'incomplete',
				description: 'Required'
			},
			{
				label: 'Description',
				status: ($formData.description && $formData.description.trim() !== ''
					? 'complete'
					: 'incomplete') as 'complete' | 'incomplete',
				description: 'Required'
			},
			{
				label: 'Location',
				status: (hasInitialLocation ? 'complete' : 'incomplete') as 'complete' | 'incomplete',
				description: 'Required'
			},
			{
				label: 'Cover image',
				status: ($formData.cover_image_url ? 'complete' : 'warning') as 'complete' | 'warning',
				description: 'Recommended'
			},
			{
				label: 'At least one category',
				status: ($formData.categories && $formData.categories.length > 0
					? 'complete'
					: 'warning') as 'complete' | 'warning',
				description: 'Recommended'
			}
		]
	);

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

		if ($formData.cover_image_url) {
			imagePreview = `${$formData.cover_image_url}?t=${imageTimestamp}`;
		}
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
		isLoadingUserLocation = true;

		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const lat = position.coords.latitude;
				const lng = position.coords.longitude;

				// Only center the map, don't update form data or show marker
				center = [lng, lat];
				boundPos = { lng, lat };

				isLoadingUserLocation = false;
			},
			(error) => {
				console.error('Error getting user location:', error);
				console.error('Error code:', error.code, 'Error message:', error.message);
				// Fallback to default location (Lisbon) - just center, don't save
				center = [-9.1393, 38.7223];
				boundPos = { lng: -9.1393, lat: 38.7223 };
				isLoadingUserLocation = false;
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

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file');
			return;
		}

		// Validate file size (10MB)
		if (file.size > 10 * 1024 * 1024) {
			alert('Image must be less than 10MB');
			return;
		}

		imageFile = file;

		const oldImageUrl = $formData.cover_image_url;

		// Show preview immediately
		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview = e.target?.result as string;
		};
		reader.readAsDataURL(file);

		// Upload to Supabase directly
		await uploadImageToSupabase(file, oldImageUrl);
	}

	async function uploadImageToSupabase(file: File, oldImageUrl?: string | null) {
		isUploadingImage = true;
		try {
			if (!session) {
				alert('You must be logged in to upload images');
				return;
			}

			// Generate file path - always use 'cover' as the base name to ensure only one image
			const fileExt = file.name.split('.').pop();
			const fileName = `cover.${fileExt}`;
			const filePath = `${session.user.id}/${params.id}/${fileName}`;

			// Delete old image if it exists and has a different extension
			if (oldImageUrl && oldImageUrl.trim() !== '') {
				try {
					// Extract path from URL (remove query params first)
					const urlWithoutParams = oldImageUrl.split('?')[0];
					const url = new URL(urlWithoutParams);
					const pathParts = url.pathname.split('/');
					const oldPath = pathParts.slice(-3).join('/');

					// Only delete if it's a different file (different extension)
					if (oldPath !== filePath) {
						console.log('Deleting old image:', oldPath);
						const { error: deleteError } = await supabase.storage
							.from('game-images')
							.remove([oldPath]);

						if (deleteError) {
							console.warn('Could not delete old image:', deleteError);
						} else {
							console.log('Old image deleted successfully');
						}
					}
				} catch (error) {
					console.warn('Error deleting old image:', error);
				}
			}

			// Upload new image (upsert will replace if same filename exists)
			const { data: uploadData, error } = await supabase.storage
				.from('game-images')
				.upload(filePath, file, {
					cacheControl: '3600',
					upsert: true
				});

			if (error) {
				console.error('Upload error:', error);
				alert('Failed to upload image: ' + error.message);
				return;
			}

			// Get public URL
			const {
				data: { publicUrl }
			} = supabase.storage.from('game-images').getPublicUrl(filePath);

			// Update form data with clean URL (no timestamp)
			$formData.cover_image_url = publicUrl;

			// Update timestamp to force reload
			imageTimestamp = Date.now();
			imagePreview = `${publicUrl}?t=${imageTimestamp}`;

			console.log('New image uploaded successfully:', publicUrl);
		} catch (error) {
			console.error('Upload error:', error);
			alert('Failed to upload image');
		} finally {
			isUploadingImage = false;
		}
	}

	async function removeImage() {
		if (isUploadingImage) return;

		const oldImageUrl = $formData.cover_image_url;

		// Delete from storage
		if (oldImageUrl && oldImageUrl.trim() !== '') {
			try {
				// Remove query params before parsing
				const urlWithoutParams = oldImageUrl.split('?')[0];
				const url = new URL(urlWithoutParams);
				const pathParts = url.pathname.split('/');
				const oldPath = pathParts.slice(-3).join('/');

				console.log('Removing image:', oldPath);
				const { error } = await supabase.storage.from('game-images').remove([oldPath]);

				if (error) {
					console.error('Could not delete image:', error);
					alert('Failed to delete image from storage');
					return;
				}

				console.log('Image removed successfully');
			} catch (error) {
				console.error('Error deleting image:', error);
			}
		}

		// Clear preview and form data
		imagePreview = '';
		imageFile = null;
		$formData.cover_image_url = '';
	}
</script>

<div class="mx-auto w-full flex-1">
	<div class="grid grid-cols-1 gap-2 lg:grid-cols-3">
		<!-- Main Form -->
		<div class="lg:col-span-2">
			<div class="space-y-6 rounded-lg border border-gray-300 bg-white p-6">
				<div class="mb-6">
					<h2 class="text-2xl font-semibold">General Information</h2>
					<p class="text-gray-600">
						Fill out this form with some basic information about the game.
					</p>
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
								<div class="relative">
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
											{#each searchResults as result}
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
									<div class="relative h-[400px] w-full overflow-hidden rounded-lg border">
										<MapLibre
											style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
											class="relative aspect-[9/16] max-h-[70vh] w-full sm:aspect-video sm:max-h-full"
											standardControls
											{center}
											zoom={12}
										>
											<MapEvents onclick={setMarker} />
											{#if showMarker}
												<Marker
													draggable
													ondragstart={() => (isDragging = true)}
													ondragend={() => (isDragging = false)}
													bind:lngLat={boundPos}
													class="place-items-center rounded-full bg-blue-500 p-1 focus:outline-2 focus:outline-black"
													><MapPin color="white" size={20} /></Marker
												>
											{/if}
										</MapLibre>
										<div
											class="absolute right-2 bottom-2 rounded bg-white/90 px-2 py-1 text-xs text-gray-600"
										>
											Geocoding by <a
												href="https://nominatim.openstreetmap.org/"
												target="_blank"
												class="underline">Nominatim</a
											>
											| ©
											<a
												href="https://www.openstreetmap.org/copyright"
												target="_blank"
												class="underline">OpenStreetMap</a
											> contributors
										</div>
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
									Upload a cover image for your game. Max 10MB.
								</Form.Description>
								{#if imagePreview}
									<div class="relative">
										<img
											src={imagePreview}
											alt="Cover preview"
											class="aspect-video w-full rounded-lg object-cover"
										/>
										{#if isUploadingImage}
											<div
												class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50"
											>
												<svg
													class="h-8 w-8 animate-spin text-white"
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
												>
													<circle
														class="opacity-25"
														cx="12"
														cy="12"
														r="10"
														stroke="currentColor"
														stroke-width="4"
													></circle>
													<path
														class="opacity-75"
														fill="currentColor"
														d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
													></path>
												</svg>
											</div>
										{/if}
										<Button
											type="button"
											variant="destructive"
											size="icon"
											class="absolute top-2 right-2"
											onclick={removeImage}
											disabled={isUploadingImage}
										>
											<X class="h-4 w-4" />
										</Button>
									</div>
								{:else}
									<Label
										for="image"
										class="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition hover:border-gray-400"
									>
										<Upload class="h-12 w-12 text-gray-400" />
										<p class="mt-2 text-sm text-gray-600">Click to upload cover image</p>
										<p class="text-xs text-gray-500">PNG, JPG up to 10MB</p>
										<input
											id="image"
											type="file"
											accept="image/*"
											class="hidden"
											onchange={handleImageUpload}
											disabled={isUploadingImage}
										/>
									</Label>
								{/if}
								<input
									type="hidden"
									name="cover_image_url"
									bind:value={$formData.cover_image_url}
								/>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<!-- Categories -->
					<Form.Field {form} name="categories">
						<Form.Control>
							{#snippet children({ props })}
								<Form.Label class="text-xl font-semibold">Categories</Form.Label>
								<div class="flex flex-wrap gap-2">
									{#each availableCategories as category}
										<button
											type="button"
											onclick={() => toggleCategory(category)}
											class="rounded-full px-4 py-2 text-sm font-medium transition hover:cursor-pointer"
											class:bg-blue-600={$formData.categories.includes(category)}
											class:text-white={$formData.categories.includes(category)}
											class:hover:bg-blue-700={$formData.categories.includes(category)}
											class:bg-gray-100={!$formData.categories.includes(category)}
											class:text-gray-700={!$formData.categories.includes(category)}
											class:hover:bg-gray-200={!$formData.categories.includes(category)}
										>
											{category}
										</button>
									{/each}
								</div>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors />
					</Form.Field>

					<!-- Form Actions -->
					<div class="mt-8 flex w-full justify-between gap-4">
						<Button size="lg" variant="outline" href="/dashboard"><ArrowLeft /> Back</Button>
						<div class="flex gap-4">
							<Form.Button type="submit" size="lg" disabled={$delayed}>
								{#if $delayed}
									<span class="flex items-center gap-2">
										<Spinner />
										Saving...
									</span>
								{:else}
									<Save /> Save information
								{/if}
							</Form.Button>
							<Button
								type="button"
								size="lg"
								href={`/dashboard/games/${params.id}/edit/characters`}
								disabled={Object.keys($tainted || {}).length > 0 || $delayed}
							>
								Next <ArrowRight />
							</Button>
						</div>
					</div>
				</form>
			</div>
		</div>

		<!-- Validation Checklist Sidebar -->
		<div class="lg:col-span-1">
			<ValidationChecklist title="Validation Checklist" checks={validationChecks} />
		</div>
	</div>
</div>
