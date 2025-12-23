<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as HoverCard from '$lib/components/ui/hover-card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button';
	import ValidationChecklist from './validation-checklist.svelte';
	import { MapLibre, Marker, MapEvents } from 'svelte-maplibre';
	import type { Map, MapMouseEvent, LngLat } from 'maplibre-gl';
	import { Upload, X, MapPin, Trash2, SquarePen, ArrowLeft, ArrowRight } from 'lucide-svelte';
	import { superForm } from 'sveltekit-superforms';
	import { poiSchema } from '$lib/zod/schema';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import SuperDebug from 'sveltekit-superforms';
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
		id?: number;
		name: string;
		description: string;
		context: string;
		image_url?: string;
		type: string;
		tags: string[];
		latitude: number;
		longitude: number;
	};

	let pois = $derived(data.pois || []);
	let isFormOpen = $state(false);
	let editingPOI = $state<POI | null>(null);
	let imagePreview = $state<string | null>(null);
	let isUploadingImage = $state(false);
	let imageTimestamp = $state(Date.now());
	let map = $state<Map>();
	let center = $derived(data.center);
	let tagInput = $state('');
	let tempMarkerPosition = $state<{ lng: number; lat: number } | null>(null);
	let hasInitialized = $state(false);

	const MIN_POIS = 6;

	const validationChecks = $derived.by(
		(): Array<{
			label: string;
			status: 'complete' | 'incomplete' | 'warning';
			description: string;
		}> => {
			const poiTypes = new Set(pois.map((p: any) => p.type));
			const poisWithoutImages = pois.filter((p: any) => !p.image_url).length;

			return [
				{
					label: `At least ${MIN_POIS} POIs`,
					status: (pois.length >= MIN_POIS ? 'complete' : 'incomplete') as
						| 'complete'
						| 'incomplete',
					description: `Required (${pois.length} created)`
				},
				{
					label: 'At least 3 different types',
					status: (pois.length >= MIN_POIS && poiTypes.size >= 3
						? 'complete'
						: poiTypes.size >= 3 || pois.length >= MIN_POIS
							? 'warning'
							: 'incomplete') as 'complete' | 'incomplete' | 'warning',
					description: `Recommended (${poiTypes.size} types used)`
				},
				{
					label: 'POI images',
					status: (poisWithoutImages === 0 ? 'complete' : 'warning') as 'complete' | 'warning',
					description:
						poisWithoutImages > 0
							? `${poisWithoutImages} missing image${poisWithoutImages > 1 ? 's' : ''}`
							: 'All POIs have images'
				}
			];
		}
	);

	onMount(() => {
		if (map && center && !hasInitialized) {
			map.setCenter(center as LngLat);
			hasInitialized = true;
		}
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
				imagePreview = null;
				editingPOI = null;
				tempMarkerPosition = null;
				invalidateAll();
			}
		}
	});

	const { form: formData, errors, enhance, delayed } = form;

	const typeTriggerContent = $derived(
		types.find((t) => t.value === $formData.type)?.label || 'Select type'
	);

	const handleMapClick = (e: MapMouseEvent) => {
		const { lng, lat } = e.lngLat;
		console.log('Map clicked at:', lng, lat);
		tempMarkerPosition = { lng, lat };

		editingPOI = null;
		imagePreview = null;
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

	const openEditForm = (poi: any) => {
		tempMarkerPosition = null;
		editingPOI = poi;
		$formData.id = poi.id;
		$formData.name = poi.name;
		$formData.description = poi.description || '';
		$formData.image_url = poi.image_url || '';
		$formData.contextual_data = poi.contextual_data || '';
		$formData.type = poi.type;
		$formData.tags = poi.tags || [];
		$formData.latitude = poi.latitude;
		$formData.longitude = poi.longitude;
		imagePreview = poi.image_url ? `${poi.image_url}?t=${Date.now()}` : null;
		isFormOpen = true;
	};

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		if (!file.type.startsWith('image/')) {
			alert('Please select an image file');
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			alert('Image must be less than 10MB');
			return;
		}

		const oldImageUrl = $formData.image_url;

		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview = e.target?.result as string;
		};
		reader.readAsDataURL(file);

		await uploadImageToSupabase(file, oldImageUrl);
	}

	async function uploadImageToSupabase(file: File, oldImageUrl?: string | null) {
		isUploadingImage = true;
		try {
			if (!session) {
				alert('You must be logged in to upload images');
				return;
			}

			const fileExt = file.name.split('.').pop();
			const fileName = `${editingPOI?.id || 'new'}-${Date.now()}.${fileExt}`;
			const filePath = `${session.user.id}/${params.id}/pois/${fileName}`;

			// Delete old image if exists
			if (oldImageUrl && oldImageUrl.trim() !== '') {
				try {
					const urlWithoutParams = oldImageUrl.split('?')[0];
					const url = new URL(urlWithoutParams);
					const pathParts = url.pathname.split('/');
					const oldPath = pathParts.slice(-4).join('/');
					await supabase.storage.from('game-images').remove([oldPath]);
				} catch (error) {
					console.warn('Error deleting old image:', error);
				}
			}

			const { error } = await supabase.storage.from('game-images').upload(filePath, file, {
				cacheControl: '3600',
				upsert: true
			});

			if (error) {
				console.error('Upload error:', error);
				alert('Failed to upload image: ' + error.message);
				return;
			}

			const {
				data: { publicUrl }
			} = supabase.storage.from('game-images').getPublicUrl(filePath);

			$formData.image_url = publicUrl;
			imageTimestamp = Date.now();
			imagePreview = `${publicUrl}?t=${imageTimestamp}`;
		} catch (error) {
			console.error('Upload error:', error);
			alert('Failed to upload image');
		} finally {
			isUploadingImage = false;
		}
	}

	function removeImage() {
		if (isUploadingImage) return;
		imagePreview = null;
		$formData.image_url = '';
	}

	function addTag() {
		const sanitizedTag = tagInput.trim().replace(/\s+/g, '');

		if (sanitizedTag && !$formData.tags.includes(sanitizedTag)) {
			$formData.tags = [...$formData.tags, sanitizedTag];
			tagInput = '';
		}
	}

	function removeTag(index: number) {
		$formData.tags = $formData.tags.filter((_, i) => i !== index);
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

<!-- Map -->
<div class="absolute inset-0 z-0">
	<MapLibre
		style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
		class="h-full w-full"
		bind:map
		zoom={14}
		onclick={handleMapClick}
	>
		{#each pois as poi (poi.id)}
			<Marker lngLat={[poi.longitude, poi.latitude]}>
				<HoverCard.Root openDelay={200}>
					<HoverCard.Trigger>
						<Button
							onclick={() => openEditForm(poi)}
							class="flex size-10 items-center justify-center rounded-full bg-blue-600 p-2 text-white"
						>
							<MapPin class="size-6" stroke-width={2} />
						</Button>
					</HoverCard.Trigger>
					<HoverCard.Content class="w-80 overflow-hidden p-0">
						<div class="flex flex-col">
							<!-- POI Image -->
							<div
								class="relative h-32 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200"
							>
								{#if poi.image_url}
									<img src={poi.image_url} alt={poi.name} class="h-full w-full object-cover" />
								{:else}
									<div class="flex h-full w-full items-center justify-center">
										<MapPin class="h-12 w-12 text-gray-300" />
									</div>
								{/if}
								<!-- Type Badge -->
								<div class="absolute top-2 right-2">
									<span
										class="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-700 capitalize shadow-sm backdrop-blur-sm"
									>
										{poi.type}
									</span>
								</div>
							</div>

							<!-- POI Content -->
							<div class="space-y-2 p-4">
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
										{#each poi.tags.slice(0, 5) as tag}
											<span class="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
												#{tag}
											</span>
										{/each}
										{#if poi.tags.length > 5}
											<span class="text-xs text-gray-500">+{poi.tags.length - 5}</span>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					</HoverCard.Content>
				</HoverCard.Root>
			</Marker>
		{/each}
		<!-- Temporary marker for new POI -->
		{#if tempMarkerPosition}
			<Marker draggable lngLat={[tempMarkerPosition.lng, tempMarkerPosition.lat]}>
				<div
					class="flex size-10 items-center justify-center rounded-full bg-orange-500 p-2 text-white"
				>
					<MapPin class="size-6" stroke-width={2} />
				</div>
			</Marker>
		{/if}
	</MapLibre>
</div>

<!-- POI List -->
<div
	class="fixed right-2 bottom-2 z-10 flex max-h-[calc(100vh-6rem)] w-sm flex-col overflow-hidden rounded-lg border border-gray-300 bg-white"
>
	<div class="p-3">
		<!-- Validation Checklist -->
		<div class="mb-3">
			<ValidationChecklist title="Validation" checks={validationChecks} />
		</div>
		<h3 class="mt-3 text-lg font-semibold">Created POIs ({pois.length})</h3>
	</div>

	{#if pois.length > 0}
		<div class="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
			{#each pois as poi (poi.id)}
				<div class="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
					<!-- POI Image -->
					<div class="relative h-32 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
						{#if poi.image_url}
							<img
								src={poi.image_url}
								alt={poi.name}
								class="h-full w-full object-cover transition-transform duration-300"
							/>
						{:else}
							<div class="flex h-full w-full items-center justify-center">
								<MapPin class="h-12 w-12 text-gray-300" />
							</div>
						{/if}
						<!-- Type Badge -->
						<div class="absolute top-2 right-2">
							<span
								class="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 capitalize"
							>
								{poi.type}
							</span>
						</div>
					</div>

					<!-- POI Content -->
					<div class="flex flex-1 flex-col p-4">
						<!-- POI Name -->
						<h4 class="text-base leading-tight font-bold text-gray-900">
							{poi.name}
						</h4>

						<!-- POI Description -->
						<p class="line-clamp-3 flex-1 py-3 text-sm leading-relaxed text-gray-600">
							{poi.description || 'No description provided.'}
						</p>

						<!-- Tags -->
						{#if poi.tags && poi.tags.length > 0}
							<div class="mb-3 flex flex-wrap gap-1">
								{#each poi.tags.slice(0, 3) as tag}
									<span class="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
										#{tag}
									</span>
								{/each}
								{#if poi.tags.length > 3}
									<span class="text-xs text-gray-500">+{poi.tags.length - 3}</span>
								{/if}
							</div>
						{/if}

						<!-- Action Buttons -->
						<div class="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								class="flex-1 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
								onclick={() => deletePOI(poi.id!)}
							>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
							<Button
								variant="default"
								size="sm"
								class="flex-[2]"
								onclick={() => openEditForm(poi)}
							>
								<SquarePen class="mr-1.5 h-3.5 w-3.5" />
								Edit
							</Button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex-1 px-3">
			<p class="text-center text-gray-500">No POIs created yet. Click on the map to add one.</p>
		</div>
	{/if}

	<div class="p-3">
		<div class="flex justify-end gap-2">
			<Button variant="outline" href={`/dashboard/games/${params.id}/edit/characters`} size="lg">
				<ArrowLeft /> Back
			</Button>
			<Button href={`/dashboard/games/${params.id}/edit/cards`} size="lg"
				>Next <ArrowRight /></Button
			>
		</div>
	</div>
</div>

<!-- Dialog Form -->
<Sheet.Root bind:open={isFormOpen}>
	<Sheet.Content
		class="fixed top-0 right-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
	>
		<Sheet.Header>
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
					<span>Location:</span>
					{#if editingPOI}
						{editingPOI.longitude.toFixed(6)}, {editingPOI.latitude.toFixed(6)}
					{:else}
						{tempMarkerPosition?.lng.toFixed(6)}, {tempMarkerPosition?.lat.toFixed(6)}
					{/if}
				</p>
			</div>

			<Input type="hidden" name="id" bind:value={$formData.id} />
			<Input type="hidden" name="latitude" bind:value={$formData.latitude} />
			<Input type="hidden" name="longitude" bind:value={$formData.longitude} />

			<Form.Field {form} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label for="name">POI Name</Form.Label>
						<Form.Description>Enter the name of the point of interest</Form.Description>
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
						<Form.Description>A brief description of the character</Form.Description>
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
						<Form.Label class="font-bold">POI Image</Form.Label>
						<Form.Description>Upload an image for this point of interest</Form.Description>
						{#if imagePreview}
							<div class="relative">
								<img
									src={imagePreview}
									alt="Preview"
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
								for="image-upload"
								class="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition hover:border-gray-400"
							>
								<Upload class="h-12 w-12 text-gray-400" />
								<p class="mt-2 text-sm text-gray-600">Click to upload image</p>
								<p class="text-xs text-gray-500">PNG, JPG up to 10MB</p>
								<input
									id="image-upload"
									type="file"
									accept="image/*"
									class="hidden"
									onchange={handleImageUpload}
									disabled={isUploadingImage}
								/>
							</Label>
						{/if}
						<Input type="hidden" {...props} bind:value={$formData.image_url} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="tags">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label for="tags">Tags</Form.Label>
						<Form.Description>Add keywords to categorize this POI</Form.Description>
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
								{#each $formData.tags as tag, index}
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
					onclick={() => ((isFormOpen = false), (tempMarkerPosition = null))}>Cancel</Button
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
