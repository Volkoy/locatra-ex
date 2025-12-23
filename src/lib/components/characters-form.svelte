<script lang="ts">
	import {
		ArrowLeft,
		ArrowRight,
		Plus,
		SquarePen,
		Trash2,
		Upload,
		UserRound,
		X
	} from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Form from '$lib/components/ui/form/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import ValidationChecklist from './validation-checklist.svelte';
	import { superForm } from 'sveltekit-superforms';
	import { characterSchema } from '$lib/zod/schema';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { invalidateAll } from '$app/navigation';
	import Label from './ui/label/label.svelte';
	import { toast } from 'svelte-sonner';
	import Spinner from './ui/spinner/spinner.svelte';

	let { data, params, supabase, session } = $props();

	type Character = {
		id: string;
		name: string;
		summary: string;
		image_url?: string;
		category: 'human' | 'non-human';
	};

	let characters = $derived<Character[]>(data.characters || []);
	let isFormOpen = $state(false);
	let editingCharacter = $state<Character | null>(null);
	let imagePreview = $state<string | null>(null);
	let isUploadingImage = $state(false);
	let imageTimestamp = $state(Date.now());

	// Search and sort state
	let searchQuery = $state('');
	let sortBy = $state<'name' | 'category'>('name');

	const form = superForm(data.form, {
		validators: zod4Client(characterSchema),
		dataType: 'json',
		resetForm: true,
		onUpdated: ({ form }) => {
			if (form.valid) {
				const action = editingCharacter ? 'updated' : 'created';
				toast.success(`Character ${action} successfully!`);
				isFormOpen = false;
				imagePreview = null;
				editingCharacter = null;
				invalidateAll(); // Refresh the character list
			}
		}
	});

	const { form: formData, errors, enhance, delayed } = form;

	// Filtered and sorted characters
	let filteredCharacters = $derived.by(() => {
		const items = characters ?? [];
		let filtered = items.filter(
			(char) =>
				char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				char.summary.toLowerCase().includes(searchQuery.toLowerCase())
		);

		return filtered.sort((a, b) => {
			if (sortBy === 'name') {
				return a.name.localeCompare(b.name);
			} else {
				return a.category.localeCompare(b.category);
			}
		});
	});

	const MIN_CHARACTERS = 2;

	const validationChecks = $derived.by(
		(): Array<{
			label: string;
			status: 'complete' | 'incomplete' | 'warning';
			description: string;
		}> => {
			const humanChars = characters.filter((c: any) => c.category === 'human').length;
			const nonHumanChars = characters.filter((c: any) => c.category === 'non-human').length;
			const charsWithoutImages = characters.filter((c: any) => !c.image_url).length;

			return [
				{
					label: `At least ${MIN_CHARACTERS} characters`,
					status: (characters.length >= MIN_CHARACTERS ? 'complete' : 'incomplete') as
						| 'complete'
						| 'incomplete',
					description: `Required (${characters.length} created)`
				},
				{
					label: 'Both human and non-human',
					status: (characters.length >= MIN_CHARACTERS && humanChars > 0 && nonHumanChars > 0
						? 'complete'
						: characters.length >= MIN_CHARACTERS
							? 'warning'
							: 'incomplete') as 'complete' | 'incomplete' | 'warning',
					description: 'Recommended for variety'
				},
				{
					label: 'Character images',
					status: (charsWithoutImages === 0 ? 'complete' : 'warning') as 'complete' | 'warning',
					description:
						charsWithoutImages > 0
							? `${charsWithoutImages} missing image${charsWithoutImages > 1 ? 's' : ''}`
							: 'All characters have images'
				}
			];
		}
	);

	const openCreateForm = () => {
		editingCharacter = null;
		imagePreview = null;
		$formData.id = undefined;
		$formData.name = '';
		$formData.summary = '';
		$formData.image_url = '';
		$formData.category = 'human';
		isFormOpen = true;
	};

	const openEditForm = (character: any) => {
		editingCharacter = character;
		$formData.id = character.id;
		$formData.name = character.name;
		$formData.summary = character.summary;
		$formData.image_url = character.image_url || '';
		$formData.category = character.category;
		imagePreview = character.image_url ? `${character.image_url}?t=${Date.now()}` : null;
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

		// Show preview immediately
		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview = e.target?.result as string;
		};
		reader.readAsDataURL(file);

		// Upload to Supabase
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
			const fileName = `${editingCharacter?.id || 'new'}-${Date.now()}.${fileExt}`;
			const filePath = `${session.user.id}/${params.id}/characters/${fileName}`;

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

	async function deleteCharacter(id: string) {
		if (!confirm('Are you sure you want to delete this character?')) return;

		const formData = new FormData();
		formData.append('characterId', id);

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			toast.success('Character deleted successfully!');
			invalidateAll();
		} else {
			toast.error('Failed to delete character');
		}
	}
</script>

<div class="mx-auto w-full flex-1">
	<div class="grid grid-cols-1 gap-2 lg:grid-cols-3">
		<!-- Main Content -->
		<div class="lg:col-span-2">
			<div class="space-y-6 rounded-lg border border-gray-300 bg-white p-6">
				<div class="mb-6">
					<h2 class="text-2xl font-semibold">Characters</h2>
					<p class="text-gray-600">
						Create characters that players can embody during the game. Each character offers a
						unique perspective on the story.
					</p>
				</div>
				<div class="flex gap-4">
					<Field.Field class="max-w-[320px]">
						<Field.Label for="search">Search Characters</Field.Label>
						<Input
							id="search"
							type="text"
							placeholder="Search by name or summary..."
							bind:value={searchQuery}
						/>
					</Field.Field>
					<Field.Field orientation="responsive" class="max-w-[180px]">
						<Field.Label for="sort">Sort By</Field.Label>
						<Select.Root type="single" bind:value={sortBy}>
							<Select.Trigger id="sort">
								{sortBy === 'name' ? 'Name' : 'Category'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="name">Name</Select.Item>
								<Select.Item value="category">Category</Select.Item>
							</Select.Content>
						</Select.Root>
					</Field.Field>
				</div>

				<!-- Character Grid -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					<!-- Add Character Card -->
					<button
						onclick={openCreateForm}
						class="group flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-6 transition-all hover:cursor-pointer hover:border-primary hover:bg-gray-50"
					>
						<div
							class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 transition-colors group-hover:bg-primary/10"
						>
							<Plus class="h-8 w-8 text-gray-400 transition-colors group-hover:text-primary" />
						</div>
						<span class="font-medium text-gray-600 transition-colors group-hover:text-primary"
							>Add New Character</span
						>
					</button>

					<!-- Character Cards -->
					{#each filteredCharacters as character (character.id)}
						<div
							class="group flex aspect-[3/4] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg"
						>
							<!-- Character Image -->
							<div
								class="relative aspect-video h-1/2 min-h-2/5 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200"
							>
								{#if character.image_url}
									<img
										src={`${character.image_url}?t=${imageTimestamp}`}
										alt="{character.name} avatar"
										class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
									/>
								{:else}
									<div class="flex h-full w-full items-center justify-center">
										<UserRound class="h-16 w-16 text-gray-300" />
									</div>
								{/if}
								<!-- Category Badge -->
								<div class="absolute top-3 right-3">
									<span
										class="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur-sm"
									>
										{character.category === 'human' ? 'Human' : 'Non-Human'}
									</span>
								</div>
							</div>

							<!-- Character Content -->
							<div class="flex flex-1 flex-col p-4">
								<!-- Character Name -->
								<h3 class="text-lg leading-tight font-bold text-balance break-words text-gray-900">
									{character.name}
								</h3>

								<!-- Character Summary -->
								<p
									class="line-clamp-3 flex-1 overflow-scroll py-2 text-sm leading-relaxed break-words text-gray-600"
								>
									{character.summary}
								</p>

								<!-- Action Buttons -->
								<div class="mt-4 flex gap-2">
									<Button
										variant="outline"
										size="sm"
										class="flex-1 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
										onclick={() => deleteCharacter(character.id)}
									>
										<Trash2 class="h-3.5 w-3.5" />
									</Button>
									<Button
										variant="default"
										size="sm"
										class="flex-[2]"
										onclick={() => openEditForm(character)}
									>
										<SquarePen class="mr-1.5 h-3.5 w-3.5" />
										Edit
									</Button>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Empty State -->
				{#if filteredCharacters.length === 0 && characters.length > 0}
					<div class="py-12 text-center">
						<p class="text-gray-500">No characters found matching "{searchQuery}"</p>
					</div>
				{/if}

				{#if filteredCharacters.length === 0 && characters.length === 0}
					<div class="py-12 text-center">
						<p class="text-gray-500">
							No characters yet. Create your first character to get started!
						</p>
					</div>
				{/if}

				<div class="mt-8 flex w-full justify-end gap-4">
					<Button variant="outline" size="lg" href={`/dashboard/games/${params.id}/edit/general`}>
						<ArrowLeft /> Back
					</Button>
					<Button size="lg" href={`/dashboard/games/${params.id}/edit/pois`}
						>Next <ArrowRight /></Button
					>
				</div>
			</div>
		</div>

		<!-- Validation Checklist Sidebar -->
		<div class="">
			<ValidationChecklist title="Validation Checklist" checks={validationChecks} />
		</div>
	</div>
</div>

<Sheet.Root bind:open={isFormOpen}>
	<Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-lg">
		<Sheet.Header>
			<Sheet.Title>{editingCharacter ? 'Edit Character' : 'Create New Character'}</Sheet.Title>
			<Sheet.Description>
				{editingCharacter
					? 'Update the character details below.'
					: 'Fill in the details to create a new character for your game.'}
			</Sheet.Description>
		</Sheet.Header>

		<form
			method="POST"
			action="?/{editingCharacter ? 'update' : 'create'}"
			use:enhance
			class="space-y-6 p-4"
		>
			<Input type="hidden" name="id" bind:value={$formData.id} />

			<!-- Character Avatar -->
			<Form.Field {form} name="image_url">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="font-bold">Character Avatar</Form.Label>
						<Form.Description>Upload an image for the character</Form.Description>
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
								<p class="mt-2 text-sm text-gray-600">Click to upload avatar</p>
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
						<input type="hidden" {...props} bind:value={$formData.image_url} />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Character Name -->
			<Form.Field {form} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="font-bold">Character Name</Form.Label>
						<Form.Description>The name of the character</Form.Description>
						<Input {...props} bind:value={$formData.name} placeholder="e.g., Species name" />
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Summary -->
			<Form.Field {form} name="summary">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="font-bold">Character Summary</Form.Label>
						<Form.Description>A brief description of the character</Form.Description>
						<Textarea
							{...props}
							bind:value={$formData.summary}
							rows={4}
							placeholder="Describe the character's background, personality, and role in the story..."
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<!-- Category -->
			<Form.Field {form} name="category">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label class="font-bold">Category</Form.Label>
						<Form.Description>Select the character type</Form.Description>
						<Select.Root type="single" bind:value={$formData.category}>
							<Select.Trigger {...props} class="w-full">
								{$formData.category === 'human' ? 'Human' : 'Non-Human'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="human">Human</Select.Item>
								<Select.Item value="non-human">Non-Human</Select.Item>
							</Select.Content>
						</Select.Root>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>

			<Sheet.Footer class="flex flex-row justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (isFormOpen = false)}>Cancel</Button>
				<Button type="submit" disabled={$delayed}>
					{#if $delayed}
						<span class="flex items-center gap-2">
							<Spinner />
							Saving...
						</span>
					{:else}
						{editingCharacter ? 'Update Character' : 'Create Character'}
					{/if}
				</Button>
			</Sheet.Footer>
		</form>
	</Sheet.Content>
</Sheet.Root>
